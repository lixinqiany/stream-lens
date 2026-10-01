import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';import mux from 'mux.js';import {TsTransmuxer} from '../hls/transmux';import {validateMp4Init} from '../hls/mp4';
test('real H264/AAC TS fixture produces MP4 with both tracks and one initialization section',async()=>{
 const ts=new Uint8Array(await readFile('src/core/tests/fixtures/hls-segment.bin'));const engine=new TsTransmuxer();try{
 const output=engine.push(ts);validateMp4Init(output[0]);const tracks=mux.mp4.probe.tracks(output[0]);assert.equal(tracks.filter(t=>t.type==='video').length,1);assert.equal(tracks.filter(t=>t.type==='audio').length,1);assert.equal(new TextDecoder().decode(output[0].slice(4,8)),'ftyp');assert.equal(new TextDecoder().decode(output[1].slice(4,8)),'moof');assert.ok(output[1].length>100000);await writeFile('work/verified-fixture.mp4',Buffer.concat(output));
 }finally{engine.dispose();}
});
test('malformed TS cannot become a successful empty video',()=>{const engine=new TsTransmuxer();try{assert.throws(()=>engine.push(new Uint8Array([0x47,0,0,0])));}finally{engine.dispose();}});

test('passthrough rejects truncated or missing MP4 initialization',()=>{assert.throws(()=>validateMp4Init(new Uint8Array([0,0,0,32,102,116,121,112])));assert.throws(()=>validateMp4Init(new Uint8Array()));});
