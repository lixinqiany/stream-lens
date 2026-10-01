import {test} from 'node:test';
import assert from 'node:assert/strict';
import {biliEndpoint,isBiliEndpoint,parseBiliPlayResponse} from '../sites/bilibili';
import {boxes,concat,mergeDashInit,parseSidx,patchDashFragment} from '../dash/mp4';
function box(type:string,data:Uint8Array|Uint8Array[]){const body=Array.isArray(data)?concat(data):data;const out=new Uint8Array(body.length+8);new DataView(out.buffer).setUint32(0,out.length);out.set(new TextEncoder().encode(type),4);out.set(body,8);return out;}
function init(type:string){const header=new Uint8Array(24);new DataView(header.buffer).setUint32(12,1);const handler=new Uint8Array(24);handler.set(new TextEncoder().encode(type),8);const trex=new Uint8Array(24);new DataView(trex.buffer).setUint32(4,1);return concat([box('ftyp',new Uint8Array(8)),box('moov',[box('mvhd',new Uint8Array(100)),box('trak',[box('tkhd',header),box('mdia',box('hdlr',handler))]),box('mvex',box('trex',trex))])]);}
function sidx(){const body=new Uint8Array(48),view=new DataView(body.buffer);view.setUint32(8,1000);view.setUint32(16,8);view.setUint16(22,2);view.setUint32(24,100);view.setUint32(28,5000);view.setUint32(36,120);view.setUint32(40,5000);return box('sidx',body);}
const track=(codec:string,id:number,height?:number)=>({id,height,codecs:codec,baseUrl:`https://cdn.example/${id}.m4s`,bandwidth:id,SegmentBase:{Initialization:'0-99',indexRange:'100-199'}});
test('Bilibili season routes resolve the selected episode and reject foreign or ambiguous endpoints',()=>{
 const page='https://www.bilibili.com/bangumi/play/ss45662?from=x';
 assert.equal(biliEndpoint(page),'https://api.bilibili.com/pgc/view/web/season?season_id=45662');
 const endpoint=biliEndpoint(page,768339)!;
 assert.match(endpoint,/ep_id=768339/);assert(isBiliEndpoint(page,endpoint));
 assert(!isBiliEndpoint(page,endpoint.replace('api.bilibili.com','evil.test')));
 assert(!isBiliEndpoint(page,endpoint+'&extra=1'));
 assert.equal(biliEndpoint('invalid'),undefined);
 assert.equal(biliEndpoint('https://bilibili.com.evil.test/bangumi/play/ss45662',768339),undefined);
});
test('Bilibili ordinary and episode URLs resolve to APIs and parse only supported full playback',()=>{
 assert.match(biliEndpoint('https://www.bilibili.com/bangumi/play/ep768338?from=x')!,/ep_id=768338/);
 assert.equal(biliEndpoint('https://bilibili.com.evil.test/bangumi/play/ep1'),undefined);
 const data={code:0,result:{is_drm:false,is_preview:0,timelength:100000,dash:{video:[track('hev1.1',64,720),track('avc1.64',32,480),track('avc1.64',16,360)],audio:[track('mp4a.40.5',30216),track('mp4a.40.2',30232)]}}};
 const result=parseBiliPlayResponse(data);assert.deepEqual(result.variants.map(v=>v.height),[480,360]);assert.match(result.variants[0].dash!.audio.url,/30232/);assert.equal(result.duration,100);
 assert.throws(()=>parseBiliPlayResponse({...data,result:{...data.result,is_drm:true}}),/DRM/);
 assert.throws(()=>parseBiliPlayResponse({...data,result:{...data.result,is_preview:1}}),/试看/);
 assert.throws(()=>parseBiliPlayResponse({code:-10403,message:'denied'}),/播放权限/);
});
test('DASH index offsets and time interleaving are absolute and nested indices fail closed',()=>{
 const index=sidx();const list=parseSidx(index,1000);assert.deepEqual(list,[{range:{offset:1064,length:100},time:0,duration:5},{range:{offset:1164,length:120},time:5,duration:5}]);
 const nested=index.slice();new DataView(nested.buffer).setUint32(32,0x80000001);assert.throws(()=>parseSidx(nested,0),/分段结构/);
});
test('DASH merges video and audio IDs and rewrites fragment references without changing payload offsets',()=>{
 const merged=mergeDashInit(init('vide'),init('soun'));assert.equal(merged.videoId,1);assert.equal(merged.audioId,2);
 const moov=boxes(merged.data).find(b=>b.type==='moov')!;assert.equal(boxes(merged.data,moov.start+8,moov.start+moov.size).filter(b=>b.type==='trak').length,2);
 const tfhd=new Uint8Array(8);new DataView(tfhd.buffer).setUint32(0,0x20000);new DataView(tfhd.buffer).setUint32(4,1);
 const fragment=concat([box('moof',[box('mfhd',new Uint8Array(8)),box('traf',box('tfhd',tfhd))]),box('mdat',new Uint8Array(100))]);
 const out=patchDashFragment(fragment,2,12);assert.equal(out.length,fragment.length);assert(out.includes(12));assert.deepEqual(out.slice(-100),fragment.slice(-100));
 const absolute=tfhd.slice();new DataView(absolute.buffer).setUint32(0,1);assert.throws(()=>patchDashFragment(concat([box('moof',box('traf',box('tfhd',absolute))),box('mdat',new Uint8Array(8))]),2,1),/绝对文件偏移/);
});

test('Bilibili preserves signed API fallback URLs only for the same representation',()=>{
 const video={...track('avc1.64',32,480),backupUrl:['https://backup.example/video.m4s?token=exact','javascript:alert(1)','https://backup.example/video.m4s?token=exact']};
 const parsed=parseBiliPlayResponse({code:0,result:{is_preview:0,timelength:1000,dash:{video:[video],audio:[track('mp4a.40.2',30232)]}}});
 assert.deepEqual(parsed.variants[0].dash!.video.backupUrls,['https://backup.example/video.m4s?token=exact']);
});
