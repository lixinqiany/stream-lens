import assert from 'node:assert/strict';import {build} from 'esbuild';import {JSDOM} from 'jsdom';
const bundle=await build({entryPoints:['src/extension/save/index.ts'],bundle:true,write:false,format:'iife',platform:'browser',loader:{'.css':'empty'}});
for(const recoverable of [true,false]){
 const d=new JSDOM('<p id="filename"></p><p id="status"></p><button id="cancel">取消</button><button id="choose" disabled>选择位置并下载</button>',{url:'chrome-extension://test/save.html?request=test',runScripts:'outside-only'});const w=d.window,originalClose=w.close.bind(w),records=new Map();let picked=0,info=0,commits=0,minimized=0,result,fail=true;
 w.close=()=>{};w.chrome={windows:{getCurrent:async()=>({id:1}),update:async()=>{minimized++;}},storage:{onChanged:{addListener(){}}},runtime:{sendMessage:async m=>{
  if(m.type==='SAVE_INFO'){info++;if(info>1&&!recoverable&&fail)throw Error('offline');return {ok:true,value:{filename:'test.mp4',result}};}
  if(m.type==='SAVE_COMMIT'){commits++;if(fail){if(recoverable)result={id:'task',duplicate:false};throw Error('lost response');}result={id:'task',duplicate:false};return {ok:true,value:result};}
  if(m.type==='SNAPSHOT')return {ok:true,value:{tasks:[{id:'task',state:'downloading'}]}};return {ok:true};
 }}};
 const db={close(){},transaction(){const tx={objectStore(){return {put(value,key){const req={result:key};queueMicrotask(()=>{records.set(key,value);tx.oncomplete();});return req;},delete(key){const req={};queueMicrotask(()=>{records.delete(key);tx.oncomplete();});return req;}}}};return tx;}};w.indexedDB={open(){const req={result:db};queueMicrotask(()=>req.onsuccess());return req;}};
 w.showSaveFilePicker=async()=>{picked++;return {name:'chosen.mp4',queryPermission:async()=> 'granted'};};
 const settle=()=>new Promise(r=>setTimeout(r,30));w.eval(bundle.outputFiles[0].text);await settle();w.document.querySelector('#choose').click();await settle();assert.equal(records.size,1);assert.equal(picked,1);
 if(recoverable){assert.equal(minimized,1);assert(w.document.querySelector('#choose').hidden);assert.equal(commits,1);}
 else{assert.equal(minimized,0);assert.equal(w.document.querySelector('#choose').textContent,'重试');fail=false;w.document.querySelector('#choose').click();await settle();assert.equal(picked,1);assert.equal(commits,2);assert.equal(minimized,1);}
 originalClose();
}
console.log('Save recovery QA passed: lost acknowledgement resumes owned task, offline retry keeps same destination and avoids another picker.');
