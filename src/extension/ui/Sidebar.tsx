import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowLeft, ArrowRight, Check, ChevronDown, ExternalLink, FileVideo, FolderOpen, Globe, Info, LoaderCircle, LockKeyhole, Pause, Play, RefreshCw, ScanLine, Settings2, ShieldCheck, Square, Trash2, X } from 'lucide-react';
import { activeStates, clearableStates, defaults, httpUrl, originPattern, taskProgress, type DownloadRecord, type MediaAsset, type Preferences, type Variant } from '../../core/model';
import type { StartResult } from '../../platform/messages';
import { useExtension } from './use-extension';
import {selectedAssets} from '../../core/discovery/selection';
import {PermissionError} from '../../core/hls/fetch';
import {statusLabels as labels,formatProgress,formatSize as size,formatDuration as duration,matchesFilter,type TaskFilter} from './presentation';
type View='page'|'tasks'|'settings';
const version=chrome.runtime.getManifest?.().version||'0.2.9';
function Icon({label,onClick,children,disabled}:{label:string;onClick:()=>void;children:ReactNode;disabled?:boolean}){return <button type="button" className="sl-icon-button" aria-label={label} title={label} onClick={onClick} disabled={disabled}>{children}</button>;}
export function Sidebar() {
  const api=useExtension();
  const {snapshot,tab,authorized,ready}=api;
  const [view,setView]=useState<View>('page'),[busy,setBusy]=useState(false),[toast,setToast]=useState('');
  const [adOpen,setAdOpen]=useState(false),[filter,setFilter]=useState<TaskFilter>('all');
  const [sheet,setSheet]=useState<{asset:MediaAsset;variant:Variant}|null>(null),[filename,setFilename]=useState('');
  const [cancelId,setCancelId]=useState<string>();
  const [taskBusy,setTaskBusy]=useState<Record<string,boolean>>({}),[clearBusy,setClearBusy]=useState(false);
  const operationLocks=useRef(new Set<string>());
  const returnView=useRef<'page'|'tasks'>('page');
  const pageIdentity=(tab?.id??-1)+':'+(tab?.url||'')+':'+(snapshot.page?.documentKey||'')+':'+(snapshot.page?.selection?.playerId||'')+':'+(snapshot.page?.selection?.sourceKey||'');
  const livePage=useRef(pageIdentity);livePage.current=pageIdentity;
    const pendingAction=useRef<{tabId:number;pageUrl:string;playerId?:string;sourceKey?:string;run:()=>Promise<unknown>}|undefined>(undefined);
  useEffect(()=>{setSheet(null);pendingAction.current=undefined;setAdOpen(false);api.setError('');api.setPendingOrigins([]);},[pageIdentity]);
  const dialogRef=useRef<HTMLDivElement>(null);const dialogId=useId();
  const prefs=snapshot.preferences||defaults;
  const assets=snapshot.page&&snapshot.page.pageUrl===tab?.url?snapshot.page.assets:[];
  const selection=snapshot.page?.pageUrl===tab?.url?snapshot.page?.selection:undefined;
  const main=selection?selectedAssets(assets,selection):[],others=assets.filter(a=>!main.some(m=>m.id===a.id));
  const shortcutError=snapshot.page?.pageUrl===tab?.url?snapshot.page?.shortcutError:undefined;
  const active=snapshot.tasks.filter(t=>activeStates.includes(t.state));
  const pendingSaves=snapshot.pendingSaves||[];
  const clearCount=snapshot.tasks.filter(t=>clearableStates.includes(t.state)).length;
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),3500);return()=>clearTimeout(timer);},[toast]);
  useEffect(()=>{if(shortcutError){api.setError(shortcutError.message);api.setPendingOrigins(shortcutError.origins);}},[shortcutError?.message,shortcutError?.origins.join('|')]);
  useEffect(()=>{if(!sheet&&!cancelId)return;const background=document.querySelector<HTMLElement>('.sl-extension');const siblings=[...(background?.children||[])].filter(node=>!node.classList.contains('sl-overlay')) as HTMLElement[];siblings.forEach(node=>node.inert=true);const previous=document.activeElement as HTMLElement|null;
    const items=()=>[...dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input')||[]];(dialogRef.current?.querySelector<HTMLInputElement>('input')||items()[0])?.focus();
    const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();setSheet(null);setCancelId(undefined);}if(e.key==='Tab'){const list=items();if(e.shiftKey&&document.activeElement===list[0]){e.preventDefault();list.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===list.at(-1)){e.preventDefault();list[0]?.focus();}}};
    document.addEventListener('keydown',onKey);return()=>{document.removeEventListener('keydown',onKey);siblings.forEach(node=>node.inert=false);previous?.focus();};
  },[sheet,cancelId]);
  async function perform(action:()=>Promise<unknown>,message?:string) {api.setError('');api.setPendingOrigins([]);try{await action();if(message)setToast(message);}catch(e){api.setPendingOrigins((e as {origins?:string[]})?.origins||[]);api.setError(e instanceof Error?e.message:'操作失败');}}
  async function scan(){if(tab?.id===undefined)return;setBusy(true);await perform(()=>api.send({type:'SCAN',tabId:tab.id!}),'已刷新');setBusy(false);}
  async function withAccess<T>(run:()=>Promise<T>):Promise<T>{const previous=pendingAction.current,identity=livePage.current;try{const result=await run();if(pendingAction.current===previous)pendingAction.current=undefined;return result;}catch(e){if(identity===livePage.current&&(e as {origins?:string[]})?.origins?.length&&tab?.id!==undefined)pendingAction.current={tabId:tab.id,pageUrl:tab.url||'',playerId:selection?.playerId,sourceKey:selection?.sourceKey,run};throw e;}}
  async function grantAccess(all=false){await api.grant(all?['http://*/*','https://*/*']:api.pendingOrigins);const pending=pendingAction.current;pendingAction.current=undefined;if(pending){const current=await chrome.tabs.get(pending.tabId);if(pending.tabId===tab?.id&&pending.pageUrl===current.url){const latest=await api.send<import('../../core/model').Snapshot>({type:'SNAPSHOT',tabId:pending.tabId});if(!pending.playerId||(latest.page?.selection?.playerId===pending.playerId&&latest.page.selection.sourceKey===pending.sourceKey))await pending.run();}}}
  async function resolve(asset:MediaAsset){return withAccess(()=>api.send<MediaAsset>({type:'RESOLVE',tabId:tab!.id!,assetId:asset.id}));}
  async function start(asset:MediaAsset,variant:Variant,name?:string){
    if(tab?.id===undefined||operationLocks.current.has('start'))return;
    operationLocks.current.add('start');setBusy(true);await perform(()=>withAccess(async()=>{const result=await api.send<StartResult>({type:'START',tabId:tab.id!,assetId:asset.id,variantId:variant.id,filename:name});setSheet(null);setView('tasks');setFilter('all');setToast(result.pending?'请选择保存位置':result.duplicate?'视频正在下载':result.failed?'下载未启动，请重试':'已开始下载');}));setBusy(false);operationLocks.current.delete('start');
  }
  async function requestStart(asset:MediaAsset,variant:Variant){
    if(operationLocks.current.has('request-start'))return;operationLocks.current.add('request-start');
    await perform(()=>withAccess(async()=>{
      const identity=livePage.current;const origins=[...new Set([variant.url,...variant.dash?[variant.dash.audio.url]:[]].map(originPattern))];
      if(!await chrome.permissions.contains({origins})){api.setPendingOrigins(origins);throw new PermissionError(origins);}
      if(identity!==livePage.current)throw new Error('视频已切换，请重新选择');
      if(prefs.editFilename&&!prefs.saveAs){setFilename(asset.title);setSheet({asset,variant});}else await start(asset,variant);
    }));operationLocks.current.delete('request-start');
  }
  async function taskAction(task:DownloadRecord,action:'pause'|'resume'|'retry'|'cancel'|'show'|'source') {
    if(operationLocks.current.has(task.id))return;operationLocks.current.add(task.id);setTaskBusy(current=>({...current,[task.id]:true}));
    await perform(async()=>{const result=await withAccess(()=>api.send<StartResult|undefined>({type:'TASK',id:task.id,action}));if(result?.pending)setToast('请选择保存位置');});
    operationLocks.current.delete(task.id);setTaskBusy(current=>({...current,[task.id]:false}));
  }
  async function clearRecords(){
    if(operationLocks.current.has('clear')||!clearCount)return;operationLocks.current.add('clear');setClearBusy(true);
    await perform(()=>api.send({type:'CLEAR'}),'已清理记录');setClearBusy(false);operationLocks.current.delete('clear');
  }
  const filtered=snapshot.tasks.filter(t=>matchesFilter(t,filter));
  const filterCounts={all:snapshot.tasks.length+pendingSaves.length,active:active.length+pendingSaves.length,failed:snapshot.tasks.filter(t=>t.state==='failed').length,ended:clearCount};
  const showPending=filter==='all'||filter==='active';
  const emptyTitles:Record<TaskFilter,string>={all:'暂无下载任务',active:'暂无进行中的任务',failed:'暂无失败任务',ended:'暂无已结束记录'};
  return <div className={`sl-preview sl-live ${prefs.theme==='dark'?'sl-dark':''}`}><section className="sl-extension" aria-label="拾影侧栏">
    <header className="sl-app-header"><span className="sl-brand"><span className="sl-brand-icon"><ArrowDownToLine size={19}/></span><strong>拾影</strong></span><Icon label="设置" onClick={()=>{if(view!=='settings')returnView.current=view;setView('settings');}}><Settings2 size={17}/></Icon></header>
    <nav className="sl-app-navigation" aria-label="侧栏导航"><button aria-current={view==='page'?'page':undefined} className={view==='page'?'active':''} onClick={()=>setView('page')}>当前页面{main.length>0&&<span>{main.length}</span>}</button><button aria-current={view==='tasks'?'page':undefined} className={view==='tasks'?'active':''} onClick={()=>setView('tasks')}>下载任务{active.length+pendingSaves.length>0&&<span>{active.length+pendingSaves.length}</span>}</button></nav>
    {api.error&&<div className="sl-live-error" role="alert"><Info size={15}/><div><span>{api.error}</span>{api.pendingOrigins.length>0&&<><small>{api.pendingOrigins.map(o=>new URL(o).hostname).join('、')}</small><button className="sl-secondary" onClick={()=>void perform(()=>grantAccess(),'已允许资源访问')}>允许访问</button><button className="sl-secondary" onClick={()=>void perform(()=>grantAccess(true),'已恢复访问')}>恢复全部访问</button><small>Chrome 限制了站点访问。</small></>}</div><button onClick={()=>api.setError('')} aria-label="关闭错误提示"><X size={14}/></button></div>}
    {view==='page'&&<div className="sl-page-content"><div className="sl-source-row"><Globe size={14}/><span>{httpUrl(tab?.url)?new URL(tab!.url!).hostname:'当前标签页'}</span><Icon label="重新检测" disabled={busy||!authorized} onClick={()=>void scan()}><RefreshCw size={15} className={busy?'spin':''}/></Icon></div>
      {!ready?<Empty icon={<LoaderCircle className="spin" size={28}/>} title="连接中" description=""/>:!httpUrl(tab?.url)?<Empty icon={<Globe size={28}/>} title="请打开视频网页" description="此页面不支持视频检测。"/>:!authorized?<Empty icon={<ShieldCheck size={28}/>} title="站点访问受限" description="请在 Chrome 中允许此站点访问。" action="允许访问" onAction={()=>void perform(()=>api.grant(),'已允许访问')}/>:<>
        {!selection?<Empty icon={<Play size={28}/>} title="选择要下载的视频" description="点击网页播放器，自动识别视频和清晰度。"/>:!main.length?<Empty icon={<ScanLine size={28}/>} title="正在识别视频" description="播放几秒后会自动显示。" action={busy?'检测中…':'重新检测'} onAction={()=>void scan()}/>:null}

        {main.map(asset=><Resource key={pageIdentity+':'+asset.id} asset={asset} prefs={prefs} resolve={resolve} onStart={requestStart} onAccess={origins=>void perform(()=>api.grant(origins))} busy={busy}/>)}
        {others.length>0&&<><button className="sl-ads-toggle" aria-expanded={adOpen} onClick={()=>setAdOpen(!adOpen)}><FileVideo size={14}/><span>其他视频 · {others.length}</span><ChevronDown size={14} className={adOpen?'rotate':''}/></button>{adOpen&&<div className="sl-other-list">{others.map(a=><div key={a.id} className="sl-other-resource"><FileVideo size={16}/><span title={a.title}>{a.title}</span></div>)}<p>点击网页中的对应播放器以选择视频</p></div>}</>}

      </>}
    </div>}
    {view==='tasks'&&<div className="sl-task-content"><div className="sl-section-heading"><div><h2>任务</h2></div><button className="sl-secondary sl-clear-button" title="清除已完成和已取消的记录，保留失败任务" disabled={!clearCount||clearBusy} aria-busy={clearBusy} onClick={()=>void clearRecords()}>{clearBusy?<LoaderCircle size={14} className="spin"/>:<Trash2 size={14}/>}清理记录</button></div><div className="sl-task-filters" role="group" aria-label="任务筛选">{([['all','全部'],['active','进行中'],['failed','失败'],['ended','已结束']] as const).map(([id,label])=><button key={id} className={filter===id?'active':''} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}<span className="sl-filter-count">{filterCounts[id]}</span></button>)}</div>
      {showPending&&pendingSaves.map(save=><article key={save.id} className="sl-pending-card"><FolderOpen size={19}/><div><h3 title={save.filename}>{save.filename}</h3><p>等待选择保存位置</p></div><div className="sl-pending-actions"><button className="sl-secondary" onClick={()=>void perform(()=>api.send({type:'SAVE_FOCUS',requestId:save.id}))}>继续</button><button className="sl-text-button" onClick={()=>void perform(()=>api.send({type:'SAVE_CANCEL',requestId:save.id}))}>取消</button></div></article>)}
      {!filtered.length&&!(showPending&&pendingSaves.length)?<Empty icon={<ArrowDownToLine size={28}/>} title={emptyTitles[filter]} description="" action={filter==='all'?'查看当前页面':'查看全部任务'} onAction={()=>filter==='all'?setView('page'):setFilter('all')}/>:filtered.map(task=><RecordCard key={task.id} task={task} busy={!!taskBusy[task.id]||pendingSaves.some(save=>save.retryId===task.id)} onAction={a=>a==='cancel'?setCancelId(task.id):void taskAction(task,a)}/>)}
    </div>}
    {view==='settings'&&<div className="sl-settings-content"><button className="sl-settings-back" onClick={()=>setView(returnView.current)}><ArrowLeft size={15}/>返回</button><h2>下载设置</h2><div className="sl-settings-group"><label className="sl-field-label" htmlFor="default-quality">默认清晰度</label><div className="sl-select-field"><select id="default-quality" value={prefs.quality} onChange={e=>void perform(()=>api.send({type:'PREFERENCES',patch:{quality:e.target.value as Preferences['quality']}}))}><option value="best">最高画质</option><option value="720">720p</option><option value="480">480p</option></select><ChevronDown size={15}/></div></div>
      {!api.automaticAccess&&<div className="sl-setting-row"><div><strong>站点访问受限</strong></div><button className="sl-secondary" onClick={()=>void perform(()=>grantAccess(true),'已恢复自动访问')}>恢复访问</button></div>}
      {([{key:'editFilename',title:'下载前编辑文件名',detail:''},{key:'saveAs',title:'下载前选择保存位置',detail:'边下载边写入磁盘'}] as const).map(s=><div className="sl-setting-row" key={s.key}><div><strong>{s.title}</strong>{(s.key==='editFilename'&&prefs.saveAs)?<small>文件名在保存窗口修改</small>:s.detail&&<small>{s.detail}</small>}</div><label className="sl-switch"><input type="checkbox" aria-label={s.title} disabled={s.key==='editFilename'&&prefs.saveAs} checked={prefs[s.key]} onChange={e=>void perform(()=>api.send({type:'PREFERENCES',patch:{[s.key]:e.target.checked}}))}/><span/></label></div>)}
      <div className="sl-setting-row"><div><strong>深色外观</strong></div><label className="sl-switch"><input type="checkbox" aria-label="深色外观" checked={prefs.theme==='dark'} onChange={e=>void perform(()=>api.send({type:'PREFERENCES',patch:{theme:e.target.checked?'dark':'light'}}))}/><span/></label></div></div>}
    <footer className="sl-app-footer"><span>StreamLens</span><span>v{version}</span></footer>
    {toast&&<div className="sl-toast" role="status"><Check size={15}/><span>{toast}</span><button onClick={()=>setToast('')} aria-label="关闭提示"><X size={14}/></button></div>}
    {sheet&&<div className="sl-overlay" ref={dialogRef}><form className="sl-sheet" role="dialog" aria-modal="true" aria-labelledby={dialogId} onSubmit={e=>{e.preventDefault();if(filename.trim())void start(sheet.asset,sheet.variant,filename);}}><div className="sl-sheet-header"><h2 id={dialogId}>文件名</h2><Icon label="关闭文件名编辑" onClick={()=>setSheet(null)}><X size={17}/></Icon></div><p>{sheet.variant.label} · {sheet.asset.protocol==='WEBM'?'WebM':'MP4'}</p><label className="sl-field-label" htmlFor="download-filename">文件名</label><input id="download-filename" value={filename} required maxLength={110} onChange={e=>setFilename(e.target.value)}/><small>自动附加清晰度与文件扩展名</small><div className="sl-sheet-actions"><button type="button" className="sl-secondary" onClick={()=>setSheet(null)}>取消</button><button className="sl-primary" disabled={busy} type="submit"><ArrowDownToLine size={15}/>开始下载</button></div></form></div>}
    {cancelId&&<div className="sl-overlay" ref={dialogRef}><div className="sl-sheet" role="dialog" aria-modal="true" aria-labelledby={dialogId}><h2 id={dialogId}>取消下载？</h2><p>下载将停止，记录会保留。</p><div className="sl-sheet-actions"><button className="sl-secondary" onClick={()=>setCancelId(undefined)}>返回</button><button className="sl-danger-button" onClick={()=>{const task=snapshot.tasks.find(t=>t.id===cancelId);if(task)void taskAction(task,'cancel');setCancelId(undefined);}}>取消下载</button></div></div></div>}
  </section></div>;
}
function Empty({icon,title,description,action,onAction}:{icon:ReactNode;title:string;description:string;action?:string;onAction?:()=>void}){return <div className="sl-empty"><span className="sl-empty-icon">{icon}</span><h2>{title}</h2>{description&&<p>{description}</p>}{action&&<button className="sl-primary" onClick={onAction}>{action}<ArrowRight size={15}/></button>}</div>;}
function Resource({asset,prefs,resolve,onStart,onAccess,busy}:{asset:MediaAsset;prefs:Preferences;resolve:(a:MediaAsset)=>Promise<MediaAsset>;onStart:(a:MediaAsset,v:Variant)=>Promise<void>;onAccess:(origins:string[])=>void;busy:boolean}) {
  const [loading,setLoading]=useState(false),[failure,setFailure]=useState(''),[failureOrigins,setFailureOrigins]=useState<string[]>([]),[variantId,setVariantId]=useState('');
  const [local,setLocal]=useState<MediaAsset>();
  const fresh=local&&(!asset.resolvedAt||(local.resolvedAt||0)>asset.resolvedAt)?local:asset;
  const variants=fresh?.variants||asset.variants||[];
  const selected=variants.find(v=>v.id===variantId)||variants.find(v=>String(v.height)===prefs.quality)||variants[0];
  const parseLock=useRef(false),attempted=useRef(false),mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const error=loading||asset.resolutionState==='loading'?'':failure||(fresh?.resolutionError||'');
  const parsing=loading||asset.resolutionState==='loading'||(!variants.length&&!error&&!asset.protected);
  const missingOrigins=failureOrigins.length?failureOrigins:fresh?.resolutionOrigins||[];
  async function parse(){
    if(parseLock.current)return;attempted.current=true;parseLock.current=true;setLoading(true);setFailure('');setFailureOrigins([]);
    try{const resolved=await resolve(asset);if(mounted.current){setLocal(resolved);setVariantId('');}}
    catch(e){if(mounted.current){setFailure(e instanceof Error?e.message:'无法识别视频，请重试');setFailureOrigins((e as {origins?:string[]})?.origins||[]);}}
    finally{parseLock.current=false;if(mounted.current)setLoading(false);}
  }
  useEffect(()=>{if(asset.resolutionState==='ready'||asset.resolutionState==='loading'){setFailure('');setFailureOrigins([]);}if(asset.resolutionState==='loading')setLocal(undefined);},[asset.resolutionState,asset.resolvedAt]);
  useEffect(()=>{if(!attempted.current&&!asset.protected&&!asset.resolutionState&&!variants.length)void parse();},[asset.id,asset.resolutionState]);
  return <article className="sl-media-card" aria-busy={parsing||busy}>
    <div className="sl-media-heading"><span className="sl-media-icon"><FileVideo size={23}/></span><div><h2 title={asset.title}>{asset.title}</h2><p><span className={`sl-player-status ${asset.playing?'playing':''}`}><span/>{asset.playing?'正在播放':'已选择'}</span>{!!(asset.duration||local?.duration)&&<span>{duration(asset.duration||local?.duration)}</span>}</p></div></div>
    {asset.protected?<div className="sl-inline-error"><LockKeyhole size={16}/><span>此视频受保护，无法下载。</span></div>:error?<div className="sl-inline-error" role="alert"><Info size={16}/><div><p>{error}</p><button className="sl-secondary" disabled={loading||busy} onClick={()=>missingOrigins.length?onAccess(missingOrigins):void parse()}><RefreshCw size={14}/>{missingOrigins.length?'允许访问':'重试'}</button></div></div>:<>
      <div className="sl-download-options"><label>清晰度</label>{parsing?<div className="sl-resolving" role="status"><LoaderCircle size={15} className="spin"/>正在识别清晰度…</div>:<div className="sl-select-wrap"><select aria-label="视频清晰度" disabled={busy} value={selected?.id||''} onChange={e=>setVariantId(e.target.value)}>{variants.map(v=><option key={v.id} value={v.id}>{v.label.replace(/ · 当前源$/,'')}</option>)}</select><ChevronDown size={15}/></div>}</div>
      <button className="sl-primary sl-download-button" disabled={busy||parsing||!selected} onClick={()=>selected&&void onStart(asset,selected)}>{busy?<LoaderCircle size={17} className="spin"/>:<ArrowDownToLine size={17}/>}<span>{busy?'正在创建任务…':prefs.saveAs?'选择位置并下载':'下载视频'}</span></button>
    </>}
  </article>;
}
function RecordCard({task,onAction,busy}:{task:DownloadRecord;busy:boolean;onAction:(action:'pause'|'resume'|'retry'|'cancel'|'show'|'source')=>void}) {
  const progress=taskProgress(task);const active=activeStates.includes(task.state);const processing=['resolving','merging','saving'].includes(task.state);
  return <article className={`sl-task-card ${task.state==='failed'?'failed':''}`} aria-busy={busy}><div className="sl-task-top"><span className="sl-file-icon">{task.state==='completed'?<Check size={19}/>:<FileVideo size={19}/>}</span><div><h3 title={task.filename}>{task.filename}</h3><p>{task.quality.replace(/ · 当前源$/,'')}</p></div>{task.state==='downloading'?<Icon label="暂停下载" disabled={busy} onClick={()=>onAction('pause')}><Pause size={15}/></Icon>:task.state==='paused'?<Icon label={task.destinationId&&['MP4','WEBM'].includes(task.protocol)?'继续下载（从头读取）':'继续下载'} disabled={busy} onClick={()=>onAction('resume')}><Play size={15}/></Icon>:processing?<LoaderCircle size={16} className="spin"/>:null}</div><div className="sl-task-status"><span>{busy?'处理中…':labels[task.state]}</span><strong>{['failed','cancelled'].includes(task.state)?'':progress!==undefined?formatProgress(progress):''}</strong></div>
    {(active||task.state==='completed')&&<div className={`sl-progress ${progress===undefined&&active?'indeterminate':''}`} role="progressbar" aria-label="下载进度" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><div style={{width:progress!==undefined?`${progress}%`:active?'30%':'0%'}}/></div>}<div className="sl-task-stats"><span>{`${size(task.bytes)}${task.totalBytes?' / '+size(task.totalBytes):''}`}</span><span>{task.state==='downloading'&&task.speed>0?size(task.speed)+'/s':''}</span></div>
    {task.error&&<p className="sl-task-error"><Info size={13}/>{task.error}</p>}
    <div className="sl-task-actions">{['failed','cancelled'].includes(task.state)&&<button className="sl-secondary" disabled={busy} title="重新下载，会从头开始" onClick={()=>onAction('retry')}>{busy?<LoaderCircle size={13} className="spin"/>:<RefreshCw size={13}/>}{task.neededOrigins?.length?'允许访问并重试':'重试'}</button>}{task.state==='completed'&&task.downloadId!==undefined&&<button className="sl-secondary" disabled={busy} onClick={()=>onAction('show')}><FolderOpen size={14}/>打开文件夹</button>}{active&&task.state!=='saving'&&<button className="sl-text-button" disabled={busy} onClick={()=>onAction('cancel')}><Square size={11}/>取消下载</button>}<button className="sl-text-button" disabled={busy} onClick={()=>onAction('source')}><ExternalLink size={12}/>查看网页</button></div>
  </article>;
}
