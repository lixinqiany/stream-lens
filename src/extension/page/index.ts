// Runs in the page world at document_start. Only resource provenance crosses to
// the isolated content script; no Chrome API or download command is exposed here.
import {httpUrl} from '../../core/model';
import {protocolFor} from '../../core/discovery/catalog';

const state=globalThis as typeof globalThis & {__streamLensProbe?:boolean};
if(!state.__streamLensProbe) {
  state.__streamLensProbe=true;
  const channel='stream-lens-media-v1';
  const buffers=new WeakMap<SourceBuffer,MediaSource>();
  const blobs=new Map<string,MediaSource>();
  const sources=new WeakMap<MediaSource,Set<string>>();
  const exact=new WeakMap<object,string>();
  const samples=new Map<string,string>();
  const parents=new Map<string,string>();
  const dashSources=new WeakSet<MediaSource>();
  const responseUrls=new WeakMap<Response,string>();
  const readers=new WeakMap<ReadableStreamDefaultReader,string>();
  const streams=new WeakMap<ReadableStream,string>();
  const limit=<K,V>(map:Map<K,V>,max:number)=>{while(map.size>max)map.delete(map.keys().next().value!);};
  function fingerprint(data:ArrayBuffer|ArrayBufferView) {
    const a=data instanceof ArrayBuffer?new Uint8Array(data):new Uint8Array(data.buffer,data.byteOffset,data.byteLength);
    let x=2166136261,y=5381;
    for(let i=0;i<Math.min(96,a.length);i++){x=Math.imul(x^a[i],16777619);y=Math.imul(y,33)^a[a.length-1-i];}
    return `${a.length}:${x>>>0}:${y>>>0}`;
  }
  function remember(data:ArrayBuffer|ArrayBufferView,url:string) {
    if(data.byteLength<16)return;
    exact.set(data,url);samples.set(fingerprint(data),url);limit(samples,800);
  }
  function manifest(text:string,url:string) {
    if(text.length>5_000_000||!text.trimStart().startsWith('#EXTM3U'))return;
    for(const line of text.split(/\r?\n/)) {
      const value=line.trim();
      const uris=value.startsWith('#')?[...value.matchAll(/URI="([^"]+)"/g)].map(m=>m[1]):value?[value]:[];
      for(const uri of uris) {try {const child=httpUrl(new URL(uri,url).href);if(child&&child!==url)parents.set(child,url);}catch{}}
    }
    limit(parents,35000);
  }
  function root(url:string) {
    const seen=new Set<string>();
    while(parents.has(url)&&!seen.has(url)){seen.add(url);url=parents.get(url)!;}
    return url;
  }
  function emit(blob:string,media:MediaSource) {
    const urls=[...(sources.get(media)||[])].map(root).filter(url=>protocolFor(url)||/\.(?:m4s|mp4)(?:\?|$)/i.test(url));
    const unique=[...new Set(urls)].slice(0,30);
    if(unique.length)window.postMessage({channel,type:'sources',blob,urls:unique,format:dashSources.has(media)?'DASH':undefined},location.origin);
  }
  function associate(media:MediaSource,url:string) {
    let set=sources.get(media);if(!set)sources.set(media,set=new Set());
    const parent=root(url);
    if(!parents.has(url)&&/\.m4s(?:\?|$)/i.test(url))dashSources.add(media);
    set.add(parent);
    if(set.size>30)set.delete(set.values().next().value!);
    for(const [blob,value] of blobs)if(value===media)emit(blob,media);
  }
  const create=URL.createObjectURL;
  URL.createObjectURL=function(value:Blob|MediaSource) {
    const url=create.call(this,value);
    if(typeof MediaSource!=='undefined'&&value instanceof MediaSource){blobs.set(url,value);limit(blobs,100);emit(url,value);}
    return url;
  };
  const revoke=URL.revokeObjectURL;
  URL.revokeObjectURL=function(url:string){revoke.call(this,url);/* Keep provenance: players revoke live blob URLs after sourceopen. */};
  if(typeof MediaSource!=='undefined') {
    const add=MediaSource.prototype.addSourceBuffer;
    MediaSource.prototype.addSourceBuffer=function(...args){const buffer=add.apply(this,args);buffers.set(buffer,this);return buffer;};
    const append=SourceBuffer.prototype.appendBuffer;
    SourceBuffer.prototype.appendBuffer=function(data:BufferSource) {
      const result=append.call(this,data);
      try {const media=buffers.get(this);const url=exact.get(data)||samples.get(fingerprint(data));if(media&&url)associate(media,url);}catch{}
      return result;
    };
  }
  const fetchOriginal=window.fetch;
  window.fetch=function(...args) {
    return fetchOriginal.apply(this,args).then(response=>{
      const url=httpUrl(response.url)||httpUrl(typeof args[0]==='string'?args[0]:args[0] instanceof Request?args[0].url:args[0].href);
      if(url){responseUrls.set(response,url);if(response.body)streams.set(response.body,url);}
      return response;
    });
  };
  const clone=Response.prototype.clone;
  Response.prototype.clone=function(){const response=clone.call(this),url=responseUrls.get(this);if(url){responseUrls.set(response,url);if(response.body)streams.set(response.body,url);}return response;};
  const arrayBuffer=Response.prototype.arrayBuffer;
  Response.prototype.arrayBuffer=function(){return arrayBuffer.call(this).then(data=>{try{const url=responseUrls.get(this);if(url){remember(data,url);if(protocolFor(url)==='HLS')manifest(new TextDecoder().decode(data),url);}}catch{}return data;});};
  const text=Response.prototype.text;
  Response.prototype.text=function(){return text.call(this).then(value=>{try{const url=responseUrls.get(this);if(url)manifest(value,url);}catch{}return value;});};
  const getReader=ReadableStream.prototype.getReader;
  ReadableStream.prototype.getReader=function(options?:ReadableStreamGetReaderOptions):any {
    const reader=(getReader as Function).call(this,options);const url=streams.get(this);if(url)readers.set(reader,url);return reader;
  };
  const read=ReadableStreamDefaultReader.prototype.read;
  ReadableStreamDefaultReader.prototype.read=function(){return read.call(this).then(result=>{try{const url=readers.get(this);if(url&&result.value instanceof Uint8Array)remember(result.value,url);}catch{}return result;});};
  const open=XMLHttpRequest.prototype.open;
  const xhrUrls=new WeakMap<XMLHttpRequest,string>();
  const observed=new WeakSet<XMLHttpRequest>();
  XMLHttpRequest.prototype.open=function(method:string,url:string|URL,...args:any[]) {
    const resolved=httpUrl(new URL(String(url),location.href).href);if(resolved)xhrUrls.set(this,resolved);
    observed.delete(this);
    this.addEventListener('readystatechange',()=>{if(this.readyState!==4||observed.has(this))return;observed.add(this);capture(this);});
    return (open as Function).call(this,method,url,...args);
  };
  function capture(xhr:XMLHttpRequest) {try{const url=httpUrl(xhr.responseURL)||xhrUrls.get(xhr);if(!url)return;
    if(xhr.response instanceof ArrayBuffer){remember(xhr.response,url);if(protocolFor(url)==='HLS')manifest(new TextDecoder().decode(xhr.response),url);}
    else if(!xhr.responseType||xhr.responseType==='text')manifest(xhr.responseText,url);
  }catch{}}
  const send=XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send=function(body?:Document|XMLHttpRequestBodyInit|null) {
    this.addEventListener('load',()=>capture(this),{once:true});
    return send.call(this,body);
  };
  window.addEventListener('message',event=>{
    if(event.source!==window||event.data?.channel!==channel)return;
    if(event.data.type==='bili-player-query'){
      if(!/(^|\.)bilibili\.com$/.test(location.hostname)||!/^\/bangumi\/play\/ss\d+(?:\/|$)/.test(location.pathname))return;
      if(typeof event.data.playerId!=='string'||event.data.playerId.length>100||typeof event.data.source!=='string')return;
      // Read the player's public API; bind the manifest to its actual media
      // element instead of guessing the first episode on a season route.
      try {
        const player=(window as any).player;
        const video=player?.mediaElement?.();const manifest=player?.getManifest?.();
        if(!(video instanceof Element)||!video.matches('video,bwp-video')||!video.closest('.bpx-player-container,#bilibili-player'))return;
        const media=video as HTMLVideoElement;
        const source=media.currentSrc||media.src||(media.srcObject?'src-object':'unloaded');
        const episodeId=Number(manifest?.episodeId),seasonId=Number(manifest?.seasonId);
        if(source!==event.data.source||!Number.isSafeInteger(episodeId)||episodeId<=0||seasonId!==Number(location.pathname.match(/ss(\d+)/)?.[1]))return;
        window.postMessage({channel,type:'bili-player-context',playerId:event.data.playerId,source,episodeId,seasonId},location.origin);
      }catch{}
      return;
    }
    if(event.data.type!=='query'||typeof event.data.blob!=='string')return;
    const media=blobs.get(event.data.blob);if(media)emit(event.data.blob,media);
  });
}
