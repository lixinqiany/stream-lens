import { originPattern } from '../model';
import type { Range } from './parser';
export class PermissionError extends Error {
  constructor(public origins:string[]) {super('需要允许访问视频所在的资源站点');this.name='PermissionError';}
}
export class ResourceAccessError extends Error {
  constructor(public status:number,public resourceUrl:string){super(status===410?`视频地址已过期（HTTP 410 · ${new URL(resourceUrl).hostname}），请重试。`:`服务器拒绝访问（HTTP ${status} · ${new URL(resourceUrl).hostname}），请在网页确认可播放后重试。`);this.name='ResourceAccessError';}
}
async function hasPermission(pattern:string) {
  // Offscreen documents expose runtime only. Permission checks belong to the service worker.
  if(chrome.permissions?.contains)return chrome.permissions.contains({origins:[pattern]});
  const response=await chrome.runtime.sendMessage({type:'CHECK_ORIGIN',pattern});
  return response?.ok===true&&response.allowed===true;
}
export async function allowedFetch(url:string,options:{signal?:AbortSignal;range?:Range;limit?:number;cache?:RequestCache}={}) {
  const response=await allowedResponse(url,options);
  const limit=options.limit||64*1024*1024;
  const declared=Number(response.headers.get('content-length'));
  if(declared>limit) {await response.body?.cancel();throw new Error('单个视频分片过大，暂不支持');}
  if(options.range&&response.status!==206) {await response.body?.cancel();throw new Error('资源服务器不支持此视频所需的分段读取');}
  if(options.range) {
    const match=/^bytes (\d+)-(\d+)\/(?:\d+|\*)$/.exec(response.headers.get('content-range')||'');
    if(!match||Number(match[1])!==options.range.offset||Number(match[2])!==options.range.offset+options.range.length-1){await response.body?.cancel();throw new Error('视频服务器返回了错误的分片范围');}
  }
  const reader=response.body?.getReader();if(!reader) throw new Error('服务器没有返回视频内容');
  const chunks:Uint8Array[]=[];let size=0;
  try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new Error('视频资源超出单次处理限制');}chunks.push(value);}}finally{reader.releaseLock();}
  const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.byteLength;}
  if(options.range&&size!==options.range.length) throw new Error('视频分片长度不完整');
  return {data,url:response.url||url};
}
export async function allowedResponse(url:string,options:{signal?:AbortSignal;range?:Range;cache?:RequestCache;stream?:boolean}={}) {
  const pattern=originPattern(url);
  if(!await hasPermission(pattern)) throw new PermissionError([pattern]);
  const headers:Record<string,string>={};
  if(options.range) headers.Range=`bytes=${options.range.offset}-${options.range.offset+options.range.length-1}`;
  const response=await fetch(url,{credentials:'include',headers,cache:options.cache,signal:options.stream?options.signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(45000)]):AbortSignal.timeout(45000)});
  // Redirect targets also require explicit permission before their contents are consumed.
  const finalPattern=originPattern(response.url||url);
  if(finalPattern!==pattern&&!await hasPermission(finalPattern)) {await response.body?.cancel();throw new PermissionError([finalPattern]);}
  if(!response.ok) {await response.body?.cancel();if([401,403,410].includes(response.status))throw new ResourceAccessError(response.status,response.url||url);throw new Error(response.status===404?'视频资源已失效，请重新检测':`资源请求失败（${response.status}）`);}
  return response;
}
