import {test} from 'node:test';
import assert from 'node:assert/strict';
import {observeHls} from '../../extension/page/hls';

function fixture(late=false) {
  const messages:{source:string;urls:string[]}[]=[];
  class Hls {
    media?:any;url?:string;events=new Map<string,(()=>void)[]>();
    on(event:string,listener:()=>void){this.events.set(event,[...(this.events.get(event)||[]),listener]);}
    trigger(event:string){for(const listener of this.events.get(event)||[])listener();}
    attachMedia(media:any){this.media=media;this.trigger('hlsMediaAttached');return 'attached';}
    loadSource(url:string){this.url=url;this.trigger('hlsManifestLoaded');return 'loaded';}
  }
  const host:any=late?{}:{Hls};Object.assign(globalThis,{window:host});
  const query=observeHls((source,urls)=>messages.push({source,urls}));
  if(late)host.Hls=Hls;
  return {Hls,messages,query};
}
test('Hls worker playback binds the exact signed playlist to its media and replays it',()=>{
  const {Hls,messages,query}=fixture();const player=new Hls();
  const url='https://cdn.example/chunklist.m3u8?sig=exact%2Bsignature&expires=123';
  assert.equal(player.loadSource(url),'loaded');assert.equal(messages.length,0);
  const media={src:'blob:https://page.example/main'};
  assert.equal(player.attachMedia(media),'attached');assert.deepEqual(messages.at(-1),{source:media.src,urls:[url]});
  const count=messages.length;query(media.src);assert.equal(messages.length,count+1);
  query('blob:https://page.example/unrelated-ad');assert.equal(messages.length,count+1);
  media.src='blob:https://page.example/next';query('blob:https://page.example/main');assert.equal(messages.length,count+1,'a stale source cannot be replayed');
});
test('late UMD assignment, attach-first ordering, source switches and detach clean up bindings',()=>{
  const {Hls,messages,query}=fixture(true);const main=new Hls(),ad=new Hls();
  const media={currentSrc:'blob:https://page.example/main'};
  main.attachMedia(media);main.loadSource('https://cdn.example/main.m3u8');
  ad.attachMedia({src:'blob:https://page.example/ad'});ad.loadSource('https://ads.example/ad.m3u8');
  query(media.currentSrc);assert.deepEqual(messages.at(-1)?.urls,['https://cdn.example/main.m3u8']);
  main.loadSource('https://cdn.example/episode-two.m3u8');
  assert(messages.some(m=>m.source===media.currentSrc&&m.urls.length===0));
  query(media.currentSrc);assert.deepEqual(messages.at(-1)?.urls,['https://cdn.example/episode-two.m3u8']);
  main.trigger('hlsMediaDetaching');const count=messages.length;query(media.currentSrc);assert.equal(messages.length,count);
  assert.deepEqual(messages.at(-1),{source:media.currentSrc,urls:[]});
});
