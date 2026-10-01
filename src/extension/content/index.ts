import {t,watchLanguage,currentLocale,localizeText,localizeQuality} from '../../i18n';
import {httpUrl, type MediaAsset, type PlayerSelection, type VideoEvidence} from '../../core/model';
import {protocolFor} from '../../core/discovery/catalog';
import {biliEndpoint} from '../../core/sites/bilibili';
import type {PlayerCommand, PlayerResolveResult, Response, StartResult} from '../../platform/messages';

const state=globalThis as typeof globalThis & {__streamLens?:boolean};
if(!state.__streamLens) {
  state.__streamLens=true;
  const channel='stream-lens-media-v1';
  const ids=new WeakMap<Element,string>(),protectedPlayers=new WeakSet<Element>();
  const sourceHints=new Map<string,{urls:string[];format?:'DASH'}>();
  const biliEpisodes=new WeakMap<HTMLVideoElement,{episodeId:number;seasonId:number;source:string}>();
  const scriptBindings=new Map<string,{video:HTMLVideoElement;source:string}>();
  let target:HTMLVideoElement|undefined,selectedAt=0,timer:ReturnType<typeof setTimeout>|undefined,previous='',lastLocation=location.href;
  let resolved:PlayerResolveResult|undefined,resolvedSource='',busy=false,popoverOpen=false,selectPending=false;
  let resolutionAttempt='',resolutionFlight:{video:HTMLVideoElement;source:string;promise:Promise<void>}|undefined;
  let pendingPermission:{command:PlayerCommand;video:HTMLVideoElement;sourceKey:string}|undefined;
  const media=()=>[...document.querySelectorAll<HTMLVideoElement>('video,bwp-video')];
  const id=(video:Element)=>{let value=ids.get(video);if(!value){value=crypto.randomUUID();ids.set(video,value);}return value;};
  const source=(video:HTMLVideoElement)=>video.currentSrc||video.src||String((video as HTMLVideoElement).srcObject?'src-object':'unloaded');
  const episode=(video:HTMLVideoElement)=>{const context=biliEpisodes.get(video);return context&&context.source===source(video)&&location.pathname===('/bangumi/play/ss'+context.seasonId)?context.episodeId:undefined;};
  const key=(video:HTMLVideoElement)=>source(video)+(episode(video)?'|bili-ep:'+episode(video):'');
  const title=()=>(document.querySelector('h1')?.textContent||document.title||t("page_video")).trim().slice(0,300);
  function selection():PlayerSelection|undefined {return target?{playerId:id(target),sourceKey:key(target),title:title(),playing:!target.paused&&!target.ended,selectedAt}:undefined;}
  function info(video?:HTMLVideoElement):Omit<VideoEvidence,'url'|'source'> {
    return {title:title(),pageUrl:location.href,poster:video?.poster,width:video?.videoWidth||video?.clientWidth||0,height:video?.videoHeight||video?.clientHeight||0,
      duration:video&&Number.isFinite(video.duration)?video.duration:undefined,playing:!!video&&!video.paused&&!video.ended,primary:!!video&&video===target,
      protected:!!video&&(!!video.mediaKeys||protectedPlayers.has(video)),playerId:video?id(video):undefined,sourceKey:video?key(video):undefined};
  }
  function inspect() {
    if(location.href!==lastLocation){resolutionAttempt='';resolutionFlight=undefined;pendingPermission=undefined;lastLocation=location.href;target=undefined;selectedAt=0;resolved=undefined;popoverOpen=false;previous='';sourceHints.clear();scriptBindings.clear();}
    const videos=media();
    if(target&&!target.isConnected){target=undefined;resolved=undefined;popoverOpen=false;}
    const evidence:VideoEvidence[]=[];
    const bili=biliEndpoint(location.href,target&&episode(target));
    if(target&&bili&&target.closest('.bpx-player-container,.bpx-player-video-wrap,.bilibili-player-video-wrap,#bilibili-player')){
      window.postMessage({channel,type:'bili-player-query',playerId:id(target),source:source(target)},location.origin);
      evidence.push({...info(target),url:bili,source:'player',format:'DASH',contentType:'video/mp4'});
    }
    for(const video of videos) {
      for(const candidate of [video.currentSrc,video.src,...[...video.querySelectorAll('source')].map(s=>s.src)]) {
        const url=httpUrl(candidate);if(url&&protocolFor(url))evidence.push({...info(video),url,source:'player'});
      }
      const blob=source(video);
      if(blob.startsWith('blob:')) {
        const hint=sourceHints.get(blob);
        if(hint)for(const url of hint.urls)evidence.push({...info(video),url,source:'player',format:hint.format,contentType:/\.m4s(?:\?|$)/i.test(url)?'video/mp4':undefined});
        else window.postMessage({channel,type:'query',blob},location.origin);
      }
    }
    // Literal configuration is a fallback for players initialized before permission
    // was granted or whose transmuxing runs in a worker. Do not execute page scripts.
    const anchor=videos.find(v=>v.id==='player')||(videos.length===1?videos[0]:undefined);
    for(const script of [...document.querySelectorAll('script:not([src])')].slice(0,80)) {
      const value=(script.textContent||'').slice(0,500000).replaceAll('\\/','/').replaceAll('&amp;','&');
      const candidates=value.match(/https?:\/\/[^\s"'<>`\\]+?\.m3u8(?:\?[^\s"'<>`\\]*)?/gi)||[];
      const related=/loadSource|hlsUrl|player/i.test(value)&&candidates.length===1?anchor:undefined;
      for(const url of candidates.slice(0,20)) {
        let bound:HTMLVideoElement|undefined;
        if(related){const old=scriptBindings.get(url),source=key(related);
          if(!old||old.source==='unloaded'){scriptBindings.set(url,{video:related,source});bound=related;}
          else if(old.video===related&&old.source===source)bound=related;
        }
        evidence.push({...info(bound),url,source:'script'});
      }
    }
    for(const entry of performance.getEntriesByType('resource').slice(-500)) {
      const url=httpUrl(entry.name);if(url&&protocolFor(url))evidence.push({...info(),url,source:'network'});
    }
    const player=selection();
    const payload=JSON.stringify({pageUrl:location.href,evidence:evidence.slice(0,100),player});
    if(payload!==previous||selectPending){previous=payload;const select=selectPending;selectPending=false;
      void chrome.runtime.sendMessage({type:'EVIDENCE',pageUrl:location.href,evidence:evidence.slice(0,100),player,select}).catch(()=>{});
    }
    if(target&&resolvedSource!==key(target)){resolved=undefined;resolvedSource='';}
    const bound=target&&evidence.filter(e=>e.playerId===id(target!)&&e.sourceKey===key(target!));
    if(target&&bound?.length&&!bound.some(e=>e.protected)){
      const attempt=JSON.stringify([location.href,id(target),key(target),bound.map(e=>e.url).sort()]);
      if(attempt!==resolutionAttempt){resolutionAttempt=attempt;void resolveSelected(target);}
    }
    position();
  }
  const schedule=()=>{if(!timer)timer=setTimeout(()=>{timer=undefined;inspect();},250);};
  function choose(video:HTMLVideoElement) {
    if(target!==video){resolved=undefined;popoverOpen=false;pendingPermission=undefined;}
    target=video;selectedAt=Date.now();selectPending=true;inspect();
  }
  function videoFor(event:Event) {
    for(const element of event.composedPath()) {
      if(!(element instanceof Element)||element===document.body||element===document.documentElement)continue;
      if(element.matches('video,bwp-video'))return element as HTMLVideoElement;
      const videos=[...element.querySelectorAll<HTMLVideoElement>('video,bwp-video')];
      if(element.matches('.bpx-player-container,#bilibili-player,.bilibili-player-video')) {
        const candidates=videos.filter(v=>v.closest('.bpx-player-video-wrap,.bilibili-player-video-wrap'));
        const visible=candidates.filter(v=>{const r=v.getBoundingClientRect();return r.width>40&&r.height>40;});
        if(visible.length===1)return visible[0];
      }
      if(videos.length===1){const container=element.getBoundingClientRect(),rect=videos[0].getBoundingClientRect();
        if(rect.width>0&&rect.height>0&&container.width<=rect.width*1.5&&container.height<=rect.height*1.6)return videos[0];
      }
      // Player containers sometimes include dormant ad video elements.
      if(videos.length>1&&element.matches('[class*="player"],[class*="plyr"]')) {
        const visible=videos.filter(v=>{const r=v.getBoundingClientRect();return r.width>40&&r.height>40;});
        if(visible.length===1){const container=element.getBoundingClientRect(),rect=visible[0].getBoundingClientRect();if(container.width<=rect.width*1.5&&container.height<=rect.height*1.6)return visible[0];}
      }
    }
  }
  document.addEventListener('pointerdown',event=>{if(!event.isTrusted||event.composedPath().includes(host))return;if(popoverOpen)hide();const video=videoFor(event);if(video)choose(video);},true);
  document.addEventListener('click',event=>{if(!event.isTrusted||event.composedPath().includes(host))return;const video=videoFor(event);if(video)choose(video);},true);
  document.addEventListener('keydown',event=>{if(!event.isTrusted||![' ','Enter','ArrowLeft','ArrowRight','k','K'].includes(event.key)||event.composedPath().includes(host))return;const video=videoFor(event);if(video)choose(video);},true);
  for(const event of ['play','pause','loadedmetadata','durationchange','emptied'])document.addEventListener(event,schedule,true);
  document.addEventListener('encrypted',event=>{if(event.target instanceof Element)protectedPlayers.add(event.target);schedule();},true);
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src','poster']});
  window.addEventListener('message',event=>{
    const data=event.data;
    if(event.source===window&&data?.channel===channel&&data.type==='bili-player-context'){
      if(!target||data.playerId!==id(target)||data.source!==source(target)||!Number.isSafeInteger(data.episodeId)||data.episodeId<=0)return;
      const season=location.pathname.match(/^\/bangumi\/play\/ss(\d+)(?:\/|$)/)?.[1];
      if(!season||data.seasonId!==Number(season)||!biliEndpoint(location.href))return;
      if(episode(target)!==data.episodeId){biliEpisodes.set(target,{episodeId:data.episodeId,seasonId:data.seasonId,source:data.source});resolved=undefined;resolvedSource='';schedule();}
      return;
    }
    if(event.source!==window||data?.channel!==channel||data.type!=='sources'||typeof data.blob!=='string'||!data.blob.startsWith('blob:')||!Array.isArray(data.urls))return;
    const urls=data.urls.slice(0,30).map(httpUrl).filter((u: string|undefined):u is string=>!!u);
    if(!urls.length)return;
    sourceHints.set(data.blob,{urls,format:data.format==='DASH'?'DASH':undefined});
    while(sourceHints.size>100)sourceHints.delete(sourceHints.keys().next().value!);
    schedule();
  });

  // The overlay uses its own shadow root, so website CSS cannot restyle controls.
  const host=document.createElement('div');
  host.setAttribute('data-stream-lens-overlay','');
  const shadow=host.attachShadow({mode:'closed'});
  const style=document.createElement('style');
  style.textContent=`:host{all:initial;position:fixed!important;z-index:2147483647!important;display:block!important;pointer-events:none!important;font-family:system-ui,-apple-system,sans-serif!important;color:#eef0f5!important}*{box-sizing:border-box}button,input,select{font:inherit}button{cursor:pointer}button:disabled{cursor:wait;opacity:.65}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #93b1ff;outline-offset:3px}.wrap{position:relative;pointer-events:none}.shortcut{pointer-events:auto;border:1px solid #ffffff30;border-radius:9px;background:#1e2128ed;color:#fff;padding:9px 13px;box-shadow:0 3px 16px #0005;display:flex;gap:7px;align-items:center;font-size:13px;font-weight:600}.shortcut:hover{background:#333a49}.shortcut svg{width:16px;height:16px}.panel{overflow-y:auto;position:absolute;right:0;top:46px;width:292px;max-width:calc(100vw - 24px);border:1px solid #333844;background:#1e2128;border-radius:12px;box-shadow:0 10px 40px #0008;padding:16px;pointer-events:auto;font-size:13px;line-height:1.5}[hidden]{display:none!important}.heading{display:flex;align-items:center;justify-content:space-between;font-weight:650;font-size:14px}.close{min-width:28px;min-height:28px;border:0;background:transparent;color:#b5bdcc;font-size:20px;padding:0 4px}.status{color:#b5bdcc;margin:10px 0;word-break:break-word}select,input{display:block;width:100%;border:1px solid #454c5a;border-radius:7px;background:#282c35;color:#fff;padding:8px;margin:8px 0}.start{width:100%;background:#7b9fff;color:#14234a;border:0;border-radius:7px;padding:9px;font-weight:650;margin-top:8px}.secondary{border:0;color:#a9beff;background:transparent;padding:9px 0 0;min-height:36px}.retry{margin-right:18px}.error{color:#f19999}label{color:#b5bdcc;font-size:12px}`;
  const wrap=document.createElement('div');wrap.className='wrap';
  const shortcut=document.createElement('button');shortcut.className='shortcut';shortcut.type='button';shortcut.setAttribute('aria-label',t("download_selected_video"));shortcut.setAttribute('aria-expanded','false');
  // This fixed icon markup is extension-owned; no website data is rendered as HTML.
  shortcut.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M5 16v4h14v-4"/></svg><span></span>';
  const panel=document.createElement('div');panel.className='panel';panel.hidden=true;panel.setAttribute('role','region');panel.setAttribute('aria-label',t("video_download_controls"));
  const heading=document.createElement('div');heading.className='heading';heading.textContent=t("download_video");
  const close=document.createElement('button');close.className='close';close.type='button';close.textContent='×';close.setAttribute('aria-label',t("close_download_controls"));heading.append(close);
  const status=document.createElement('p');status.className='status';status.setAttribute('role','status');
  const quality=document.createElement('select');quality.setAttribute('aria-label',t("download_quality"));quality.hidden=true;
  const nameLabel=document.createElement('label');nameLabel.textContent=t("filename");nameLabel.hidden=true;
  const filename=document.createElement('input');filename.maxLength=110;filename.setAttribute('aria-label',t("download_filename"));nameLabel.append(filename);
  const start=document.createElement('button');start.className='start';start.type='button';start.textContent=t("start_download");start.hidden=true;
  const retry=document.createElement('button');retry.className='secondary retry';retry.type='button';retry.textContent=t("retry");retry.hidden=true;
  const more=document.createElement('button');more.className='secondary';more.type='button';more.textContent=t("view_downloads");
  panel.append(heading,status,quality,nameLabel,start,retry,more);wrap.append(shortcut,panel);shadow.append(style,wrap);document.documentElement.append(host);
  function renderLanguage(){
    host.lang=currentLocale()==='zh_CN'?'zh-CN':'en';
    shortcut.querySelector('span')!.textContent=t("download_video");shortcut.setAttribute('aria-label',t("download_selected_video"));
    heading.firstChild!.textContent=t("download_video");panel.setAttribute('aria-label',t("video_download_controls"));close.setAttribute('aria-label',t("close_download_controls"));
    quality.setAttribute('aria-label',t("download_quality"));filename.setAttribute('aria-label',t("download_filename"));nameLabel.firstChild!.textContent=t("filename");
    retry.textContent=t("retry");more.textContent=pendingPermission?t("open_sidebar_to_allow_access"):t("view_downloads");
    start.textContent=busy?t("working"):resolved?.preferences.saveAs?t("choose_location_download"):t("start_download");
    if(status.getAttribute('role')==='alert'||!resolved||status.textContent!==resolved.asset.title)status.textContent=localizeText(status.textContent||'');
    for(const option of quality.options)option.textContent=localizeQuality(option.textContent||'');
    position();
  }
  renderLanguage();watchLanguage(renderLanguage);
  const hide=()=>{popoverOpen=false;panel.hidden=true;shortcut.setAttribute('aria-expanded','false');};
  close.addEventListener('click',event=>{event.stopPropagation();hide();shortcut.focus();});
  shadow.addEventListener('keydown',event=>{if((event as KeyboardEvent).key==='Escape'){hide();shortcut.focus();}});
  for(const event of ['pointerdown','click','dblclick'])shadow.addEventListener(event,event=>event.stopPropagation());
  async function send<T>(message:object):Promise<T> {
    const response=await chrome.runtime.sendMessage(message) as Response<T>;
    if(!response?.ok)throw Object.assign(new Error(response?.error||t("the_download_service_did_not_respond")),{origins:response?.origins||[]});
    return response.value;
  }
  function permissionFailure(error:unknown,command:PlayerCommand,video:HTMLVideoElement,sourceKey:string){
    if((error as {origins?:string[]})?.origins?.length){pendingPermission={command,video,sourceKey};more.textContent=t("open_sidebar_to_allow_access");}
  }
  function showStarted(result:StartResult){retry.hidden=true;status.setAttribute('role','status');status.className='status';status.textContent=result.pending?t("choose_a_save_location"):result.duplicate?t("this_video_is_already_downloading"):result.failed?t("download_did_not_start_retry_in_the_sidebar"):t("download_started");start.hidden=true;quality.hidden=true;nameLabel.hidden=true;pendingPermission=undefined;more.textContent=t("view_downloads");}
  async function retryPermission(){
    const pending=pendingPermission;if(!pending||busy)return;
    pendingPermission=undefined;
    if(target!==pending.video||key(pending.video)!==pending.sourceKey)return;
    busy=true;shortcut.disabled=true;start.disabled=true;status.className='status';status.textContent=t("working");
    try {
      inspect();const result=await send<PlayerResolveResult|StartResult>(pending.command);
      if(target!==pending.video||key(pending.video)!==pending.sourceKey)return;
      if(pending.command.type==='PLAYER_RESOLVE')showResolved(result as PlayerResolveResult);else showStarted(result as StartResult);
      more.textContent=t("view_downloads");
    }catch(e){permissionFailure(e,pending.command,pending.video,pending.sourceKey);status.setAttribute('role','alert');status.className='status error';status.textContent=e instanceof Error?localizeText(e.message):t("download_failed");}
    finally{busy=false;shortcut.disabled=false;start.disabled=false;}
  }
  more.addEventListener('click',()=>{if(target)void send({type:'PLAYER_PANEL',playerId:id(target)}).catch(e=>{status.textContent=localizeText(e.message);});});
  function showResolved(result:PlayerResolveResult) {
    retry.hidden=true;resolved=result;resolvedSource=target?key(target):'';
    status.setAttribute('role','status');status.className='status';status.textContent=result.asset.title;
    quality.replaceChildren();
    for(const variant of result.asset.variants||[]){const option=document.createElement('option');option.value=variant.id;option.textContent=localizeQuality(variant.label);quality.append(option);}
    quality.disabled=false;filename.disabled=false;quality.value=result.asset.variants?.find(v=>String(v.height)===result.preferences.quality)?.id||result.asset.variants?.[0]?.id||'';
    quality.hidden=false;start.hidden=false;start.textContent=result.preferences.saveAs?t("choose_location_download"):t("start_download");nameLabel.hidden=!result.preferences.editFilename||result.preferences.saveAs;filename.value=result.asset.title;if(popoverOpen)quality.focus();
  }
  function resolveSelected(chosen:HTMLVideoElement):Promise<void> {
    const source=key(chosen),pageUrl=location.href;
    if(resolutionFlight?.video===chosen&&resolutionFlight.source===source)return resolutionFlight.promise;
    const command:PlayerCommand={type:'PLAYER_RESOLVE',playerId:id(chosen)};
    const flight={video:chosen,source,promise:Promise.resolve()};
    resolutionFlight=flight;
    flight.promise=send<PlayerResolveResult>(command).then(result=>{
      if(target!==chosen||key(chosen)!==source||location.href!==pageUrl)return;
      resolved=result;resolvedSource=source;pendingPermission=undefined;more.textContent=t("view_downloads");
      if(popoverOpen)showResolved(result);
    }).catch(e=>{
      if(target!==chosen||key(chosen)!==source||location.href!==pageUrl)return;
      permissionFailure(e,command,chosen,source);retry.hidden=!!pendingPermission;
      status.setAttribute('role','alert');status.className='status error';status.textContent=e instanceof Error?localizeText(e.message):t("cannot_detect_the_video_please_retry");
    }).finally(()=>{if(resolutionFlight===flight)resolutionFlight=undefined;});
    return flight.promise;
  }
  retry.addEventListener('click',async event=>{
    event.stopPropagation();if(!target||busy||retry.disabled)return;
    retry.disabled=true;retry.hidden=true;status.setAttribute('role','status');status.className='status';status.textContent=t("detecting_quality");
    try{await resolveSelected(target);}finally{retry.disabled=false;}
  });
  shortcut.addEventListener('click',async event=>{
    event.stopPropagation();if(!target||busy)return;
    if(popoverOpen){hide();return;}
    popoverOpen=true;panel.hidden=false;retry.hidden=true;shortcut.setAttribute('aria-expanded','true');status.className='status';status.textContent=t("detecting_quality");quality.hidden=true;start.hidden=true;nameLabel.hidden=true;
    if(resolved&&resolvedSource===key(target)){showResolved(resolved);return;}
    inspect();await resolveSelected(target);
  });
  start.addEventListener('click',async event=>{
    event.stopPropagation();if(!target||!resolved||busy)return;
    if(resolvedSource!==key(target)){resolved=undefined;status.textContent=t("the_video_changed_reopen_the_download_controls");start.hidden=true;return;}
    if(resolved.preferences.editFilename&&!resolved.preferences.saveAs&&!filename.value.trim()){filename.focus();return;}
    busy=true;start.disabled=true;quality.disabled=true;filename.disabled=true;start.textContent=t("working");const chosen=target,sourceKey=key(chosen);
    const command:PlayerCommand={type:'PLAYER_START',playerId:id(chosen),assetId:resolved.asset.id,variantId:quality.value,filename:resolved.preferences.editFilename&&!resolved.preferences.saveAs?filename.value:undefined};
    try {const result=await send<StartResult>(command);if(target===chosen&&key(chosen)===sourceKey)showStarted(result);}
    catch(e){permissionFailure(e,command,chosen,sourceKey);status.setAttribute('role','alert');status.className='status error';status.textContent=e instanceof Error?localizeText(e.message):t("download_failed");}
    finally{busy=false;start.disabled=false;quality.disabled=false;filename.disabled=false;start.textContent=resolved?.preferences.saveAs?t("choose_location_download"):t("start_download");}
  });
  function position() {
    if(!target||!target.isConnected){host.style.setProperty('display','none','important');return;}
    const rect=target.getBoundingClientRect();
    const fullscreen=document.fullscreenElement;
    if(fullscreen&&!(fullscreen===target||fullscreen.contains(target))){host.style.setProperty('display','none','important');return;}
    const parent=fullscreen&&fullscreen!==target?fullscreen:document.documentElement;
    if(host.parentElement!==parent)parent.append(host);
    const visible=rect.width>=100&&rect.height>=60&&rect.bottom>30&&rect.top<innerHeight-30&&rect.right>30&&rect.left<innerWidth-30;
    host.style.setProperty('display',visible?'block':'none','important');
    if(!visible)return;
    const buttonWidth=shortcut.offsetWidth||114;host.style.setProperty('left',Math.max(8,Math.min(innerWidth-buttonWidth-8,rect.right-buttonWidth-12))+'px','important');
    host.style.setProperty('top',Math.max(8,rect.top+12)+'px','important');
    const buttonTop=Math.max(8,rect.top+12);
    panel.style.maxHeight=Math.max(100,innerHeight-16)+'px';panel.style.top=popoverOpen&&buttonTop+46+panel.offsetHeight>innerHeight-8?Math.max(-buttonTop+8,innerHeight-buttonTop-panel.offsetHeight-8)+'px':'46px';
  }
  window.addEventListener('scroll',position,true);window.addEventListener('resize',position);document.addEventListener('fullscreenchange',position);
  chrome.runtime.onMessage.addListener(message=>{if(message?.type==='CONTENT_SCAN'){previous='';schedule();if(message.retryPermissions){resolutionAttempt='';void retryPermission();}}});
  setInterval(schedule,2000);host.style.setProperty('display','none','important');schedule();
}
