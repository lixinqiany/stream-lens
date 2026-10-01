import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {writeFile,readFile,mkdir} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import postcss from 'postcss';
const bundle=await build({stdin:{contents:"import {createRoot} from 'react-dom/client';import {Sidebar} from './src/extension/ui/Sidebar';createRoot(document.getElementById('root')).render(<Sidebar/>);",loader:'tsx',resolveDir:process.cwd()},jsx:'automatic',bundle:true,write:false,format:'iife',platform:'browser'});
const settle=()=>new Promise(r=>setTimeout(r,35));
const base={id:'main',title:'示例视频 · 第一集',url:'https://cdn.example/main.m3u8',pageUrl:'https://page.example/',protocol:'HLS',playing:true,protected:false,evidence:['player'],playerBindings:[{playerId:'player',sourceKey:'blob:main'}]};
const variants=[{id:'high',url:'https://cdn.example/1080.m3u8',label:'1080p',height:1080},{id:'medium',url:'https://cdn.example/720.m3u8',label:'720p',height:720}];
const prefs={quality:'720',editFilename:false,hideAds:true,saveAs:false,theme:'light'};
function fixture(initial=base,resolver=async a=>({...a,variants,duration:155,resolutionState:'ready',resolvedAt:Date.now()})){
 const dom=new JSDOM('<div id="root"></div>',{url:'chrome-extension://test/sidepanel.html',runScripts:'outside-only'}),w=dom.window,calls=[];
 Object.defineProperty(w.document,'visibilityState',{value:'visible'});let event;
 const quiet={addListener(){},removeListener(){}};
 const state={page:{pageUrl:base.pageUrl,selection:{playerId:'player',sourceKey:'blob:main',selectedAt:1},assets:[structuredClone(initial),{...base,id:'ad',title:'其他视频',url:'https://ads.example/ad.m3u8',playerBindings:[],playing:false,evidence:['network']}]},tasks:[],preferences:{...prefs},pendingSaves:[]};
 w.chrome={tabs:{query:async()=>[{id:1,url:base.pageUrl}],onActivated:quiet,onUpdated:quiet},permissions:{contains:async()=>true,onAdded:quiet,onRemoved:quiet},storage:{onChanged:{addListener(fn){event=fn;},removeListener(){}}},runtime:{getManifest:()=>({version:'0.2.9'}),sendMessage:async m=>{
 calls.push(m);if(m.type==='SNAPSHOT')return {ok:true,value:structuredClone(state)};
 if(m.type==='RESOLVE'){try{return {ok:true,value:await resolver(structuredClone(state.page.assets.find(a=>a.id===m.assetId)))};}catch(e){return {ok:false,error:e.message,origins:e.origins};}}
 if(m.type==='PREFERENCES')Object.assign(state.preferences,m.patch);
 if(m.type==='START')return {ok:true,value:{id:'task'}};return {ok:true};
 }}};
 w.eval(bundle.outputFiles[0].text);
 return {dom,w,calls,state,refresh:()=>event({},'session'),button:text=>[...w.document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith(text))};
}
let finish;const f=fixture(base,a=>new Promise(r=>{finish=()=>r({...a,variants,duration:155,resolutionState:'ready',resolvedAt:Date.now()});}));await settle();
assert.equal(f.calls.filter(c=>c.type==='RESOLVE').length,1);assert(f.w.document.querySelector('.sl-download-button').disabled);assert(f.w.document.body.textContent.includes('正在识别清晰度'));
f.button('其他视频').click();await settle();assert.equal(f.calls.filter(c=>c.type==='RESOLVE').length,1,'expanding other resources cannot resolve ads');
finish();await settle();assert.equal(f.w.document.querySelector('select').value,'medium');assert(!f.w.document.querySelector('.sl-download-button').disabled);
for(const value of ['资源详情','发现方式','CDN','HLS','复制地址','解析视频'])assert(!f.w.document.body.textContent.includes(value));
assert.equal(f.w.document.querySelectorAll('img').length,0);f.w.document.querySelector('select').value='high';f.w.document.querySelector('select').dispatchEvent(new f.w.Event('change',{bubbles:true}));await settle();f.button('下载视频').click();await settle();assert.equal(f.calls.find(c=>c.type==='START').variantId,'high');
f.dom.window.close();
let count=0;const failure=fixture(base,async a=>{if(++count===1)throw new Error('无法读取视频，请重试');return {...a,variants,resolutionState:'ready',resolvedAt:Date.now()};});await settle();assert.equal(count,1);assert(failure.w.document.querySelector('.sl-inline-error'));failure.refresh();await settle();assert.equal(count,1,'failed auto resolve never loops');failure.button('重试').click();await settle();assert.equal(count,2);assert(!failure.w.document.querySelector('.sl-inline-error'));assert(failure.w.document.querySelector('select'));failure.dom.window.close();
const stored=fixture({...base,resolutionState:'failed',resolutionError:'旧错误'},async a=>({...a,variants,resolutionState:'ready',resolutionError:undefined,resolvedAt:Date.now()}));await settle();assert.equal(stored.calls.filter(c=>c.type==='RESOLVE').length,0);stored.button('重试').click();await settle();assert(!stored.w.document.querySelector('.sl-inline-error'),'successful retry clears stored errors');stored.dom.window.close();
let releases=[];const changed=fixture(base,a=>new Promise(r=>releases.push(()=>r({...a,variants:[{id:a.playerBindings[0].sourceKey,label:a.title,url:a.url}],resolutionState:'ready',resolvedAt:Date.now()}))));await settle();
changed.state.page.selection.sourceKey='blob:next';changed.state.page.assets[0]={...base,title:'新视频',playerBindings:[{playerId:'player',sourceKey:'blob:next'}]};changed.refresh();await settle();assert.equal(releases.length,2);releases[1]();await settle();releases[0]();await settle();assert.equal(changed.w.document.querySelector('select').value,'blob:next');assert(changed.w.document.querySelector('h2').textContent.includes('新视频'));changed.dom.window.close();
// Actual formal React markup, static preview only; no browser or screenshot automation.
const frames=[];
for(const theme of ['light','dark']){
 const ready=fixture({...base,variants,duration:155,resolutionState:'ready',resolvedAt:1});await settle();ready.state.preferences.theme=theme;ready.refresh();await settle();
 frames.push({name:theme==='light'?'当前页面 · 浅色':'当前页面 · 深色',markup:ready.w.document.querySelector('#root').innerHTML});
 ready.state.tasks=[{id:'download',filename:'示例视频_1080p.mp4',quality:'1080p',protocol:'HLS',state:'downloading',pageUrl:base.pageUrl,bytes:268435456,totalBytes:536870912,segments:128,totalSegments:256,speed:5242880},{id:'failed',filename:'另一集_720p.mp4',quality:'720p',protocol:'DASH',state:'failed',pageUrl:base.pageUrl,bytes:0,segments:0,speed:0,error:'资源暂时不可用，请重试'}];ready.refresh();await settle();ready.button('下载任务').click();await settle();
 frames.push({name:theme==='light'?'下载任务 · 浅色':'下载任务 · 深色',markup:ready.w.document.querySelector('#root').innerHTML});
 ready.w.document.querySelector('[aria-label="设置"]').click();await settle();frames.push({name:theme==='light'?'下载设置 · 浅色':'下载设置 · 深色',markup:ready.w.document.querySelector('#root').innerHTML});ready.dom.window.close();
}
const css=await readFile('src/extension/ui/styles.css','utf8');postcss.parse(css);assert(!css.includes('@import'));assert(css.includes('@media(max-width:340px)'));assert(css.includes('prefers-reduced-motion'));
await mkdir('work',{recursive:true});
const path='work/ui-preview.html';
await writeFile(path,`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>拾影 0.2.9 界面预览</title><style>${css}\nbody{background:#e8ebf0;padding:28px;font:14px system-ui}body>header{max-width:1120px;margin:0 auto 24px;color:#20242c}body>header h1{font-size:22px;margin:0 0 8px}body>header p{color:#596273;margin:0}.preview-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,360px));justify-content:center;gap:24px}.preview-item>h2{font-size:13px;color:#596273;margin:0 0 10px}.preview-item>div{border:1px solid #cdd3dd;border-radius:14px;overflow:hidden}.preview-item .sl-extension,.preview-item .sl-live{min-height:640px}.preview-item .sl-toast{display:none}@media(max-width:400px){body{padding:16px}}</style><body><header><h1>拾影 0.2.9</h1><p>正式组件与样式的静态预览，数据为示例。展示浅色、深色与主要页面。</p></header><main class="preview-grid">${frames.map(f=>`<section class="preview-item"><h2>${f.name}</h2><div>${f.markup}</div></section>`).join('')}</main></body></html>`);
console.log('Automatic UI QA passed: automatic resolution once, default/manual quality, failures/retry, same-ID source switch, hidden technical fields, no ad parsing. Formal HTML preview generated without a browser.');
