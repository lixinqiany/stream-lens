import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import {readFile} from 'node:fs/promises';
const version=JSON.parse(await readFile('package.json','utf8')).version;
const source="import {createRoot} from 'react-dom/client';import {Sidebar} from './src/extension/ui/Sidebar';createRoot(document.getElementById('root')).render(<Sidebar/>);";
const bundle=await build({stdin:{contents:source,loader:'tsx',resolveDir:process.cwd()},jsx:'automatic',bundle:true,write:false,format:'iife',platform:'browser'});
const dom=new JSDOM('<div id="root"></div>',{url:'chrome-extension://test/sidepanel.html',runScripts:'outside-only'});const w=dom.window,calls=[];Object.defineProperty(w.document,'visibilityState',{value:'visible'});
const base={id:'1',assetId:'a',title:'Test',filename:'test.mp4',pageUrl:'https://page.example',url:'https://cdn.example/video.m3u8',protocol:'HLS',quality:'720p',createdAt:1,updatedAt:1,bytes:100,segments:1,totalSegments:1771,speed:0};
let tasks=['failed','completed','cancelled','downloading'].map(state=>({...base,id:state,filename:state+'.mp4',state,...state==='failed'?{error:'HTTP 410'}:{}}));
let pendingSaves=[];let heldAction;let holdTask=false;
let prefs={quality:'best',editFilename:true,hideAds:true,saveAs:true,theme:'dark'};
const event={addListener(){},removeListener(){}};
w.chrome={tabs:{query:async()=>[{id:1,url:'https://page.example/'}],onActivated:event,onUpdated:event},permissions:{contains:async()=>true,onAdded:event,onRemoved:event},storage:{onChanged:event},runtime:{getManifest:()=>({version}),sendMessage:async m=>{
 calls.push(m);if(m.type==='SNAPSHOT')return {ok:true,value:{page:null,tasks,preferences:prefs,pendingSaves}};
 if(m.type==='TASK'&&holdTask)return new Promise(resolve=>{heldAction=()=>resolve({ok:true});});
 if(m.type==='SAVE_CANCEL')pendingSaves=[];
 if(m.type==='CLEAR')tasks=tasks.filter(t=>!['completed','cancelled'].includes(t.state));
 return {ok:true};
}}};
const settle=()=>new Promise(r=>setTimeout(r,35));w.eval(bundle.outputFiles[0].text);await settle();
const button=text=>[...w.document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith(text));
button('下载任务').click();await settle();assert(w.document.querySelector('.sl-task-card .sl-task-status strong').textContent==='');assert(!w.document.body.textContent.includes('分片'));assert([...w.document.querySelectorAll('.sl-task-status strong')].some(el=>el.textContent==='<1%'));const clear=button('清理记录');assert(clear.classList.contains('sl-secondary'));assert(!clear.disabled);
assert(w.document.body.textContent.includes('下载失败'));assert(!w.document.body.textContent.includes('需要处理'));assert(!w.document.body.textContent.includes('下载中断'));
button('失败').click();await settle();assert.equal(w.document.querySelectorAll('.sl-task-card').length,1);assert(w.document.body.textContent.includes('failed.mp4'));
button('已结束').click();await settle();assert.equal(w.document.querySelectorAll('.sl-task-card').length,2);assert(!w.document.body.textContent.includes('failed.mp4'));
button('清理记录').click();await settle();assert.deepEqual(tasks.map(t=>t.state),['failed','downloading']);assert(button('清理记录').disabled);
w.document.querySelector('[aria-label="设置"]').click();await settle();assert(w.document.querySelector('[aria-label="下载前选择保存位置"]'));
for(const old of ['按你的习惯下载','保存时选择位置','使用 Chrome 系统保存窗口','只在本地，保持简单','所有页面的下载记录'])assert(!w.document.body.textContent.includes(old));
assert(w.document.querySelector('[aria-label="下载前编辑文件名"]').disabled);assert(w.document.body.textContent.includes('文件名在保存窗口修改'));
button('返回').click();await settle();assert(w.document.querySelector('.sl-task-content'));
button('失败').click();await settle();holdTask=true;button('重试').click();button('重试').click();await settle();assert.equal(calls.filter(m=>m.type==='TASK').length,1);assert(button('重试').disabled);assert(w.document.querySelector('[aria-busy="true"]'));heldAction();holdTask=false;await settle();
pendingSaves=[{id:'save-one',filename:'pending.mp4',pageUrl:'https://page.example/'}];await new Promise(r=>setTimeout(r,2050));button('进行中').click();await settle();assert(w.document.body.textContent.includes('等待选择保存位置'));const card=w.document.querySelector('.sl-pending-card');card.querySelector('.sl-secondary').click();await settle();assert(calls.some(m=>m.type==='SAVE_FOCUS'));card.querySelector('.sl-text-button').click();await settle();assert(!w.document.querySelector('.sl-pending-card'));
button('已结束').click();await settle();assert(w.document.body.textContent.includes('暂无已结束记录'));button('查看全部任务').click();await settle();assert.equal(w.document.querySelectorAll('.sl-task-card').length,2);
assert.equal(w.document.body.textContent.split('v'+version).length-1,1);dom.window.close();
const pickerBundle=await build({entryPoints:['src/extension/save/index.ts'],bundle:true,write:false,format:'iife',platform:'browser',loader:{'.css':'empty'}});
for(const cancelled of [true,false]){
 const d=new JSDOM('<p id="filename"></p><p id="status"></p><button id="cancel">取消</button><button id="choose" disabled>选择位置并下载</button>',{url:'chrome-extension://test/save.html?request=abc',runScripts:'outside-only'});
 const x=d.window,messages=[],stored=new Map(),originalClose=x.close.bind(x);let closed=false;
 x.close=()=>{closed=true;};
 x.chrome={storage:{onChanged:{addListener(){}}},windows:{getCurrent:async()=>({id:1}),update:async()=>{}},runtime:{sendMessage:async m=>{messages.push(m);return m.type==='SAVE_INFO'?{ok:true,value:{filename:'test.mp4'}}:m.type==='SNAPSHOT'?{ok:true,value:{tasks:[{id:'task',state:'downloading'}]}}:{ok:true,value:{id:'task',duplicate:false}};}}};
 const db={close(){},transaction(){const tx={objectStore(){return {put(value,key){const req={result:key};queueMicrotask(()=>{stored.set(key,value);tx.oncomplete();});return req;},delete(key){const req={};queueMicrotask(()=>{stored.delete(key);tx.oncomplete();});return req;}}}};return tx;}};
 x.indexedDB={open(){const req={result:db};queueMicrotask(()=>req.onsuccess());return req;}};
 let picked=0;x.showSaveFilePicker=async opts=>{picked++;assert.equal(opts.suggestedName,'test.mp4');if(cancelled)throw new x.DOMException('cancel','AbortError');return {name:'mine.mp4',queryPermission:async()=> 'granted'};};
 x.eval(pickerBundle.outputFiles[0].text);await settle();assert.equal(picked,0);assert.equal(messages.length,1);
 x.document.querySelector('#choose').click();await settle();assert.equal(picked,1);assert.equal(closed,false);
 if(cancelled){assert(!messages.some(m=>m.type==='SAVE_CANCEL'));assert(!messages.some(m=>m.type==='SAVE_COMMIT'));assert.equal(stored.size,0);assert(x.document.querySelector('#status').textContent.includes('下载尚未开始'));assert(!x.document.querySelector('#choose').disabled);x.document.querySelector('#cancel').click();await settle();assert(closed);assert(messages.some(m=>m.type==='SAVE_CANCEL'));}
 else{const commit=messages.find(m=>m.type==='SAVE_COMMIT');assert.equal(commit.filename,'mine.mp4');assert(stored.has(commit.destinationId));}
 originalClose();
}
console.log('UI QA passed: visible clear button, failed retention/filter, concise copy, one version, picker cancel/commit before download. No browser operated.');
