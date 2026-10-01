import {test} from 'node:test';import assert from 'node:assert/strict';
import {mergeEvidence,protocolFor} from '../discovery/catalog';import {safeFilename,taskProgress,httpUrl,originPattern,type VideoEvidence,type DownloadRecord} from '../model';
const evidence:VideoEvidence={title:'主视频',pageUrl:'https://page.example/',width:1280,height:720,duration:8838,playing:false,primary:true,protected:false,source:'player',url:'https://cdn.example/main.m3u8?sig=a'};
test('main player outranks playing ad, repeated network evidence preserves ad classification',()=>{
 let assets=mergeEvidence([],evidence);assets=mergeEvidence(assets,{...evidence,url:'https://cdn.example/ad.mp4',title:'ad',primary:false,playing:true,width:320,height:180,duration:15});
 assets=mergeEvidence(assets,{...evidence,url:'https://cdn.example/ad.mp4',title:'page title',primary:false,playing:false,width:0,height:0,duration:undefined,source:'network'});
 assert.equal(assets[0].title,'主视频');assert.equal(assets[1].suspectedAd,true);
});
test('exact URLs deduplicate without collapsing different signed resources',()=>{
 let assets=mergeEvidence([],evidence);assets=mergeEvidence(assets,{...evidence,source:'script'});assert.equal(assets.length,1);assert.deepEqual(assets[0].evidence,['player','script']);assets=mergeEvidence(assets,{...evidence,url:'https://cdn.example/main.m3u8?sig=b'});assert.equal(assets.length,2);
});
test('URL, filename and protocol handling preserve format and reject executable/credential URLs',()=>{
 assert.equal(originPattern('http://localhost:5180/video'),'http://localhost/*');assert.equal(httpUrl('javascript:alert(1)'),undefined);assert.equal(httpUrl('https://user:pass@example.com/v.mp4'),undefined);assert.equal(protocolFor('https://a/v?sig=x','video/webm'),'WEBM');assert.equal(safeFilename('../电影:片段','720p','mp4'),'_电影_片段_720p.mp4');assert.equal(safeFilename(' . ','原始文件','webm'),'video.webm');
});
test('unknown totals stay indeterminate and downloaded segments do not imply task completion',()=>{
 const task={state:'downloading',protocol:'HLS',segments:5,bytes:100} as DownloadRecord;assert.equal(taskProgress(task),undefined);assert.equal(taskProgress({...task,totalSegments:10}),50);assert.equal(taskProgress({...task,totalSegments:5,state:'merging'}),100);assert.equal(taskProgress({...task,state:'completed'}),100);
});
