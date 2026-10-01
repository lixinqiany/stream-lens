import {httpUrl, type Variant} from '../model.ts';
import type {DashTrack} from '../dash/mp4';
export function biliEndpoint(pageUrl:string,episodeId?:number):string|undefined {
  let page:URL;try{page=new URL(pageUrl);}catch{return;}
  if(!/(^|\.)bilibili\.com$/.test(page.hostname))return;
  const ep=page.pathname.match(/^\/bangumi\/play\/ep(\d+)(?:\/|$)/)?.[1];
  if(ep)return `https://api.bilibili.com/pgc/player/web/playurl?ep_id=${ep}&qn=127&fnval=4048&fnver=0&fourk=1`;
  const season=page.pathname.match(/^\/bangumi\/play\/ss(\d+)(?:\/|$)/)?.[1];
  if(season){
    if(typeof episodeId==='number'&&Number.isSafeInteger(episodeId)&&episodeId>0)return `https://api.bilibili.com/pgc/player/web/playurl?ep_id=${episodeId}&qn=127&fnval=4048&fnver=0&fourk=1`;
    return `https://api.bilibili.com/pgc/view/web/season?season_id=${season}`;
  }
  const bv=page.pathname.match(/^\/video\/(BV[a-zA-Z0-9]+)/)?.[1];
  if(bv)return `https://api.bilibili.com/x/web-interface/view?bvid=${bv}`;
}
// Season routes keep their URL while the player changes episodes. Accept only
// the canonical API address constructed from the selected player's episode ID.
export function isBiliEndpoint(pageUrl:string,url:string):boolean {
  if(biliEndpoint(pageUrl)===url)return true;
  let page:URL,api:URL;try{page=new URL(pageUrl);api=new URL(url);}catch{return false;}
  if(!/^\/bangumi\/play\/ss\d+(?:\/|$)/.test(page.pathname))return false;
  const episodeId=Number(api.searchParams.get('ep_id'));
  return Number.isSafeInteger(episodeId)&&episodeId>0&&biliEndpoint(pageUrl,episodeId)===url;
}
export function biliPlayEndpoint(bvid:string,cid:number):string {
  return `https://api.bilibili.com/x/player/playurl?bvid=${encodeURIComponent(bvid)}&cid=${cid}&qn=127&fnval=4048&fnver=0&fourk=1`;
}
function range(value:unknown) {
  const match=typeof value==='string'&&/^(\d+)-(\d+)$/.exec(value);
  if(!match)throw new Error('音视频分段索引无效');
  const offset=Number(match[1]),end=Number(match[2]);
  if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(end)||end<offset||end>1_000_000)throw new Error('音视频分段索引超出范围');
  return {offset,length:end-offset+1};
}
function track(raw:any):DashTrack {
  const url=httpUrl(raw.baseUrl||raw.base_url);
  const segment=raw.SegmentBase||raw.segment_base;
  if(!url||!segment)throw new Error('音视频地址或索引缺失');
  const alternatives=raw.backupUrl||raw.backup_url||[];
  const backupUrls=Array.isArray(alternatives)?[...new Set(alternatives.map(httpUrl).filter((u):u is string=>!!u&&u!==url))].slice(0,4):[];
  return {url,backupUrls,init:range(segment.Initialization||segment.initialization),index:range(segment.indexRange||segment.index_range),codec:raw.codecs};
}
export function parseBiliPlayResponse(json:any):{variants:Variant[];duration:number} {
  if(json?.code!==0)throw new Error(json?.code===-10403?'此视频需要登录、会员或所在地区的播放权限，请先在网页正常播放':`播放接口返回错误：${String(json?.message||json?.code||'未知错误').slice(0,180)}`);
  const result=json.result||json.data;
  const data=result?.video_info||result;
  if(data?.is_drm||data?.drm_tech_type||data?.dash?.drm_tech_type)throw new Error('此视频使用 DRM 保护，无法下载');
  if(data?.is_preview)throw new Error('播放接口只返回试看，请先在网页取得完整播放权限');
  const videos=data?.dash?.video, audios=data?.dash?.audio;
  if(!Array.isArray(videos)||!Array.isArray(audios))throw new Error('播放接口没有返回可合并的 DASH 音视频');
  const audio=audios.filter((t:any)=>/^mp4a\./i.test(t.codecs||'')).sort((a:any,b:any)=>(/^mp4a\.40\.2$/i.test(b.codecs)?1:0)-(/^mp4a\.40\.2$/i.test(a.codecs)?1:0)||(b.bandwidth||0)-(a.bandwidth||0))[0];
  if(!audio)throw new Error('没有找到支持的 AAC 音轨');
  const choices=videos.filter((t:any)=>/^avc1\./i.test(t.codecs||'')).sort((a:any,b:any)=>(b.height||0)-(a.height||0)||(b.bandwidth||0)-(a.bandwidth||0));
  const variants=choices.map((v:any,i:number)=>({id:'dash-'+i,url:track(v).url,label:`${v.height}p`,height:v.height,bandwidth:v.bandwidth,codecs:v.codecs,dash:{video:track(v),audio:track(audio)}}));
  if(!variants.length)throw new Error('没有找到支持的 H.264 清晰度');
  return {variants,duration:(data.timelength||data.dash.duration*1000)/1000};
}
