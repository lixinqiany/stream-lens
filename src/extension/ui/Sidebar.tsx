import {t,setLanguage,currentLocale,applyDocumentLanguage,localizeText,localizeQuality} from '../../i18n';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowLeft, ArrowRight, Check, ChevronDown, ExternalLink, FileVideo, FolderOpen, Globe, Info, LoaderCircle, LockKeyhole, Pause, Play, RefreshCw, ScanLine, Settings2, ShieldCheck, Square, Trash2, X } from 'lucide-react';
import { activeStates, clearableStates, defaults, httpUrl, originPattern, taskProgress, type DownloadRecord, type MediaAsset, type Preferences, type Variant } from '../../core/model';
import type { StartResult } from '../../platform/messages';
import { useExtension } from './use-extension';
import {selectedAssets} from '../../core/discovery/selection';
import {PermissionError} from '../../core/hls/fetch';
import {statusLabel,formatProgress,formatSize as size,formatDuration as duration,matchesFilter,type TaskFilter} from './presentation';
type View='page'|'tasks'|'settings';
const version=chrome.runtime.getManifest?.().version||'0.3.0';
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
  setLanguage(prefs.language);
  useEffect(()=>{applyDocumentLanguage();document.title=t("app_title");},[prefs.language]);
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
  async function perform(action:()=>Promise<unknown>,message?:string) {api.setError('');api.setPendingOrigins([]);try{await action();if(message)setToast(message);}catch(e){api.setPendingOrigins((e as {origins?:string[]})?.origins||[]);api.setError(e instanceof Error?e.message:t("operation_failed"));}}
  async function scan(){if(tab?.id===undefined)return;setBusy(true);await perform(()=>api.send({type:'SCAN',tabId:tab.id!}),t("refreshed"));setBusy(false);}
  async function withAccess<T>(run:()=>Promise<T>):Promise<T>{const previous=pendingAction.current,identity=livePage.current;try{const result=await run();if(pendingAction.current===previous)pendingAction.current=undefined;return result;}catch(e){if(identity===livePage.current&&(e as {origins?:string[]})?.origins?.length&&tab?.id!==undefined)pendingAction.current={tabId:tab.id,pageUrl:tab.url||'',playerId:selection?.playerId,sourceKey:selection?.sourceKey,run};throw e;}}
  async function grantAccess(all=false){await api.grant(all?['http://*/*','https://*/*']:api.pendingOrigins);const pending=pendingAction.current;pendingAction.current=undefined;if(pending){const current=await chrome.tabs.get(pending.tabId);if(pending.tabId===tab?.id&&pending.pageUrl===current.url){const latest=await api.send<import('../../core/model').Snapshot>({type:'SNAPSHOT',tabId:pending.tabId});if(!pending.playerId||(latest.page?.selection?.playerId===pending.playerId&&latest.page.selection.sourceKey===pending.sourceKey))await pending.run();}}}
  async function resolve(asset:MediaAsset){return withAccess(()=>api.send<MediaAsset>({type:'RESOLVE',tabId:tab!.id!,assetId:asset.id}));}
  async function start(asset:MediaAsset,variant:Variant,name?:string){
    if(tab?.id===undefined||operationLocks.current.has('start'))return;
    operationLocks.current.add('start');setBusy(true);await perform(()=>withAccess(async()=>{const result=await api.send<StartResult>({type:'START',tabId:tab.id!,assetId:asset.id,variantId:variant.id,filename:name});setSheet(null);setView('tasks');setFilter('all');setToast(result.pending?t("choose_a_save_location"):result.duplicate?t("this_video_is_already_downloading"):result.failed?t("download_did_not_start_please_retry"):t("download_started"));}));setBusy(false);operationLocks.current.delete('start');
  }
  async function requestStart(asset:MediaAsset,variant:Variant){
    if(operationLocks.current.has('request-start'))return;operationLocks.current.add('request-start');
    await perform(()=>withAccess(async()=>{
      const identity=livePage.current;const origins=[...new Set([variant.url,...variant.dash?[variant.dash.audio.url]:[]].map(originPattern))];
      if(!await chrome.permissions.contains({origins})){api.setPendingOrigins(origins);throw new PermissionError(origins);}
      if(identity!==livePage.current)throw new Error(t("the_video_changed_select_it_again_105"));
      if(prefs.editFilename&&!prefs.saveAs){setFilename(asset.title);setSheet({asset,variant});}else await start(asset,variant);
    }));operationLocks.current.delete('request-start');
  }
  async function taskAction(task:DownloadRecord,action:'pause'|'resume'|'retry'|'cancel'|'show'|'source') {
    if(operationLocks.current.has(task.id))return;operationLocks.current.add(task.id);setTaskBusy(current=>({...current,[task.id]:true}));
    await perform(async()=>{const result=await withAccess(()=>api.send<StartResult|undefined>({type:'TASK',id:task.id,action}));if(result?.pending)setToast(t("choose_a_save_location"));});
    operationLocks.current.delete(task.id);setTaskBusy(current=>({...current,[task.id]:false}));
  }
  async function clearRecords(){
    if(operationLocks.current.has('clear')||!clearCount)return;operationLocks.current.add('clear');setClearBusy(true);
    await perform(()=>api.send({type:'CLEAR'}),t("records_cleared"));setClearBusy(false);operationLocks.current.delete('clear');
  }
  const filtered=snapshot.tasks.filter(t=>matchesFilter(t,filter));
  const filterCounts={all:snapshot.tasks.length+pendingSaves.length,active:active.length+pendingSaves.length,failed:snapshot.tasks.filter(t=>t.state==='failed').length,ended:clearCount};
  const showPending=filter==='all'||filter==='active';
  const emptyTitles:Record<TaskFilter,string>={all:t("no_downloads_yet"),active:t("no_active_downloads"),failed:t("no_failed_downloads"),ended:t("no_finished_downloads")};
  return <div className={`sl-preview sl-live ${prefs.theme==='dark'?'sl-dark':''}`}><section className="sl-extension" aria-label={t("streamlens_sidebar")}>
    <header className="sl-app-header"><span className="sl-brand"><span className="sl-brand-icon"><ArrowDownToLine size={19}/></span><strong>{t("streamlens_199")}</strong></span><Icon label={t("settings")} onClick={()=>{if(view!=='settings')returnView.current=view;setView('settings');}}><Settings2 size={17}/></Icon></header>
    <nav className="sl-app-navigation" aria-label={t("sidebar_navigation")}><button aria-current={view==='page'?'page':undefined} className={view==='page'?'active':''} onClick={()=>setView('page')}>{t("current_page")}{main.length>0&&<span>{main.length}</span>}</button><button aria-current={view==='tasks'?'page':undefined} className={view==='tasks'?'active':''} onClick={()=>setView('tasks')}>{t("downloads")}{active.length+pendingSaves.length>0&&<span>{active.length+pendingSaves.length}</span>}</button></nav>
    {api.error&&<div className="sl-live-error" role="alert"><Info size={15}/><div><span>{localizeText(api.error)}</span>{api.pendingOrigins.length>0&&<><small>{api.pendingOrigins.map(o=>new URL(o).hostname).join(currentLocale()==='zh_CN'?'、':', ')}</small><button className="sl-secondary" onClick={()=>void perform(()=>grantAccess(),t("resource_access_allowed"))}>{t("allow_access")}</button><button className="sl-secondary" onClick={()=>void perform(()=>grantAccess(true),t("access_restored"))}>{t("restore_all_access")}</button><small>{t("chrome_has_restricted_site_access")}</small></>}</div><button onClick={()=>api.setError('')} aria-label={t("dismiss_error")}><X size={14}/></button></div>}
    {view==='page'&&<div className="sl-page-content"><div className="sl-source-row"><Globe size={14}/><span>{httpUrl(tab?.url)?new URL(tab!.url!).hostname:t("current_tab")}</span><Icon label={t("detect_again")} disabled={busy||!authorized} onClick={()=>void scan()}><RefreshCw size={15} className={busy?'spin':''}/></Icon></div>
      {!ready?<Empty icon={<LoaderCircle className="spin" size={28}/>} title={t("connecting")} description=""/>:!httpUrl(tab?.url)?<Empty icon={<Globe size={28}/>} title={t("open_a_video_page")} description={t("video_detection_is_unavailable_on_this_page")}/>:!authorized?<Empty icon={<ShieldCheck size={28}/>} title={t("site_access_restricted")} description={t("allow_access_to_this_site_in_chrome")} action={t("allow_access")} onAction={()=>void perform(()=>api.grant(),t("access_allowed"))}/>:<>
        {!selection?<Empty icon={<Play size={28}/>} title={t("select_a_video_to_download")} description={t("click_a_player_to_detect_its_video_and")}/>:!main.length?<Empty icon={<ScanLine size={28}/>} title={t("detecting_video")} description={t("play_for_a_few_seconds_to_detect_the")} action={busy?t("detecting"):t("detect_again")} onAction={()=>void scan()}/>:null}

        {main.map(asset=><Resource key={pageIdentity+':'+asset.id} asset={asset} prefs={prefs} resolve={resolve} onStart={requestStart} onAccess={origins=>void perform(()=>api.grant(origins))} busy={busy}/>)}
        {others.length>0&&<><button className="sl-ads-toggle" aria-expanded={adOpen} onClick={()=>setAdOpen(!adOpen)}><FileVideo size={14}/><span>{t("other_videos",[others.length])}</span><ChevronDown size={14} className={adOpen?'rotate':''}/></button>{adOpen&&<div className="sl-other-list">{others.map(a=><div key={a.id} className="sl-other-resource"><FileVideo size={16}/><span title={a.title}>{a.title}</span></div>)}<p>{t("click_the_corresponding_player_on_the_page_to")}</p></div>}</>}

      </>}
    </div>}
    {view==='tasks'&&<div className="sl-task-content"><div className="sl-section-heading"><div><h2>{t("downloads_225")}</h2></div><button className="sl-secondary sl-clear-button" title={t("clear_completed_and_cancelled_records_failed_downloads_are")} disabled={!clearCount||clearBusy} aria-busy={clearBusy} onClick={()=>void clearRecords()}>{clearBusy?<LoaderCircle size={14} className="spin"/>:<Trash2 size={14}/>}{t("clear_finished")}</button></div><div className="sl-task-filters" role="group" aria-label={t("download_filters")}>{([['all',t("all")],['active',t("active")],['failed',t("failed")],['ended',t("finished")]] as const).map(([id,label])=><button key={id} className={filter===id?'active':''} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}<span className="sl-filter-count">{filterCounts[id]}</span></button>)}</div>
      {showPending&&pendingSaves.map(save=><article key={save.id} className="sl-pending-card"><FolderOpen size={19}/><div><h3 title={save.filename}>{save.filename}</h3><p>{t("waiting_for_a_save_location")}</p></div><div className="sl-pending-actions"><button className="sl-secondary" onClick={()=>void perform(()=>api.send({type:'SAVE_FOCUS',requestId:save.id}))}>{t("continue")}</button><button className="sl-text-button" onClick={()=>void perform(()=>api.send({type:'SAVE_CANCEL',requestId:save.id}))}>{t("cancel")}</button></div></article>)}
      {!filtered.length&&!(showPending&&pendingSaves.length)?<Empty icon={<ArrowDownToLine size={28}/>} title={emptyTitles[filter]} description="" action={filter==='all'?t("view_current_page"):t("view_all_downloads")} onAction={()=>filter==='all'?setView('page'):setFilter('all')}/>:filtered.map(task=><RecordCard key={task.id} task={task} busy={!!taskBusy[task.id]||pendingSaves.some(save=>save.retryId===task.id)} onAction={a=>a==='cancel'?setCancelId(task.id):void taskAction(task,a)}/>)}
    </div>}
    {view==='settings'&&<div className="sl-settings-content"><button className="sl-settings-back" onClick={()=>setView(returnView.current)}><ArrowLeft size={15}/>{t("back")}</button><h2>{t("download_settings")}</h2><div className="sl-settings-group"><label className="sl-field-label" htmlFor="default-quality">{t("default_quality")}</label><div className="sl-select-field"><select id="default-quality" value={prefs.quality} onChange={e=>void perform(()=>api.send({type:'PREFERENCES',patch:{quality:e.target.value as Preferences['quality']}}))}><option value="best">{t("best_quality")}</option><option value="720">720p</option><option value="480">480p</option></select><ChevronDown size={15}/></div></div>
      <div className="sl-settings-group"><label className="sl-field-label" htmlFor="interface-language">{t("language")}</label><div className="sl-select-field"><select id="interface-language" value={prefs.language||'auto'} onChange={e=>void perform(()=>api.send({type:'PREFERENCES',patch:{language:e.target.value as Preferences['language']}}))}><option value="auto">{t("language_auto")}</option><option value="zh_CN">简体中文</option><option value="en">English</option></select><ChevronDown size={15}/></div></div>
      {!api.automaticAccess&&<div className="sl-setting-row"><div><strong>{t("site_access_restricted")}</strong></div><button className="sl-secondary" onClick={()=>void perform(()=>grantAccess(true),t("automatic_access_restored"))}>{t("restore_access")}</button></div>}
      {([{key:'editFilename',title:t("edit_filename_before_download"),detail:''},{key:'saveAs',title:t("choose_location_before_download"),detail:t("stream_downloads_to_disk")}] as const).map(s=><div className="sl-setting-row" key={s.key}><div><strong>{s.title}</strong>{(s.key==='editFilename'&&prefs.saveAs)?<small>{t("edit_the_filename_in_the_save_dialog")}</small>:s.detail&&<small>{s.detail}</small>}</div><label className="sl-switch"><input type="checkbox" aria-label={s.title} disabled={s.key==='editFilename'&&prefs.saveAs} checked={prefs[s.key]} onChange={e=>void perform(()=>api.send({type:'PREFERENCES',patch:{[s.key]:e.target.checked}}))}/><span/></label></div>)}
      <div className="sl-setting-row"><div><strong>{t("dark_appearance")}</strong></div><label className="sl-switch"><input type="checkbox" aria-label={t("dark_appearance")} checked={prefs.theme==='dark'} onChange={e=>void perform(()=>api.send({type:'PREFERENCES',patch:{theme:e.target.checked?'dark':'light'}}))}/><span/></label></div></div>}
    <footer className="sl-app-footer"><span>StreamLens</span><span>v{version}</span></footer>
    {toast&&<div className="sl-toast" role="status"><Check size={15}/><span>{localizeText(toast)}</span><button onClick={()=>setToast('')} aria-label={t("dismiss_notification")}><X size={14}/></button></div>}
    {sheet&&<div className="sl-overlay" ref={dialogRef}><form className="sl-sheet" role="dialog" aria-modal="true" aria-labelledby={dialogId} onSubmit={e=>{e.preventDefault();if(filename.trim())void start(sheet.asset,sheet.variant,filename);}}><div className="sl-sheet-header"><h2 id={dialogId}>{t("filename")}</h2><Icon label={t("close_filename_editor")} onClick={()=>setSheet(null)}><X size={17}/></Icon></div><p>{localizeQuality(sheet.variant.label)} · {sheet.asset.protocol==='WEBM'?'WebM':'MP4'}</p><label className="sl-field-label" htmlFor="download-filename">{t("filename")}</label><input id="download-filename" value={filename} required maxLength={110} onChange={e=>setFilename(e.target.value)}/><small>{t("quality_and_file_extension_are_added_automatically")}</small><div className="sl-sheet-actions"><button type="button" className="sl-secondary" onClick={()=>setSheet(null)}>{t("cancel")}</button><button className="sl-primary" disabled={busy} type="submit"><ArrowDownToLine size={15}/>{t("start_download")}</button></div></form></div>}
    {cancelId&&<div className="sl-overlay" ref={dialogRef}><div className="sl-sheet" role="dialog" aria-modal="true" aria-labelledby={dialogId}><h2 id={dialogId}>{t("cancel_download")}</h2><p>{t("the_download_will_stop_its_record_will_be")}</p><div className="sl-sheet-actions"><button className="sl-secondary" onClick={()=>setCancelId(undefined)}>{t("back")}</button><button className="sl-danger-button" onClick={()=>{const task=snapshot.tasks.find(t=>t.id===cancelId);if(task)void taskAction(task,'cancel');setCancelId(undefined);}}>{t("cancel_download_254")}</button></div></div></div>}
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
    catch(e){if(mounted.current){setFailure(e instanceof Error?e.message:t("cannot_detect_the_video_please_retry"));setFailureOrigins((e as {origins?:string[]})?.origins||[]);}}
    finally{parseLock.current=false;if(mounted.current)setLoading(false);}
  }
  useEffect(()=>{if(asset.resolutionState==='ready'||asset.resolutionState==='loading'){setFailure('');setFailureOrigins([]);}if(asset.resolutionState==='loading')setLocal(undefined);},[asset.resolutionState,asset.resolvedAt]);
  useEffect(()=>{if(!attempted.current&&!asset.protected&&!asset.resolutionState&&!variants.length)void parse();},[asset.id,asset.resolutionState]);
  return <article className="sl-media-card" aria-busy={parsing||busy}>
    <div className="sl-media-heading"><span className="sl-media-icon"><FileVideo size={23}/></span><div><h2 title={asset.title}>{asset.title}</h2><p><span className={`sl-player-status ${asset.playing?'playing':''}`}><span/>{asset.playing?t("playing"):t("selected")}</span>{!!(asset.duration||local?.duration)&&<span>{duration(asset.duration||local?.duration)}</span>}</p></div></div>
    {asset.protected?<div className="sl-inline-error"><LockKeyhole size={16}/><span>{t("this_video_is_protected_and_cannot_be_downloaded")}</span></div>:error?<div className="sl-inline-error" role="alert"><Info size={16}/><div><p>{localizeText(error)}</p><button className="sl-secondary" disabled={loading||busy} onClick={()=>missingOrigins.length?onAccess(missingOrigins):void parse()}><RefreshCw size={14}/>{missingOrigins.length?t("allow_access"):t("retry")}</button></div></div>:<>
      <div className="sl-download-options"><label>{t("quality")}</label>{parsing?<div className="sl-resolving" role="status"><LoaderCircle size={15} className="spin"/>{t("detecting_quality")}</div>:<div className="sl-select-wrap"><select aria-label={t("video_quality")} disabled={busy} value={selected?.id||''} onChange={e=>setVariantId(e.target.value)}>{variants.map(v=><option key={v.id} value={v.id}>{localizeQuality(v.label)}</option>)}</select><ChevronDown size={15}/></div>}</div>
      <button className="sl-primary sl-download-button" disabled={busy||parsing||!selected} onClick={()=>selected&&void onStart(asset,selected)}>{busy?<LoaderCircle size={17} className="spin"/>:<ArrowDownToLine size={17}/>}<span>{busy?t("creating_download"):prefs.saveAs?t("choose_location_download"):t("download_video")}</span></button>
    </>}
  </article>;
}
function RecordCard({task,onAction,busy}:{task:DownloadRecord;busy:boolean;onAction:(action:'pause'|'resume'|'retry'|'cancel'|'show'|'source')=>void}) {
  const progress=taskProgress(task);const active=activeStates.includes(task.state);const processing=['resolving','merging','saving'].includes(task.state);
  return <article className={`sl-task-card ${task.state==='failed'?'failed':''}`} aria-busy={busy}><div className="sl-task-top"><span className="sl-file-icon">{task.state==='completed'?<Check size={19}/>:<FileVideo size={19}/>}</span><div><h3 title={task.filename}>{task.filename}</h3><p>{localizeQuality(task.quality)}</p></div>{task.state==='downloading'?<Icon label={t("pause_download")} disabled={busy} onClick={()=>onAction('pause')}><Pause size={15}/></Icon>:task.state==='paused'?<Icon label={task.destinationId&&['MP4','WEBM'].includes(task.protocol)?t("resume_download_from_beginning"):t("resume_download")} disabled={busy} onClick={()=>onAction('resume')}><Play size={15}/></Icon>:processing?<LoaderCircle size={16} className="spin"/>:null}</div><div className="sl-task-status"><span>{busy?t("working"):statusLabel(task.state)}</span><strong>{['failed','cancelled'].includes(task.state)?'':progress!==undefined?formatProgress(progress):''}</strong></div>
    {(active||task.state==='completed')&&<div className={`sl-progress ${progress===undefined&&active?'indeterminate':''}`} role="progressbar" aria-label={t("download_progress")} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><div style={{width:progress!==undefined?`${progress}%`:active?'30%':'0%'}}/></div>}<div className="sl-task-stats"><span>{`${size(task.bytes)}${task.totalBytes?' / '+size(task.totalBytes):''}`}</span><span>{task.state==='downloading'&&task.speed>0?size(task.speed)+'/s':''}</span></div>
    {task.error&&<p className="sl-task-error"><Info size={13}/>{localizeText(task.error)}</p>}
    <div className="sl-task-actions">{['failed','cancelled'].includes(task.state)&&<button className="sl-secondary" disabled={busy} title={t("retry_downloads_from_the_beginning")} onClick={()=>onAction('retry')}>{busy?<LoaderCircle size={13} className="spin"/>:<RefreshCw size={13}/>}{task.neededOrigins?.length?t("allow_access_retry"):t("retry")}</button>}{task.state==='completed'&&task.downloadId!==undefined&&<button className="sl-secondary" disabled={busy} onClick={()=>onAction('show')}><FolderOpen size={14}/>{t("show_in_folder")}</button>}{active&&task.state!=='saving'&&<button className="sl-text-button" disabled={busy} onClick={()=>onAction('cancel')}><Square size={11}/>{t("cancel_download_254")}</button>}<button className="sl-text-button" disabled={busy} onClick={()=>onAction('source')}><ExternalLink size={12}/>{t("view_source")}</button></div>
  </article>;
}
