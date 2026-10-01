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
  if (!uri) throw new HlsError('播放清单缺少资源地址');
  const url = new URL(uri, base);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new HlsError('播放清单包含不支持的资源地址');
  return url.href;
}
function byteRange(value: string, previous?: Range): Range {
  const [length, offset] = value.split('@').map(Number);
  if (!Number.isSafeInteger(length) || length <= 0 || (offset !== undefined && (!Number.isSafeInteger(offset) || offset < 0))) throw new HlsError('分片字节范围无效');
  if (offset === undefined && !previous) throw new HlsError('分片字节范围缺少起始位置');
  return { length, offset: offset ?? previous!.offset + previous!.length };
}
export function parseHls(text: string, base: string): HlsPlaylist {
  if (text.length > 5_000_000 || !text.replace(/^\uFEFF/,'').trimStart().startsWith('#EXTM3U')) throw new HlsError('服务器返回的内容不是有效视频播放清单');
  const lines = text.replace(/^\uFEFF/,'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const variants: HlsVariant[] = [], externalAudio: string[] = [];
  for (let i=0;i<lines.length;i++) {
    if (lines[i].startsWith('#EXT-X-MEDIA:')) { const a=attributes(lines[i]); if(a.TYPE==='AUDIO'&&a.URI) externalAudio.push(a['GROUP-ID']); }
    if (!lines[i].startsWith('#EXT-X-STREAM-INF:')) continue;
    const a=attributes(lines[i]); const uri=lines[i+1];
    if(!uri || uri.startsWith('#')) throw new HlsError('清晰度规格缺少资源地址');
    variants.push({url:resolve(uri,base),bandwidth:Number(a['AVERAGE-BANDWIDTH']||a.BANDWIDTH)||undefined,height:Number(a.RESOLUTION?.split('x')[1])||undefined,codecs:a.CODECS,audioGroup:a.AUDIO});
  }
  if (variants.length) return {type:'master',variants:variants.sort((a,b)=>(b.height||0)-(a.height||0)||(b.bandwidth||0)-(a.bandwidth||0)),externalAudio};
  let sequence=0,duration=0,pendingDuration=0,pendingRange:string|undefined,previousRange:Range|undefined,previousUrl:string|undefined;
  let key:HlsKey|undefined,init:Segment['init'],discontinuity=false;
  const segments:Segment[]=[];
  for(const line of lines) {
    if(line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) {sequence=Number(line.split(':')[1]);if(!Number.isSafeInteger(sequence)||sequence<0)throw new HlsError('视频分片序号无效');}
    else if(line.startsWith('#EXTINF:')) pendingDuration=Number(line.slice(8).split(',')[0]);
    else if(line.startsWith('#EXT-X-BYTERANGE:')) pendingRange=line.slice(17);
    else if(line.startsWith('#EXT-X-MAP:')) {const a=attributes(line);init={url:resolve(a.URI,base),range:a.BYTERANGE?byteRange(a.BYTERANGE):undefined};}
    else if(line.startsWith('#EXT-X-KEY:')) {
      const a=attributes(line);
      if(a.METHOD==='NONE') key=undefined;
      else if(a.METHOD==='AES-128'&&(!a.KEYFORMAT||a.KEYFORMAT==='identity')&&a.URI) {
        if(a.IV&&!/^0x[0-9a-f]{1,32}$/i.test(a.IV)) throw new HlsError('视频加密参数无效');
        key={url:resolve(a.URI,base),iv:a.IV};
      } else throw new HlsError('此视频使用当前不支持的加密或 DRM 保护');
    }
    else if(line==='#EXT-X-DISCONTINUITY') discontinuity=true;
    else if(!line.startsWith('#')) {
      const url=resolve(line,base);
      if(!Number.isFinite(pendingDuration)||pendingDuration<=0) throw new HlsError('视频分片时长无效');
      const range=pendingRange?byteRange(pendingRange,url===previousUrl?previousRange:undefined):undefined;
      segments.push({url,duration:pendingDuration,sequence:sequence++,range,key,init});duration+=pendingDuration;
      previousRange=range;previousUrl=url;pendingRange=undefined;pendingDuration=0;
      if(segments.length>30000) throw new HlsError('视频分片过多，暂不支持');
    }
  }
  if(!segments.length) throw new HlsError('播放清单中没有视频分片');
  return {type:'media',segments,duration,ended:lines.includes('#EXT-X-ENDLIST'),discontinuity};
}
export function keyIv(key: HlsKey, sequence: number): Uint8Array<ArrayBuffer> {
  const iv=new Uint8Array(16);
  if(key.iv) {const hex=key.iv.slice(2).padStart(32,'0');for(let i=0;i<16;i++) iv[i]=parseInt(hex.slice(i*2,i*2+2),16);}
  else {let value=BigInt(sequence);for(let i=15;i>=0;i--){iv[i]=Number(value&255n);value>>=8n;}}
  return iv;
}
