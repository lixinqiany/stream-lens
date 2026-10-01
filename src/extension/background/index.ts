import { defaults, httpUrl, originPattern, activeStates, clearableStates, runningStates, safeFilename, type DownloadRecord, type MediaAsset, type PageCatalog, type Preferences, type Snapshot, type VideoEvidence } from '../../core/model';
import { mergeEvidence, protocolFor } from '../../core/discovery/catalog';
import {playerKey, selectedAssets} from '../../core/discovery/selection';
import {biliEndpoint,biliPlayEndpoint,isBiliEndpoint,parseBiliPlayResponse} from '../../core/sites/bilibili';
import { allowedFetch, PermissionError } from '../../core/hls/fetch';
import {ResolutionCache} from '../../core/discovery/resolution';
import { parseHls } from '../../core/hls/parser';
import {renewedHlsUrl} from '../../core/hls/refresh';
import { getPage, getPreferences, getTasks, mutateTasks, patchTask, setPage } from '../../platform/repository';
import type { ContentMessage, PlayerCommand, PlayerResolveResult, Response, RunnerMessage, UiCommand, WorkerMessage, SaveCommand, SaveRequest } from '../../platform/messages';

import {checkDestination,forgetDestination} from '../../platform/destination';

const ownOrigin=chrome.runtime.getURL('');
const offscreenUrl=chrome.runtime.getURL('offscreen.html');
let offscreenCreation:Promise<void>|undefined;
let pageQueue=Promise.resolve();
let startQueue=Promise.resolve();
let hostQueue=Promise.resolve();
let headerQueue=Promise.resolve();
const downloadJobs=new Set<number>();
const resolutionCache=new ResolutionCache<MediaAsset>();
const frameDocuments=new Map<string,string>();

chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true}).catch(()=>{});
chrome.runtime.onInstalled.addListener(()=>{void initialize();});
chrome.runtime.onStartup.addListener(()=>{void initialize();});
async function initialize() {
  await chrome.storage.local.set({schemaVersion:1});
  await syncHosts();
  const tasks=await getTasks();
  for(const task of tasks) {
    if(task.downloadId){await updateDownload(task.downloadId);continue;}
    if(activeStates.includes(task.state)) await patchTask(task.id,{state:'failed',error:'浏览器已重启。重新下载会从头开始。',speed:0,outputUrl:undefined});
  }
}
async function syncHosts() {
  const operation=hostQueue.then(syncHostsNow);hostQueue=operation.then(()=>{},()=>{});return operation;
}
async function syncHostsNow() {
  const permissions=await chrome.permissions.getAll();
  const matches=(permissions.origins||[]).filter(p=>/^https?:\/\//.test(p));
  const registered=await chrome.scripting.getRegisteredContentScripts();
  const old=registered.filter(s=>s.id==='stream-lens'||s.id==='stream-lens-probe').map(s=>s.id);
  if(old.length)await chrome.scripting.unregisterContentScripts({ids:old});
  if(matches.length)await chrome.scripting.registerContentScripts([
    {id:'stream-lens-probe',matches,js:['probe.js'],world:'MAIN',allFrames:true,runAt:'document_start',persistAcrossSessions:true},
    {id:'stream-lens',matches,js:['content.js'],allFrames:true,runAt:'document_idle',persistAcrossSessions:true},
  ]);
  for(const task of await getTasks())if(task.neededOrigins?.length&&await chrome.permissions.contains({origins:task.neededOrigins}))await patchTask(task.id,{neededOrigins:undefined});
  await ensureBiliHeaders();
}
async function ensureBiliHeaders() {
  if(!chrome.declarativeNetRequest)return;
  const operation=headerQueue.then(async()=>{
  const rule:chrome.declarativeNetRequest.Rule={
    id:1001,priority:1000,action:{type:chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,requestHeaders:[{header:'Referer',operation:chrome.declarativeNetRequest.HeaderOperation.SET,value:'https://www.bilibili.com/'}]},
    condition:{initiatorDomains:[chrome.runtime.id],requestDomains:['bilibili.com','bilivideo.com'],resourceTypes:[chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST]},
  };
  const existing=(await chrome.declarativeNetRequest.getSessionRules()).find(r=>r.id===1001);
  if(existing&&existing.priority===rule.priority&&existing.action.requestHeaders?.some(h=>h.header.toLowerCase()==='referer'&&h.value==='https://www.bilibili.com/')&&existing.condition.initiatorDomains?.[0]===chrome.runtime.id&&existing.condition.requestDomains?.join(',')==='bilibili.com,bilivideo.com'&&existing.condition.resourceTypes?.join(',')==='xmlhttprequest')return;
  await chrome.declarativeNetRequest.updateSessionRules({removeRuleIds:[1001],addRules:[rule]});
  });
  headerQueue=operation.then(()=>{},()=>{});await operation;
}
chrome.permissions.onRemoved.addListener(()=>{void syncHosts();});
chrome.permissions.onAdded.addListener(()=>{void syncHosts();});
chrome.tabs.onRemoved.addListener(tabId=>{void chrome.storage.session.remove('page:'+tabId);});
chrome.webRequest.onBeforeRequest.addListener(details=>{
  if(details.tabId>=0&&details.type==='main_frame') {
    for(const key of frameDocuments.keys())if(key.startsWith(details.tabId+':'))frameDocuments.delete(key);
    pageQueue=pageQueue.then(()=>chrome.storage.session.remove('page:'+details.tabId)).then(()=>{}).catch(()=>{});
  }
},{urls:['http://*/*','https://*/*'],types:['main_frame']});
chrome.tabs.onUpdated.addListener((tabId,change,tab)=>{
  if(change.status==='loading'||change.url) {
    pageQueue=pageQueue.then(async()=>{
      const old=await getPage(tabId);
      if(old&&old.pageUrl!==tab.url) await chrome.storage.session.remove('page:'+tabId);
    }).catch(()=>{});
  }
});

chrome.webRequest.onHeadersReceived.addListener(details=>{
  if(details.tabId<0)return;
  const contentType=details.responseHeaders?.find(h=>h.name.toLowerCase()==='content-type')?.value||'';
  if(!protocolFor(details.url,contentType))return;
  const size=Number(details.responseHeaders?.find(h=>h.name.toLowerCase()==='content-length')?.value)||undefined;
  pageQueue=pageQueue.then(async()=>{
    const tab=await chrome.tabs.get(details.tabId).catch(()=>undefined);if(!tab?.url)return;
    const expected=frameDocuments.get(details.tabId+':'+details.frameId);
    const documentId=(details as typeof details & {documentId?:string}).documentId;
    if(expected&&documentId&&expected!==documentId)return;
    const page=await getPage(details.tabId)||{pageUrl:tab.url,assets:[],documentKey:'',updatedAt:Date.now()};
    page.assets=mergeEvidence(page.assets,{url:details.url,title:tab.title||'页面视频',pageUrl:tab.url,width:0,height:0,playing:false,primary:false,protected:false,source:'network',contentType,size});
    page.updatedAt=Date.now();await setPage(details.tabId,page);
  }).catch(()=>{});
},{urls:['http://*/*','https://*/*']},['responseHeaders']);

async function acceptEvidence(message:ContentMessage,sender:chrome.runtime.MessageSender) {
  const tabId=sender.tab?.id;if(tabId===undefined||!httpUrl(sender.url)||!Array.isArray(message.evidence))return;
  if(!await chrome.permissions.contains({origins:[originPattern(sender.url!)]}))return;
  const tab=await chrome.tabs.get(tabId);if(!httpUrl(tab.url))return;
  if(sender.frameId===0&&sender.url!==tab.url)return;
  if(sender.documentId)frameDocuments.set(tabId+':'+sender.frameId,sender.documentId);
  const page=await getPage(tabId)||{pageUrl:tab.url!,assets:[],documentKey:sender.documentId||'',updatedAt:Date.now()};
  for(const raw of message.evidence.slice(0,100)) {
    if(!raw||typeof raw!=='object'||typeof raw.title!=='string')continue;
    const url=httpUrl(raw.url);if(!url)continue;
    const evidence:VideoEvidence={url,title:raw.title.slice(0,300),pageUrl:tab.url!,poster:httpUrl(raw.poster),width:Math.max(0,Number(raw.width)||0),height:Math.max(0,Number(raw.height)||0),duration:Number.isFinite(raw.duration)?raw.duration:undefined,
      playerId:typeof raw.playerId==='string'&&raw.playerId.length<=100?playerKey(sender.documentId,sender.frameId,raw.playerId):undefined,
      sourceKey:typeof raw.sourceKey==='string'&&raw.sourceKey.length<=16000?raw.sourceKey:undefined,format:raw.format==='DASH'?'DASH':undefined,
      contentType:raw.format==='DASH'?'video/mp4':undefined,
      playing:raw.playing===true,primary:sender.frameId===0&&raw.primary===true,protected:raw.protected===true,source:['player','network','script'].includes(raw.source)?raw.source:'player'};
    page.assets=mergeEvidence(page.assets,evidence);
  }
  const player=message.player;
  if(player&&typeof player.playerId==='string'&&player.playerId.length<=100&&typeof player.sourceKey==='string'&&player.sourceKey.length<=16000&&typeof player.title==='string'&&Number.isFinite(player.selectedAt)) {
    const playerId=playerKey(sender.documentId,sender.frameId,player.playerId);
    if((message.select===true&&player.selectedAt>=(page.selection?.selectedAt||0))||page.selection?.playerId===playerId) {
      if(page.selection?.playerId!==playerId||page.selection?.sourceKey!==player.sourceKey){page.shortcutError=undefined;page.assets=page.assets.map(a=>a.playerBindings?.some(b=>b.playerId===playerId&&b.sourceKey===player.sourceKey)?{...a,variants:undefined,resolutionState:undefined,resolutionError:undefined,resolutionOrigins:undefined}:a);}
      page.selection={playerId,sourceKey:player.sourceKey,title:player.title.slice(0,300),playing:player.playing===true,selectedAt:player.selectedAt};
    }
  }
  page.pageUrl=tab.url!;page.updatedAt=Date.now();await setPage(tabId,page);
  const count=page.selection?selectedAssets(page.assets,page.selection).length:page.assets.filter(a=>!a.suspectedAd).length;
  await chrome.action.setBadgeText({tabId,text:count?String(count):''});
  await chrome.action.setBadgeBackgroundColor({color:'#527ae5'});
  if(page.selection){const selection=page.selection;for(const asset of selectedAssets(page.assets,selection).slice(0,3))if(!asset.protected&&(!asset.resolutionState||(asset.resolutionState==='loading'&&!resolutionCache.hasPending(resolutionKey(tabId,page,asset.id)))))void resolveAsset(tabId,asset.id).catch(()=>{});}
}
async function scan(tabId:number,retryPermissions=false) {
  const tab=await chrome.tabs.get(tabId);if(!httpUrl(tab.url))throw new Error('此浏览器页面无法读取，请打开普通网页');
  if(!await chrome.permissions.contains({origins:[originPattern(tab.url!)]}))throw new Error('请先允许访问当前站点');
  await chrome.scripting.executeScript({target:{tabId,allFrames:true},world:'MAIN',files:['probe.js']});
  await chrome.scripting.executeScript({target:{tabId,allFrames:true},files:['content.js']});
  if(retryPermissions){const operation=pageQueue.then(async()=>{const page=await getPage(tabId);if(page){delete page.shortcutError;page.assets=page.assets.map(a=>a.resolutionState==='failed'?{...a,resolutionState:undefined,resolutionError:undefined,resolutionOrigins:undefined}:a);await setPage(tabId,page);}});pageQueue=operation.catch(()=>{});await operation;}
  await chrome.tabs.sendMessage(tabId,{type:'CONTENT_SCAN',retryPermissions}).catch(()=>{});
}
function resolutionIdentity(page:NonNullable<Awaited<ReturnType<typeof getPage>>>){return JSON.stringify([page.documentKey,page.pageUrl,page.selection?.playerId,page.selection?.sourceKey]);}
function resolutionKey(tabId:number,page:NonNullable<Awaited<ReturnType<typeof getPage>>>,assetId:string){return tabId+'|'+resolutionIdentity(page)+'|'+assetId;}
async function resolveAsset(tabId:number,assetId:string,force=false):Promise<MediaAsset> {
  const page=await getPage(tabId);const asset=page?.assets.find(a=>a.id===assetId);if(!page||!asset)throw new Error('视频已变化，请重新选择');
  const identity=resolutionIdentity(page);
  const result=await resolutionCache.get(resolutionKey(tabId,page,asset.id),()=>resolveAssetNow(tabId,assetId,identity),force);
  if(asset.resolutionState!=='ready')await patchResolution(tabId,assetId,identity,{variants:result.variants,duration:result.duration,resolutionState:'ready',resolutionError:undefined,resolutionOrigins:undefined,resolvedAt:result.resolvedAt});
  return result;
}
async function resolveAssetNow(tabId:number,assetId:string,identity:string):Promise<MediaAsset> {
  const page=await getPage(tabId);const asset=page?.assets.find(a=>a.id===assetId);if(!asset||!page||resolutionIdentity(page)!==identity)throw new Error('该页面资源已变化，请重新检测');
  if(asset.protected)throw new Error('此视频受保护，无法保存');
  await patchResolution(tabId,assetId,identity,{resolutionState:'loading',resolutionError:undefined,resolutionOrigins:undefined});
  try{
  if(asset.protocol==='DASH') {
    await ensureBiliHeaders();
    let endpoint=isBiliEndpoint(asset.pageUrl,asset.url)?asset.url:biliEndpoint(asset.pageUrl);if(!endpoint)throw new Error('本版暂不支持此站点的 DASH 视频');
    async function json(url:string){const fetched=await allowedFetch(url,{limit:5_000_000});return JSON.parse(new TextDecoder().decode(fetched.data));}
    if(endpoint.includes('/pgc/view/web/season')) {
      const season=await json(endpoint);if(season.code!==0)throw new Error('无法读取番剧分集信息，请在网页正常播放后重试');
      const binding=asset.playerBindings;
      const related=page!.assets.filter(a=>a.id===asset.id||a.playerBindings?.some(b=>binding?.some(s=>s.playerId===b.playerId&&s.sourceKey===b.sourceKey)));
      const cids=related.map(a=>a.url.match(/\/upgcxcode\/\d+\/\d+\/(\d+)\//)?.[1]).filter(Boolean);
      const episodes=season.result?.episodes||[];
      const episode=episodes.find((e:any)=>cids.includes(String(e.cid)));
      if(!Number.isSafeInteger(episode?.id)||episode.id<=0)throw new Error('尚未确认当前播放的集数，请刷新网页，再点击视频画面或播放按钮后重试');
      endpoint=biliEndpoint(asset.pageUrl,episode.id)!;
    }
    if(endpoint.includes('/x/web-interface/view')) {
      const view=await json(endpoint);if(view.code!==0)throw new Error('无法读取视频信息，请在网页正常播放后重试');
      const p=Number(new URL(asset.pageUrl).searchParams.get('p')||1);const cid=view.data?.pages?.[p-1]?.cid||view.data?.cid;
      if(!Number.isSafeInteger(cid)||cid<=0)throw new Error('视频分集信息无效');
      endpoint=biliPlayEndpoint(view.data.bvid,cid);
    }
    const parsed=parseBiliPlayResponse(await json(endpoint));asset.variants=parsed.variants;asset.duration=parsed.duration;
  } else if(asset.protocol==='HLS') {
    const fetched=await allowedFetch(asset.url,{limit:5_000_000});
    const playlist=parseHls(new TextDecoder().decode(fetched.data),fetched.url);
    if(playlist.type==='master') {
      const variants=playlist.variants.filter(v=>!v.audioGroup||!playlist.externalAudio.includes(v.audioGroup));
      if(!variants.length)throw new Error('此视频需要独立音轨合并，本版暂不支持');
      asset.variants=variants.map((v,i)=>({...v,id:'variant-'+i,label:v.height?`${v.height}p`:v.bandwidth?`${(v.bandwidth/1e6).toFixed(1)} Mbps`:'原始画质'}));
    } else {
      if(!playlist.ended)throw new Error('当前为直播视频，本版只支持点播下载');
      if(playlist.discontinuity)throw new Error('此视频含时间线切换，本版暂不支持合并');
      asset.variants=[{id:'original',url:fetched.url,label:asset.height?`${asset.height}p · 当前源`:'原始画质'}];asset.duration=playlist.duration;
    }
  } else asset.variants=[{id:'original',url:asset.url,label:asset.height?`${asset.height}p`:'原始文件'}];
  const resolvedAt=Date.now();
  await pageQueue;
  await patchResolution(tabId,assetId,identity,{variants:asset.variants,duration:asset.duration,resolutionState:'ready',resolutionError:undefined,resolutionOrigins:undefined,resolvedAt});
  return {...asset,resolutionState:'ready',resolutionError:undefined,resolutionOrigins:undefined,resolvedAt};
  }catch(error){await patchResolution(tabId,assetId,identity,{resolutionState:'failed',resolutionError:errorText(error),resolutionOrigins:error instanceof PermissionError?error.origins:undefined});throw error;}
}
async function patchResolution(tabId:number,assetId:string,identity:string,patch:Partial<MediaAsset>){
  const operation=pageQueue.then(async()=>{const current=await getPage(tabId);if(!current||identity!==resolutionIdentity(current))return;current.assets=current.assets.map(a=>a.id===assetId?{...a,...patch}:a);await setPage(tabId,current);});pageQueue=operation.catch(()=>{});await operation;
}
async function ensureRunner() {
  if(await chrome.offscreen.hasDocument())return;
  if(!offscreenCreation)offscreenCreation=chrome.offscreen.createDocument({url:'offscreen.html',reasons:[chrome.offscreen.Reason.BLOBS],justification:'下载视频并写入临时文件，生成 Blob 或写入用户选择的位置，关闭侧栏后继续处理'}).finally(()=>{offscreenCreation=undefined;});
  await offscreenCreation;
}
async function tellRunner(message:RunnerMessage) {
  const response=await chrome.runtime.sendMessage(message);
  if(response?.ok!==true)throw new Error(response?.error||'后台视频处理未响应');
  return response;
}
async function openSaveRequest(request:SaveRequest) {
  const stored=await chrome.storage.session.get(null);
  for(const [key,value] of Object.entries(stored)){
    if(!key.startsWith('save:'))continue;
    const old=value as SaveRequest;
    const same=old.retryId?old.retryId===request.retryId:!request.retryId&&old.tabId===request.tabId&&old.assetId===request.assetId&&old.variantId===request.variantId&&old.expectedPlayer?.source===request.expectedPlayer?.source;
    if(!old.result&&same&&Date.now()-old.createdAt<30*60*1000&&old.windowId!==undefined){
      try{await chrome.windows.update(old.windowId,{state:'normal',focused:true});return {id:key.slice(5),duplicate:false,pending:true};}
      catch{await chrome.storage.session.remove(key);}
    }
  }
  const requestId=crypto.randomUUID();
  await chrome.storage.session.set({['save:'+requestId]:request});
  try {const window=await chrome.windows.create({url:chrome.runtime.getURL('save.html')+'?request='+requestId,type:'popup',width:600,height:390,focused:true});await chrome.storage.session.set({['save:'+requestId]:{...request,windowId:window.id}});}
  catch(error){await chrome.storage.session.remove('save:'+requestId);throw error;}
  return {id:requestId,duplicate:false,pending:true};
}
async function handleSave(command:SaveCommand) {
  if(!/^[a-zA-Z0-9-]{1,80}$/.test(command.requestId))throw new Error('保存请求无效');
  const key='save:'+command.requestId;
  const request=(await chrome.storage.session.get(key))[key] as SaveRequest|undefined;
  if(command.type==='SAVE_CANCEL'){
    const operation=startQueue.then(async()=>{const current=(await chrome.storage.session.get(key))[key] as SaveRequest|undefined;if(!current?.result){await chrome.storage.session.remove(key);if(current?.windowId!==undefined)await chrome.windows.remove(current.windowId).catch(()=>{});}});startQueue=operation.then(()=>{},()=>{});return operation;
  }
  if(!request||(!request.result&&Date.now()-request.createdAt>30*60*1000))throw new Error('保存请求已过期，请重新下载');
  if(command.type==='SAVE_INFO')return request;
  if(command.type==='SAVE_FOCUS'){if(request.windowId===undefined)throw new Error('保存窗口已关闭，请重新下载');await chrome.windows.update(request.windowId,{state:'normal',focused:true});return;}
  if(request.result)return request.result;
  if(!/^[a-zA-Z0-9-]{1,80}$/.test(command.destinationId)||!command.filename||command.filename.length>255||/[\\/\x00-\x1f]/.test(command.filename))throw new Error('保存文件名无效');
  if(!command.filename.toLowerCase().endsWith(request.filename.toLowerCase().endsWith('.webm')?'.webm':'.mp4'))throw new Error('请保留视频文件扩展名');
  const destination={id:command.destinationId,filename:command.filename};
  const operation=startQueue.then(async()=>{
    // A repeated commit (including a lost response) must never launch twice.
    const latest=(await chrome.storage.session.get(key))[key] as SaveRequest|undefined;
    if(!latest)throw new Error('保存请求已取消');if(latest.result)return latest.result;
    const result=await (async()=>{
    if(request.retryId){const retry=(await getTasks()).find(t=>t.id===request.retryId);if(retry&&activeStates.includes(retry.state)&&retry.destinationId===destination.id)return {id:retry.id,duplicate:false};if(!retry||!['failed','cancelled'].includes(retry.state))throw new Error('任务状态已变化，请返回下载任务');return await taskCommand(request.retryId,'retry',destination)||{id:request.retryId,duplicate:false};}
    const tab=await chrome.tabs.get(request.tabId);
    if(tab.url!==request.pageUrl)throw new Error('页面已切换，请重新选择视频');
    return startTask(request.tabId,request.assetId,request.variantId,request.name,request.expectedPlayer,destination);
    })();
    await chrome.storage.session.set({[key]:{...request,result}});return result;
  });
  startQueue=operation.then(()=>{},()=>{});
  return operation;
}
chrome.windows.onRemoved.addListener(windowId=>{
  const operation=startQueue.then(async()=>{const stored=await chrome.storage.session.get(null);for(const [key,value] of Object.entries(stored))if(key.startsWith('save:')&&(value as SaveRequest).windowId===windowId)await chrome.storage.session.remove(key);});startQueue=operation.then(()=>{},()=>{});
});
async function pendingSaves(){
  const stored=await chrome.storage.session.get(null);const pending:NonNullable<Snapshot['pendingSaves']>=[];
  for(const [key,value] of Object.entries(stored)){
    if(!key.startsWith('save:'))continue;const request=value as SaveRequest;
    if(Date.now()-request.createdAt>30*60*1000&&!request.result){await chrome.storage.session.remove(key);if(request.windowId!==undefined)await chrome.windows.remove(request.windowId).catch(()=>{});continue;}
    if(!request.result)pending.push({id:key.slice(5),filename:request.filename,pageUrl:request.pageUrl,retryId:request.retryId});
  }
  return pending;
}
async function availableDestination(id:string,excludeTask?:string){
  const selected=await checkDestination(id);
  for(const task of await getTasks()){
    if(task.id===excludeTask||!task.destinationId||!activeStates.includes(task.state))continue;
    const other=await checkDestination(task.destinationId).catch(()=>undefined);
    if(other&&await selected.isSameEntry(other))throw new Error('此文件正在被另一个任务使用，请选择其他文件名');
  }
}
async function startTask(tabId:number,assetId:string,variantId?:string,name?:string,expectedPlayer?:{id:string;source:string},destination?:{id:string;filename:string}) {
  const asset=await resolveAsset(tabId,assetId,true);
  const variant=asset.variants?.find(v=>v.id===(variantId||asset.variants?.[0]?.id));if(!variant)throw new Error('请选择有效清晰度');
  const origins=[...new Set([variant.url,...variant.dash?[variant.dash.audio.url]:[]].map(originPattern))];
  const missing:string[]=[];for(const origin of origins)if(!await chrome.permissions.contains({origins:[origin]}))missing.push(origin);if(missing.length)throw new PermissionError(missing);
  const tasks=await getTasks();
  if(expectedPlayer){await pageQueue;const current=await getPage(tabId);if(current?.selection?.playerId!==expectedPlayer.id||current.selection.sourceKey!==expectedPlayer.source)throw new Error('视频已切换，请重新选择');}
  const duplicate=tasks.find(t=>t.url===variant.url&&activeStates.includes(t.state));if(duplicate)return{id:duplicate.id,duplicate:!destination||duplicate.destinationId!==destination.id};
  if((['HLS','DASH'].includes(asset.protocol)||destination||(await getPreferences()).saveAs)&&tasks.filter(t=>(['HLS','DASH'].includes(t.protocol)||t.destinationId)&&activeStates.includes(t.state)).length>=2)throw new Error('最多同时处理两个流式视频，请等待或取消其他任务');
  const extension=asset.protocol==='WEBM'?'webm':'mp4';
  const filename=safeFilename(name?.trim()||asset.title,variant.label.replace(/ · 当前源$/,''),extension);
  if(!destination&&(await getPreferences()).saveAs)return openSaveRequest({tabId,assetId,variantId:variant.id,name,filename,pageUrl:asset.pageUrl,expectedPlayer,createdAt:Date.now()});
  if(destination)await availableDestination(destination.id);
  const task:DownloadRecord={id:crypto.randomUUID(),assetId,title:asset.title,filename:destination?.filename||filename,destinationId:destination?.id,pageUrl:asset.pageUrl,url:variant.url,protocol:asset.protocol,dash:variant.dash,resolutionUrl:asset.protocol==='DASH'&&isBiliEndpoint(asset.pageUrl,asset.url)?asset.url:undefined,quality:variant.label,state:'resolving',createdAt:Date.now(),updatedAt:Date.now(),bytes:0,segments:0,speed:0};
  await mutateTasks(current=>({tasks:[task,...current],value:undefined}));
  try {
    if(['HLS','DASH'].includes(asset.protocol)||task.destinationId){await ensureRunner();await tellRunner({target:'runner',type:'RUN',task});}
    else {const downloadId=await chrome.downloads.download({url:variant.url,filename:task.filename,saveAs:false,conflictAction:'uniquify'});await patchTask(task.id,{downloadId,state:'downloading'});await updateDownload(downloadId);}
  }catch(error){await patchTask(task.id,{state:'failed',error:errorText(error)});if(destination)return {id:task.id,duplicate:false,failed:true};throw error;}
  return{id:task.id,duplicate:false};
}
function errorText(error:unknown) {return error instanceof Error?error.message:'操作失败，请重试';}
async function updateDownload(downloadId:number) {
  if(downloadJobs.has(downloadId))return;downloadJobs.add(downloadId);
  try {
    const [item]=await chrome.downloads.search({id:downloadId});if(!item)return;
    const task=(await getTasks()).find(t=>t.downloadId===downloadId);if(!task)return;
    if(task.state==='cancelled'&&item.state==='in_progress')return;
    const state=item.state==='complete'?'completed':item.state==='interrupted'?(task.state==='cancelled'||item.error==='USER_CANCELED'?'cancelled':'failed'):item.paused?'paused':['HLS','DASH'].includes(task.protocol)?'saving':'downloading';
    const bytes=['HLS','DASH'].includes(task.protocol)?task.bytes:item.bytesReceived;
    const totalBytes=item.totalBytes>0?item.totalBytes:undefined;
    if(task.state===state&&task.bytes===bytes&&task.totalBytes===totalBytes)return;
    const elapsed=Math.max(.001,(Date.now()-task.updatedAt)/1000);
    await patchTask(task.id,{state,bytes,totalBytes,speed:state==='downloading'?Math.max(0,(item.bytesReceived-task.bytes)/elapsed):0,error:state==='failed'?`文件保存失败：${item.error||'请重试'}`:undefined});
    if(['completed','failed','cancelled'].includes(state)&&['HLS','DASH'].includes(task.protocol)){await tellRunner({target:'runner',type:'RELEASE',id:task.id}).catch(()=>{});await patchTask(task.id,{outputUrl:undefined});}
  }finally{downloadJobs.delete(downloadId);}
}
chrome.downloads.onChanged.addListener(delta=>{void updateDownload(delta.id);});
chrome.alarms.create('reconcile',{periodInMinutes:1});
chrome.alarms.onAlarm.addListener(()=>{void getTasks().then(tasks=>Promise.all(tasks.filter(t=>t.downloadId&&activeStates.includes(t.state)).map(t=>updateDownload(t.downloadId!))));});

async function taskCommand(id:string,action:Extract<UiCommand,{type:'TASK'}>['action'],destination?:{id:string;filename:string}) {
  const task=(await getTasks()).find(t=>t.id===id);if(!task)throw new Error('下载记录不存在');
  if(action==='show'){if(task.downloadId===undefined||task.state!=='completed')throw new Error('文件尚未保存');await chrome.downloads.show(task.downloadId);return;}
  if(action==='source'){if(httpUrl(task.pageUrl))await chrome.tabs.create({url:task.pageUrl});return;}
  if(action==='retry') {
    if(!['failed','cancelled'].includes(task.state))return;
    if(!destination&&(task.destinationId||(await getPreferences()).saveAs))return openSaveRequest({tabId:-1,assetId:task.assetId,filename:task.filename,pageUrl:task.pageUrl,retryId:id,createdAt:Date.now()});
    if(destination)await availableDestination(destination.id);
    if((['HLS','DASH'].includes(task.protocol)||destination)&&(await getTasks()).filter(t=>(['HLS','DASH'].includes(t.protocol)||t.destinationId)&&activeStates.includes(t.state)).length>=2)throw new Error('请先结束其他流式下载');
    if(!await chrome.permissions.contains({origins:[originPattern(task.url)]}))throw new PermissionError([originPattern(task.url)]);
    let refreshed:Partial<DownloadRecord>={};
    if(task.protocol==='HLS'&&/410/.test(task.error||''))refreshed={url:await refreshHls(task)};
    if(task.protocol==='DASH'&&biliEndpoint(task.pageUrl)){
      await ensureBiliHeaders();
      const endpoint=task.resolutionUrl&&isBiliEndpoint(task.pageUrl,task.resolutionUrl)?task.resolutionUrl:biliEndpoint(task.pageUrl)!;
      if(endpoint.includes('/pgc/view/web/season')||endpoint.includes('/x/web-interface/view'))throw new Error('请回到来源页面重新选择当前视频，获取新的下载地址');
      const data=await allowedFetch(endpoint,{limit:5_000_000});
      const parsed=parseBiliPlayResponse(JSON.parse(new TextDecoder().decode(data.data)));
      const variant=parsed.variants.find(v=>v.label===task.quality);
      if(!variant)throw new Error(`当前账号未返回原来的 ${task.quality}，请在来源页面重新选择可用清晰度`);
      refreshed={url:variant.url,dash:variant.dash,resolutionUrl:endpoint};
      if(!await chrome.permissions.contains({origins:[originPattern(variant.url),originPattern(variant.dash!.audio.url)]}))throw new PermissionError([originPattern(variant.url),originPattern(variant.dash!.audio.url)]);
    }
    const reset:DownloadRecord={...task,...refreshed,destinationId:destination?.id,filename:destination?.filename||task.filename,state:'resolving',bytes:0,segments:0,totalSegments:undefined,totalBytes:undefined,downloadId:undefined,error:undefined,neededOrigins:undefined,speed:0,updatedAt:Date.now()};
    await patchTask(id,reset);
    if(task.destinationId&&task.destinationId!==reset.destinationId)await forgetDestination(task.destinationId).catch(()=>{});
    if(['HLS','DASH'].includes(task.protocol)||reset.destinationId){try{await ensureRunner();await tellRunner({target:'runner',type:'RUN',task:reset});}catch(error){await patchTask(id,{state:'failed',error:errorText(error)});if(destination)return {id,duplicate:false,failed:true};throw error;}}
    else{try{const downloadId=await chrome.downloads.download({url:task.url,filename:task.filename,saveAs:false,conflictAction:'uniquify'});await patchTask(id,{downloadId,state:'downloading'});await updateDownload(downloadId);}catch(error){await patchTask(id,{state:'failed',error:errorText(error)});if(destination)return {id,duplicate:false,failed:true};throw error;}}
    return;
  }
  if(!activeStates.includes(task.state))return;
  if(task.destinationId&&task.state==='saving')throw new Error('文件正在保存，请稍候');
  if(task.downloadId){if(action==='pause')await chrome.downloads.pause(task.downloadId);if(action==='resume')await chrome.downloads.resume(task.downloadId);if(action==='cancel'){await patchTask(id,{state:'cancelled'});await chrome.downloads.cancel(task.downloadId);}await updateDownload(task.downloadId);}
  else if(['HLS','DASH'].includes(task.protocol)||task.destinationId) {
    if(action==='cancel'){
      const accepted=await mutateTasks(tasks=>{const current=tasks.find(t=>t.id===id);const accepted=!!current&&activeStates.includes(current.state)&&!(current.destinationId&&current.state==='saving');return {tasks:tasks.map(t=>t.id===id&&accepted?{...t,state:'cancelled',speed:0,updatedAt:Date.now()}:t),value:accepted};});
      if(!accepted)throw new Error('文件正在保存，请稍候');
    }
    if(!await chrome.offscreen.hasDocument()){if(action==='cancel')return;await patchTask(id,{state:'failed',error:'后台任务已中断，请从头重试'});return;}
    await tellRunner({target:'runner',type:'CONTROL',id,action});
  }
}
async function refreshHls(task:DownloadRecord):Promise<string>{
  const page=await allowedFetch(task.pageUrl,{limit:5_000_000,cache:'no-store'});
  return renewedHlsUrl(new TextDecoder().decode(page.data),task.url);
}
async function handleUi(command:UiCommand):Promise<unknown> {
  switch(command.type) {
    case 'SAVE_FOCUS':case 'SAVE_CANCEL':return handleSave(command);
    case 'SNAPSHOT':{const saves=await pendingSaves();await pageQueue;const tasks=await getTasks();await Promise.all(tasks.filter(t=>t.downloadId&&activeStates.includes(t.state)).map(t=>updateDownload(t.downloadId!)));return {page:await getPage(command.tabId),tasks:await getTasks(),preferences:await getPreferences(),pendingSaves:saves} satisfies Snapshot;}
    case 'SCAN':await scan(command.tabId,command.retryPermissions);return;
    case 'SYNC_HOSTS':await syncHosts();return;
    case 'RESOLVE':return resolveAsset(command.tabId,command.assetId,true);
    case 'START':{
      const operation=startQueue.then(()=>startTask(command.tabId,command.assetId,command.variantId,command.filename));startQueue=operation.then(()=>{},()=>{});return operation;
    }
    case 'TASK':{
      if(command.action!=='retry')return taskCommand(command.id,command.action);
      const operation=startQueue.then(()=>taskCommand(command.id,command.action));startQueue=operation.then(()=>{},()=>{});return operation;
    }
    case 'CLEAR':{const removed=await mutateTasks(tasks=>({tasks:tasks.filter(t=>!clearableStates.includes(t.state)),value:tasks.filter(t=>clearableStates.includes(t.state))}));for(const task of removed)if(task.destinationId)await forgetDestination(task.destinationId).catch(()=>{});return;}
    case 'PREFERENCES':{const prefs=await getPreferences();const p=command.patch;
      if(['best','720','480'].includes(p.quality||''))prefs.quality=p.quality!;if(['dark','light'].includes(p.theme||''))prefs.theme=p.theme!;
      for(const key of ['editFilename','hideAds','saveAs'] as const)if(typeof p[key]==='boolean')prefs[key]=p[key]!;
      await chrome.storage.local.set({preferences:prefs});return prefs;
    }
  }
}
async function handleWorker(message:WorkerMessage) {
  const id=message.type==='PROGRESS'?message.task?.id:message.id;if(typeof id!=='string')return;
  const task=(await getTasks()).find(t=>t.id===id);if(!task||['cancelled','completed'].includes(task.state)){if(message.type==='OUTPUT')await tellRunner({target:'runner',type:'RELEASE',id}).catch(()=>{});return;}
  if(message.type==='SAVED'){if(!task.destinationId||task.state!=='saving')throw new Error('保存任务无效');await patchTask(id,{state:'completed',speed:0,error:undefined});await forgetDestination(task.destinationId).catch(()=>{});return;}
  if(message.type==='PROGRESS') {await mutateTasks(tasks=>({tasks:tasks.map(current=>current.id===id&&!['cancelled','completed','failed'].includes(current.state)&&!(current.destinationId&&current.state==='saving'&&message.task.state&&message.task.state!=='failed')?{...current,...message.task,id:current.id,updatedAt:Date.now()}:current),value:undefined}));return;}
  if(message.type==='OUTPUT') {
    if(!message.url.startsWith('blob:chrome-extension://'+chrome.runtime.id+'/'))throw new Error('无效的视频文件来源');
    try {
      const accepted=await mutateTasks(tasks=>{const current=tasks.find(t=>t.id===id);const accepted=!!current&&activeStates.includes(current.state);return {tasks:tasks.map(t=>t.id===id&&accepted?{...t,state:'saving',outputUrl:message.url,updatedAt:Date.now()}:t),value:accepted};});
      if(!accepted){await tellRunner({target:'runner',type:'RELEASE',id});return;}
      const downloadId=await chrome.downloads.download({url:message.url,filename:task.filename,saveAs:false,conflictAction:'uniquify'});await patchTask(id,{downloadId});const current=(await getTasks()).find(t=>t.id===id);if(current?.state==='cancelled')await chrome.downloads.cancel(downloadId);await updateDownload(downloadId);
    }
    catch(error){await mutateTasks(tasks=>({tasks:tasks.map(t=>t.id===id&&t.state!=='cancelled'?{...t,state:'failed',error:errorText(error),updatedAt:Date.now()}:t),value:undefined}));await tellRunner({target:'runner',type:'RELEASE',id});}
  }
}
async function handlePlayer(command:PlayerCommand,sender:chrome.runtime.MessageSender):Promise<unknown> {
  const tabId=sender.tab?.id;
  if(tabId===undefined||!httpUrl(sender.url)||typeof command.playerId!=='string'||command.playerId.length>100)throw new Error('无效的视频请求');
  if(!await chrome.permissions.contains({origins:[originPattern(sender.url!)]}))throw new Error('请在拾影侧栏允许访问这个站点');
  await pageQueue;
  const tab=await chrome.tabs.get(tabId);
  const page=await getPage(tabId);
  const binding=playerKey(sender.documentId,sender.frameId,command.playerId);
  if(!page||page.pageUrl!==tab.url||page.selection?.playerId!==binding)throw new Error('选择已变化，请重新点击要下载的视频');
  const candidates=selectedAssets(page.assets,page.selection);
  if(candidates.length===0)throw new Error('还没有关联到这个视频的地址。请继续播放几秒；首次授权后可刷新网页再试。');
  const endpoint=biliEndpoint(page.pageUrl);
  const asset=candidates.find(a=>a.url===endpoint)||candidates.find(a=>a.protocol==='HLS'||a.protocol==='DASH')||candidates[0];
  if(asset.protocol!=='DASH'&&candidates.length>1)throw new Error('这个播放器关联了多个资源，请在侧栏确认要下载的资源');
  if(command.type==='PLAYER_RESOLVE')return {asset:await resolveAsset(tabId,asset.id),preferences:await getPreferences()} satisfies PlayerResolveResult;
  if(command.type==='PLAYER_START') {
    if(command.assetId!==asset.id)throw new Error('视频地址已变化，请重新解析');
    const currentSource=page.selection.sourceKey;
    const operation=startQueue.then(async()=>{
      await pageQueue;
      const current=await getPage(tabId);
      if(current?.selection?.playerId!==binding||current.selection.sourceKey!==currentSource||!selectedAssets(current.assets,current.selection).some(a=>a.id===asset.id))throw new Error('视频已切换，请重新选择');
      return startTask(tabId,asset.id,command.variantId,command.filename,{id:binding,source:currentSource});
    });
    startQueue=operation.then(()=>{},()=>{});return operation;
  }
}
async function playerFailure(sender:chrome.runtime.MessageSender,error:unknown) {
  const tabId=sender.tab?.id;if(tabId===undefined)return;
  pageQueue=pageQueue.then(async()=>{const page=await getPage(tabId);if(!page)return;page.shortcutError={message:errorText(error),origins:error instanceof PermissionError?error.origins:[]};await setPage(tabId,page);}).catch(()=>{});
  await pageQueue;
}
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(!message||typeof message.type!=='string'||message.target==='runner')return;
  if(message.type==='EVIDENCE'&&sender.tab){pageQueue=pageQueue.then(()=>acceptEvidence(message,sender)).catch(()=>{});return;}
  if(['PLAYER_RESOLVE','PLAYER_START'].includes(message.type)&&sender.tab&&sender.id===chrome.runtime.id) {
    void handlePlayer(message,sender).then(value=>respond({ok:true,value})).catch(async error=>{if(message.type==='PLAYER_START')await playerFailure(sender,error);respond({ok:false,error:errorText(error),origins:error instanceof PermissionError?error.origins:undefined});});return true;
  }
  if(message.type==='PLAYER_PANEL'&&sender.tab?.id!==undefined&&sender.id===chrome.runtime.id&&httpUrl(sender.url)) {
    // Preserve Chrome's transient user activation: open before any asynchronous work.
    void chrome.sidePanel.open({tabId:sender.tab.id}).then(()=>respond({ok:true})).catch(error=>respond({ok:false,error:errorText(error)}));return true;
  }
  if(sender.url===offscreenUrl&&message.type==='RUNNER_IDLE') {
    const operation=startQueue.then(async()=>{
      if(!await chrome.offscreen.hasDocument())return;
      const status=await tellRunner({target:'runner',type:'PING'});
      if(Array.isArray(status.jobs)&&status.jobs.length===0&&status.outputs===0)await chrome.offscreen.closeDocument();
    });
    startQueue=operation.then(()=>{},()=>{});void operation.then(()=>respond({ok:true})).catch(()=>respond({ok:false}));return true;
  }
  if(sender.url===offscreenUrl&&message.type==='PREPARE_SAVE'){
    void mutateTasks(tasks=>{
      const task=tasks.find(t=>t.id===message.id);const accepted=!!task&&!!task.destinationId&&activeStates.includes(task.state)&&task.state!=='paused';
      return {tasks:tasks.map(t=>t.id===message.id&&accepted?{...t,state:'saving',speed:0,updatedAt:Date.now()}:t),value:accepted};
    }).then(accepted=>respond({ok:true,accepted}));return true;
  }
  if(sender.url===offscreenUrl&&message.type==='CHECK_ORIGIN') {
    const pattern=typeof message.pattern==='string'?message.pattern:'';
    if(!/^https?:\/\/[^/]+\/\*$/.test(pattern)){respond({ok:false});return;}
    void chrome.permissions.contains({origins:[pattern]}).then(allowed=>respond({ok:true,allowed}));return true;
  }
  if(sender.url===offscreenUrl&&message.type==='REFRESH_HLS'){
    void (async()=>{
      const task=(await getTasks()).find(t=>t.id===message.id);
      if(!task||task.protocol!=='HLS'||!activeStates.includes(task.state)||task.url!==message.url)throw new Error('视频任务已变化，无法更新地址');
      const url=await refreshHls(task);
      const current=(await getTasks()).find(t=>t.id===task.id);
      if(!current||!activeStates.includes(current.state)||current.url!==message.url)throw new Error('视频任务已变化，无法更新地址');
      await patchTask(task.id,{url});return {url};
    })().then(value=>respond({ok:true,value})).catch(error=>respond({ok:false,error:errorText(error),origins:error instanceof PermissionError?error.origins:undefined}));return true;
  }
  if(sender.url===offscreenUrl&&['PROGRESS','OUTPUT','SAVED'].includes(message.type)){void handleWorker(message).then(()=>respond({ok:true})).catch(error=>respond({ok:false,error:errorText(error)}));return true;}
  if(sender.id!==chrome.runtime.id||!sender.url?.startsWith(ownOrigin)||sender.url===offscreenUrl)return;
  if(sender.url?.startsWith(chrome.runtime.getURL('save.html')+'?')&&['SAVE_INFO','SAVE_COMMIT','SAVE_CANCEL'].includes(message.type)){void handleSave(message).then(value=>respond({ok:true,value})).catch(error=>respond({ok:false,error:errorText(error)}));return true;}
  if(!['SNAPSHOT','SCAN','RESOLVE','START','TASK','CLEAR','PREFERENCES','SYNC_HOSTS','SAVE_FOCUS','SAVE_CANCEL'].includes(message.type))return;
  void handleUi(message).then(value=>respond({ok:true,value} satisfies Response<unknown>)).catch(error=>respond({ok:false,error:errorText(error),origins:error instanceof PermissionError?error.origins:undefined}));return true;
});
