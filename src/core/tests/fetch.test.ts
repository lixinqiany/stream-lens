import {test} from 'node:test';import assert from 'node:assert/strict';import {allowedFetch,PermissionError,ResourceAccessError} from '../hls/fetch';
let permitted=true;Object.assign(globalThis,{chrome:{permissions:{contains:async({origins}:any)=>permitted&&!origins.includes('https://other.example/*')}}});
test('host permission is checked before media network access',async()=>{permitted=false;let fetched=false;globalThis.fetch=async()=>{fetched=true;return new Response();};await assert.rejects(allowedFetch('https://cdn.example/seg'),PermissionError);assert.equal(fetched,false);permitted=true;});
test('exact range verifies 206, Content-Range and payload length',async()=>{
 globalThis.fetch=async(_url,options)=>{assert.equal((options?.headers as any).Range,'bytes=5-7');return new Response(new Uint8Array([1,2,3]),{status:206,headers:{'content-range':'bytes 5-7/30'}});};assert.deepEqual([...(await allowedFetch('https://cdn.example/seg',{range:{offset:5,length:3}})).data],[1,2,3]);
 globalThis.fetch=async()=>new Response(new Uint8Array([1,2,3]),{status:206,headers:{'content-range':'bytes 0-2/30'}});await assert.rejects(allowedFetch('https://cdn.example/seg',{range:{offset:5,length:3}}),/错误/);
 globalThis.fetch=async()=>new Response(new Uint8Array([1,2,3]));await assert.rejects(allowedFetch('https://cdn.example/seg',{range:{offset:5,length:3}}),/分段读取/);
});
test('streaming limit enforces actual bytes even without Content-Length',async()=>{globalThis.fetch=async()=>new Response(new Uint8Array(10));await assert.rejects(allowedFetch('https://cdn.example/seg',{limit:5}),/处理限制/);});
test('redirected CDN must be authorized before response consumption',async()=>{globalThis.fetch=async()=>{const response=new Response(new Uint8Array([1,2,3]));Object.defineProperty(response,'url',{value:'https://other.example/seg'});return response;};await assert.rejects(allowedFetch('https://cdn.example/seg'),(error:any)=>error instanceof PermissionError&&error.origins[0]==='https://other.example/*');});
test('server rejection reports status and host without leaking signed URL credentials',async()=>{
 globalThis.fetch=async()=>new Response('denied',{status:403});
 await assert.rejects(allowedFetch('https://cdn.example/seg?token=secret'),(e:any)=>e instanceof ResourceAccessError&&e.status===403&&e.message.includes('cdn.example')&&!e.message.includes('secret'));
});
