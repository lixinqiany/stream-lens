import type {Range} from '../hls/parser';
export type DashTrack={url:string;backupUrls?:string[];init:Range;index:Range;codec:string};
export type DashSource={video:DashTrack;audio:DashTrack};
type Box={start:number;size:number;type:string;header:number};
const decoder=new TextDecoder();
export function boxes(data:Uint8Array,start=0,end=data.length):Box[] {
  const view=new DataView(data.buffer,data.byteOffset,data.byteLength),result:Box[]=[];
  for(let at=start;at<end;) {
    if(at+8>end)throw new Error('MP4 结构被截断');
    let size=view.getUint32(at),header=8;
    if(size===1){if(at+16>end)throw new Error('MP4 扩展结构被截断');size=Number(view.getBigUint64(at+8));header=16;}
    if(size===0)size=end-at;
    if(!Number.isSafeInteger(size)||size<header||at+size>end)throw new Error('MP4 结构大小无效');
    result.push({start:at,size,type:decoder.decode(data.subarray(at+4,at+8)),header});at+=size;
  }
  return result;
}
const part=(data:Uint8Array,box:Box)=>data.slice(box.start,box.start+box.size);
export function concat(parts:Uint8Array[]):Uint8Array<ArrayBuffer> {const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;}
function box(type:string,parts:Uint8Array[]) {const data=concat(parts),out=new Uint8Array(data.length+8);new DataView(out.buffer).setUint32(0,out.length);out.set(new TextEncoder().encode(type),4);out.set(data,8);return out;}
function trackId(data:Uint8Array):number {
  const tkhd=boxes(data,8).find(b=>b.type==='tkhd');if(!tkhd)throw new Error('音视频轨道缺少头部');
  const offset=tkhd.start+tkhd.header+(data[tkhd.start+tkhd.header]===1?20:12);return new DataView(data.buffer,data.byteOffset,data.length).getUint32(offset);
}
function patchTrak(data:Uint8Array,newId:number) {
  const out=data.slice(),tkhd=boxes(out,8).find(b=>b.type==='tkhd')!;
  new DataView(out.buffer).setUint32(tkhd.start+tkhd.header+(out[tkhd.start+tkhd.header]===1?20:12),newId);return out;
}
function handler(data:Uint8Array):string {
  const mdia=boxes(data,8).find(b=>b.type==='mdia');if(!mdia)throw new Error('轨道缺少媒体信息');
  const hdlr=boxes(data,mdia.start+mdia.header,mdia.start+mdia.size).find(b=>b.type==='hdlr');
  return hdlr?decoder.decode(data.subarray(hdlr.start+hdlr.header+8,hdlr.start+hdlr.header+12)):'';
}
function encrypted(data:Uint8Array):boolean {
  // Protection boxes and encrypted sample entries are rejected before writing output.
  return ['encv','enca','pssh','senc','sinf'].some(type=>{const bytes=new TextEncoder().encode(type);for(let i=4;i<data.length-4;i++)if(bytes.every((b,j)=>data[i+j]===b))return true;return false;});
}
export function mergeDashInit(video:Uint8Array,audio:Uint8Array) {
  if(encrypted(video)||encrypted(audio))throw new Error('音视频含加密或 DRM 信息，无法合并');
  const vb=boxes(video),ab=boxes(audio),vm=vb.find(b=>b.type==='moov'),am=ab.find(b=>b.type==='moov'),ftyp=vb.find(b=>b.type==='ftyp');
  if(!vm||!am||!ftyp)throw new Error('音视频初始化信息缺失');
  const vc=boxes(video,vm.start+vm.header,vm.start+vm.size),ac=boxes(audio,am.start+am.header,am.start+am.size);
  const vt=vc.filter(b=>b.type==='trak').map(b=>part(video,b)).find(t=>handler(t)==='vide');
  const at=ac.filter(b=>b.type==='trak').map(b=>part(audio,b)).find(t=>handler(t)==='soun');
  if(!vt||!at)throw new Error('缺少视频或音频轨道');
  const vId=trackId(vt),aId=trackId(at),newAudioId=vId===1?2:1;
  const defaults:Uint8Array[]=[];
  for(const [data,children,oldId,newId] of [[video,vc,vId,vId],[audio,ac,aId,newAudioId]] as const) {
    const mvex=children.find(b=>b.type==='mvex');if(!mvex)throw new Error('不支持非分片 DASH 音视频');
    const trex=boxes(data,mvex.start+mvex.header,mvex.start+mvex.size).find(b=>b.type==='trex'&&new DataView(data.buffer,data.byteOffset).getUint32(b.start+b.header+4)===oldId);
    if(!trex)throw new Error('音视频缺少分片默认参数');
    const copy=part(data,trex);new DataView(copy.buffer).setUint32(trex.header+4,newId);defaults.push(copy);
  }
  const mvhd=vc.find(b=>b.type==='mvhd');if(!mvhd)throw new Error('缺少影片头部');
  const movie=part(video,mvhd);new DataView(movie.buffer).setUint32(movie.length-4,Math.max(vId,newAudioId)+1);
  return {data:concat([part(video,ftyp),box('moov',[movie,vt,patchTrak(at,newAudioId),box('mvex',defaults)])]),videoId:vId,audioId:newAudioId};
}
export type DashSegment={range:Range;time:number;duration:number};
export function parseSidx(data:Uint8Array,absoluteOffset:number):DashSegment[] {
  const b=boxes(data).find(b=>b.type==='sidx');if(!b)throw new Error('缺少 DASH 分段索引');
  const v=new DataView(data.buffer,data.byteOffset,data.length),base=b.start+b.header,version=data[base];
  if(version!==0&&version!==1)throw new Error('不支持此 DASH 索引版本');
  const scale=v.getUint32(base+8);if(!scale)throw new Error('DASH 时间刻度无效');
  let at=base+12,time:number,offset:number;
  if(version===0){time=v.getUint32(at);offset=v.getUint32(at+4);at+=8;}else{time=Number(v.getBigUint64(at));offset=Number(v.getBigUint64(at+8));at+=16;}
  let position=absoluteOffset+b.start+b.size+offset;const count=v.getUint16(at+2);at+=4;
  if(count>30000||at+count*12>b.start+b.size)throw new Error('DASH 索引数量无效');
  const result:DashSegment[]=[];
  for(let i=0;i<count;i++,at+=12) {
    const word=v.getUint32(at),size=word&0x7fffffff,duration=v.getUint32(at+4);
    if(word>>>31||!size||!duration||size>64*1024*1024||!Number.isSafeInteger(position))throw new Error('不支持此 DASH 分段结构');
    result.push({range:{offset:position,length:size},time:time/scale,duration:duration/scale});position+=size;time+=duration;
  }
  if(!result.length)throw new Error('DASH 索引没有视频分段');return result;
}
export function patchDashFragment(data:Uint8Array,track:number,sequence:number):Uint8Array<ArrayBuffer> {
  const out=data.slice(),view=new DataView(out.buffer);let found=false,mdat=false;
  for(const b of boxes(out)) {
    if(b.type==='mdat')mdat=true;
    if(b.type!=='moof')continue;
    for(const child of boxes(out,b.start+b.header,b.start+b.size)) {
      if(child.type==='mfhd')view.setUint32(child.start+child.header+4,sequence);
      if(child.type==='traf')for(const atom of boxes(out,child.start+child.header,child.start+child.size)) {
        if(atom.type==='senc')throw new Error('DASH 分段使用加密，无法保存');
        if(atom.type!=='tfhd')continue;
        const flags=view.getUint32(atom.start+atom.header)&0xffffff;
        if(flags&1)throw new Error('DASH 分段包含绝对文件偏移，暂不支持合并');
        if(!(flags&0x20000))throw new Error('DASH 分段未使用相对片段偏移，暂不支持合并');
        view.setUint32(atom.start+atom.header+4,track);found=true;
      }
    }
  }
  if(!found||!mdat)throw new Error('DASH 分段缺少音视频数据');return out;
}
