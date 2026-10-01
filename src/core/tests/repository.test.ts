import {test} from 'node:test';import assert from 'node:assert/strict';import {mutateTasks,getTasks,patchTask} from '../../platform/repository';import type {DownloadRecord} from '../model';
test('concurrent task inserts and progress patches do not overwrite each other',async()=>{
 const data:Record<string,unknown>={};Object.assign(globalThis,{chrome:{storage:{local:{get:async(key:string)=>{await new Promise(r=>setTimeout(r,2));return {[key]:structuredClone(data[key])};},set:async(patch:Record<string,unknown>)=>{await new Promise(r=>setTimeout(r,2));Object.assign(data,structuredClone(patch));}}}}});
 await Promise.all(Array.from({length:12},(_,i)=>mutateTasks(tasks=>({tasks:[...tasks,{id:String(i),bytes:0} as DownloadRecord],value:i}))));assert.equal((await getTasks()).length,12);
 await Promise.all(Array.from({length:12},(_,i)=>patchTask(String(i),{bytes:i*100})));assert.equal((await getTasks()).reduce((sum,t)=>sum+t.bytes,0),6600);
 await assert.rejects(mutateTasks(()=>{throw new Error('failed write');}));await patchTask('0',{bytes:42});assert.equal((await getTasks())[0].bytes,42);
});
