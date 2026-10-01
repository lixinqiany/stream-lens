import {destinationDatabase,destinationFile} from './support/destinations';
import {rememberDestination} from '../../platform/destination';
const destinationRecords=destinationDatabase();const chooserWindows:any[]=[];let removedWindow:(id:number)=>void=()=>{};let windowFocuses=0;let runnerReject=false;
import {test} from 'node:test';import assert from 'node:assert/strict';import {mergeEvidence} from '../discovery/catalog';import type {DownloadRecord} from '../model';
const event=()=>({addListener:(_fn:unknown)=>{}});const local:Record<string,any>={};const session:Record<string,any>={};let receive:any;let headerRules:any[]=[];let headerWrites=0;const runner:any[]=[];const downloads=new Map<number,any>();let nextId=1;let runnerAlive=false;let granted=true;let releaseDownload:(id:number)=>void;let delayDownload=false;
const store=(data:Record<string,any>)=>({get:async(key:string|null)=>key===null?structuredClone(data):({[key]:structuredClone(data[key])}),set:async(patch:any)=>{Object.assign(data,structuredClone(patch));},remove:async(key:string)=>{delete data[key];}});
Object.assign(globalThis,{chrome:{windows:{create:async(options:any)=>{chooserWindows.push(options);return {id:chooserWindows.length};},update:async()=>{windowFocuses++;},remove:async(id:number)=>{removedWindow(id);},onRemoved:{addListener:(fn:any)=>{removedWindow=fn;}}},declarativeNetRequest:{RuleActionType:{MODIFY_HEADERS:'modifyHeaders'},HeaderOperation:{SET:'set'},ResourceType:{XMLHTTPREQUEST:'xmlhttprequest'},getSessionRules:async()=>structuredClone(headerRules),updateSessionRules:async({removeRuleIds,addRules}:any)=>{headerWrites++;headerRules=[...headerRules.filter(r=>!removeRuleIds.includes(r.id)),...addRules]}},runtime:{id:'test',getURL:(p:string)=>'chrome-extension://test/'+p,onInstalled:event(),onStartup:event(),onMessage:{addListener:(fn:any)=>{receive=fn;}},sendMessage:async(m:any)=>{runner.push(m);return runnerReject&&m.type==='RUN'?{ok:false,error:'runner unavailable'}:{ok:true};}},sidePanel:{setPanelBehavior:async()=>{}},storage:{local:store(local),session:store(session)},scripting:{getRegisteredContentScripts:async()=>[],registerContentScripts:async()=>{},unregisterContentScripts:async()=>{},executeScript:async()=>{}},permissions:{contains:async()=>granted,getAll:async()=>({origins:['https://cdn.example/*']}),onRemoved:event(),onAdded:event()},tabs:{onRemoved:event(),onUpdated:event(),get:async()=>({id:1,url:'https://page.example/',title:'Test'}),sendMessage:async()=>{},create:async()=>{}},webRequest:{onBeforeRequest:event(),onHeadersReceived:event()},action:{setBadgeText:async()=>{},setBadgeBackgroundColor:async()=>{}},offscreen:{Reason:{BLOBS:'BLOBS'},hasDocument:async()=>runnerAlive,createDocument:async()=>{runnerAlive=true;}},alarms:{create:async()=>{},onAlarm:event()},downloads:{onChanged:event(),download:async(options:any)=>{const id=nextId++;downloads.set(id,{saveAs:options.saveAs,id,state:'in_progress',bytesReceived:10,totalBytes:100,url:options.url});if(delayDownload)return new Promise<number>(resolve=>{releaseDownload=()=>resolve(id);});return id;},search:async({id}:any)=>downloads.has(id)?[downloads.get(id)]:[],pause:async(id:number)=>{downloads.get(id).paused=true;},resume:async(id:number)=>{downloads.get(id).paused=false;},cancel:async(id:number)=>{Object.assign(downloads.get(id),{state:'interrupted',error:'USER_CANCELED'});},show:async()=>{}}}});
globalThis.fetch=async()=>new Response('#EXTM3U\n#EXTINF:10,\na.ts\n#EXT-X-ENDLIST');
await import('../../extension/background/index');
function ui(m:any){return new Promise<any>(resolve=>receive(m,{id:'test',url:'chrome-extension://test/sidepanel.html'},resolve));}
function worker(m:any){return new Promise<any>(resolve=>receive(m,{id:'test',url:'chrome-extension://test/offscreen.html'},resolve));}
function reset(protocol:'MP4'|'HLS'='HLS'){
 for(const key of Object.keys(session))delete session[key];runnerReject=false;windowFocuses=0;local.tasks=[];local.preferences={saveAs:false};chooserWindows.length=0;runner.length=0;downloads.clear();granted=true;delayDownload=false;
 const assets=mergeEvidence([],{url:'https://cdn.example/video.'+(protocol==='HLS'?'m3u8':'mp4'),title:'Test',pageUrl:'https://page.example/',width:1280,height:720,duration:10,playing:true,primary:true,protected:false,source:'player'});session['page:1']={pageUrl:'https://page.example/',assets,documentKey:'test',updatedAt:Date.now()};return assets[0];
}
test('actual background routes HLS to independent runner and rejects duplicate active resource',async()=>{
 const asset=reset();const response=await ui({type:'START',tabId:1,assetId:asset.id});assert.equal(response.ok,true);assert.equal(local.tasks.length,1);assert.equal(runner.find(m=>m.type==='RUN').task.id,response.value.id);const duplicate=await ui({type:'START',tabId:1,assetId:asset.id});assert.equal(duplicate.value.duplicate,true);assert.equal(local.tasks.length,1);
});
test('direct Chrome downloads updates native pause and completion without repeated snapshot writes',async()=>{
 const asset=reset('MP4');const response=await ui({type:'START',tabId:1,assetId:asset.id});const task=local.tasks[0];assert.equal(task.state,'downloading');assert.equal(task.bytes,10);await ui({type:'TASK',id:response.value.id,action:'pause'});assert.equal(local.tasks[0].state,'paused');downloads.get(task.downloadId).state='complete';await ui({type:'SNAPSHOT',tabId:2});assert.equal(local.tasks[0].state,'completed');assert.equal((await ui({type:'SNAPSHOT',tabId:2})).value.tasks.length,1);
});
test('cancelled HLS cannot be revived by late progress or output',async()=>{
 const asset=reset();const response=await ui({type:'START',tabId:1,assetId:asset.id});const id=response.value.id;await ui({type:'TASK',id,action:'cancel'});assert.equal(local.tasks[0].state,'cancelled');await worker({type:'PROGRESS',task:{id,state:'downloading',segments:9}});assert.equal(local.tasks[0].state,'cancelled');await worker({type:'OUTPUT',id,url:'blob:chrome-extension://test/valid'});assert.equal(downloads.size,0);assert.ok(runner.some(m=>m.type==='RELEASE'));
});
test('cancel racing with Chrome save keeps terminal cancellation and releases output',async()=>{
 const asset=reset();const response=await ui({type:'START',tabId:1,assetId:asset.id});const id=response.value.id;delayDownload=true;const saving=worker({type:'OUTPUT',id,url:'blob:chrome-extension://test/valid'});while(!downloads.size)await new Promise(r=>setTimeout(r,1));await ui({type:'TASK',id,action:'cancel'});releaseDownload!(0);await saving;assert.equal(local.tasks[0].state,'cancelled');assert.equal(downloads.values().next().value.state,'interrupted');assert.ok(runner.some(m=>m.type==='RELEASE'));
});
test('permission failure creates no task and exposes required CDN origin',async()=>{
 const asset=reset();granted=false;const response=await ui({type:'START',tabId:1,assetId:asset.id});assert.equal(response.ok,false);assert.deepEqual(response.origins,['https://cdn.example/*']);assert.equal(local.tasks.length,0);
});
function content(m:any){receive(m,{id:'test',url:'https://page.example/',documentId:'doc',frameId:0,tab:{id:1}},()=>{});}
function player(m:any,documentId='doc'){return new Promise<any>(resolve=>receive(m,{id:'test',url:'https://page.example/',documentId,frameId:0,tab:{id:1}},resolve));}
test('player shortcut uses selected source and rejects other frames and stale sources',async()=>{
 reset();
 content({type:'EVIDENCE',pageUrl:'https://page.example/',select:true,player:{playerId:'main',sourceKey:'blob:one',title:'Test',playing:true,selectedAt:100},evidence:[{url:'https://cdn.example/video.m3u8',playerId:'main',sourceKey:'blob:one',title:'Test',pageUrl:'https://page.example/',width:1280,height:720,duration:10,playing:true,primary:true,protected:false,source:'player'}]});
 await ui({type:'SNAPSHOT',tabId:1});
 const resolved=await player({type:'PLAYER_RESOLVE',playerId:'main'});assert.equal(resolved.ok,true);assert.equal(resolved.value.asset.playerBindings[0].playerId,'doc:main');
 const foreign=await player({type:'PLAYER_RESOLVE',playerId:'main'},'foreign');assert.equal(foreign.ok,false);
 const started=await player({type:'PLAYER_START',playerId:'main',assetId:resolved.value.asset.id,variantId:'original'});assert.equal(started.ok,true);assert.equal(local.tasks.length,1);
 content({type:'EVIDENCE',pageUrl:'https://page.example/',player:{playerId:'main',sourceKey:'blob:two',title:'Next',playing:false,selectedAt:100},evidence:[]});await ui({type:'SNAPSHOT',tabId:1});
 const stale=await player({type:'PLAYER_START',playerId:'main',assetId:resolved.value.asset.id,variantId:'original'});assert.equal(stale.ok,false);assert.equal(local.tasks.length,1);
});
test('bound DASH cannot be offered as a silent direct MP4 download',async()=>{
 reset();content({type:'EVIDENCE',pageUrl:'https://page.example/',select:true,player:{playerId:'bili',sourceKey:'blob:dash',title:'Bili',playing:true,selectedAt:200},evidence:[{url:'https://cdn.example/video.m4s',playerId:'bili',sourceKey:'blob:dash',format:'DASH',title:'Bili',pageUrl:'https://page.example/',width:1280,height:720,playing:true,primary:true,protected:false,source:'player'}]});await ui({type:'SNAPSHOT',tabId:1});
 const response=await player({type:'PLAYER_RESOLVE',playerId:'bili'});assert.equal(response.ok,false);assert.match(response.error,/暂不支持/);assert.equal(local.tasks.length,0);
});
test('Bilibili DASH resolves episode quality, requires audio permission and starts independent runner',async()=>{
 reset();const oldFetch=globalThis.fetch;
 const rawTrack=(id:number,codec:string,height?:number)=>({id,codecs:codec,height,baseUrl:'https://cdn.example/'+id+'.m4s',SegmentBase:{Initialization:'0-99',indexRange:'100-199'}});
 globalThis.fetch=async()=>new Response(JSON.stringify({code:0,result:{is_drm:false,is_preview:0,timelength:60000,dash:{video:[rawTrack(32,'avc1.64001F',480)],audio:[rawTrack(30232,'mp4a.40.2')]}}}));
 const endpoint='https://api.bilibili.com/pgc/player/web/playurl?ep_id=768338&qn=127&fnval=4048&fnver=0&fourk=1';
 const asset=mergeEvidence([],{url:endpoint,title:'Episode',pageUrl:'https://www.bilibili.com/bangumi/play/ep768338',width:852,height:480,playing:true,primary:true,protected:false,source:'player',format:'DASH',contentType:'video/mp4'})[0];
 session['page:1']={pageUrl:asset.pageUrl,assets:[asset],documentKey:'doc',updatedAt:Date.now()};
 const response=await ui({type:'START',tabId:1,assetId:asset.id,variantId:'dash-0'});assert.equal(response.ok,true);assert.equal(local.tasks[0].protocol,'DASH');assert.match(local.tasks[0].dash.audio.url,/30232/);assert(runner.some(m=>m.type==='RUN'&&m.task.protocol==='DASH'));assert.equal(downloads.size,0);
 globalThis.fetch=oldFetch;
});
test('Bilibili season DASH uses the selected episode and maps raw player tracks by CID without guessing',async()=>{
 reset();const oldFetch=globalThis.fetch;const requested:string[]=[];
 const rawTrack=(id:number,codec:string,height?:number)=>({id,codecs:codec,height,baseUrl:'https://cdn.example/'+id+'.m4s',SegmentBase:{Initialization:'0-99',indexRange:'100-199'}});
 globalThis.fetch=async(input)=>{const url=String(input);requested.push(url);return new Response(JSON.stringify(url.includes('/pgc/view/web/season')?{code:0,result:{episodes:[{id:768338,cid:1251263498},{id:768339,cid:1251260180}]}}:{code:0,result:{is_preview:0,timelength:60000,dash:{video:[rawTrack(32,'avc1.64',480)],audio:[rawTrack(30232,'mp4a.40.2')]}}}));};
 const pageUrl='https://www.bilibili.com/bangumi/play/ss45662';
 const evidence={title:'Episode 2',pageUrl,width:852,height:480,playing:true,primary:true,protected:false,source:'player' as const,format:'DASH' as const,contentType:'video/mp4',playerId:'doc:bili',sourceKey:'blob:main|bili-ep:768339'};
 const endpoint='https://api.bilibili.com/pgc/player/web/playurl?ep_id=768339&qn=127&fnval=4048&fnver=0&fourk=1';
 let assets=mergeEvidence([],{...evidence,url:endpoint});session['page:1']={pageUrl,assets,documentKey:'doc',updatedAt:Date.now()};
 let response=await ui({type:'RESOLVE',tabId:1,assetId:assets[0].id});assert(response.ok);assert.match(requested.at(-1)!,/ep_id=768339/);
 requested.length=0;assets=mergeEvidence([],{...evidence,url:'https://upos.bilivideo.com/upgcxcode/80/01/1251260180/1251260180-1-30032.m4s'});session['page:1'].assets=assets;
 response=await ui({type:'RESOLVE',tabId:1,assetId:assets[0].id});assert(response.ok);assert.equal(requested.length,2);assert.match(requested[1],/ep_id=768339/);
 assets=mergeEvidence([],{...evidence,url:'https://cdn.example/unidentified.m4s'});session['page:1'].assets=assets;
 response=await ui({type:'RESOLVE',tabId:1,assetId:assets[0].id});assert.equal(response.ok,false);assert.match(response.error,/尚未确认/);
 globalThis.fetch=oldFetch;
});

test('Bilibili request headers are established once and retries refresh signed tracks without changing quality',async()=>{
 reset();const oldFetch=globalThis.fetch;headerRules=[];headerWrites=0;const calls:string[]=[];
 const track=(id:number,codec:string)=>({id,height:id===80?1080:0,codecs:codec,baseUrl:'https://cdn.example/'+id+'.m4s?token=fresh',SegmentBase:{Initialization:'0-99',indexRange:'100-199'}});
 globalThis.fetch=async(input)=>{calls.push(String(input));assert(headerRules.some(r=>r.action.requestHeaders.some((h:any)=>h.header==='Referer')));return new Response(JSON.stringify({code:0,result:{is_preview:0,timelength:60000,dash:{video:[track(80,'avc1.640028')],audio:[track(30280,'mp4a.40.2')]}}}));};
 const endpoint='https://api.bilibili.com/pgc/player/web/playurl?ep_id=787052&qn=127&fnval=4048&fnver=0&fourk=1';
 const asset=mergeEvidence([],{url:endpoint,title:'Episode',pageUrl:'https://www.bilibili.com/bangumi/play/ep787052',width:1920,height:1080,playing:true,primary:true,protected:false,source:'player',format:'DASH',contentType:'video/mp4'})[0];
 session['page:1']={pageUrl:asset.pageUrl,assets:[asset],documentKey:'doc',updatedAt:Date.now()};
 const start=await ui({type:'START',tabId:1,assetId:asset.id,variantId:'dash-0'});assert(start.ok);assert.equal(headerWrites,1);
 const rule=headerRules[0];assert.equal(rule.priority,1000);assert.deepEqual(rule.condition.initiatorDomains,['test']);assert.deepEqual(rule.condition.requestDomains,['bilibili.com','bilivideo.com']);assert.deepEqual(rule.condition.resourceTypes,['xmlhttprequest']);
 const task=local.tasks[0];task.state='failed';task.url='https://cdn.example/old.m4s?token=expired';task.dash.video.url=task.url;
 const retry=await ui({type:'TASK',id:task.id,action:'retry'});assert(retry.ok);assert.equal(headerWrites,1);assert.equal(calls.length,2);assert.equal(local.tasks[0].quality,'1080p');assert.match(local.tasks[0].url,/token=fresh/);assert.equal(local.tasks[0].resolutionUrl,endpoint);assert.match(runner.filter(m=>m.type==='RUN').at(-1).task.url,/token=fresh/);
 globalThis.fetch=async()=>new Response(JSON.stringify({code:0,result:{is_preview:1}}));local.tasks[0].state='failed';
 const denied=await ui({type:'TASK',id:task.id,action:'retry'});assert.equal(denied.ok,false);assert.match(denied.error,/试看/);assert.equal(local.tasks[0].state,'failed');
 globalThis.fetch=oldFetch;
});

test('HLS user retry gets matching fresh source from the page instead of replaying an expired signature',async()=>{
 reset();const oldFetch=globalThis.fetch;
 const old='https://cdn.example/hls/expired/1/62000/62298/62298.m3u8',fresh='https://cdn.example/hls/fresh/2/62000/62298/62298.m3u8';
 local.tasks=[{id:'old-hls',error:'资源请求失败（410）',assetId:'old',title:'Video',filename:'video.mp4',pageUrl:'https://page.example/',url:old,protocol:'HLS',quality:'720p',state:'failed',createdAt:0,updatedAt:0,bytes:10,segments:1,speed:0}];
 globalThis.fetch=async(url,options)=>{assert.equal(String(url),'https://page.example/');assert.equal(options?.cache,'no-store');return new Response(`<script>var hlsUrl="${fresh}"</script>`);};
 const response=await ui({type:'TASK',id:'old-hls',action:'retry'});assert(response.ok);assert.equal(local.tasks[0].url,fresh);assert.equal(local.tasks[0].quality,'720p');assert.equal(runner.filter(m=>m.type==='RUN').at(-1).task.url,fresh);
 globalThis.fetch=oldFetch;
});

function chooser(m:any){return new Promise<any>(resolve=>receive(m,{id:'test',url:'chrome-extension://test/save.html?request='+m.requestId},resolve));}
test('clear removes completed/cancelled only and always preserves failed and active tasks',async()=>{
 const asset=reset();await ui({type:'START',tabId:1,assetId:asset.id});const base=local.tasks[0];
 local.tasks=['completed','cancelled','failed','paused','downloading','saving'].map(state=>({...base,id:state,state}));
 await ui({type:'CLEAR'});assert.deepEqual(local.tasks.map((t:any)=>t.state),['failed','paused','downloading','saving']);
});
test('location selection precedes task and media runner; cancelling picker starts nothing',async()=>{
 for(const protocol of ['MP4','HLS'] as const){
  const asset=reset(protocol);local.preferences={saveAs:true};const response=await ui({type:'START',tabId:1,assetId:asset.id});
  assert.equal(response.ok,true);assert.equal(response.value.pending,true);assert.equal(local.tasks.length,0);assert.equal(downloads.size,0);assert(!runner.some(m=>m.type==='RUN'));
  assert.equal(chooserWindows.length,1);assert(chooserWindows[0].url.includes('save.html?request='));
  const info=await chooser({type:'SAVE_INFO',requestId:response.value.id});assert(info.value.filename.endsWith('.mp4'));
  await chooser({type:'SAVE_CANCEL',requestId:response.value.id});assert.equal(local.tasks.length,0);assert.equal(session['save:'+response.value.id],undefined);
 }
});
test('foreground selection transfers a stored handle to offscreen and completes without late Chrome picker',async()=>{
 for(const protocol of ['MP4','HLS'] as const){
  const asset=reset(protocol);local.preferences={saveAs:true};const response=await ui({type:'START',tabId:1,assetId:asset.id});
  const destination=destinationFile('my-file.mp4');const id=await rememberDestination(destination.handle);
  const commit=await chooser({type:'SAVE_COMMIT',requestId:response.value.id,destinationId:id,filename:'my-file.mp4'});
  assert.equal(commit.ok,true);assert.equal(local.tasks[0].destinationId,id);assert.equal(local.tasks[0].filename,'my-file.mp4');assert.equal(downloads.size,0);
  assert.equal(runner.find(m=>m.type==='RUN').task.destinationId,id);
  local.tasks[0].state='saving';await worker({type:'SAVED',id:local.tasks[0].id});assert.equal(local.tasks[0].state,'completed');assert.equal(downloads.size,0);assert.equal(destinationRecords.has(id),false);
 }
});
test('lost location permission blocks task creation; retry asks for location upfront again',async()=>{
 const asset=reset('MP4');local.preferences={saveAs:true};const response=await ui({type:'START',tabId:1,assetId:asset.id});
 const file=destinationFile();const id=await rememberDestination(file.handle);file.deny();
 const commit=await chooser({type:'SAVE_COMMIT',requestId:response.value.id,destinationId:id,filename:'chosen.mp4'});assert.equal(commit.ok,false);assert.equal(local.tasks.length,0);assert.equal(downloads.size,0);
 local.tasks=[{id:'failed-id',assetId:asset.id,title:'test',filename:'chosen.mp4',destinationId:id,protocol:'MP4',state:'failed',url:asset.url,pageUrl:asset.pageUrl}];
 const retry=await ui({type:'TASK',id:'failed-id',action:'retry'});assert.equal(retry.value.pending,true);assert.equal(local.tasks[0].state,'failed');assert.equal(downloads.size,0);
});

test('a changed save preference cannot introduce a late save dialog for an already running task',async()=>{
 const asset=reset();await ui({type:'START',tabId:1,assetId:asset.id});local.preferences={saveAs:true};const t=local.tasks[0];
 await worker({type:'OUTPUT',id:t.id,url:'blob:chrome-extension://test/output'});assert.equal(downloads.get(local.tasks[0].downloadId).saveAs,false);
});

test('pending save is visible globally, repeated start focuses one window, native close clears pending request',async()=>{
 const asset=reset('MP4');local.preferences={saveAs:true};const first=await ui({type:'START',tabId:1,assetId:asset.id});
 const snapshot=await ui({type:'SNAPSHOT',tabId:9});assert.equal(snapshot.value.pendingSaves.length,1);assert.equal(snapshot.value.pendingSaves[0].id,first.value.id);
 const second=await ui({type:'START',tabId:1,assetId:asset.id});assert.equal(second.value.id,first.value.id);assert.equal(chooserWindows.length,1);assert.equal(windowFocuses,1);
 await ui({type:'SAVE_FOCUS',requestId:first.value.id});assert.equal(windowFocuses,2);removedWindow(1);await new Promise(r=>setTimeout(r,0));assert.equal((await ui({type:'SNAPSHOT',tabId:9})).value.pendingSaves.length,0);
});
test('concurrent repeated save commit launches once and returns recorded result after lost response',async()=>{
 const asset=reset('MP4');local.preferences={saveAs:true};const first=await ui({type:'START',tabId:1,assetId:asset.id});const file=destinationFile();const id=await rememberDestination(file.handle);
 const message={type:'SAVE_COMMIT',requestId:first.value.id,destinationId:id,filename:'chosen.mp4'};
 const [one,two]=await Promise.all([chooser(message),chooser(message)]);assert(one.ok&&two.ok);assert.equal(one.value.id,two.value.id);assert.equal(local.tasks.length,1);assert.equal(runner.filter(m=>m.type==='RUN').length,1);
 const info=await chooser({type:'SAVE_INFO',requestId:first.value.id});assert.equal(info.value.result.id,one.value.id);assert.equal((await ui({type:'SNAPSHOT',tabId:1})).value.pendingSaves.length,0);
 const repeated=await chooser(message);assert.equal(repeated.value.id,one.value.id);assert.equal(runner.filter(m=>m.type==='RUN').length,1);
});
test('runner launch failure after choosing a file returns owned failed task and preserves recovery',async()=>{
 const asset=reset();local.preferences={saveAs:true};const first=await ui({type:'START',tabId:1,assetId:asset.id});const file=destinationFile();const id=await rememberDestination(file.handle);runnerReject=true;
 const committed=await chooser({type:'SAVE_COMMIT',requestId:first.value.id,destinationId:id,filename:'chosen.mp4'});
 assert(committed.ok);assert.equal(committed.value.failed,true);assert.equal(local.tasks[0].state,'failed');assert.equal(local.tasks[0].destinationId,id);assert(destinationRecords.has(id));runnerReject=false;
});
test('final save reservation and cancellation are mutually exclusive in either order',async()=>{
 const asset=reset();await ui({type:'START',tabId:1,assetId:asset.id});const task=local.tasks[0];task.destinationId='selected';task.state='merging';
 const accepted=await worker({type:'PREPARE_SAVE',id:task.id});assert.equal(accepted.accepted,true);assert.equal(local.tasks[0].state,'saving');
 const cancel=await ui({type:'TASK',id:task.id,action:'cancel'});assert.equal(cancel.ok,false);assert.equal(local.tasks[0].state,'saving');
 local.tasks[0].state='downloading';await ui({type:'TASK',id:task.id,action:'cancel'});const denied=await worker({type:'PREPARE_SAVE',id:task.id});assert.equal(denied.accepted,false);assert.equal(local.tasks[0].state,'cancelled');
});

test('two downloads cannot concurrently replace the same chosen file',async()=>{
 const asset=reset('MP4');local.preferences={saveAs:true};const file=destinationFile();const id=await rememberDestination(file.handle);const first=await ui({type:'START',tabId:1,assetId:asset.id});
 assert((await chooser({type:'SAVE_COMMIT',requestId:first.value.id,destinationId:id,filename:'chosen.mp4'})).ok);
 session['page:1'].assets[0].url='https://cdn.example/other.mp4';session['page:1'].assets[0].variants=undefined;
 const second=await ui({type:'START',tabId:1,assetId:asset.id});const again=await rememberDestination(file.handle);
 const rejected=await chooser({type:'SAVE_COMMIT',requestId:second.value.id,destinationId:again,filename:'chosen.mp4'});assert.equal(rejected.ok,false);assert.match(rejected.error,/另一个任务/);assert.equal(local.tasks.length,1);
});

test('service-worker interruption before saving commit result recovers task without deleting its destination',async()=>{
 const asset=reset('MP4');local.preferences={saveAs:true};const first=await ui({type:'START',tabId:1,assetId:asset.id});const file=destinationFile();const id=await rememberDestination(file.handle);
 const command={type:'SAVE_COMMIT',requestId:first.value.id,destinationId:id,filename:'chosen.mp4'};const committed=await chooser(command);delete session['save:'+first.value.id].result;
 const recovered=await chooser(command);assert.equal(recovered.value.id,committed.value.id);assert.equal(recovered.value.duplicate,false);assert.equal(runner.filter(m=>m.type==='RUN').length,1);assert(destinationRecords.has(id));
});

async function until(check:()=>boolean){for(let i=0;i<100;i++){if(check())return;await new Promise(r=>setTimeout(r,2));}assert.fail('automatic metadata did not settle');}
function selectedEvidence(sourceKey:string,url:string,selectedAt=1000){return {type:'EVIDENCE',pageUrl:'https://page.example/',select:true,player:{playerId:'automatic',sourceKey,title:'Automatic',playing:true,selectedAt},evidence:[{url,playerId:'automatic',sourceKey,title:'Automatic',pageUrl:'https://page.example/',width:1280,height:720,playing:true,primary:true,protected:false,source:'player'},{url:'https://ads.example/promo.m3u8',title:'Ad',pageUrl:'https://page.example/',width:320,height:180,playing:true,primary:false,protected:false,source:'network'}]};}
test('selecting player automatically resolves quality once without downloads or ad requests',async()=>{
 reset();const original=globalThis.fetch,calls:string[]=[];
 globalThis.fetch=async url=>{calls.push(String(url));return new Response('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720\n720.m3u8');};
 try{
 const evidence=selectedEvidence('blob:auto-once','https://cdn.example/auto-once.m3u8');
 content({...evidence,player:undefined,select:false});await ui({type:'SNAPSHOT',tabId:1});await new Promise(r=>setTimeout(r,10));assert.equal(calls.length,0);
 content(evidence);await until(()=>session['page:1'].assets.some((a:any)=>a.resolutionState==='ready'));
 assert.deepEqual(calls,['https://cdn.example/auto-once.m3u8']);assert.equal(local.tasks.length,0);assert.equal(downloads.size,0);
 const selected=session['page:1'].assets.find((a:any)=>a.url.includes('auto-once'));assert.equal(selected.variants[0].label,'720p');
 for(let i=0;i<3;i++)content(evidence);await ui({type:'SNAPSHOT',tabId:1});await new Promise(r=>setTimeout(r,10));assert.equal(calls.length,1);
 }finally{globalThis.fetch=original;}
});
test('automatic failure remains actionable without polling, permission rescan restarts resolution',async()=>{
 reset();const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return new Response('failed',{status:403});};
 try{
 const evidence=selectedEvidence('blob:auto-fail','https://cdn.example/auto-fail.m3u8');content(evidence);
 await until(()=>session['page:1'].assets.some((a:any)=>a.resolutionState==='failed'));
 for(let i=0;i<3;i++)content(evidence);await ui({type:'SNAPSHOT',tabId:1});await new Promise(r=>setTimeout(r,10));assert.equal(calls,1);
 assert.equal(session['page:1'].shortcutError,undefined);assert.equal(local.tasks.length,0);
 globalThis.fetch=async()=>{calls++;return new Response('#EXTM3U\n#EXTINF:10,\na.ts\n#EXT-X-ENDLIST');};
 await ui({type:'SCAN',tabId:1,retryPermissions:true});content(evidence);await until(()=>session['page:1'].assets.some((a:any)=>a.resolutionState==='ready'));assert.equal(calls,2);
 }finally{globalThis.fetch=original;}
});
test('a late metadata response cannot overwrite a newly selected source using the same URL',async()=>{
 reset();const original=globalThis.fetch;let release!:(r:Response)=>void,calls=0;
 globalThis.fetch=async()=>{calls++;if(calls===1)return new Promise<Response>(r=>{release=r;});return new Response('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=854x480\n480.m3u8');};
 try{
 const url='https://cdn.example/switch-source.m3u8';content(selectedEvidence('blob:old-auto',url));await until(()=>calls===1);
 content(selectedEvidence('blob:new-auto',url,1001));await until(()=>session['page:1'].assets.some((a:any)=>a.url===url&&a.resolutionState==='ready'));
 release(new Response('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720\n720.m3u8'));await new Promise(r=>setTimeout(r,15));
 const asset=session['page:1'].assets.find((a:any)=>a.url===url);assert.equal(asset.variants[0].label,'480p');assert.equal(session['page:1'].selection.sourceKey,'blob:new-auto');assert.equal(local.tasks.length,0);
 }finally{globalThis.fetch=original;}
});
test('stored loading metadata after worker restart is recovered on selected player evidence',async()=>{
 reset();const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return new Response('#EXTM3U\n#EXTINF:10,\na.ts\n#EXT-X-ENDLIST');};
 try{
 const evidence=selectedEvidence('blob:orphan-load','https://cdn.example/orphan.m3u8');
 const assets=mergeEvidence([],{...evidence.evidence[0],source:'player',playerId:'doc:automatic'});
 session['page:1']={pageUrl:'https://page.example/',documentKey:'test',selection:{...evidence.player,playerId:'doc:automatic'},assets:assets.map(a=>({...a,resolutionState:'loading'})),updatedAt:Date.now()};
 content(evidence);await until(()=>session['page:1'].assets.some((a:any)=>a.resolutionState==='ready'));assert.equal(calls,1);
 }finally{globalThis.fetch=original;}
});


test('language preference persists, rejects invalid values and reaches the active runner',async()=>{
 reset();const result=await ui({type:'PREFERENCES',patch:{language:'en'}});assert.equal(result.value.language,'en');
 const invalid=await ui({type:'PREFERENCES',patch:{language:'xx'}});assert.equal(invalid.value.language,'en');
 runnerAlive=true;await ui({type:'PREFERENCES',patch:{language:'zh_CN'}});assert(runner.some(m=>m.type==='LANGUAGE'&&m.language==='zh_CN'));
});

test('YouTube background resolves canonical source, starts paired tracks and renews same-quality retry',async()=>{
 reset();const previous=globalThis.fetch;const pageUrl='https://www.youtube.com/watch?v=jNQXAC9IVRw';
 const formats=[{itag:137,height:1080,mimeType:'video/mp4; codecs="avc1.640028"'},{itag:140,mimeType:'audio/mp4; codecs="mp4a.40.2"'}].map(f=>({...f,url:`https://rr1.googlevideo.com/videoplayback?itag=${f.itag}&token=fresh`,initRange:{start:'0',end:'100'},indexRange:{start:'101',end:'180'}}));
 const data={playabilityStatus:{status:'OK'},videoDetails:{videoId:'jNQXAC9IVRw',lengthSeconds:'19'},streamingData:{adaptiveFormats:formats}};
 globalThis.fetch=async()=>new Response('ytInitialPlayerResponse = '+JSON.stringify(data)+';');
 try{
  const asset=mergeEvidence([],{url:pageUrl,title:'Video',pageUrl,width:1920,height:1080,playing:true,primary:true,protected:false,source:'player',format:'DASH',contentType:'video/mp4'})[0];session['page:1']={pageUrl,assets:[asset],documentKey:'youtube',updatedAt:Date.now()};
  const response=await ui({type:'START',tabId:1,assetId:asset.id,variantId:'yt-137'});assert(response.ok,response.error);assert.equal(downloads.size,0);assert.match(local.tasks[0].dash.audio.url,/itag=140/);assert.equal(local.tasks[0].resolutionUrl,pageUrl);
  local.tasks[0].state='failed';local.tasks[0].url='https://rr1.googlevideo.com/expired';const retry=await ui({type:'TASK',id:local.tasks[0].id,action:'retry'});assert(retry.ok,retry.error);assert.equal(local.tasks[0].quality,'1080p');assert.match(local.tasks[0].url,/token=fresh/);
 }finally{globalThis.fetch=previous;}
});

test('Douyin background validates share metadata, scopes headers and starts/refetches a complete MP4',async()=>{
 reset();const previous=globalThis.fetch;const pageUrl='https://www.douyin.com/jingxuan?modal_id=7677919026948967689',endpoint='https://www.iesdouyin.com/share/video/7677919026948967689/?from_aid=1128&from_ssr=1';
 globalThis.fetch=async()=>new Response('window._ROUTER_DATA = '+JSON.stringify({loaderData:{'video_(id)/page':{itemId:'7677919026948967689',videoInfoRes:{status_code:0,item_list:[{aweme_id:'7677919026948967689',video:{height:2160,duration:1275496,play_addr:{url_list:['https://v95.douyinvod.com/play?token=fresh']}}}]}}}})+';');
 try{
  const asset=mergeEvidence([],{url:endpoint,title:'Video',pageUrl,width:3840,height:2160,playing:true,primary:true,protected:false,source:'player',contentType:'video/mp4'})[0];session['page:1']={pageUrl,assets:[asset],documentKey:'douyin',updatedAt:Date.now()};
  const response=await ui({type:'START',tabId:1,assetId:asset.id,variantId:'dy-original'});assert(response.ok,response.error);assert.equal(local.tasks[0].protocol,'MP4');assert.equal(local.tasks[0].resolutionUrl,endpoint);assert.equal(downloads.size,1);assert.match(downloads.values().next().value.url,/token=fresh/);
  const uaRule=headerRules.find(r=>r.id===1002);assert.deepEqual(uaRule.condition.initiatorDomains,['test']);assert.match(uaRule.condition.regexFilter,/share\/video/);assert(uaRule.action.requestHeaders[0].value.includes('iPhone'));
  local.tasks[0].state='failed';local.tasks[0].url='https://v95.douyinvod.com/expired';const retry=await ui({type:'TASK',id:local.tasks[0].id,action:'retry'});assert(retry.ok,retry.error);assert.match(downloads.get(local.tasks[0].downloadId).url,/token=fresh/);
 }finally{globalThis.fetch=previous;}
});

test('ordinary Bilibili retry renews exactly the requested multipart page',async()=>{
 reset();const previous=globalThis.fetch,requested:string[]=[];const pageUrl='https://www.bilibili.com/video/BV1GJ411x7h7?p=2',endpoint='https://api.bilibili.com/x/web-interface/view?bvid=BV1GJ411x7h7';
 globalThis.fetch=async(url)=>{requested.push(String(url));return new Response(JSON.stringify(String(url).includes('/x/web-interface/view')?{code:0,data:{bvid:'BV1GJ411x7h7',pages:[{cid:1},{cid:2}]}}:{code:0,data:{timelength:10000,dash:{video:[{height:480,codecs:'avc1.64001f',baseUrl:'https://cdn.example/video.m4s?fresh',SegmentBase:{Initialization:'0-100',indexRange:'101-180'}}],audio:[{codecs:'mp4a.40.2',baseUrl:'https://cdn.example/audio.m4s?fresh',SegmentBase:{Initialization:'0-100',indexRange:'101-180'}}]}}}));};
 try{
  local.tasks=[{id:'bv-retry',assetId:'bv',title:'BV',filename:'bv.mp4',pageUrl,url:'https://cdn.example/expired.m4s',protocol:'DASH',resolutionUrl:endpoint,quality:'480p',state:'failed',bytes:0,segments:0,speed:0,createdAt:0,updatedAt:0}];
  const response=await ui({type:'TASK',id:'bv-retry',action:'retry'});assert(response.ok,response.error);assert.match(requested[1],/cid=2&/);assert.equal(local.tasks[0].resolutionUrl,endpoint);assert.match(local.tasks[0].url,/fresh/);
 }finally{globalThis.fetch=previous;}
});
