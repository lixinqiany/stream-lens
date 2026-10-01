import {t} from '../../i18n';
import type {Variant} from '../model';
import {allowedFetch} from '../hls/fetch';
import {literalJson} from './youtube';
export const douyinMobileAgent='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1';
export function douyinId(pageUrl:string):string|undefined {
  let page:URL;try{page=new URL(pageUrl);}catch{return;}
  if(!['https:','http:'].includes(page.protocol)||!['douyin.com','www.douyin.com','www.iesdouyin.com'].includes(page.hostname))return;
  const id=page.pathname.match(/^\/(?:share\/)?video\/(\d+)(?:\/|$)/)?.[1]||page.searchParams.get('modal_id');
  return id&&/^\d{15,22}$/.test(id)?id:undefined;
}
export function douyinEndpoint(pageUrl:string){const id=douyinId(pageUrl);return id?`https://www.iesdouyin.com/share/video/${id}/?from_aid=1128&from_ssr=1`:undefined;}
export function isDouyinEndpoint(pageUrl:string,url:string){return !!douyinEndpoint(pageUrl)&&douyinEndpoint(pageUrl)===url;}
function mediaUrl(value:unknown){
  let u:URL;try{u=new URL(String(value));}catch{return;}
  if(u.protocol!=='https:'||!['douyinvod.com','douyin.com','iesdouyin.com','bytecdn.cn','bytecdn.com','snssdk.com','amemv.com'].some(host=>u.hostname===host||u.hostname.endsWith('.'+host)))return;
  return u.href;
}
export function parseDouyinPage(html:string,id:string):{variants:Variant[];duration:number} {
  const router=literalJson(html,/window\._ROUTER_DATA\s*=\s*/);
  const data=router?.loaderData?.['video_(id)/page'];const result=data?.videoInfoRes;
  const item=result?.item_list?.find((v:any)=>String(v.aweme_id)===id);
  if(result?.status_code!==0||data?.itemId!==id||!item?.video)throw new Error(t('site_playback_unavailable'));
  if(item.video.drm_type||item.video.is_drm||item.is_preview)throw new Error(t('drmprotected_videos_cannot_be_downloaded'));
  const url=item.video.play_addr?.url_list?.map(mediaUrl).find(Boolean);
  const duration=Number(item.video.duration)/1000;
  if(!url||!Number.isFinite(duration)||duration<=0)throw new Error(t('site_playback_unavailable'));
  // The public share page supplies a complete, muxed MP4. Preserve its normal
  // playback URL (including any watermark) instead of constructing a new URL.
  return {variants:[{id:'dy-original',url,label:t('original_quality'),height:item.video.height}],duration};
}
export async function resolveDouyin(pageUrl:string){
  const endpoint=douyinEndpoint(pageUrl),id=douyinId(pageUrl);if(!endpoint||!id)throw new Error(t('invalid_video_request'));
  // Establish the share site's normal session cookie before requesting its
  // rendered playback data. Cookies remain in the browser's cookie store.
  await allowedFetch(`https://www.iesdouyin.com/share/video/${id}/`,{limit:5_000_000});
  const fetched=await allowedFetch(endpoint,{limit:5_000_000});return parseDouyinPage(new TextDecoder().decode(fetched.data),id);
}
