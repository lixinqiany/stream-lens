import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';

const bundle=await build({entryPoints:['src/extension/content/index.ts'],bundle:true,write:false,format:'iife',platform:'browser'});
function fixture(html='<h1>404 - 找不到文件或目录。</h1>'){
  const dom=new JSDOM(html,{url:'https://page.example/',runScripts:'outside-only'}),w=dom.window,timers=[],calls=[];
  let receive,insertedDisplay,rect={left:100,top:40,right:900,bottom:490,width:800,height:450};
  const append=w.document.documentElement.append.bind(w.document.documentElement);
  w.document.documentElement.append=(...nodes)=>{
    for(const node of nodes)if(node instanceof w.Element&&node.hasAttribute('data-stream-lens-overlay'))insertedDisplay=node.style.display;
    append(...nodes);
  };
  w.setTimeout=fn=>{timers.push(fn);return timers.length;};w.setInterval=()=>0;w.performance.getEntriesByType=()=>[];
  w.chrome={runtime:{onMessage:{addListener(fn){receive=fn;}},sendMessage:async message=>{
    calls.push(message);
    return {ok:true,value:message.type==='PLAYER_RESOLVE'?{asset:{id:'main',title:'Fixture',variants:[{id:'original',label:'Original',url:'https://cdn.example/main.mp4'}]},preferences:{quality:'best'}}:undefined};
  }}};
  const video=w.document.querySelector('video');
  if(video){
    Object.defineProperties(video,{currentSrc:{get(){return this.src;}},paused:{value:false,writable:true},ended:{value:false},duration:{value:100},videoWidth:{value:1280},videoHeight:{value:720}});
    video.getBoundingClientRect=()=>rect;
  }
  w.eval(bundle.outputFiles[0].text);
  const host=w.document.querySelector('[data-stream-lens-overlay]');
  const scan=()=>{receive({type:'CONTENT_SCAN'},{},()=>{});while(timers.length)timers.shift()();};
  return {dom,w,host,video,calls,insertedDisplay,scan,rect:value=>{rect={...rect,...value};}};
}

for(const html of ['<h1>404 - 找不到文件或目录。</h1>','<h1>Ordinary page</h1><script>const hlsUrl="https://cdn.example/main.m3u8";</script>']){
  const f=fixture(html);
  assert.equal(f.insertedDisplay,'none','the overlay must already be hidden when inserted');
  assert.equal(f.host.style.display,'none','the overlay is hidden before the first scan');
  for(let i=0;i<3;i++)f.scan();
  assert.equal(f.host.style.display,'none','pages without a player never show the shortcut');
  assert(!f.calls.some(m=>m.player||m.type==='PLAYER_RESOLVE'||m.type==='PLAYER_START'));
  f.dom.window.close();
}

const f=fixture('<h1>Video</h1><div id="player"><video src="https://cdn.example/main.mp4"></video></div>');
assert.equal(f.insertedDisplay,'none');f.scan();assert.equal(f.host.style.display,'block','a ready, playing video shows the shortcut');
f.video.paused=true;f.scan();assert.equal(f.host.style.display,'block','pausing keeps the selected player available');
f.rect({top:-500,bottom:-50});f.scan();assert.equal(f.host.style.display,'none','offscreen players hide the shortcut');
f.rect({top:40,bottom:490});f.scan();assert.equal(f.host.style.display,'block');
f.video.parentElement.setAttribute('data-ad','');f.scan();assert.equal(f.host.style.display,'none','ad playback hides the shortcut');
f.video.parentElement.removeAttribute('data-ad');f.scan();assert.equal(f.host.style.display,'block');
const unrelated=f.w.document.createElement('div');f.w.document.body.append(unrelated);
Object.defineProperty(f.w.document,'fullscreenElement',{value:unrelated,configurable:true});f.scan();assert.equal(f.host.style.display,'none','unrelated fullscreen content hides the shortcut');
Object.defineProperty(f.w.document,'fullscreenElement',{value:null,configurable:true});f.scan();assert.equal(f.host.style.display,'block');
f.video.remove();f.scan();assert.equal(f.host.style.display,'none','removing the player hides the shortcut');
assert(!f.calls.some(m=>m.type==='PLAYER_START'));f.dom.window.close();

const spa=fixture('<video src="https://cdn.example/main.mp4"></video>');spa.scan();assert.equal(spa.host.style.display,'block');
spa.w.history.pushState({},'', '/not-found');spa.video.paused=true;spa.scan();assert.equal(spa.host.style.display,'none','navigation clears the selected player');spa.dom.window.close();
console.log('Overlay visibility QA passed: hidden before insertion/first scan, 404/plain pages, video/pause, offscreen/ad/fullscreen suppression, removal and navigation reset.');
