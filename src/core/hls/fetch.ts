import {t} from '../../i18n';
import { originPattern } from '../model';
import type { Range } from './parser';
export class PermissionError extends Error {
  constructor(public origins:string[]) {super(t("allow_access_to_the_video_resource_site"));this.name='PermissionError';}
}
export class ResourceAccessError extends Error {
  constructor(public status:number,public resourceUrl:string){super(status===410?t("video_url_expired_http_410_please_retry",[new URL(resourceUrl).hostname]):t("access_denied_http_check_that_the_video_plays",[status,new URL(resourceUrl).hostname]));this.name='ResourceAccessError';}
}
async function hasPermission(pattern:string) {
  // Offscreen documents expose runtime only. Permission checks belong to the service worker.
  if(chrome.permissions?.contains)return chrome.permissions.contains({origins:[pattern]});
  const response=await chrome.runtime.sendMessage({type:'CHECK_ORIGIN',pattern});
  return response?.ok===true&&response.allowed===true;
}
export async function allowedFetch(url:string,options:{signal?:AbortSignal;range?:Range;limit?:number;cache?:RequestCache;json?:unknown}={}) {
  const response=await allowedResponse(url,options);
  const limit=options.limit||64*1024*1024;
  const declared=Number(response.headers.get('content-length'));
  if(declared>limit) {await response.body?.cancel();throw new Error(t("this_video_segment_exceeds_the_size_limit"));}
  if(options.range&&response.status!==206) {await response.body?.cancel();throw new Error(t("the_server_does_not_support_the_required_range"));}
  if(options.range) {
    const match=/^bytes (\d+)-(\d+)\/(?:\d+|\*)$/.exec(response.headers.get('content-range')||'');
    if(!match||Number(match[1])!==options.range.offset||Number(match[2])!==options.range.offset+options.range.length-1){await response.body?.cancel();throw new Error(t("the_server_returned_an_incorrect_segment_range"));}
  }
  const reader=response.body?.getReader();if(!reader) throw new Error(t("the_server_returned_no_video_data"));
  const chunks:Uint8Array[]=[];let size=0;
  try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new Error(t("video_resource_exceeds_the_perrequest_limit"));}chunks.push(value);}}finally{reader.releaseLock();}
  const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.byteLength;}
  if(options.range&&size!==options.range.length) throw new Error(t("video_segment_is_incomplete"));
  return {data,url:response.url||url};
}
export async function allowedResponse(url:string,options:{signal?:AbortSignal;range?:Range;cache?:RequestCache;stream?:boolean;json?:unknown}={}) {
  const pattern=originPattern(url);
  if(!await hasPermission(pattern)) throw new PermissionError([pattern]);
  const headers:Record<string,string>={};
  if(options.json!==undefined)headers['Content-Type']='application/json';
  if(options.range) headers.Range=`bytes=${options.range.offset}-${options.range.offset+options.range.length-1}`;
  const response=await fetch(url,{method:options.json===undefined?'GET':'POST',body:options.json===undefined?undefined:JSON.stringify(options.json),credentials:'include',headers,cache:options.cache,signal:options.stream?options.signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(45000)]):AbortSignal.timeout(45000)});
  // Redirect targets also require explicit permission before their contents are consumed.
  const finalPattern=originPattern(response.url||url);
  if(finalPattern!==pattern&&!await hasPermission(finalPattern)) {await response.body?.cancel();throw new PermissionError([finalPattern]);}
  if(!response.ok) {await response.body?.cancel();if([401,403,410].includes(response.status))throw new ResourceAccessError(response.status,response.url||url);throw new Error(response.status===404?t("video_resource_is_no_longer_available_detect_it"):t("resource_request_failed",[response.status]));}
  return response;
}
