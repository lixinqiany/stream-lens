import vm from 'node:vm';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['src/extension/page/index.ts'],bundle:true,write:false,platform:'browser',format:'iife'});
const messages=[],handlers=[];
class BufferMock{appendBuffer(){} }
class MediaMock{addSourceBuffer(){return new BufferMock()}}
class XhrMock{open(){}send(){}addEventListener(){} }
class ResponseMock{constructor(url,data){this.url=url;this.data=data}arrayBuffer(){return Promise.resolve(this.data)}text(){return Promise.resolve(new TextDecoder().decode(this.data))}clone(){return new ResponseMock(this.url,this.data)}}
const window={fetch:async url=>new ResponseMock(url,new Uint8Array(Array.from({length:150},(_,i)=>i)).buffer),postMessage:m=>messages.push(m),addEventListener:(name,fn)=>handlers.push(fn)};
const URLMock=class extends URL{};URLMock.createObjectURL=()=> 'blob:https://page.example/media';URLMock.revokeObjectURL=()=>{};
const context={window,location:{href:'https://page.example/',origin:'https://page.example'},URL:URLMock,MediaSource:MediaMock,SourceBuffer:BufferMock,Response:ResponseMock,Request,ReadableStream,ReadableStreamDefaultReader,XMLHttpRequest:XhrMock,ArrayBuffer,Uint8Array,TextDecoder,Map,Set,WeakMap,WeakSet};
vm.runInNewContext(bundle.outputFiles[0].text,context);
const media=new MediaMock(),blob=URLMock.createObjectURL(media),buffer=media.addSourceBuffer('video/mp4');
const response=await window.fetch('https://cdn.example/video.m4s');const data=await response.arrayBuffer();buffer.appendBuffer(data);
assert.equal(messages.at(-1).blob,blob);assert.equal(messages.at(-1).format,'DASH');assert.deepEqual(Array.from(messages.at(-1).urls),['https://cdn.example/video.m4s']);
URLMock.revokeObjectURL(blob);handlers[0]({source:window,data:{channel:'stream-lens-media-v1',type:'query',blob}});assert.equal(messages.length,2);
console.log('Probe QA passed: fetch bytes -> SourceBuffer -> MediaSource -> blob association; DASH protection; revoked live blob replay.');
class ElementMock {matches(){return true}closest(){return this}}
const selectedVideo=new ElementMock();selectedVideo.src='blob:https://www.bilibili.com/selected';
context.Element=ElementMock;context.location.hostname='www.bilibili.com';context.location.pathname='/bangumi/play/ss45662';
window.player={mediaElement:()=>selectedVideo,getManifest:()=>({episodeId:768339,seasonId:45662})};
handlers[0]({source:window,data:{channel:'stream-lens-media-v1',type:'bili-player-query',playerId:'chosen',source:selectedVideo.src}});
assert.equal(messages.at(-1).type,'bili-player-context');assert.equal(messages.at(-1).episodeId,768339);assert.equal(messages.at(-1).playerId,'chosen');
const count=messages.length;handlers[0]({source:window,data:{channel:'stream-lens-media-v1',type:'bili-player-query',playerId:'chosen',source:'blob:old'}});assert.equal(messages.length,count);
console.log('Bilibili probe QA passed: public player manifest binds current episode to actual media source; stale queries rejected.');
