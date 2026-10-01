import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attributes, parseHls, keyIv } from '../hls/parser';
const base='https://cdn.example/path/master.m3u8?token=secret';
test('master resolves relative signed variant URLs, sorts quality, retains codec lists and audio groups',()=>{
 const p=parseHls(`#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",URI="sound.m3u8"\n#EXT-X-STREAM-INF:BANDWIDTH=900000,RESOLUTION=640x360,CODECS="avc1.42,mp4a.40.2"\nlow.m3u8?sig=abc%2Fdef\n#EXT-X-STREAM-INF:BANDWIDTH=3000000,RESOLUTION=1280x720,AUDIO="audio"\n../high.m3u8?sig=high`,base);
 assert.equal(p.type,'master');if(p.type!=='master')return;
 assert.equal(p.variants[0].height,720);assert.equal(p.variants[0].url,'https://cdn.example/high.m3u8?sig=high');
 assert.equal(p.variants[1].url,'https://cdn.example/path/low.m3u8?sig=abc%2Fdef');assert.equal(p.variants[1].codecs,'avc1.42,mp4a.40.2');assert.deepEqual(p.externalAudio,['audio']);
 assert.equal(attributes('CODECS="avc1.42,mp4a.40.2",BANDWIDTH=42').BANDWIDTH,'42');
});
test('VOD keeps init maps, byte-range continuation, key rotation and sequence IV',()=>{
 const p=parseHls(`#EXTM3U\n#EXT-X-MEDIA-SEQUENCE:258\n#EXT-X-MAP:URI="init.mp4",BYTERANGE="32@0"\n#EXT-X-KEY:METHOD=AES-128,URI="key",IV=0x01\n#EXTINF:4.5,\n#EXT-X-BYTERANGE:100@32\nmedia.mp4\n#EXT-X-KEY:METHOD=NONE\n#EXTINF:2,\n#EXT-X-BYTERANGE:50\nmedia.mp4\n#EXT-X-ENDLIST`,base);
 assert.equal(p.type,'media');if(p.type!=='media')return;
 assert.equal(p.duration,6.5);assert.equal(p.ended,true);assert.equal(p.segments[1].sequence,259);assert.deepEqual(p.segments[1].range,{length:50,offset:132});assert.equal(p.segments[0].key?.url,'https://cdn.example/path/key');assert.equal(p.segments[1].key,undefined);
 assert.deepEqual([...keyIv({url:'key'},258)].slice(-2),[1,2]);assert.equal(keyIv({url:'key',iv:'0x01'},999)[15],1);
});
test('live and timeline switching are reported distinctly',()=>{
 const p=parseHls('#EXTM3U\n#EXTINF:2,\na.ts\n#EXT-X-DISCONTINUITY\n#EXTINF:2,\nb.ts',base);assert.equal(p.type,'media');if(p.type==='media'){assert.equal(p.ended,false);assert.equal(p.discontinuity,true);}
});
for(const [name,body] of Object.entries({html:'<html>Login</html>',missingVariant:'#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1',badSequence:'#EXTM3U\n#EXT-X-MEDIA-SEQUENCE:-1\n#EXTINF:1,\na.ts',badRange:'#EXTM3U\n#EXTINF:1,\n#EXT-X-BYTERANGE:5\na.ts',differentRangeResource:'#EXTM3U\n#EXTINF:1,\n#EXT-X-BYTERANGE:5@0\na.ts\n#EXTINF:1,\n#EXT-X-BYTERANGE:5\nb.ts',missingMap:'#EXTM3U\n#EXT-X-MAP:BYTERANGE="10@0"\n#EXTINF:1,\na.ts',drm:'#EXTM3U\n#EXT-X-KEY:METHOD=SAMPLE-AES,URI="key"\n#EXTINF:1,\na.ts',badIv:'#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key",IV=oops\n#EXTINF:1,\na.ts',nonHttp:'#EXTM3U\n#EXTINF:1,\nfile:///etc/passwd'}))test('rejects '+name,()=>assert.throws(()=>parseHls(body,base)));
