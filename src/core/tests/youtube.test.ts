import {test} from 'node:test';
import assert from 'node:assert/strict';
import {youtubeId,youtubeEndpoint,isYoutubeEndpoint,literalJson,parseYoutubePlayer,resolveYoutube} from '../sites/youtube';
import {selectedAssets} from '../discovery/selection';
import {mergeEvidence} from '../discovery/catalog';
const id='jNQXAC9IVRw';
const format=(itag:number,type:string,height?:number,extra={})=>({itag,height,bitrate:1000,mimeType:`${height?'video':'audio'}/mp4; codecs="${type}"`,url:`https://rr1.googlevideo.com/videoplayback?itag=${itag}`,initRange:{start:'0',end:'700'},indexRange:{start:'701',end:'780'},...extra});
const player=()=>({playabilityStatus:{status:'OK'},videoDetails:{videoId:id,lengthSeconds:'19'},streamingData:{adaptiveFormats:[format(137,'avc1.640028',1080),format(140,'mp4a.40.2'),format(139,'mp4a.40.5'),format(136,'avc1.64001F',720)]}});
test('YouTube routes bind watch, Shorts and short links to an exact trusted video ID',()=>{
 for(const url of [`https://www.youtube.com/watch?v=${id}&list=x`,`https://www.youtube.com/shorts/${id}`,`https://youtu.be/${id}?t=1`]){assert.equal(youtubeId(url),id);assert.equal(youtubeEndpoint(url),`https://www.youtube.com/watch?v=${id}`);}
 for(const url of [`https://youtube.com.evil.test/watch?v=${id}`,`https://example.com/watch?v=${id}`,'https://www.youtube.com/watch?v=invalid'])assert.equal(youtubeId(url),undefined);
 assert(!isYoutubeEndpoint(`https://youtu.be/${id}`,'https://www.youtube.com/watch?v=M7lc1UVf-VE'));
});
test('literal JSON parsing handles braces in strings without executing page code',()=>{
 assert.deepEqual(literalJson('var ytInitialPlayerResponse = {"title":"}\\\"{", "nested":[1,{"ok":true}]}; globalThis.bad=true;',/ytInitialPlayerResponse\s*=\s*/),{title:'}"{',nested:[1,{ok:true}]});
 assert.equal(literalJson('ytInitialPlayerResponse = (()=>({}))()',/ytInitialPlayerResponse\s*=\s*/),undefined);
 assert.equal(literalJson('ytInitialPlayerResponse = {invalid}',/ytInitialPlayerResponse\s*=\s*/),undefined);
});
test('YouTube creates paired indexed H264/AAC variants and chooses the default audio',()=>{
 const p=player();p.streamingData.adaptiveFormats.push(format(141,'mp4a.40.2',undefined,{audioTrack:{audioIsDefault:true},bitrate:900}));
 const parsed=parseYoutubePlayer(p,id);assert.equal(parsed.duration,19);assert.deepEqual(parsed.variants.map(v=>v.label),['1080p','720p']);assert.match(parsed.variants[0].dash!.audio.url,/itag=141/);assert.equal(parsed.variants[0].dash!.video.init.length,701);
});
test('YouTube rejects restricted, mismatched, encrypted and unindexed responses',()=>{
 const restricted=player();restricted.playabilityStatus.status='LOGIN_REQUIRED';assert.throws(()=>parseYoutubePlayer(restricted,id));
 const mismatch=player();mismatch.videoDetails.videoId='M7lc1UVf-VE';assert.throws(()=>parseYoutubePlayer(mismatch,id));
 const encrypted=player();encrypted.streamingData.adaptiveFormats.forEach(f=>Object.assign(f,{drmFamilies:['WIDEVINE']}));assert.throws(()=>parseYoutubePlayer(encrypted,id));
 const unindexed=player();unindexed.streamingData.adaptiveFormats.forEach(f=>delete (f as any).indexRange);assert.throws(()=>parseYoutubePlayer(unindexed,id));
 const external=player();external.streamingData.adaptiveFormats[0].url='https://evil.test/video';assert.throws(()=>parseYoutubePlayer(external,id));
});
test('YouTube canonical source hides isolated audio/video resources for the selected player',()=>{
 const pageUrl=`https://www.youtube.com/watch?v=${id}`,sourceKey='blob:one|yt:'+id;const evidence={title:'Video',pageUrl,playerId:'main',sourceKey,playing:true,primary:true,protected:false,width:500,height:300,source:'player' as const,format:'DASH' as const,contentType:'video/mp4'};
 let assets=mergeEvidence([],{...evidence,url:youtubeEndpoint(pageUrl)!});assets=mergeEvidence(assets,{...evidence,url:'https://rr1.googlevideo.com/videoplayback?itag=137'});
 assert.equal(selectedAssets(assets,{playerId:'main',sourceKey,title:'Video',playing:true,selectedAt:0}).length,1);
 assert.equal(selectedAssets(assets,{playerId:'main',sourceKey:'blob:next',title:'Next',playing:true,selectedAt:1}).length,0);
});
test('YouTube resolver uses permission-checked JSON POST for public playback and stops at login errors',async()=>{
 const previousFetch=globalThis.fetch;const calls:any[]=[];
 Object.assign(globalThis,{chrome:{permissions:{contains:async()=>true}}});
 const p=player();const page=JSON.stringify({...p,streamingData:{adaptiveFormats:[]}});
 globalThis.fetch=async(url,options)=>{calls.push({url:String(url),options});return new Response(calls.length===1?`ytInitialPlayerResponse = ${page}; "INNERTUBE_API_KEY":"public-key"`:JSON.stringify(p));};
 try{
  const parsed=await resolveYoutube(`https://www.youtube.com/shorts/${id}`);assert.equal(parsed.variants.length,2);assert.equal(calls[1].options.method,'POST');assert.equal(calls[1].options.headers['Content-Type'],'application/json');assert.equal(JSON.parse(calls[1].options.body).videoId,id);
  calls.length=0;globalThis.fetch=async()=>{calls.push({});return new Response('ytInitialPlayerResponse = {"playabilityStatus":{"status":"LOGIN_REQUIRED"}}; "INNERTUBE_API_KEY":"public-key"');};
  await assert.rejects(resolveYoutube(`https://www.youtube.com/watch?v=${id}`));assert.equal(calls.length,1);
 }finally{globalThis.fetch=previousFetch;}
});

test('YouTube permits archived broadcasts and VOD HLS alternatives, while rejecting active live playback',()=>{
 const archive=player();Object.assign(archive.videoDetails,{isLiveContent:true});Object.assign(archive.streamingData,{hlsManifestUrl:'https://example.com/vod.m3u8'});assert.equal(parseYoutubePlayer(archive,id).variants.length,2);
 Object.assign(archive.videoDetails,{isLive:true});assert.throws(()=>parseYoutubePlayer(archive,id));
});
