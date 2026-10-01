import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renewedHlsUrl,sameHlsTimeline} from '../hls/refresh';
import {parseHls} from '../hls/parser';
test('renew a signed media URL from literal configuration without binding unrelated videos',()=>{
 const old='https://old.example/hls/expired/1/62000/62298/62298.m3u8';
 const fresh='https://new.example/hls/fresh/2/62000/62298/62298.m3u8';
 assert.equal(renewedHlsUrl(`<script>var hlsUrl="${fresh}";var ad="https://ads.example/a/live/index.m3u8";</script>`,old),fresh);
 assert.throws(()=>renewedHlsUrl(`<script>var hlsUrl="${old}";</script>`,old),/原来的失效/);
 assert.throws(()=>renewedHlsUrl('<html>Cloudflare</html>',old),/无法从来源网页/);
 assert.throws(()=>renewedHlsUrl(`${fresh} ${fresh.replace('new.example','another.example')}`,old),/无法从来源网页/);
});
test('renewal can resume only an identical VOD timeline and encryption layout',()=>{
 const text='#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key",IV=0x1\n#EXTINF:4,\na.ts\n#EXTINF:5,\nb.ts\n#EXT-X-ENDLIST';
 const old=parseHls(text,'https://old.example/hls/old/v.m3u8'),next=parseHls(text,'https://new.example/hls/new/v.m3u8');
 assert(sameHlsTimeline(old,next));
 assert(!sameHlsTimeline(old,parseHls(text.replace('#EXTINF:5','#EXTINF:6'),'https://new.example/v.m3u8')));
 assert(!sameHlsTimeline(old,parseHls(text.replace('IV=0x1','IV=0x2'),'https://new.example/v.m3u8')));
 assert(!sameHlsTimeline(old,parseHls(text.replace('#EXT-X-ENDLIST',''),'https://new.example/v.m3u8')));
});
