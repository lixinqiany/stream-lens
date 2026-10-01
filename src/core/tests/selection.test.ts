import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mergeEvidence} from '../discovery/catalog';
import {playerKey,selectedAssets,otherPlayerAssets} from '../discovery/selection';
import type {VideoEvidence} from '../model';
const evidence:VideoEvidence={url:'https://cdn.example/main.m3u8',title:'Video',pageUrl:'https://page.example/',width:1280,height:720,duration:100,playing:true,primary:true,protected:false,source:'player',playerId:'doc:main',sourceKey:'blob:main'};
test('selected player hides unrelated autoplay and keeps source association when paused',()=>{
 let assets=mergeEvidence([],evidence);
 assets=mergeEvidence(assets,{...evidence,url:'https://ads.example/a.m3u8',playerId:'doc:ad',sourceKey:'blob:ad',primary:false});
 assets=mergeEvidence(assets,{...evidence,source:'network',playerId:undefined,sourceKey:undefined,width:0,height:0});
 const selection={playerId:'doc:main',sourceKey:'blob:main',selectedAt:1,title:'Video',playing:false};
 assert.equal(selectedAssets(assets,selection).length,1);
 assets=mergeEvidence(assets,{...evidence,playing:false});
 assert.equal(selectedAssets(assets,selection)[0].playing,false);
 assert.equal(selectedAssets(assets,{...selection,sourceKey:'blob:next'}).length,0);
});
test('different frames cannot share a player identity and DASH cannot regress to silent MP4',()=>{
 assert.notEqual(playerKey('doc-a',0,'video'),playerKey('doc-b',0,'video'));
 assert.notEqual(playerKey(undefined,0,'video'),playerKey(undefined,1,'video'));
 let assets=mergeEvidence([],{...evidence,url:'https://cdn.example/v.m4s',contentType:'video/mp4',format:'DASH'});
 assets=mergeEvidence(assets,{...evidence,url:'https://cdn.example/v.m4s',source:'network',contentType:'video/mp4'});
 assert.equal(assets[0].protocol,'DASH');
});
test('a season player offers its current episode API as one video and discards stale episode bindings',()=>{
 const pageUrl='https://www.bilibili.com/bangumi/play/ss45662';
 const sourceKey='blob:main|bili-ep:768339';
 const url='https://api.bilibili.com/pgc/player/web/playurl?ep_id=768339&qn=127&fnval=4048&fnver=0&fourk=1';
 let assets=mergeEvidence([],{...evidence,pageUrl,sourceKey,url,contentType:'video/mp4',format:'DASH'});
 assets=mergeEvidence(assets,{...evidence,pageUrl,sourceKey,url:'https://cdn.example/video.m4s',contentType:'video/mp4',format:'DASH'});
 assets=mergeEvidence(assets,{...evidence,pageUrl,sourceKey:'blob:main|bili-ep:768338',url:url.replace('768339','768338'),contentType:'video/mp4',format:'DASH'});
 assert.deepEqual(selectedAssets(assets,{playerId:'doc:main',sourceKey,selectedAt:1,title:'Episode',playing:true}).map(a=>a.url),[url]);
});

test('other videos collapse player tracks and exclude unbound network evidence and the selected player',()=>{
 const pageUrl='https://www.bilibili.com/video/BV1rRut6rEGS/';
 const endpoint='https://api.bilibili.com/x/web-interface/view?bvid=BV1rRut6rEGS';
 let assets=mergeEvidence([],{...evidence,pageUrl,url:endpoint,format:'DASH',contentType:'video/mp4'});
 assets=mergeEvidence(assets,{...evidence,pageUrl,url:'https://cdn.example/video.m4s',format:'DASH',contentType:'video/mp4'});
 assets=mergeEvidence(assets,{...evidence,pageUrl,url:'https://cdn.example/audio.m4s',format:'DASH',contentType:'video/mp4',playerId:undefined,sourceKey:undefined});
 const selection={playerId:'doc:main',sourceKey:'blob:main',title:'Video',playing:true,selectedAt:1};
 assert.equal(selectedAssets(assets,selection).length,1);assert.equal(otherPlayerAssets(assets,selection).length,0);
 assets=mergeEvidence(assets,{...evidence,pageUrl:'https://other.example/',url:'https://cdn.example/other.mp4',playerId:'doc:other',sourceKey:'blob:old'});
 assets=mergeEvidence(assets,{...evidence,pageUrl:'https://other.example/',url:'https://cdn.example/new.mp4',playerId:'doc:other',sourceKey:'blob:new'});
 assets=assets.map(a=>({...a,playerBindings:a.playerBindings?.map(b=>({...b,seenAt:b.sourceKey==='blob:new'?100:1}))}));
 assert.deepEqual(otherPlayerAssets(assets,selection).map(a=>a.url),['https://cdn.example/new.mp4']);
});
