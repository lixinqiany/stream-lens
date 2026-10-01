import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ArrowDown, ArrowDownToLine, ArrowLeft, ArrowRight, Check, ChevronDown, ChevronRight, CircleHelp, Copy, Download, Ellipsis, ExternalLink, FileVideo, FolderOpen, Globe, Info, Link2, LoaderCircle, LockKeyhole, Maximize2, PanelRight, Pause, Play, Radio, RefreshCw, ScanLine, Settings2, ShieldCheck, Sparkles, Square, X } from 'lucide-react';
import { DemoDownloads } from '../adapters/demo-downloads';
import type { DownloadPort } from '../application/ports';
import { mediaForScene, secondaryMedia, sceneHints, scenes, type Media, type Scene } from '../domain/media';
import { taskLabels, type Task } from '../domain/task';

const downloads = new DemoDownloads();
type View = 'page' | 'tasks' | 'settings';
type Mode = 'popup' | 'sidebar';
export type Layout = 'focus' | 'compact' | 'studio';
const activeStatuses = ['resolving', 'downloading', 'paused', 'merging', 'saving'];
function IconButton({ label, children, onClick, ...props }: { label: string; children: ReactNode; onClick?: () => void; disabled?: boolean; className?: string }) {
  return <button type="button" className="sl-icon-button" aria-label={label} title={label} onClick={onClick} {...props}>{children}</button>;
}
function readTheme(): boolean {
  try { return localStorage.getItem('stream-lens-theme') === 'dark'; } catch { return false; }
}

export function App() {
  const [scene, setScene] = useState<Scene>('found');
  const [mode, setMode] = useState<Mode>('popup');
  const [layout, setLayout] = useState<Layout>('focus');
  const [dark, setDark] = useState(readTheme);
  function selectDesign(next: Layout) {
    setLayout(next);
    setDark(next === 'studio');
    setMode(next === 'studio' ? 'sidebar' : 'popup');
  }
  useEffect(() => { try { localStorage.setItem('stream-lens-theme', dark ? 'dark' : 'light'); } catch { /* Browser storage may be disabled. */ } }, [dark]);
  return <div className={`sl-preview ${dark ? 'sl-dark' : ''}`}>
    <header className="preview-header"><a className="preview-brand" href="#"><span className="brand-symbol"><ScanLine size={20}/></span><span>拾影<span className="brand-en">StreamLens</span></span></a><div className="preview-header-right"><span className="prototype-label"><span/>交互设计预览</span><span className="preview-version">v0.1</span></div></header>
    <main className="preview-main">
      <aside className="design-intro">
        <span className="eyebrow">为当前页面，留住一帧</span>
        <h1>发现。选择。<br/><span>保存到本地。</span></h1>
        <p className="intro-description">一个安静、清晰的视频下载工具。<br/>从打开插件到开始下载，只保留必要的选择。</p>
        <div className="design-selector" role="group" aria-label="交互布局"><span className="control-label">体验方向</span><button className={layout === 'focus' ? 'design-choice selected' : 'design-choice'} onClick={() => selectDesign('focus')}><span className="choice-mark"><Sparkles size={16}/></span><span><strong>聚焦视频</strong><small>浅色大预览 · 单视频优先</small></span><span className="choice-end">{layout === 'focus' ? <Check size={16}/> : <ArrowRight size={16}/>}</span></button><button className={layout === 'compact' ? 'design-choice selected' : 'design-choice'} onClick={() => selectDesign('compact')}><span className="choice-mark"><FileVideo size={16}/></span><span><strong>紧凑列表</strong><small>多视频列表 · 展开后选择</small></span><span className="choice-end">{layout === 'compact' ? <Check size={16}/> : <ArrowRight size={16}/>}</span></button><button className={layout === 'studio' ? 'design-choice selected' : 'design-choice'} onClick={() => selectDesign('studio')}><span className="choice-mark"><PanelRight size={16}/></span><span><strong>专业侧栏</strong><small>深色工作区 · 持续管理任务</small></span><span className="choice-end">{layout === 'studio' ? <Check size={16}/> : <ArrowRight size={16}/>}</span></button></div>
        <div className="scene-control"><label htmlFor="scene">体验不同状态</label><div className="select-wrap"><select id="scene" value={scene} onChange={e => setScene(e.target.value as Scene)}>{scenes.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select><ChevronDown size={15}/></div><p>{sceneHints[scene]}</p></div>
        <div className="preview-note"><Info size={15}/><span>这是可交互原型。下载进度为模拟，<br/>不会保存真实视频。</span></div>
      </aside>
      <section className="preview-workspace" aria-label="浏览器内扩展预览">
        <div className="workspace-toolbar"><div className="mode-control" role="group" aria-label="展示方式"><button aria-pressed={mode === 'popup'} className={mode === 'popup' ? 'active' : ''} onClick={() => setMode('popup')}><Maximize2 size={14}/>弹窗</button><button aria-pressed={mode === 'sidebar'} className={mode === 'sidebar' ? 'active' : ''} onClick={() => setMode('sidebar')}><PanelRight size={14}/>侧栏</button></div><button className="theme-control" onClick={() => setDark(!dark)}>{dark ? '浅色外观' : '深色外观'}<span className={`theme-dot ${dark ? 'dark' : ''}`}/></button></div>
        <div className={`browser-shell ${mode}`}>
          <div className="browser-tabs"><div className="traffic-lights"><i/><i/><i/></div><div className="browser-tab"><Globe size={13}/><span>{scene === 'jable' ? 'START-640 · 测试页' : 'Coastline · 页面视频'}</span><X size={12}/></div><span className="browser-plus">+</span></div>
          <div className="browser-address"><ArrowLeft size={15}/><ArrowRight size={15}/><RefreshCw size={14}/><div><LockKeyhole size={12}/><span>{scene === 'jable' ? 'jable.tv/videos/start-640/' : 'demo.local/watch/coastline'}</span></div><Ellipsis size={16}/><span className="extension-toolbar-icon"><ScanLine size={18}/><b>{scene === 'empty' || scene === 'permission' ? 0 : 1}</b></span></div>
          <div className="browser-body"><div className="web-page"><span className="web-page-wordmark">coastline<span>journal</span></span><div className="web-page-nav">Films &nbsp; Stories &nbsp; About</div><div className="web-page-art"/><div className="web-page-bottom"><Play size={14}/><span>02:14 / 08:42</span><div/><Maximize2 size={14}/></div><h2>A slower kind of afternoon.</h2><p>一段关于海岸、风与时间的影像。</p><span className="web-page-caption">中性背景示意 · 非测试站点截图</span></div>
            <div className="extension-position"><ExtensionPanel scene={scene} onScene={setScene} onMode={setMode} mode={mode} layout={layout} port={downloads}/></div>
          </div>
        </div>
        <div className="workspace-caption"><span><span className="caption-line"/>真实尺寸思路 · 弹窗宽 420px</span><span>点击按钮，体验完整流程<ArrowRight size={14}/></span></div>
      </section>
    </main><footer className="preview-footer"><span>简洁的表面，完整的状态。</span><span>本地优先<span className="footer-dot"/>按站点授权<span className="footer-dot"/>可扩展的下载引擎</span></footer>
  </div>;
}

export function ExtensionPanel({ scene, onScene, onMode, mode, layout, port }: { scene: Scene; onScene: (s: Scene) => void; onMode: (m: Mode) => void; mode: Mode; layout: Layout; port: DownloadPort }) {
  const tasks = useSyncExternalStore(port.subscribe, port.getSnapshot, port.getSnapshot);
  const [view, setView] = useState<View>('page');
  const [scanning, setScanning] = useState(false);
  const [hideAds, setHideAds] = useState(true);
  const [toast, setToast] = useState('');
  const [saveAs, setSaveAs] = useState(false);
  const [defaultQuality, setDefaultQuality] = useState('best');
  const [sheet, setSheet] = useState<{ media: Media; quality: string } | null>(null);
  const [filename, setFilename] = useState('');
  const [nameError, setNameError] = useState('');
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'finished'>('all');
  const [expandedMedia, setExpandedMedia] = useState<string>('coast');
  const dialogId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const media = layout === 'compact' && scene === 'found' ? [...mediaForScene(scene), secondaryMedia] : mediaForScene(scene);
  const activeCount = tasks.filter(t => activeStatuses.includes(t.status)).length;
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3500); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => { if (!scanning) return; const timer = setTimeout(() => { setScanning(false); setToast('检测完成 · 示例资源已更新'); }, 1400); return () => clearTimeout(timer); }, [scanning]);
  useEffect(() => { setView('page'); setSheet(null); }, [scene]);
  useEffect(() => {
    if (!sheet && !confirmCancel) return;
    const previous = document.activeElement as HTMLElement | null;
    const overlay = dialogRef.current;
    const focusables = () => [...overlay?.querySelectorAll<HTMLElement>('button:not([disabled]), input, select') || []];
    focusables()[0]?.focus();
    function trap(event: KeyboardEvent) {
      if (event.key === 'Escape') { setSheet(null); setConfirmCancel(null); }
      if (event.key !== 'Tab') return;
      const list = focusables();
      if (!list.length) return;
      if (event.shiftKey && document.activeElement === list[0]) { event.preventDefault(); list.at(-1)?.focus(); }
      if (!event.shiftKey && document.activeElement === list.at(-1)) { event.preventDefault(); list[0]?.focus(); }
    }
    document.addEventListener('keydown', trap);
    return () => { document.removeEventListener('keydown', trap); previous?.focus(); };
  }, [sheet, confirmCancel]);
  function start(m: Media, quality: string, name?: string) {
    try {
      const result = port.start(m, quality, scene, name);
      setToast(result.duplicate ? '这个清晰度已有下载任务' : '已加入任务 · 正在模拟下载');
      setView('tasks'); setFilter('all'); setSheet(null);
    } catch (error) { setToast(error instanceof Error ? error.message : '无法开始下载'); }
  }
  function requestStart(m: Media, quality: string) {
    if (saveAs) { setSheet({ media: m, quality }); setFilename(m.title); setNameError(''); }
    else start(m, quality);
  }
  const filteredTasks = tasks.filter(t => filter === 'all' || (filter === 'active' ? activeStatuses.includes(t.status) : ['completed', 'cancelled'].includes(t.status)));
  return <section className={`sl-extension ${layout === 'compact' ? 'sl-compact' : layout === 'studio' ? 'sl-studio' : ''}`} aria-label="拾影视频下载扩展">
    <header className="sl-app-header"><span className="sl-brand"><span className="sl-brand-icon"><ScanLine size={19}/></span><strong>拾影</strong><span>StreamLens</span></span><div><IconButton label={mode === 'popup' ? '在侧栏中打开' : '切换为弹窗'} onClick={() => onMode(mode === 'popup' ? 'sidebar' : 'popup')}><PanelRight size={17}/></IconButton><IconButton label="设置" onClick={() => setView('settings')}><Settings2 size={17}/></IconButton></div></header>
    <div className="sl-app-navigation"><button className={view === 'page' ? 'active' : ''} onClick={() => setView('page')}>当前页面{media.length > 0 && <span>{media.length}</span>}</button><button className={view === 'tasks' ? 'active' : ''} onClick={() => setView('tasks')}>下载任务{activeCount > 0 && <span>{activeCount}</span>}</button><span className="sl-local-status"><span/>本地处理</span></div>
    {view === 'page' && <div className="sl-page-content">
      <div className="sl-source-row"><Globe size={14}/><span>{scene === 'jable' ? 'jable.tv' : 'demo.local'}</span><span className="sl-source-status">{scanning ? '检测中…' : '仅当前标签页'}</span><IconButton label="重新检测" disabled={scanning} onClick={() => setScanning(true)}><RefreshCw size={15} className={scanning ? 'spin' : ''}/></IconButton></div>
      {scene === 'permission' ? <EmptyState icon={<ShieldCheck size={28}/>} title="在这个站点发现视频" description="允许拾影读取当前站点的播放器和视频请求。授权范围会在 Chrome 提示中显示。" action="允许访问此站点" onAction={() => {onScene('found'); setToast('已模拟授权当前站点');}} footnote="此处为权限交互演示，不会授予真实权限。"/> : scene === 'empty' ? <EmptyState icon={<ScanLine size={30}/>} title="还没有发现视频" description="有些视频在播放后才会加载。先在页面上播放几秒，再回来检测。" action={scanning ? '正在检测…' : '重新检测'} onAction={() => setScanning(true)} disabled={scanning} footnote="演示中此状态会保留，以便检查空状态交互。"/> : <>
        <div className="sl-found-heading"><h2>{scene === 'protected' ? '发现受保护视频' : '已发现视频'}</h2><span>{scene === 'jable' ? '主播放器优先' : '当前播放优先'}</span></div>
        {layout === 'studio' && <div className="sl-studio-summary"><span><Radio size={13}/>监听页面资源</span><span>自动合并重复请求</span></div>}
        {media.map(m => <MediaCard key={m.id} media={m} compact={layout === 'compact'} studio={layout === 'studio'} expanded={layout !== 'compact' || expandedMedia === m.id} onExpand={() => setExpandedMedia(m.id)} defaultQuality={defaultQuality} onDownload={q => requestStart(m, q)} onMessage={setToast}/>) }
        {layout === 'studio' && <button className="sl-queue-summary" onClick={() => setView('tasks')}><ArrowDownToLine size={16}/><div><strong>{activeCount ? `${activeCount} 个任务进行中` : '下载队列已就绪'}</strong><small>{tasks.length ? `${tasks.length} 个任务 · 查看所有进度` : '添加视频后，在这里继续管理'}</small></div><ChevronRight size={15}/></button>}
        {scene === 'jable' && <div className="sl-observation"><Info size={14}/><span>播放器与时长已观察到；下载规格与文件大小待验证。</span></div>}
        <button className="sl-ads-toggle" aria-expanded={!hideAds} onClick={() => setHideAds(!hideAds)}><ShieldCheck size={14}/><span>{hideAds ? '已收起疑似广告 / 小尺寸视频' : '疑似广告 / 小尺寸视频'}</span><ChevronDown size={14} className={!hideAds ? 'rotate' : ''}/></button>
        {!hideAds && <div className="sl-ad-row"><span className="sl-ad-icon"><FileVideo size={17}/></span><div><strong>页面短片 · 示例资源</strong><small>00:10 · MP4 · 疑似广告</small></div><button className="sl-text-button" onClick={() => requestStart({id:'ad-example',title:'页面短片',domain:'demo.local',duration:'00:10',protocol:'MP4',qualities:[{id:'360',label:'360p',size:'2 MB'}],playing:false,artwork:'abstract',supported:true},'360')}>下载</button></div>}
        <div className="sl-detection-hint"><Radio size={14}/><span>页面播放时，持续发现新的视频资源。</span></div>
      </>}
    </div>}
    {view === 'tasks' && <div className="sl-task-content"><div className="sl-section-heading"><div><h2>下载任务</h2><p>{activeCount > 0 ? `${activeCount} 个任务正在进行` : tasks.length ? '所有任务均保留在此处' : '开始下载后，可在这里查看进度'}</p></div><button className="sl-text-button" disabled={!tasks.some(t=>['completed','cancelled'].includes(t.status))} onClick={() => port.clearFinished()}>清理已结束</button></div><div className="sl-task-filters" role="group" aria-label="筛选下载任务">{([['all','全部'],['active','进行中'],['finished','已结束']] as const).map(([id,label])=><button key={id} aria-pressed={filter===id} className={filter===id?'active':''} onClick={()=>setFilter(id)}>{label}</button>)}</div>
      {filteredTasks.length === 0 ? <EmptyState icon={<ArrowDownToLine size={28}/>} title={tasks.length ? '这里暂时没有任务' : '你的下载，从这里开始'} description={tasks.length ? '切换筛选，可查看其他任务。' : '回到当前页面，选择视频与清晰度。关闭弹窗后，正式版的任务会继续运行。'} action="查看当前页面" onAction={() => setView('page')}/> : filteredTasks.map(t => <TaskCard key={t.id} task={t} onPause={() => port.dispatch(t.id,{type:'pause'})} onResume={() => port.dispatch(t.id,{type:'resume'})} onRetry={() => port.dispatch(t.id,{type:'retry'})} onCancel={() => setConfirmCancel(t.id)} onReveal={() => setToast('演示文件未保存 · 正式版将定位本地文件')}/>) }
    </div>}
    {view === 'settings' && <div className="sl-settings-content"><button className="sl-settings-back" onClick={() => setView('page')}><ArrowLeft size={15}/>返回当前页面</button><h2>按你的习惯下载</h2><p className="sl-settings-subtitle">这些偏好仅在本次预览中生效。</p><label className="sl-field-label" htmlFor="quality-default">默认清晰度</label><div className="sl-select-field"><select id="quality-default" value={defaultQuality} onChange={e=>setDefaultQuality(e.target.value)}><option value="best">优先最高画质</option><option value="720">优先 720p，兼顾大小</option><option value="480">优先 480p，节省空间</option></select><ChevronDown size={15}/></div><div className="sl-setting-row"><div><strong>下载前编辑文件名</strong><small>为每次下载保留确认步骤</small></div><label className="sl-switch"><input type="checkbox" checked={saveAs} onChange={e=>setSaveAs(e.target.checked)} aria-label="下载前编辑文件名"/><span/></label></div><div className="sl-setting-row"><div><strong>收起疑似广告资源</strong><small>随时可以在列表中展开查看</small></div><label className="sl-switch"><input type="checkbox" checked={hideAds} onChange={e=>setHideAds(e.target.checked)} aria-label="收起疑似广告资源"/><span/></label></div><div className="sl-privacy-block"><ShieldCheck size={18}/><div><strong>只在本地，保持简单。</strong><p>播放器信息和下载任务在本地处理。正式版将按站点请求访问权限。</p></div></div><div className="sl-settings-meta"><span>拾影 StreamLens</span><span>设计预览 v0.1</span></div></div>}
    <footer className="sl-app-footer"><span><span className="sl-demo-dot"/>演示模式 · 进度为模拟</span><button onClick={() => setToast('下载提示：先播放视频；流式视频需要解析与合并；可在任务页重试。')} aria-label="下载帮助"><CircleHelp size={14}/>帮助</button></footer>
    {toast && <div className="sl-toast" role="status"><Check size={15}/><span>{toast}</span><button onClick={() => setToast('')} aria-label="关闭提示"><X size={14}/></button></div>}
    {sheet && <div className="sl-overlay" ref={dialogRef}><form className="sl-sheet" role="dialog" aria-modal="true" aria-labelledby={`${dialogId}-save`} onSubmit={e=>{e.preventDefault(); if (!filename.trim()) {setNameError('请输入文件名'); return;} start(sheet.media,sheet.quality,filename);}}><div className="sl-sheet-header"><h2 id={`${dialogId}-save`}>准备保存视频</h2><IconButton label="关闭保存对话框" onClick={()=>setSheet(null)}><X size={17}/></IconButton></div><p>{sheet.quality}p · MP4</p><label className="sl-field-label" htmlFor={`${dialogId}-filename`}>文件名</label><input id={`${dialogId}-filename`} value={filename} maxLength={100} onChange={e=>{setFilename(e.target.value);setNameError('');}}/><small>将自动添加清晰度与 .mp4 后缀</small>{nameError && <span className="sl-error" role="alert">{nameError}</span>}<div className="sl-sheet-actions"><button type="button" className="sl-secondary" onClick={()=>setSheet(null)}>取消</button><button type="submit" className="sl-primary"><Download size={15}/>开始下载</button></div></form></div>}
    {confirmCancel && <div className="sl-overlay" ref={dialogRef}><div className="sl-sheet" role="dialog" aria-modal="true" aria-labelledby={`${dialogId}-cancel`}><h2 id={`${dialogId}-cancel`}>取消这个下载？</h2><p>正式版会停止任务并清理临时分片。此处只改变演示状态。</p><div className="sl-sheet-actions"><button className="sl-secondary" onClick={()=>setConfirmCancel(null)}>继续下载</button><button className="sl-primary" onClick={()=>{port.dispatch(confirmCancel,{type:'cancel'});setConfirmCancel(null);setToast('下载已取消');}}>取消任务</button></div></div></div>}
  </section>;
}
function EmptyState({icon,title,description,action,onAction,footnote,disabled}: {icon:ReactNode;title:string;description:string;action:string;onAction:()=>void;footnote?:string;disabled?:boolean}) {
  return <div className="sl-empty"><span className="sl-empty-icon">{icon}</span><h2>{title}</h2><p>{description}</p><button className="sl-primary" disabled={disabled} onClick={onAction}>{action}<ArrowRight size={15}/></button>{footnote&&<small>{footnote}</small>}</div>;
}
function MediaCard({media,compact,studio,expanded,onExpand,defaultQuality,onDownload,onMessage}: {media:Media;compact:boolean;studio:boolean;expanded:boolean;onExpand:()=>void;defaultQuality:string;onDownload:(q:string)=>void;onMessage:(s:string)=>void}) {
  const best = media.qualities.find(q=>q.id===defaultQuality)?.id || media.qualities[0].id;
  const [quality,setQuality] = useState(best);
  const [details,setDetails] = useState(false);
  useEffect(()=>setQuality(best),[best]);
  const selected=media.qualities.find(q=>q.id===quality)!;
  return <article className="sl-media-card">
    <div className={`sl-artwork ${media.artwork === 'abstract' ? 'abstract' : 'coast'}`} aria-label="中性视频封面示意"><div className="sl-art-top"><span className="sl-playing">{media.playing ? <><span/>正在播放</> : <><FileVideo size={11}/>{media.id === 'studio-tour' ? '页面视频' : '主视频'}</>}</span><span className="sl-art-placeholder">示意封面</span></div>{media.artwork==='abstract'&&<span className="sl-art-code">{media.id === 'jable-primary' ? 'START–640' : 'STUDIO'}</span>}<div className="sl-art-bottom"><span>{media.duration}</span><span>{media.protocol}</span></div>{compact && <span className="sl-art-mini"><FileVideo size={18}/></span>}</div>
    <div className="sl-media-info"><div className="sl-title-row"><h3>{media.title}</h3><span className="sl-video-check"><Check size={12}/></span></div><p className="sl-media-meta">{media.protocol==='HLS' ? '流式视频' : '视频文件'}<i/>含音频<i/>{studio?media.duration:'单个视频'}</p>
      {!expanded && <button className="sl-expand-resource sl-secondary" onClick={onExpand}>选择清晰度与下载<ChevronDown size={13}/></button>}
      {expanded && (media.supported ? <><div className="sl-quality-heading"><span>清晰度</span><span>{selected.size}</span></div>{studio ? <div className="sl-studio-quality"><select aria-label={`${media.title}清晰度`} value={quality} onChange={e=>setQuality(e.target.value)}>{media.qualities.map(q=><option key={q.id} value={q.id}>{q.label}{q.recommended?' · 推荐':''}</option>)}</select><ChevronDown size={13}/><span>{selected.size}</span></div> : <div className="sl-quality-options" role="group" aria-label={`${media.title}清晰度`}>{media.qualities.map(q=><button key={q.id} aria-pressed={quality===q.id} className={quality===q.id?'selected':''} onClick={()=>setQuality(q.id)}><span>{q.label}</span>{q.recommended&&<small>推荐</small>}{quality===q.id&&<Check size={12}/>}</button>)}</div>}<button className="sl-primary sl-download-button" onClick={()=>onDownload(quality)}><ArrowDownToLine size={16}/><span>{studio?'添加到下载队列':'下载视频'}</span><span className="sl-button-format">MP4</span></button></> : <div className="sl-protected-note"><LockKeyhole size={16}/><div><strong>此视频受 DRM 保护</strong><p>当前无法保存为可播放文件。</p></div></div>)}
      {expanded && <button className="sl-details-toggle" aria-expanded={details} onClick={()=>setDetails(!details)}><Link2 size={13}/><span>资源详情</span><ChevronDown size={13} className={details?'rotate':''}/></button>}
      {details&&<div className="sl-resource-details"><dl><div><dt>资源类型</dt><dd>{media.protocol} {media.protocol==='HLS'?'播放清单':'文件'}</dd></div><div><dt>发现方式</dt><dd>播放器 + 网络请求</dd></div><div><dt>输出方式</dt><dd>{media.protocol==='HLS'?'下载分片 → 合并 MP4':'保存源文件'}</dd></div><div><dt>页面来源</dt><dd>{media.domain}</dd></div></dl>{media.note&&<p>{media.note}</p>}<div className="sl-demo-url">demo.local/media/manifest.m3u8<span>示例链接</span></div><button className="sl-text-button" onClick={()=>onMessage('演示模式没有真实资源链接可复制')}><Copy size={12}/>复制资源链接</button></div>}
    </div>
  </article>;
}
function TaskCard({task,onPause,onResume,onRetry,onCancel,onReveal}: {task:Task;onPause:()=>void;onResume:()=>void;onRetry:()=>void;onCancel:()=>void;onReveal:()=>void}) {
  const isBusy=['resolving','merging','saving'].includes(task.status);
  const isActive=activeStatuses.includes(task.status);
  return <article className={`sl-task-card ${task.status==='failed'?'failed':''}`}><div className="sl-task-top"><span className="sl-file-icon">{task.status==='completed'?<Check size={19}/>:<FileVideo size={19}/>}</span><div><h3 title={task.filename}>{task.filename}</h3><p>{task.quality}<i/>MP4{task.protocol !== 'MP4' && <><i/>{task.protocol}</>}</p></div>{task.status==='downloading'?<IconButton label="暂停下载" onClick={onPause}><Pause size={15}/></IconButton>:task.status==='paused'?<IconButton label="继续下载" onClick={onResume}><Play size={15}/></IconButton>:isBusy?<LoaderCircle size={16} className="spin"/>:null}</div>
    <div className="sl-task-status"><span>{isBusy&&<LoaderCircle size={12} className="spin"/>}{task.status==='completed'&&<Check size={12}/>} {taskLabels[task.status]}</span><strong>{task.status==='completed'?'100%':task.status==='failed'?'链接失效':task.status==='cancelled'?'已停止':`${task.progress}%`}</strong></div>
    <div className="sl-progress" role="progressbar" aria-label="模拟下载进度" aria-valuenow={task.progress} aria-valuemin={0} aria-valuemax={100}><div style={{width:`${task.progress}%`}}/></div>
    {task.status==='downloading'&&<div className="sl-task-stats"><span>模拟速度 4.2 MB/s</span><span>{Math.max(1,Math.ceil((100-task.progress)/10))} 秒后进入合并</span></div>}
    {task.status==='paused'&&<p className="sl-task-context">已保留进度，继续后从当前位置恢复。</p>}
    {task.status==='merging'&&<p className="sl-task-context">分片已下载，正在生成完整视频。</p>}
    {task.status==='saving'&&<p className="sl-task-context">正在模拟写入本地文件。</p>}
    {task.status==='resolving'&&<p className="sl-task-context">{task.protocol==='MP4'?'正在检查源文件与保存方式。':'正在解析清晰度、音频与视频分片。'}</p>}
    {task.error&&<p className="sl-task-error"><Info size={13}/>{task.error}</p>}
    <div className="sl-task-actions">{task.status==='failed'&&<button className="sl-secondary" onClick={onRetry}><RefreshCw size={13}/>重新获取并重试</button>}{task.status==='completed'&&<button className="sl-secondary" onClick={onReveal}><FolderOpen size={14}/>在文件夹中显示</button>}{isActive&&<button className="sl-text-button" onClick={onCancel}><Square size={11}/>取消任务</button>}{task.status==='completed'&&<span>模拟完成 · 未写入文件</span>}</div>
  </article>;
}
