import {httpUrl} from '../model';
import type {HlsPlaylist} from './parser';

// Read literal player configuration only, without running page scripts. Match
// the same media directory/file, allowing its signed parent path/CDN to rotate.
export function renewedHlsUrl(html:string,oldUrl:string):string {
  const old=new URL(oldUrl),parts=old.pathname.split('/').filter(Boolean);
  if(parts.length<3)throw new Error('无法确认这个视频的新地址，请刷新来源页面后重新选择视频');
  const identity=parts.slice(-3).join('/');
  const text=html.replaceAll('\\/','/').replaceAll('&amp;','&');
  const candidates=[...new Set((text.match(/https?:\/\/[^\s"'<>`\\]+?\.m3u8(?:\?[^\s"'<>`\\]*)?/gi)||[]).map(httpUrl).filter((u):u is string=>!!u))];
  const matches=candidates.filter(url=>new URL(url).pathname.split('/').filter(Boolean).slice(-3).join('/')===identity);
  if(matches.length!==1)throw new Error('无法从来源网页确认这个视频的新地址，请刷新页面后重新选择视频');
  if(matches[0]===oldUrl)throw new Error('来源网页仍返回原来的失效地址，请刷新页面播放后重新检测');
  return matches[0];
}
export function sameHlsTimeline(old:HlsPlaylist,next:HlsPlaylist):boolean {
  if(old.type!=='media'||next.type!=='media'||!next.ended||next.discontinuity||old.segments.length!==next.segments.length)return false;
  const filename=(url?:string)=>url?new URL(url).pathname.split('/').at(-1):undefined;
  return old.segments.every((s,i)=>{const n=next.segments[i];return filename(s.url)===filename(n.url)&&s.sequence===n.sequence&&Math.abs(s.duration-n.duration)<.001&&JSON.stringify(s.range)===JSON.stringify(n.range)&&filename(s.init?.url)===filename(n.init?.url)&&JSON.stringify(s.init?.range)===JSON.stringify(n.init?.range)&&filename(s.key?.url)===filename(n.key?.url)&&s.key?.iv===n.key?.iv;});
}
