import {t} from '../../i18n';
import type {Range} from '../hls/parser';
export type DashTrack={url:string;backupUrls?:string[];init:Range;index:Range;codec:string};
export type DashSource={video:DashTrack;audio:DashTrack};
type Box={start:number;size:number;type:string;header:number};
const decoder=new TextDecoder();
export function boxes(data:Uint8Array,start=0,end=data.length):Box[] {
  const view=new DataView(data.buffer,data.byteOffset,data.byteLength),result:Box[]=[];
  for(let at=start;at<end;) {
    if(at+8>end)throw new Error(t("mp4_structure_is_truncated"));
    let size=view.getUint32(at),header=8;
    if(size===1){if(at+16>end)throw new Error(t("extended_mp4_structure_is_truncated"));size=Number(view.getBigUint64(at+8));header=16;}
    if(size===0)size=end-at;
    if(!Number.isSafeInteger(size)||size<header||at+size>end)throw new Error(t("invalid_mp4_box_size"));
    result.push({start:at,size,type:decoder.decode(data.subarray(at+4,at+8)),header});at+=size;
  }
  return result;
}
const part=(data:Uint8Array,box:Box)=>data.slice(box.start,box.start+box.size);
export function concat(parts:Uint8Array[]):Uint8Array<ArrayBuffer> {const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;}
function box(type:string,parts:Uint8Array[]) {const data=concat(parts),out=new Uint8Array(data.length+8);new DataView(out.buffer).setUint32(0,out.length);out.set(new TextEncoder().encode(type),4);out.set(data,8);return out;}
function trackId(data:Uint8Array):number {
  const tkhd=boxes(data,8).find(b=>b.type==='tkhd');if(!tkhd)throw new Error(t("track_header_is_missing"));
  const offset=tkhd.start+tkhd.header+(data[tkhd.start+tkhd.header]===1?20:12);return new DataView(data.buffer,data.byteOffset,data.length).getUint32(offset);
}
function patchTrak(data:Uint8Array,newId:number) {
  const out=data.slice(),tkhd=boxes(out,8).find(b=>b.type==='tkhd')!;
  new DataView(out.buffer).setUint32(tkhd.start+tkhd.header+(out[tkhd.start+tkhd.header]===1?20:12),newId);return out;
}
function handler(data:Uint8Array):string {
  const mdia=boxes(data,8).find(b=>b.type==='mdia');if(!mdia)throw new Error(t("track_media_information_is_missing"));
  const hdlr=boxes(data,mdia.start+mdia.header,mdia.start+mdia.size).find(b=>b.type==='hdlr');
  return hdlr?decoder.decode(data.subarray(hdlr.start+hdlr.header+8,hdlr.start+hdlr.header+12)):'';
}
function encrypted(data:Uint8Array):boolean {
  // Protection boxes and encrypted sample entries are rejected before writing output.
  return ['encv','enca','pssh','senc','sinf'].some(type=>{const bytes=new TextEncoder().encode(type);for(let i=4;i<data.length-4;i++)if(bytes.every((b,j)=>data[i+j]===b))return true;return false;});
}
export function mergeDashInit(video:Uint8Array,audio:Uint8Array) {
  if(encrypted(video)||encrypted(audio))throw new Error(t("encrypted_or_drmprotected_tracks_cannot_be_merged"));
  const vb=boxes(video),ab=boxes(audio),vm=vb.find(b=>b.type==='moov'),am=ab.find(b=>b.type==='moov'),ftyp=vb.find(b=>b.type==='ftyp');
  if(!vm||!am||!ftyp)throw new Error(t("track_initialization_data_is_missing"));
  const vc=boxes(video,vm.start+vm.header,vm.start+vm.size),ac=boxes(audio,am.start+am.header,am.start+am.size);
  const vt=vc.filter(b=>b.type==='trak').map(b=>part(video,b)).find(t=>handler(t)==='vide');
  const at=ac.filter(b=>b.type==='trak').map(b=>part(audio,b)).find(t=>handler(t)==='soun');
  if(!vt||!at)throw new Error(t("video_or_audio_track_is_missing"));
  const vId=trackId(vt),aId=trackId(at),newAudioId=vId===1?2:1;
  const defaults:Uint8Array[]=[];
  for(const [data,children,oldId,newId] of [[video,vc,vId,vId],[audio,ac,aId,newAudioId]] as const) {
    const mvex=children.find(b=>b.type==='mvex');if(!mvex)throw new Error(t("nonfragmented_dash_media_is_not_supported"));
    const trex=boxes(data,mvex.start+mvex.header,mvex.start+mvex.size).find(b=>b.type==='trex'&&new DataView(data.buffer,data.byteOffset).getUint32(b.start+b.header+4)===oldId);
    if(!trex)throw new Error(t("default_fragment_parameters_are_missing"));
    const copy=part(data,trex);new DataView(copy.buffer).setUint32(trex.header+4,newId);defaults.push(copy);
  }
  const mvhd=vc.find(b=>b.type==='mvhd');if(!mvhd)throw new Error(t("movie_header_is_missing"));
  const movie=part(video,mvhd);new DataView(movie.buffer).setUint32(movie.length-4,Math.max(vId,newAudioId)+1);
  return {data:concat([part(video,ftyp),box('moov',[movie,vt,patchTrak(at,newAudioId),box('mvex',defaults)])]),videoId:vId,audioId:newAudioId};
}
export type DashSegment={range:Range;time:number;duration:number};
export function parseSidx(data:Uint8Array,absoluteOffset:number):DashSegment[] {
  const b=boxes(data).find(b=>b.type==='sidx');if(!b)throw new Error(t("dash_segment_index_is_missing"));
  const v=new DataView(data.buffer,data.byteOffset,data.length),base=b.start+b.header,version=data[base];
  if(version!==0&&version!==1)throw new Error(t("this_dash_index_version_is_not_supported"));
  const scale=v.getUint32(base+8);if(!scale)throw new Error(t("invalid_dash_timescale"));
  let at=base+12,time:number,offset:number;
  if(version===0){time=v.getUint32(at);offset=v.getUint32(at+4);at+=8;}else{time=Number(v.getBigUint64(at));offset=Number(v.getBigUint64(at+8));at+=16;}
  let position=absoluteOffset+b.start+b.size+offset;const count=v.getUint16(at+2);at+=4;
  if(count>30000||at+count*12>b.start+b.size)throw new Error(t("invalid_dash_index_count"));
  const result:DashSegment[]=[];
  for(let i=0;i<count;i++,at+=12) {
    const word=v.getUint32(at),size=word&0x7fffffff,duration=v.getUint32(at+4);
    if(word>>>31||!size||!duration||size>64*1024*1024||!Number.isSafeInteger(position))throw new Error(t("this_dash_segment_structure_is_not_supported"));
    result.push({range:{offset:position,length:size},time:time/scale,duration:duration/scale});position+=size;time+=duration;
  }
  if(!result.length)throw new Error(t("dash_index_contains_no_segments"));return result;
}
export function patchDashFragment(data:Uint8Array,track:number,sequence:number):Uint8Array<ArrayBuffer> {
  const out=data.slice(),view=new DataView(out.buffer);let found=false,mdat=false;
  for(const b of boxes(out)) {
    if(b.type==='mdat')mdat=true;
    if(b.type!=='moof')continue;
    for(const child of boxes(out,b.start+b.header,b.start+b.size)) {
      if(child.type==='mfhd')view.setUint32(child.start+child.header+4,sequence);
      if(child.type==='traf')for(const atom of boxes(out,child.start+child.header,child.start+child.size)) {
        if(atom.type==='senc')throw new Error(t("encrypted_dash_segments_cannot_be_saved"));
        if(atom.type!=='tfhd')continue;
        const flags=view.getUint32(atom.start+atom.header)&0xffffff;
        if(flags&1)throw new Error(t("dash_fragments_with_absolute_file_offsets_cannot_be"));
        if(!(flags&0x20000))throw new Error(t("dash_fragments_without_relative_offsets_cannot_be_merged"));
        view.setUint32(atom.start+atom.header+4,track);found=true;
      }
    }
  }
  if(!found||!mdat)throw new Error(t("dash_fragment_contains_no_media_data"));return out;
}
