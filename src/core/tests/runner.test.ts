import {destinationDatabase,destinationFile} from './support/destinations';
import {rememberDestination} from '../../platform/destination';
destinationDatabase();
import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import type {DownloadRecord} from '../model';
const ts=new Uint8Array(await readFile('src/core/tests/fixtures/hls-segment.bin'));
const nativeFetch=globalThis.fetch;const messages:any[]=[];const files=new Map<string,Uint8Array>();let listener:any;let block=false;let denied=false;let encrypted=false;let calls=0;let currentId='';let rejectSave=false;let storageReads=0;let streaming:undefined|(()=>Response);let expired=false,mismatch=false,refreshCount=0;const urls:string[]=[];
const rawKey=new Uint8Array(16).fill(7);const cryptoKey=await crypto.subtle.importKey('raw',rawKey,'AES-CBC',false,['encrypt']);const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-CBC',iv:new Uint8Array(16)},cryptoKey,ts));
Object.assign(globalThis,{chrome:{runtime:{id:'test',getURL:(path:string)=>'chrome-extension://test/'+path,onMessage:{addListener:(fn:any)=>{listener=fn;}},sendMessage:async(message:any)=>{messages.push(structuredClone(message));if(message.type==='CHECK_ORIGIN')return {ok:true,allowed:!denied};if(message.type==='REFRESH_HLS'){refreshCount++;return {ok:true,value:{url:'https://cdn.example/fresh/v.m3u8'}};}return message.type==='PREPARE_SAVE'?{ok:true,accepted:!rejectSave}:{ok:true};}}}});
const directory={removeEntry:async(name:string)=>{files.delete(name);},getFileHandle:async(name:string)=>({createWritable:async()=>{const chunks:Uint8Array[]=[];return {write:async(data:Uint8Array)=>{chunks.push(data.slice());},close:async()=>{files.set(name,new Uint8Array(Buffer.concat(chunks)));},abort:async()=>{files.delete(name);}};},getFile:async()=>new Blob([files.get(name)! as Uint8Array<ArrayBuffer>])})};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{storage:{getDirectory:async()=>{storageReads++;return {getDirectoryHandle:async()=>directory};}}}});
globalThis.fetch=async(input:any,options:any)=>{
 const url=String(input);urls.push(url);if(streaming)return streaming();if(expired){if(url.endsWith('.m3u8'))return new Response('#EXTM3U\n#EXTINF:10,\na.ts\n#EXTINF:'+((mismatch&&url.includes('/fresh/'))?11:10)+',\nb.ts\n#EXT-X-ENDLIST');if(url==='https://cdn.example/b.ts')return new Response('gone',{status:410});}if(url.startsWith('blob:'))return nativeFetch(input,options);
 if(url.endsWith('.m3u8'))return new Response('#EXTM3U\n'+(encrypted?'#EXT-X-KEY:METHOD=AES-128,URI="key",IV=0x0\n':'')+'#EXTINF:10,\nseg.ts\n#EXT-X-ENDLIST');
 if(url.endsWith('/key'))return new Response(rawKey);
 calls++;
 if(block)await new Promise<void>((resolve,reject)=>{const timer=setTimeout(resolve,120);options.signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('aborted','AbortError'));},{once:true});});
 return new Response(encrypted?cipher:ts);
};
await import('../../extension/offscreen/index');
function command(message:any):Promise<any>{return new Promise(resolve=>{listener({target:'runner',...message},{id:'test'},resolve);});}
async function until(predicate:()=>boolean){const start=Date.now();while(!predicate()){if(Date.now()-start>5000)throw new Error('runner timed out: '+JSON.stringify(messages));await new Promise(r=>setTimeout(r,5));}}
function task():DownloadRecord{currentId=crypto.randomUUID();messages.length=0;calls=0;return {id:currentId,assetId:'test',title:'Test',filename:'test.mp4',pageUrl:'https://page.example/',url:'https://cdn.example/v.m3u8',protocol:'HLS',quality:'720p',state:'resolving',createdAt:Date.now(),updatedAt:Date.now(),bytes:0,segments:0,speed:0};}
function state(name:string){return messages.some(m=>m.type==='PROGRESS'&&m.task?.id===currentId&&m.task.state===name);}
async function finish(){await until(()=>messages.some(m=>m.type==='OUTPUT'&&m.id===currentId));const output=messages.find(m=>m.type==='OUTPUT'&&m.id===currentId);const data=new Uint8Array(await (await nativeFetch(output.url)).arrayBuffer());assert.ok(data.length>100000);assert.equal(new TextDecoder().decode(data.slice(4,8)),'ftyp');await until(()=>messages.some(m=>m.type==='PROGRESS'&&m.task?.id===currentId&&m.task.state==='saving'));await command({type:'RELEASE',id:currentId});await until(()=>!files.size);return data;}
test('actual runner decrypts AES128 TS, writes MP4, emits states, releases temporary file',async()=>{
 encrypted=true;block=false;denied=false;const t=task();assert.equal((await command({type:'RUN',task:t})).ok,true);await finish();assert.ok(state('resolving'));assert.ok(state('downloading'));assert.ok(state('merging'));assert.ok(state('saving'));assert.equal(messages.find(m=>m.task?.segments===1)?.task.totalSegments,undefined);encrypted=false;
});
test('pause aborts an in-flight segment; resume keeps same task and produces valid output',async()=>{
 block=true;const t=task();await command({type:'RUN',task:t});await until(()=>calls===1);await command({type:'CONTROL',id:t.id,action:'pause'});await until(()=>state('paused'));await new Promise(r=>setTimeout(r,30));assert.equal(messages.some(m=>m.type==='OUTPUT'),false);await command({type:'CONTROL',id:t.id,action:'resume'});await finish();assert.ok(calls>=2);block=false;
});
test('cancel waits for runner termination and removes partial files before acknowledgement',async()=>{
 block=true;const t=task();await command({type:'RUN',task:t});await until(()=>calls===1);assert.equal((await command({type:'CONTROL',id:t.id,action:'cancel'})).ok,true);assert.ok(state('cancelled'));assert.equal(messages.some(m=>m.type==='OUTPUT'),false);assert.equal(files.size,0);assert.deepEqual((await command({type:'PING'})).jobs,[]);block=false;
});
test('denied CDN produces actionable permission failure without fetching media',async()=>{
 denied=true;const t=task();await command({type:'RUN',task:t});await until(()=>state('failed'));assert.equal(calls,0);assert.deepEqual(messages.find(m=>m.task?.state==='failed').task.neededOrigins,['https://cdn.example/*']);denied=false;
});

test('HLS 410 renews signed playlist and continues same next segment without discarding completed output',async()=>{
 expired=true;mismatch=false;urls.length=0;refreshCount=0;const t=task();await command({type:'RUN',task:t});await finish();
 assert.equal(refreshCount,1);assert.equal(urls.filter(u=>u==='https://cdn.example/b.ts').length,1,'expired segment should not be retried unchanged');assert.equal(urls.filter(u=>u==='https://cdn.example/seg.ts').length,0);assert(!urls.includes('https://cdn.example/fresh/a.ts'),'already completed segment is retained');assert(urls.includes('https://cdn.example/fresh/b.ts'));assert(messages.some(m=>m.task?.segments===2));expired=false;
});
test('HLS 410 renewal rejects changed timelines and cannot save truncated output',async()=>{
 expired=true;mismatch=true;refreshCount=0;const t=task();await command({type:'RUN',task:t});await until(()=>state('failed'));assert.equal(refreshCount,1);assert(messages.some(m=>m.task?.error?.includes('时间线发生变化')));assert(!messages.some(m=>m.type==='OUTPUT'));assert.equal(files.size,0);expired=false;mismatch=false;
});

test('selected HLS destination commits final MP4 and never emits a Chrome OUTPUT request',async()=>{
 const file=destinationFile();const t=task();t.destinationId=await rememberDestination(file.handle);const reads=storageReads;
 await command({type:'RUN',task:t});await until(()=>messages.some(m=>m.type==='SAVED'&&m.id===t.id));
 assert.equal(storageReads,reads,'selected output must never open OPFS');assert.equal(file.stats().opens,1);assert.equal(new TextDecoder().decode(file.bytes()!.slice(4,8)),'ftyp');assert(!messages.some(m=>m.type==='OUTPUT'));await until(()=>files.size===0);
});
test('destination failure retains failed state and cannot emit completion or commit partial bytes',async()=>{
 const file=destinationFile();file.fail();const t=task();t.destinationId=await rememberDestination(file.handle);
 await command({type:'RUN',task:t});await until(()=>state('failed'));assert(!messages.some(m=>m.type==='SAVED'||m.type==='OUTPUT'));assert.equal(file.bytes(),undefined);await until(()=>files.size===0);
});
test('direct file streams to selected destination; revoked permission prevents all network reads',async()=>{
 const file=destinationFile();const t=task();t.protocol='WEBM';t.destinationId=await rememberDestination(file.handle);t.url='https://cdn.example/file.webm';
 await command({type:'RUN',task:t});await until(()=>messages.some(m=>m.type==='SAVED'));assert.deepEqual(file.bytes(),ts);assert(!messages.some(m=>m.type==='OUTPUT'));await until(()=>files.size===0);
 const deniedFile=destinationFile();deniedFile.deny();const next=task();next.destinationId=await rememberDestination(deniedFile.handle);urls.length=0;
 await command({type:'RUN',task:next});await until(()=>state('failed'));assert.equal(urls.length,0);assert.equal(deniedFile.bytes(),undefined);
});

test('direct selected-location download pauses and restarts safely; cancel leaves destination uncommitted',async()=>{
 block=true;const file=destinationFile();const t=task();t.protocol='MP4';t.destinationId=await rememberDestination(file.handle);t.url='https://cdn.example/file.mp4';
 await command({type:'RUN',task:t});await until(()=>calls>0);await command({type:'CONTROL',id:t.id,action:'pause'});await until(()=>state('paused'));
 assert.equal(file.bytes(),undefined);await command({type:'CONTROL',id:t.id,action:'resume'});await until(()=>messages.some(m=>m.type==='SAVED'));assert.deepEqual(file.bytes(),ts);await until(()=>!files.size);
 const cancelled=destinationFile();const next=task();next.protocol='MP4';next.destinationId=await rememberDestination(cancelled.handle);next.url=t.url;
 await command({type:'RUN',task:next});await until(()=>calls>0);await command({type:'CONTROL',id:next.id,action:'cancel'});assert.equal(cancelled.bytes(),undefined);assert(!messages.some(m=>m.type==='SAVED'));assert.equal(files.size,0);block=false;
});

test('rejected final save reservation discards streamed staging and never commits bytes',async()=>{
 rejectSave=true;const file=destinationFile();const t=task();t.destinationId=await rememberDestination(file.handle);await command({type:'RUN',task:t});await until(()=>state('failed'));
 assert.equal(file.bytes(),undefined);assert(!messages.some(m=>m.type==='SAVED'));await until(()=>file.stats().aborts===1);assert.equal(file.stats().opens,1);assert.equal(file.stats().staged,0);rejectSave=false;
});

test('selected HLS writes before completion, preserves staging on pause and aborts it on cancel',async()=>{
 expired=true;block=true;const file=destinationFile();const original=new TextEncoder().encode('existing file');file.seed(original);
 const t=task();t.destinationId=await rememberDestination(file.handle);const reads=storageReads;
 await command({type:'RUN',task:t});await until(()=>messages.some(m=>m.task?.segments===1));
 await command({type:'CONTROL',id:t.id,action:'pause'});const staged=file.stats().staged;assert(staged>32);await new Promise(r=>setTimeout(r,25));
 assert.equal(file.stats().staged,staged);assert.equal(file.stats().opens,1);assert.deepEqual(file.bytes(),original);
 await command({type:'CONTROL',id:t.id,action:'cancel'});assert.equal(file.stats().aborts,1);assert.equal(file.stats().staged,0);
 assert.deepEqual(file.bytes(),original);assert.equal(storageReads,reads);assert(!messages.some(m=>m.type==='SAVED'));expired=false;block=false;
});

test('3 GB direct stream uses bounded chunks, disk backpressure and zero OPFS copies',async()=>{
 const chunk=new Uint8Array(1024*1024),count=3072;let writes=0,pulls=0,closed=false,maxAhead=0;
 const handle={...destinationFile().handle,createWritable:async()=>new WritableStream<Uint8Array>({
   async write(data){assert.equal(data.byteLength,chunk.length);maxAhead=Math.max(maxAhead,pulls-writes);writes++;},close(){closed=true;},
 })};
 streaming=()=>new Response(new ReadableStream<Uint8Array>({pull(controller){
   if(pulls<count){pulls++;controller.enqueue(chunk);}else controller.close();
 }},{highWaterMark:0}),{headers:{'content-length':String(count*chunk.length)}});
 const t=task();t.protocol='MP4';t.url='https://cdn.example/large.mp4';t.destinationId=await rememberDestination(handle as any);const reads=storageReads;
 try {
  await command({type:'RUN',task:t});await until(()=>messages.some(m=>m.type==='SAVED'||m.task?.state==='failed'));
  assert(!state('failed'),JSON.stringify(messages));assert.equal(writes,count);assert.equal(closed,true);assert(maxAhead<=1);
  assert.equal(storageReads,reads);assert(!messages.some(m=>m.type==='OUTPUT'));assert(messages.some(m=>m.task?.bytes===3*1024**3));
 }finally{streaming=undefined;}
});
