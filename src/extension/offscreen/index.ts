import {t,setLanguage} from '../../i18n';
import { type DownloadRecord, type DownloadState } from '../../core/model';
import { allowedFetch, allowedResponse, PermissionError, ResourceAccessError } from '../../core/hls/fetch';
import {checkDestination,openDestination} from '../../platform/destination';
import { keyIv, parseHls, type HlsKey, type Segment } from '../../core/hls/parser';
import {sameHlsTimeline} from '../../core/hls/refresh';
import { TsTransmuxer } from '../../core/hls/transmux';
import { validateMp4Init } from '../../core/hls/mp4';
import {mergeDashInit,parseSidx,patchDashFragment,type DashTrack} from '../../core/dash/mp4';
import type { RunnerMessage } from '../../platform/messages';

type Job={task:DownloadRecord;controller:AbortController;paused:boolean;cancelled:boolean;wake?:()=>void;done?:Promise<void>;cleanupError?:unknown};
const jobs=new Map<string,Job>();
const outputs=new Map<string,{url:string;directory:FileSystemDirectoryHandle}>();
const failedCleanups=new Map<string,()=>Promise<void>>();
const MAX_BYTES=8*1024*1024*1024;
// A new document cannot resume an old writer. Remove leftovers from interrupted sessions.
let cleanup:Promise<void>|undefined;
function cleanupTemporary(){return cleanup??=navigator.storage.getDirectory().then(async root=>{
  const directory=await root.getDirectoryHandle('stream-lens',{create:true});
  const entries=directory as FileSystemDirectoryHandle & {keys():AsyncIterableIterator<string>};
  if(!entries.keys)return;
  for await(const name of entries.keys())if(name.endsWith('.mp4'))await directory.removeEntry(name).catch(()=>{});
}).catch(()=>{});}
async function progress(job:Job,patch:Partial<DownloadRecord>) {
  if(job.cancelled&&patch.state!=='cancelled')return;
  job.task={...job.task,...patch,updatedAt:Date.now()};
  const response=await chrome.runtime.sendMessage({type:'PROGRESS',task:{...patch,id:job.task.id}});
  if(response?.ok===false)throw new Error(response.error||t("cannot_update_the_download_record"));
}
async function waitActive(job:Job) {
  while(job.paused&&!job.cancelled)await new Promise<void>(resolve=>{job.wake=resolve;});
  if(job.cancelled)throw new DOMException(t("task_cancelled"),'AbortError');
}
async function fetchRetry(job:Job,url:string,range?:Segment['range'],limit?:number):Promise<{data:Uint8Array<ArrayBuffer>;url:string}> {
  for(let attempt=0;attempt<3;attempt++) {
    await waitActive(job);
    const signal=job.controller.signal;
    try{return await allowedFetch(url,{signal,range,limit});}
    catch(error){if(job.cancelled)throw error;if(job.paused||signal.aborted){attempt--;continue;}if(error instanceof PermissionError||error instanceof ResourceAccessError||attempt===2)throw error;await new Promise(r=>setTimeout(r,500*2**attempt));}
  }
  throw new Error(t("video_segment_download_failed"));
}
type OutputWriter={bytes:number;write(data:Uint8Array<ArrayBuffer>):Promise<void>;finish(minBytes:number):Promise<void>;abort():Promise<void>};
async function openOutput(job:Job):Promise<OutputWriter> {
  let directory:FileSystemDirectoryHandle|undefined,handle:FileSystemFileHandle|undefined;
  let writer:{write(data:Uint8Array<ArrayBuffer>):Promise<void>;close():Promise<void>;abort():Promise<void>};
  if(job.task.destinationId)writer=await openDestination(job.task.destinationId);
  else {
    await cleanupTemporary();
    directory=await (await navigator.storage.getDirectory()).getDirectoryHandle('stream-lens',{create:true});
    await directory.removeEntry(job.task.id+'.mp4').catch(()=>{});
    handle=await directory.getFileHandle(job.task.id+'.mp4',{create:true});
    const stream=await handle.createWritable();
    writer={write:data=>stream.write(data),close:()=>stream.close(),abort:()=>stream.abort()};
  }
  let closed=false;
  const output:OutputWriter={bytes:0,
    async write(data){
      if(output.bytes+data.byteLength>MAX_BYTES)throw new Error(t("video_exceeds_the_current_8_gb_limit"));
      await writer.write(data);output.bytes+=data.byteLength;
    },
    async finish(minBytes){
      await waitActive(job);
      if(output.bytes<minBytes)throw new Error(t("video_file_is_incomplete_and_cannot_be_saved"));
      if(job.task.destinationId){
        const reservation=await chrome.runtime.sendMessage({type:'PREPARE_SAVE',id:job.task.id});
        if(!reservation?.ok||!reservation.accepted)throw new DOMException(t("task_stopped_before_saving"),'AbortError');
        job.task.state='saving';await waitActive(job);
        await writer.close();closed=true;
        // The final file is now committed; background excludes cancellation
        // after PREPARE_SAVE so it cannot overwrite a successful close.
        const response=await chrome.runtime.sendMessage({type:'SAVED',id:job.task.id});
        if(response?.ok===false)throw new Error(response.error||t("cannot_record_the_save_result"));
      }else{
        await writer.close();closed=true;await waitActive(job);
        const file=await handle!.getFile();
        await progress(job,{state:'saving',speed:0});await waitActive(job);
        const url=URL.createObjectURL(file);outputs.set(job.task.id,{url,directory:directory!});
        const response=await chrome.runtime.sendMessage({type:'OUTPUT',id:job.task.id,url});
        if(response?.ok===false)throw new Error(response.error||t("video_file_could_not_be_saved"));
      }
    },
    async abort(){if(!closed){await writer.abort();closed=true;}if(directory)await removeEntry(directory,job.task.id+'.mp4');},
  };
  return output;
}
async function run(job:Job) {
  if(job.task.protocol==='DASH'){await runDash(job);return;}
  if(['MP4','WEBM'].includes(job.task.protocol)){await runDirect(job);return;}
  let output:OutputWriter|undefined,transmuxer:TsTransmuxer|undefined;
  let completed=false;
  try {
    if(job.task.destinationId)await checkDestination(job.task.destinationId);
    await progress(job,{state:'resolving',error:undefined,neededOrigins:undefined});
    let refreshes=0;
    async function renewUrl(){
      if(refreshes++>=2)throw new Error(t("video_urls_keep_expiring_refresh_the_source_page"));
      await waitActive(job);
      const reply=await chrome.runtime.sendMessage({type:'REFRESH_HLS',id:job.task.id,url:job.task.url});
      if(!reply?.ok){if(reply?.origins?.length)throw new PermissionError(reply.origins);throw new Error(reply?.error||t("cannot_renew_the_video_url"));}
      await waitActive(job);job.task.url=reply.value.url;
      await progress(job,{url:reply.value.url});
    }
    let playlistData;
    try{playlistData=await fetchRetry(job,job.task.url,undefined,5_000_000);}
    catch(e){if(!(e instanceof ResourceAccessError)||e.status!==410)throw e;await renewUrl();playlistData=await fetchRetry(job,job.task.url,undefined,5_000_000);}
    let playlist=parseHls(new TextDecoder().decode(playlistData.data),playlistData.url);
    if(playlist.type!=='media')throw new Error(t("choose_a_specific_quality_and_retry"));
    if(!playlist.ended)throw new Error(t("live_recording_is_not_supported"));
    if(playlist.discontinuity)throw new Error(t("timeline_changes_in_this_video_are_not_supported_164"));
    // One map is supported; mid-stream map/config changes require a separate remux strategy.
    const maps=[...new Set(playlist.segments.map(s=>s.init?JSON.stringify(s.init):''))];
    if(maps.length>1)throw new Error(t("changes_to_video_initialization_data_are_not_supported"));
    output=await openOutput(job);
    const keyCache=new Map<string,CryptoKey>();
    async function renewPlaylist(){
      await renewUrl();const data=await fetchRetry(job,job.task.url,undefined,5_000_000);
      const next=parseHls(new TextDecoder().decode(data.data),data.url);
      if(!sameHlsTimeline(playlist,next)||next.type!=='media')throw new Error(t("playlist_segments_or_timeline_changed_download_from_the"));
      playlist=next;keyCache.clear();
    }
    async function readSegment(index:number,init=false):Promise<Uint8Array<ArrayBuffer>>{
      for(;;){
        const segment=playlist.type==='media'?playlist.segments[index]:undefined;
        if(!segment)throw new Error(t("video_segment_information_changed"));
        const resource=init?segment.init:segment;if(!resource)throw new Error(t("initialization_data_is_missing"));
        try{
          let {data}=await fetchRetry(job,resource.url,resource.range);
          if(segment.key){if(init&&!segment.key.iv)throw new Error(t("initialization_segment_encryption_parameters_are_missing"));data=await decrypt(data,segment.key,segment.sequence);}
          return data;
        }catch(e){if(!(e instanceof ResourceAccessError)||e.status!==410)throw e;await renewPlaylist();}
      }
    }
    async function decrypt(data:Uint8Array<ArrayBuffer>,key:HlsKey,sequence:number) {
      let cryptoKey=keyCache.get(key.url);
      if(!cryptoKey){const {data:raw}=await fetchRetry(job,key.url,undefined,1024);if(raw.length!==16)throw new Error(t("invalid_video_key"));cryptoKey=await crypto.subtle.importKey('raw',raw,'AES-CBC',false,['decrypt']);keyCache.set(key.url,cryptoKey);}
      try{return new Uint8Array(await crypto.subtle.decrypt({name:'AES-CBC',iv:keyIv(key,sequence)},cryptoKey,data));}catch{throw new Error(t("video_segment_decryption_failed_detect_the_video_again"));}
    }
    let bytes=0,lastTime=performance.now(),lastBytes=0;
    async function write(data:Uint8Array) {await output!.write(data as Uint8Array<ArrayBuffer>);}
    let mode:'ts'|'fmp4'|undefined;
    const first=playlist.segments[0];
    if(first.init) {
      const init=await readSegment(0,true);
      validateMp4Init(init);
      await write(init);mode='fmp4';
    }
    await progress(job,{state:job.paused?'paused':'downloading',totalSegments:playlist.segments.length,segments:0});
    for(let index=0;index<playlist.segments.length;index++) {
      await waitActive(job);
      const data=await readSegment(index);bytes+=data.byteLength;
      await waitActive(job);
      if(!mode){if(data[0]===0x47){mode='ts';transmuxer=new TsTransmuxer();}else throw new Error(t("this_segment_format_is_not_supported_try_another"));}
      if(mode==='ts') {for(const piece of transmuxer!.push(data))await write(piece);}
      else {
        const boxType=new TextDecoder().decode(data.slice(4,8));
        if(!['styp','moof','sidx','emsg'].includes(boxType))throw new Error(t("video_segment_is_incomplete_and_cannot_be_merged"));
        await write(data);
      }
      const now=performance.now();const speed=(bytes-lastBytes)/Math.max(.001,(now-lastTime)/1000);lastTime=now;lastBytes=bytes;
      await progress(job,{state:job.paused?'paused':'downloading',segments:index+1,bytes,speed});
    }
    await waitActive(job);await progress(job,{state:'merging',speed:0});
    await output.finish(32);completed=true;
  }catch(error){
    await release(job.task.id);completed=false;
    const state:DownloadState=job.cancelled?'cancelled':'failed';
    await progress(job,{state,speed:0,error:job.cancelled?undefined:error instanceof Error?error.message:t("download_failed_please_retry"),neededOrigins:error instanceof PermissionError?error.origins:undefined}).catch(()=>{});
  }finally{
    transmuxer?.dispose();if(!completed)await discardOutput(job,output);
    jobs.delete(job.task.id);
    void maybeClose();
  }
}
async function runDash(job:Job) {
  let output:OutputWriter|undefined,completed=false;
  try {
    await progress(job,{state:'resolving',error:undefined,neededOrigins:undefined});
    if(job.task.destinationId)await checkDestination(job.task.destinationId);
    const source=job.task.dash;if(!source)throw new Error(t("dash_track_information_is_missing_detect_the_video"));
    // All alternatives belong to the same representation and SegmentBase. Use
    // only API-provided URLs, with permission checked separately for each host.
    const chosen=new Map<DashTrack,string>();
    async function trackFetch(track:DashTrack,range:DashTrack['init']){
      const preferred=chosen.get(track)||track.url;
      const urls=[...new Set([preferred,track.url,...track.backupUrls||[]])];
      let last:unknown;
      for(const url of urls){try{const data=await fetchRetry(job,url,range);chosen.set(track,url);return data;}catch(e){if(job.cancelled||job.controller.signal.aborted)throw e;last=e;}}
      throw last;
    }
    const [vinit,ainit,vindex,aindex]=await Promise.all([
      trackFetch(source.video,source.video.init),trackFetch(source.audio,source.audio.init),
      trackFetch(source.video,source.video.index),trackFetch(source.audio,source.audio.index),
    ]);
    const merged=mergeDashInit(vinit.data,ainit.data);
    const video=parseSidx(vindex.data,source.video.index.offset),audio=parseSidx(aindex.data,source.audio.index.offset);
    const segments=[...video.map(s=>({...s,track:source.video,id:merged.videoId})),...audio.map(s=>({...s,track:source.audio,id:merged.audioId}))].sort((a,b)=>a.time-b.time||a.id-b.id);
    const totalBytes=segments.reduce((n,s)=>n+s.range.length,0)+merged.data.length;
    if(totalBytes>MAX_BYTES)throw new Error(t("video_exceeds_the_current_8_gb_limit"));
    output=await openOutput(job);
    await output.write(merged.data);
    let bytes=merged.data.length,lastBytes=bytes,lastTime=performance.now();
    await progress(job,{state:job.paused?'paused':'downloading',totalSegments:segments.length,totalBytes,bytes,segments:0});
    for(let i=0;i<segments.length;i++) {
      const segment=segments[i];await waitActive(job);
      const {data}=await trackFetch(segment.track,segment.range);await waitActive(job);
      const fragment=patchDashFragment(data,segment.id,i+1);await output.write(fragment);
      bytes+=data.length;const now=performance.now();const speed=(bytes-lastBytes)/Math.max(.001,(now-lastTime)/1000);lastTime=now;lastBytes=bytes;
      await progress(job,{state:job.paused?'paused':'downloading',segments:i+1,bytes,speed});
    }
    await waitActive(job);await progress(job,{state:'merging',speed:0});
    await output.finish(merged.data.length+32);completed=true;
  }catch(error){
    await release(job.task.id);completed=false;
    await progress(job,{state:job.cancelled?'cancelled':'failed',speed:0,error:job.cancelled?undefined:error instanceof Error?error.message:t("video_or_audio_download_failed"),neededOrigins:error instanceof PermissionError?error.origins:undefined}).catch(()=>{});
  }finally{
    if(!completed)await discardOutput(job,output);
    jobs.delete(job.task.id);void maybeClose();
  }
}

async function runDirect(job:Job) {
  let output:OutputWriter|undefined,completed=false;
  try {
    if(!job.task.destinationId)throw new Error(t("choose_a_save_location_first"));
    await checkDestination(job.task.destinationId);
    // A direct response restarts after pause. Abort only that attempt's
    // disk staging; the final target stays unchanged until successful close.
    for(;;){
      await waitActive(job);await progress(job,{state:'downloading',bytes:0,totalBytes:undefined,speed:0});
      output=await openOutput(job);const attemptSignal=job.controller.signal;
      let reader:ReadableStreamDefaultReader<Uint8Array>|undefined;
      try {
        const response=await allowedResponse(job.task.url,{signal:attemptSignal,stream:true});
        const total=Number(response.headers.get('content-length'))||undefined;
        if(total&&total>MAX_BYTES)throw new Error(t("video_exceeds_the_current_8_gb_limit"));
        reader=response.body?.getReader();if(!reader)throw new Error(t("the_server_returned_no_video_data"));
        let bytes=0,lastBytes=0,lastTime=performance.now();
        for(;;){
          const {value,done}=await reader.read();if(done)break;
          attemptSignal.throwIfAborted();bytes+=value.byteLength;
          if(bytes>MAX_BYTES)throw new Error(t("video_exceeds_the_current_8_gb_limit"));
          await output.write(value as Uint8Array<ArrayBuffer>);
          const now=performance.now();if(now-lastTime>250){await progress(job,{bytes,totalBytes:total,speed:(bytes-lastBytes)/((now-lastTime)/1000)});lastTime=now;lastBytes=bytes;}
        }
        if(!bytes||(total&&bytes!==total))throw new Error(t("video_file_length_is_incomplete"));
        await progress(job,{bytes,totalBytes:total,speed:0});
        await waitActive(job);attemptSignal.throwIfAborted();
        break;
      }catch(error){
        if(output)await output.abort();output=undefined;
        if(!job.cancelled&&(job.paused||attemptSignal.aborted))continue;throw error;
      }finally{await reader?.cancel().catch(()=>{});reader?.releaseLock();}
    }
    await waitActive(job);await progress(job,{state:'saving',speed:0});
    await output!.finish(1);completed=true;
  }catch(error){
    await progress(job,{state:job.cancelled?'cancelled':'failed',speed:0,error:job.cancelled?undefined:error instanceof Error?error.message:t("download_failed"),neededOrigins:error instanceof PermissionError?error.origins:undefined}).catch(()=>{});
  }finally{
    if(!completed)await discardOutput(job,output);
    jobs.delete(job.task.id);void maybeClose();
  }
}

async function removeEntry(directory:FileSystemDirectoryHandle,name:string) {
  try{await directory.removeEntry(name);}catch(error){if(!(error instanceof DOMException&&error.name==='NotFoundError'))throw error;}
}
async function discardOutput(job:Job,output?:OutputWriter) {
  if(!output)return;
  try{await output.abort();}catch(error){job.cleanupError=error;failedCleanups.set(job.task.id,()=>output.abort());}
}
async function release(id:string) {
  const retry=failedCleanups.get(id);if(retry){await retry();failedCleanups.delete(id);}
  const output=outputs.get(id);if(output){await removeEntry(output.directory,id+'.mp4');URL.revokeObjectURL(output.url);outputs.delete(id);}
  void maybeClose();
}
async function maybeClose(){if(!jobs.size&&!outputs.size&&!failedCleanups.size)void chrome.runtime.sendMessage({type:'RUNNER_IDLE'}).catch(()=>{});}
function respondAfter(operation:Promise<void>,respond:(message:unknown)=>void){
  void operation.then(()=>respond({ok:true})).catch(error=>respond({ok:false,error:error instanceof Error?error.message:t('operation_failed_please_retry')}));
}
chrome.runtime.onMessage.addListener((message:RunnerMessage,sender,respond)=>{
  if(message?.target!=='runner'||sender.id!==chrome.runtime.id||sender.tab||(sender.url&&!sender.url.startsWith(chrome.runtime.getURL(''))))return;
  if(message.type==='PING'){respond({ok:true,jobs:[...new Set([...jobs.keys(),...failedCleanups.keys()])],outputs:outputs.size});return;}
  if(message.type==='LANGUAGE'){setLanguage(message.language);respond({ok:true});return;}
  if(message.type==='RUN') {
    setLanguage(message.language);
    if(jobs.has(message.task.id)||failedCleanups.has(message.task.id)){respond({ok:false,error:t("this_task_is_still_running_retry_later")});return;}
    const job:Job={task:message.task,controller:new AbortController(),paused:false,cancelled:false};jobs.set(job.task.id,job);
    job.done=release(job.task.id).then(()=>run(job)).catch(error=>{job.cleanupError=error;jobs.delete(job.task.id);});respond({ok:true});return;
  }
  if(message.type==='RELEASE'){respondAfter(release(message.id),respond);return true;}
  if(message.type==='CONTROL') {
    const job=jobs.get(message.id);if(!job){if(message.action==='cancel'){respondAfter(release(message.id),respond);return true;}respond({ok:false,error:t("the_download_runner_stopped_start_the_download_again")});return;}
    if(message.action==='pause'&&!job.paused){if(['merging','saving'].includes(job.task.state)){respond({ok:false,error:t("finishing_the_file_please_wait")});return;}job.paused=true;job.controller.abort();void progress(job,{state:'paused',speed:0}).catch(()=>{});}
    if(message.action==='resume'&&job.paused){job.paused=false;job.controller=new AbortController();job.wake?.();void progress(job,{state:job.task.totalSegments?'downloading':'resolving'}).catch(()=>{});}
    if(message.action==='cancel'&&job.task.destinationId&&job.task.state==='saving'){respond({ok:false,error:t("saving_the_file_please_wait")});return;}
    if(message.action==='cancel'){job.cancelled=true;job.controller.abort();job.wake?.();respondAfter((async()=>{await job.done;if(job.cleanupError)throw job.cleanupError;await release(message.id);})(),respond);return true;}
    respond({ok:true});return;
  }
});
