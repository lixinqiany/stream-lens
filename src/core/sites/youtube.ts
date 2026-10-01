import {t} from '../../i18n';
import type {Variant} from '../model';
import type {DashTrack} from '../dash/mp4';
import {allowedFetch} from '../hls/fetch';

export function youtubeId(pageUrl:string):string|undefined {
  let page:URL;try{page=new URL(pageUrl);}catch{return;}
  if(page.protocol!=='https:'&&page.protocol!=='http:')return;
  const host=page.hostname.toLowerCase();
  const id=host==='youtu.be'?page.pathname.slice(1).split('/')[0]:['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com'].includes(host)?page.pathname==='/watch'?page.searchParams.get('v'):page.pathname.match(/^\/(?:shorts|embed)\/([^/]+)(?:\/|$)/)?.[1]:undefined;
  return id&&/^[\w-]{11}$/.test(id)?id:undefined;
}
export function youtubeEndpoint(pageUrl:string){const id=youtubeId(pageUrl);return id?`https://www.youtube.com/watch?v=${id}`:undefined;}
export function isYoutubeEndpoint(pageUrl:string,url:string){return !!youtubeEndpoint(pageUrl)&&youtubeEndpoint(pageUrl)===url;}

// Read only literal JSON. Page scripts are never evaluated in the extension.
export function literalJson(html:string,marker:RegExp):any {
  const match=marker.exec(html);if(!match)return;
  const start=match.index+match[0].length;let depth=0,quoted=false,escaped=false;
  for(let i=start;i<html.length&&i-start<5_000_000;i++){
    const c=html[i];
    if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}
    if(c==='"')quoted=true;
    else if(c==='{'||c==='[')depth++;
    else if(c==='}'||c===']'){if(--depth===0){try{return JSON.parse(html.slice(start,i+1));}catch{return;}}}
    else if(!depth&&!/\s/.test(c))return;
  }
}
function playbackAllowed(json:any,id:string){
  if(json?.playabilityStatus?.status!=='OK')throw new Error(t('site_playback_unavailable'));
  if(json.videoDetails?.videoId!==id)throw new Error(t('the_video_changed_select_it_again_105'));
  if(json.videoDetails.isLive||json.videoDetails.isLiveNow||json.microformat?.playerMicroformatRenderer?.liveBroadcastDetails?.isLiveNow)throw new Error(t('live_recording_is_not_supported'));
  if(json.streamingData?.drmFamilies?.length)throw new Error(t('drmprotected_videos_cannot_be_downloaded'));
}
function codec(raw:any){return typeof raw.mimeType==='string'?raw.mimeType.match(/codecs="([^"]+)"/)?.[1]||'':'';}
function range(raw:any){
  const offset=Number(raw?.start),end=Number(raw?.end);
  if(!/^\d+$/.test(String(raw?.start))||!/^\d+$/.test(String(raw?.end))||!Number.isSafeInteger(offset)||!Number.isSafeInteger(end)||end<offset||end>1_000_000)throw new Error(t('invalid_track_segment_index'));
  return {offset,length:end-offset+1};
}
function track(raw:any):DashTrack {
  let url:URL;try{url=new URL(raw.url);}catch{throw new Error(t('track_url_or_index_is_missing'));}
  if(url.protocol!=='https:'||!/(^|\.)googlevideo\.com$/.test(url.hostname)||raw.drmFamilies?.length)throw new Error(t('track_url_or_index_is_missing'));
  return {url:url.href,init:range(raw.initRange),index:range(raw.indexRange),codec:codec(raw)};
}
export function parseYoutubePlayer(json:any,id:string):{variants:Variant[];duration:number} {
  playbackAllowed(json,id);
  const formats=json.streamingData?.adaptiveFormats;
  if(!Array.isArray(formats))throw new Error(t('playback_api_returned_no_compatible_dash_tracks'));
  const compatible=formats.filter((f:any)=>f.url&&f.initRange&&f.indexRange&&!f.drmFamilies?.length);
  const audio=compatible.filter((f:any)=>/^audio\/mp4/.test(f.mimeType)&&/^mp4a\.40\.2$/i.test(codec(f))).sort((a:any,b:any)=>Number(!!b.audioTrack?.audioIsDefault)-Number(!!a.audioTrack?.audioIsDefault)||(b.bitrate||0)-(a.bitrate||0))[0];
  if(!audio)throw new Error(t('no_supported_aac_audio_track_found'));
  const choices=compatible.filter((f:any)=>/^video\/mp4/.test(f.mimeType)&&/^avc1\./i.test(codec(f))).sort((a:any,b:any)=>(b.height||0)-(a.height||0)||(b.fps||0)-(a.fps||0)||(b.bitrate||0)-(a.bitrate||0));
  const seen=new Set<string>(),variants:Variant[]=[];
  for(const v of choices){
    const label=`${v.height}p${v.fps>30?` ${v.fps}fps`:''}`;if(seen.has(label))continue;seen.add(label);
    const video=track(v);variants.push({id:`yt-${v.itag}`,url:video.url,label,height:v.height,bandwidth:v.bitrate,codecs:video.codec,dash:{video,audio:track(audio)}});
  }
  if(!variants.length)throw new Error(t('no_supported_h264_quality_found'));
  const duration=Number(json.videoDetails.lengthSeconds);if(!Number.isFinite(duration)||duration<=0)throw new Error(t('video_file_is_incomplete_and_cannot_be_saved'));
  return {variants,duration};
}
export async function resolveYoutube(pageUrl:string){
  const id=youtubeId(pageUrl),endpoint=youtubeEndpoint(pageUrl);if(!id||!endpoint)throw new Error(t('invalid_video_request'));
  const data=await allowedFetch(endpoint,{limit:5_000_000});const html=new TextDecoder().decode(data.data);
  const page=literalJson(html,/(?:var\s+)?ytInitialPlayerResponse\s*=\s*/);
  playbackAllowed(page,id);
  if(page.streamingData?.adaptiveFormats?.some((f:any)=>f.url&&/^avc1\./i.test(codec(f))))return parseYoutubePlayer(page,id);
  // Some public pages expose only SABR. Request a normal indexed MP4 playback
  // response, without deciphering signatures, tokens, challenges or DRM.
  const key=html.match(/"INNERTUBE_API_KEY"\s*:\s*"([A-Za-z0-9_-]+)"/)?.[1];
  if(!key)throw new Error(t('site_playback_unavailable'));
  const fetched=await allowedFetch(`https://www.youtube.com/youtubei/v1/player?key=${key}`,{limit:5_000_000,json:{context:{client:{clientName:'IOS',clientVersion:'20.20.5'}},videoId:id}});
  return parseYoutubePlayer(JSON.parse(new TextDecoder().decode(fetched.data)),id);
}
