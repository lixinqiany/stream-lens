import {t} from '../../i18n';
export type Range = { offset: number; length: number };
export type HlsKey = { url: string; iv?: string };
export type Segment = { url: string; duration: number; sequence: number; range?: Range; key?: HlsKey; init?: { url: string; range?: Range } };
export type HlsVariant = { url: string; bandwidth?: number; height?: number; codecs?: string; audioGroup?: string };
export type HlsPlaylist = { type: 'master'; variants: HlsVariant[]; externalAudio: string[] } | { type: 'media'; segments: Segment[]; duration: number; ended: boolean; discontinuity: boolean };
export class HlsError extends Error { constructor(message: string) { super(message); this.name = 'HlsError'; } }
export function attributes(line: string): Record<string, string> {
  const result: Record<string,string> = {};
  const pattern = /([A-Z0-9-]+)=("[^"]*"|[^,]*)/g;
  for (const match of line.matchAll(pattern)) result[match[1]] = match[2].replace(/^"|"$/g, '');
  return result;
}
function resolve(uri: string, base: string): string {
  if (!uri) throw new HlsError(t("playlist_resource_url_is_missing"));
  const url = new URL(uri, base);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new HlsError(t("playlist_contains_an_unsupported_resource_url"));
  return url.href;
}
function byteRange(value: string, previous?: Range): Range {
  const [length, offset] = value.split('@').map(Number);
  if (!Number.isSafeInteger(length) || length <= 0 || (offset !== undefined && (!Number.isSafeInteger(offset) || offset < 0))) throw new HlsError(t("invalid_segment_byte_range"));
  if (offset === undefined && !previous) throw new HlsError(t("segment_byte_range_has_no_starting_offset"));
  return { length, offset: offset ?? previous!.offset + previous!.length };
}
export function parseHls(text: string, base: string): HlsPlaylist {
  if (text.length > 5_000_000 || !text.replace(/^\uFEFF/,'').trimStart().startsWith('#EXTM3U')) throw new HlsError(t("the_server_did_not_return_a_valid_video"));
  const lines = text.replace(/^\uFEFF/,'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const variants: HlsVariant[] = [], externalAudio: string[] = [];
  for (let i=0;i<lines.length;i++) {
    if (lines[i].startsWith('#EXT-X-MEDIA:')) { const a=attributes(lines[i]); if(a.TYPE==='AUDIO'&&a.URI) externalAudio.push(a['GROUP-ID']); }
    if (!lines[i].startsWith('#EXT-X-STREAM-INF:')) continue;
    const a=attributes(lines[i]); const uri=lines[i+1];
    if(!uri || uri.startsWith('#')) throw new HlsError(t("quality_option_has_no_resource_url"));
    variants.push({url:resolve(uri,base),bandwidth:Number(a['AVERAGE-BANDWIDTH']||a.BANDWIDTH)||undefined,height:Number(a.RESOLUTION?.split('x')[1])||undefined,codecs:a.CODECS,audioGroup:a.AUDIO});
  }
  if (variants.length) return {type:'master',variants:variants.sort((a,b)=>(b.height||0)-(a.height||0)||(b.bandwidth||0)-(a.bandwidth||0)),externalAudio};
  let sequence=0,duration=0,pendingDuration=0,pendingRange:string|undefined,previousRange:Range|undefined,previousUrl:string|undefined;
  let key:HlsKey|undefined,init:Segment['init'],discontinuity=false;
  const segments:Segment[]=[];
  for(const line of lines) {
    if(line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) {sequence=Number(line.split(':')[1]);if(!Number.isSafeInteger(sequence)||sequence<0)throw new HlsError(t("invalid_video_segment_sequence"));}
    else if(line.startsWith('#EXTINF:')) pendingDuration=Number(line.slice(8).split(',')[0]);
    else if(line.startsWith('#EXT-X-BYTERANGE:')) pendingRange=line.slice(17);
    else if(line.startsWith('#EXT-X-MAP:')) {const a=attributes(line);init={url:resolve(a.URI,base),range:a.BYTERANGE?byteRange(a.BYTERANGE):undefined};}
    else if(line.startsWith('#EXT-X-KEY:')) {
      const a=attributes(line);
      if(a.METHOD==='NONE') key=undefined;
      else if(a.METHOD==='AES-128'&&(!a.KEYFORMAT||a.KEYFORMAT==='identity')&&a.URI) {
        if(a.IV&&!/^0x[0-9a-f]{1,32}$/i.test(a.IV)) throw new HlsError(t("invalid_video_encryption_parameters"));
        key={url:resolve(a.URI,base),iv:a.IV};
      } else throw new HlsError(t("this_encryption_or_drm_scheme_is_not_supported"));
    }
    else if(line==='#EXT-X-DISCONTINUITY') discontinuity=true;
    else if(!line.startsWith('#')) {
      const url=resolve(line,base);
      if(!Number.isFinite(pendingDuration)||pendingDuration<=0) throw new HlsError(t("invalid_video_segment_duration"));
      const range=pendingRange?byteRange(pendingRange,url===previousUrl?previousRange:undefined):undefined;
      segments.push({url,duration:pendingDuration,sequence:sequence++,range,key,init});duration+=pendingDuration;
      previousRange=range;previousUrl=url;pendingRange=undefined;pendingDuration=0;
      if(segments.length>30000) throw new HlsError(t("this_video_has_too_many_segments"));
    }
  }
  if(!segments.length) throw new HlsError(t("playlist_contains_no_video_segments"));
  return {type:'media',segments,duration,ended:lines.includes('#EXT-X-ENDLIST'),discontinuity};
}
export function keyIv(key: HlsKey, sequence: number): Uint8Array<ArrayBuffer> {
  const iv=new Uint8Array(16);
  if(key.iv) {const hex=key.iv.slice(2).padStart(32,'0');for(let i=0;i<16;i++) iv[i]=parseInt(hex.slice(i*2,i*2+2),16);}
  else {let value=BigInt(sequence);for(let i=15;i>=0;i--){iv[i]=Number(value&255n);value>>=8n;}}
  return iv;
}
