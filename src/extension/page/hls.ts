import {httpUrl} from '../../core/model';
import {protocolFor} from '../../core/discovery/catalog';

// Hls.js transmuxes TS in a Worker, so fetched bytes never reach appendBuffer
// unchanged. Its public media/url pair provides provenance without guessing from
// unrelated requests (ads and preloads can use the same CDN).
export function observeHls(publish:(source:string,urls:string[])=>void) {
  type Player = {media?:HTMLMediaElement;url?:string;on?:(event:string,listener:()=>void)=>void};
  const hooked=new WeakSet<object>(),observed=new WeakSet<object>();
  const bindings=new Map<string,{player:Player;media:HTMLMediaElement;url:string}>();
  function emit(player:Player) {
    const media=player.media,url=httpUrl(player.url),source=media?.currentSrc||media?.src;
    if(!media||!source?.startsWith('blob:')||!url||protocolFor(url)!=='HLS')return;
    bindings.set(source,{player,media,url});
    while(bindings.size>100)bindings.delete(bindings.keys().next().value!);
    publish(source,[url]);
  }
  function forget(player:Player) {
    for(const [source,binding] of bindings)if(binding.player===player){bindings.delete(source);publish(source,[]);}
  }
  function watch(player:Player) {
    if(observed.has(player))return;observed.add(player);
    for(const event of ['hlsMediaAttached','hlsManifestLoaded','hlsLevelLoaded'])player.on?.(event,()=>{try{emit(player);}catch{}});
    for(const event of ['hlsMediaDetaching','hlsDestroying'])player.on?.(event,()=>{try{forget(player);}catch{}});
  }
  function hook(value:unknown) {
    const prototype=(value as {prototype?:any})?.prototype;
    if(!prototype||hooked.has(prototype)||typeof prototype.attachMedia!=='function'||typeof prototype.loadSource!=='function')return;
    hooked.add(prototype);
    for(const method of ['attachMedia','loadSource'] as const) {
      const original=prototype[method];
      prototype[method]=function(this:Player,...args:unknown[]) {
        try{watch(this);if(method==='loadSource')forget(this);}catch{}
        const result=original.apply(this,args);
        try{emit(this);}catch{}
        return result;
      };
    }
  }
  const host=window as typeof window & {Hls?:unknown};
  const descriptor=Object.getOwnPropertyDescriptor(host,'Hls');
  try{hook(host.Hls);}catch{}
  // UMD builds assign window.Hls after our document_start probe has run.
  if(!descriptor||('value' in descriptor&&descriptor.configurable&&descriptor.writable)) {
    let value=host.Hls;
    Object.defineProperty(host,'Hls',{configurable:true,enumerable:descriptor?.enumerable??true,get:()=>value,set:next=>{value=next;try{hook(next);}catch{}}});
  }
  return (source:string)=>{
    const binding=bindings.get(source);
    if(binding&&binding.player.media===binding.media&&(binding.media.currentSrc||binding.media.src)===source&&httpUrl(binding.player.url)===binding.url)emit(binding.player);
  };
}
