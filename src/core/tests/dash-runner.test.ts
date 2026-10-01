import {destinationDatabase,destinationFile} from './support/destinations';
import {rememberDestination} from '../../platform/destination';
destinationDatabase();
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import mux from 'mux.js';
import {boxes,concat} from '../dash/mp4';
import type {DownloadRecord} from '../model';
function indexed(data:Uint8Array) {
 const atoms=boxes(data),init=concat(atoms.filter(b=>['ftyp','moov'].includes(b.type)).map(b=>data.slice(b.start,b.start+b.size)));
 const fragments:Uint8Array[]=[];
 for(let i=0;i<atoms.length;i++)if(atoms[i].type==='moof'){const a=atoms[i],b=atoms[i+1];assert.equal(b.type,'mdat');fragments.push(data.slice(a.start,b.start+b.size));}
 const index=new Uint8Array(32+fragments.length*12),view=new DataView(index.buffer);view.setUint32(0,index.length);index.set(new TextEncoder().encode('sidx'),4);view.setUint32(16,1000);view.setUint16(30,fragments.length);
 fragments.forEach((f,i)=>{view.setUint32(32+i*12,f.length);view.setUint32(36+i*12,1000)});
 return {data:concat([init,index,...fragments]),track:{url:'',init:{offset:0,length:init.length},index:{offset:init.length,length:index.length},codec:''}};
}
const video=indexed(new Uint8Array(await readFile('src/core/tests/fixtures/dash-video.mp4'))),audio=indexed(new Uint8Array(await readFile('src/core/tests/fixtures/dash-audio.mp4')));
video.track.url='https://cdn.example/video.m4s';video.track.codec='avc1.64001F';audio.track.url='https://cdn.example/audio.m4s';audio.track.codec='mp4a.40.2';
const input=new Map([[video.track.url,video.data],[audio.track.url,audio.data]]),messages:any[]=[],files=new Map<string,Uint8Array>();
let listener:any,denied=false,block=false,calls=0,rejectPrimary=false;const requested:string[]=[];
const nativeFetch=globalThis.fetch;
Object.assign(globalThis,{chrome:{runtime:{id:'test',getURL:(p:string)=>'chrome-extension://test/'+p,onMessage:{addListener:(fn:any)=>listener=fn},sendMessage:async(m:any)=>{messages.push(structuredClone(m));return m.type==='CHECK_ORIGIN'?{ok:true,allowed:!denied}:m.type==='PREPARE_SAVE'?{ok:true,accepted:true}:{ok:true};}}}});
const directory={removeEntry:async(name:string)=>{files.delete(name)},getFileHandle:async(name:string)=>({createWritable:async()=>{const pieces:Uint8Array[]=[];return {write:async(data:Uint8Array)=>{pieces.push(data.slice())},close:async()=>{files.set(name,concat(pieces))},abort:async()=>{files.delete(name)}}},getFile:async()=>new Blob([files.get(name)! as Uint8Array<ArrayBuffer>])})};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{storage:{getDirectory:async()=>({getDirectoryHandle:async()=>directory})}}});
globalThis.fetch=async(inputUrl:any,options:any)=>{
 const url=String(inputUrl);requested.push(url);const data=input.get(url)!;calls++;if(rejectPrimary&&url===video.track.url)return new Response('denied',{status:403});
 if(block&&calls>4)await new Promise<void>((resolve,reject)=>{const t=setTimeout(resolve,120);options.signal?.addEventListener('abort',()=>{clearTimeout(t);reject(new DOMException('aborted','AbortError'))},{once:true})});
 const match=/bytes=(\d+)-(\d+)/.exec(options.headers.Range)!;const a=Number(match[1]),b=Number(match[2]);return new Response(data.slice(a,b+1),{status:206,headers:{'content-range':`bytes ${a}-${b}/${data.length}`}});
};
await import('../../extension/offscreen/index');
const command=(m:any)=>new Promise<any>(r=>listener({target:'runner',...m},{id:'test'},r));
async function until(fn:()=>boolean){const start=Date.now();while(!fn()){if(Date.now()-start>5000)throw Error('DASH runner timed out');await new Promise(r=>setTimeout(r,5))}}
function task():DownloadRecord{messages.length=0;calls=0;return {id:crypto.randomUUID(),assetId:'dash',title:'DASH',filename:'dash.mp4',pageUrl:'https://www.bilibili.com/',url:video.track.url,protocol:'DASH',dash:{video:video.track,audio:audio.track},quality:'480p',state:'resolving',createdAt:Date.now(),updatedAt:Date.now(),bytes:0,segments:0,speed:0};}
async function finish(t:DownloadRecord){await until(()=>messages.some(m=>m.type==='OUTPUT'||m.task?.state==='failed'));assert(!messages.some(m=>m.task?.state==='failed'),JSON.stringify(messages));const output=messages.find(m=>m.type==='OUTPUT');const bytes=new Uint8Array(await (await nativeFetch(output.url)).arrayBuffer());const tracks=mux.mp4.probe.tracks(bytes);assert.equal(tracks.filter(t=>t.type==='video').length,1);assert.equal(tracks.filter(t=>t.type==='audio').length,1);assert.notEqual(tracks[0].id,tracks[1].id);await command({type:'RELEASE',id:t.id});await until(()=>!files.size);}
test('actual DASH runner combines independently indexed audio and video into one playable track set',async()=>{denied=false;block=false;const t=task();await command({type:'RUN',task:t});await finish(t);const final=messages.filter(m=>m.task?.segments).at(-1).task;assert(final.segments>2);assert.equal(final.segments,final.totalSegments===undefined?messages.find(m=>m.task?.totalSegments).task.totalSegments:final.totalSegments);});
test('DASH pause retains output progress and resumes without replacing the task',async()=>{block=true;const t=task();await command({type:'RUN',task:t});await until(()=>calls>4);await command({type:'CONTROL',id:t.id,action:'pause'});await new Promise(r=>setTimeout(r,25));assert(!messages.some(m=>m.type==='OUTPUT'));await command({type:'CONTROL',id:t.id,action:'resume'});await finish(t);block=false;});
test('DASH denied CDN and cancelled partial files cannot become saved output',async()=>{denied=true;const t=task();await command({type:'RUN',task:t});await until(()=>messages.some(m=>m.task?.state==='failed'));assert.equal(calls,0);denied=false;block=true;const next=task();await command({type:'RUN',task:next});await until(()=>calls>4);await command({type:'CONTROL',id:next.id,action:'cancel'});assert(!messages.some(m=>m.type==='OUTPUT'));assert.equal(files.size,0);block=false;});

test('DASH primary HTTP rejection uses API backup and keeps sound with permission checks',async()=>{
 block=false;denied=false;rejectPrimary=true;requested.length=0;
 const backup='https://backup.example/video.m4s?signature=exact';input.set(backup,video.data);
 const t=task();t.dash!.video={...video.track,backupUrls:[backup]};await command({type:'RUN',task:t});await finish(t);
 assert(requested.includes(backup));assert(messages.some(m=>m.type==='CHECK_ORIGIN'&&m.pattern==='https://backup.example/*'));assert.equal(requested.filter(u=>u===video.track.url).length,2,'both parallel initialization requests may try the primary, segments use the successful backup');rejectPrimary=false;
});

test('DASH selected destination saves both tracks without a late Chrome download dialog',async()=>{
 block=false;denied=false;const file=destinationFile();const t=task();t.destinationId=await rememberDestination(file.handle);
 await command({type:'RUN',task:t});await until(()=>messages.some(m=>m.type==='SAVED'||m.task?.state==='failed'));
 assert(!messages.some(m=>m.task?.state==='failed'),JSON.stringify(messages));assert(!messages.some(m=>m.type==='OUTPUT'));
 const tracks=mux.mp4.probe.tracks(file.bytes()!);assert.equal(tracks.filter(t=>t.type==='video').length,1);assert.equal(tracks.filter(t=>t.type==='audio').length,1);await until(()=>!files.size);
});
