import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
const bundle=await build({entryPoints:['src/extension/content/index.ts'],bundle:true,write:false,format:'iife',platform:'browser'});
for(const site of ['youtube','douyin']){
 const url=site==='youtube'?'https://www.youtube.com/watch?v=jNQXAC9IVRw':'https://www.douyin.com/jingxuan?modal_id=7677919026948967689';
 const dom=new JSDOM('<div id="movie_player" class="player"><video></video><button>Play</button></div>',{url,runScripts:'outside-only'}),w=dom.window;
 const calls=[],handlers=[],timers=[];
 const add=w.document.addEventListener.bind(w.document);w.document.addEventListener=(type,fn,opts)=>{handlers.push({type,fn});return add(type,fn,opts);};
 w.setTimeout=fn=>{timers.push(fn);return timers.length};w.setInterval=()=>0;w.performance.getEntriesByType=()=>[];w.postMessage=()=>{};
 w.chrome={runtime:{onMessage:{addListener(){}},sendMessage:async m=>{calls.push(m);return {ok:true}}}};
 const video=w.document.querySelector('video'),player=w.document.querySelector('.player');let source='blob:'+w.location.origin+'/one';
 Object.defineProperties(video,{src:{get:()=>source},currentSrc:{get:()=>source},paused:{value:false},ended:{value:false},duration:{value:300},videoWidth:{value:1280},videoHeight:{value:720}});
 video.getBoundingClientRect=player.getBoundingClientRect=()=>({left:10,top:10,right:810,bottom:460,width:800,height:450});
 w.eval(bundle.outputFiles[0].text);const flush=()=>{while(timers.length)timers.shift()()};flush();
 const host=w.document.querySelector('[data-stream-lens-overlay]');assert.equal(host.style.display,'none');assert.equal(calls.filter(m=>m.type==='PLAYER_RESOLVE').length,0);
 handlers.find(h=>h.type==='click').fn({isTrusted:true,composedPath:()=>[video,player,w.document.body]});
 let latest=calls.findLast(m=>m.type==='EVIDENCE');assert(latest.player.sourceKey.includes(site==='youtube'?'|yt:jNQXAC9IVRw':'|dy:7677919026948967689'));assert(latest.evidence.some(e=>e.url.includes(site==='youtube'?'watch?v=jNQXAC9IVRw':'share/video/7677919026948967689')&&e.playerId===latest.player.playerId));assert.equal(host.style.display,'block');
 if(site==='douyin'){
  const other=w.document.createElement('video');player.append(other);Object.defineProperties(other,{src:{value:'blob:other'},currentSrc:{value:'blob:other'}});other.getBoundingClientRect=()=>({left:10,top:500,right:810,bottom:750,width:800,height:250});video.dispatchEvent(new w.Event('loadedmetadata',{bubbles:true}));flush();latest=calls.findLast(m=>m.type==='EVIDENCE');assert(!latest.evidence.some(e=>e.url.includes('share/video/')));assert(latest.player.sourceKey.endsWith('|unbound'));other.remove();
  player.setAttribute('data-aweme-id','7677919026948967690');video.dispatchEvent(new w.Event('loadedmetadata',{bubbles:true}));flush();latest=calls.findLast(m=>m.type==='EVIDENCE');assert(!latest.evidence.some(e=>e.url.includes('share/video/')));assert(latest.player.sourceKey.endsWith('|unbound'));
  player.setAttribute('data-aweme-id','7677919026948967689');video.dispatchEvent(new w.Event('loadedmetadata',{bubbles:true}));flush();latest=calls.findLast(m=>m.type==='EVIDENCE');assert(latest.evidence.some(e=>e.url.includes('share/video/')));
 }
 if(site==='youtube'){
  player.classList.add('ad-showing');video.dispatchEvent(new w.Event('loadedmetadata',{bubbles:true}));flush();latest=calls.findLast(m=>m.type==='EVIDENCE');assert(latest.player.sourceKey.endsWith('|ad'));assert(!latest.evidence.some(e=>e.url.includes('watch?v=')));
  player.classList.remove('ad-showing');source='blob:'+w.location.origin+'/two';video.dispatchEvent(new w.Event('emptied',{bubbles:true}));flush();latest=calls.findLast(m=>m.type==='EVIDENCE');assert(!latest.player.sourceKey.endsWith('|ad'));assert(latest.player.sourceKey.startsWith(source));
 }
 dom.window.close();
}
console.log('Platform content QA passed: selected YouTube/Douyin source, overlay, no autoplay selection and YouTube ad isolation.');
