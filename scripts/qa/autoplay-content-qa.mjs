import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
const bundle=await build({entryPoints:['src/extension/content/index.ts'],bundle:true,write:false,format:'iife',platform:'browser'});
function fixture({url='https://www.bilibili.com/video/BV1rRut6rEGS/',paused=false,ready=true}={}){
 const dom=new JSDOM('<h1>Main movie</h1><div class="bpx-player-container"><div class="bpx-player-video-wrap"><bwp-video id="main"></bwp-video></div></div><video id="recommendation" src="https://cdn.example/recommendation.mp4"></video>',{url,runScripts:'outside-only'}),w=dom.window,calls=[],timers=[],handlers=[];let receive,current='blob:'+w.location.origin+'/main';
 const add=w.document.addEventListener.bind(w.document);w.document.addEventListener=(type,fn,opts)=>{handlers.push({type,fn});return add(type,fn,opts);};
 w.setTimeout=fn=>{timers.push(fn);return timers.length};w.setInterval=()=>0;w.performance.getEntriesByType=()=>[];w.postMessage=()=>{};
 w.chrome={runtime:{onMessage:{addListener(fn){receive=fn;}},sendMessage:async m=>{calls.push(m);return {ok:true};}}};
 const main=w.document.querySelector('#main'),other=w.document.querySelector('#recommendation'),container=w.document.querySelector('.bpx-player-container');
 Object.defineProperties(main,{currentSrc:{get:()=>current},src:{get:()=>current},paused:{value:paused,writable:true},ended:{value:false},duration:{value:ready?300:NaN,writable:true},videoWidth:{value:ready?1280:0,writable:true},videoHeight:{value:720}});
 Object.defineProperties(other,{currentSrc:{get(){return this.src}},paused:{value:false},ended:{value:false},duration:{value:100},videoWidth:{value:640},videoHeight:{value:360}});
 main.getBoundingClientRect=()=>({left:0,top:20,right:1000,bottom:582,width:1000,height:562});other.getBoundingClientRect=()=>({left:1100,top:20,right:1400,bottom:190,width:300,height:170});
 const flush=()=>{while(timers.length)timers.shift()()};const click=v=>handlers.find(h=>h.type==='click').fn({isTrusted:true,composedPath:()=>[v,w.document.body]});
 w.eval(bundle.outputFiles[0].text);flush();
 return {dom,w,calls,main,other,container,flush,click,receive:(...args)=>receive(...args),source:value=>{current=value;},host:()=>w.document.querySelector('[data-stream-lens-overlay]')};
}
const f=fixture();let latest=f.calls.findLast(m=>m.type==='EVIDENCE');assert(latest.select);assert.equal(latest.player.mode,'auto');assert(latest.evidence.some(e=>e.url.includes('bvid=BV1rRut6rEGS')));assert.equal(f.host().style.display,'block');assert(f.calls.some(m=>m.type==='PLAYER_RESOLVE'));assert(!f.calls.some(m=>m.type==='PLAYER_START'));
f.main.paused=true;f.main.dispatchEvent(new f.w.Event('pause',{bubbles:true}));f.flush();assert.equal(f.calls.findLast(m=>m.type==='EVIDENCE').player.playerId,latest.player.playerId);
f.click(f.other);latest=f.calls.findLast(m=>m.type==='EVIDENCE');assert.equal(latest.player.mode,'manual');const otherId=latest.player.playerId;f.main.paused=false;f.main.dispatchEvent(new f.w.Event('play',{bubbles:true}));f.flush();assert.equal(f.calls.findLast(m=>m.type==='EVIDENCE').player.playerId,otherId);
let response;f.receive({type:'CONTENT_SELECT',playerId:otherId,sourceKey:'stale'}, {},r=>response=r);assert.equal(response.ok,false);f.receive({type:'CONTENT_SELECT',playerId:otherId,sourceKey:latest.player.sourceKey},{},r=>response=r);assert.equal(response.ok,true);
f.w.history.pushState({},'', '/video/BV1GJ411x7h7/');f.main.dispatchEvent(new f.w.Event('loadedmetadata',{bubbles:true}));f.flush();latest=f.calls.findLast(m=>m.type==='EVIDENCE');assert.equal(latest.player.mode,'auto');assert(latest.evidence.some(e=>e.url.includes('bvid=BV1GJ411x7h7')));assert.notEqual(latest.player.playerId,otherId);
f.container.classList.add('ad-showing');f.main.dispatchEvent(new f.w.Event('loadedmetadata',{bubbles:true}));f.flush();latest=f.calls.findLast(m=>m.type==='EVIDENCE');assert(latest.player.sourceKey.endsWith('|ad'));assert(!latest.evidence.some(e=>e.url.includes('bvid=')));assert.equal(f.host().style.display,'none');f.dom.window.close();
const slow=fixture({ready:false});assert(!slow.calls.findLast(m=>m.type==='EVIDENCE').player,'an unloaded main player cannot select recommendation playback');slow.main.duration=300;slow.main.videoWidth=1280;slow.main.dispatchEvent(new slow.w.Event('loadedmetadata',{bubbles:true}));slow.flush();assert.equal(slow.calls.findLast(m=>m.type==='EVIDENCE').player.mode,'auto');slow.dom.window.close();
const paused=fixture({paused:true});assert.equal(paused.calls.findLast(m=>m.type==='EVIDENCE').player.mode,'auto');paused.dom.window.close();
console.log('Autoplay content QA passed: Bilibili main selection without gestures, overlay, delayed ready/paused player, manual priority, sidebar switch, navigation reset and ad suppression.');
