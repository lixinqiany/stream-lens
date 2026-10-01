import {test} from 'node:test';
import assert from 'node:assert/strict';
import {automaticOrigins,automaticAccessGranted,requestAccess} from '../../platform/access';
import {allowedFetch} from '../hls/fetch';
import {manifest} from '../../extension/manifest';
let broad=false,calls=0,approve=true;
Object.assign(globalThis,{chrome:{permissions:{
  request:({origins}:{origins:string[]})=>{calls++;assert.deepEqual(origins,automaticOrigins);broad=approve;return Promise.resolve(approve);},
  contains:async()=>broad,
}}});
test('install-time host permissions enable new CDNs without a runtime authorization request',async()=>{
 assert.deepEqual(manifest.host_permissions,automaticOrigins);
 assert(!('optional_host_permissions' in manifest));broad=true;
 assert(await automaticAccessGranted());const requests=calls;
 globalThis.fetch=async()=>new Response(new Uint8Array([1,2,3]));
 await allowedFetch('https://amuse-lefty.mushroomtrack.com/video');
 await allowedFetch('https://new-host.cdn.example/video');assert.equal(calls,requests);
});
test('restricted site access can be restored only from an explicit click',async()=>{
 let continued=false;const grant=requestAccess(automaticOrigins,async()=>{continued=true;});
 assert.equal(calls,1,'request must run before yielding the click gesture');await grant;
 assert(continued);assert(await automaticAccessGranted());
 let fetched=0;globalThis.fetch=async url=>{fetched++;const r=new Response(new Uint8Array([1,2,3]));Object.defineProperty(r,'url',{value:String(url).replace('amuse-lefty','rotated')});return r;};
 await allowedFetch('https://amuse-lefty.mushroomtrack.com/video');
 await allowedFetch('https://another.cdn.example/video');assert.equal(fetched,2);assert.equal(calls,1);
});
test('denied automatic access never continues or reads media and revoked access is respected',async()=>{
 approve=false;let continued=false;await assert.rejects(requestAccess(automaticOrigins,async()=>{continued=true;}),/未授予/);
 assert.equal(continued,false);assert.equal(await automaticAccessGranted(),false);
 let fetched=false;globalThis.fetch=async()=>{fetched=true;return new Response()};await assert.rejects(allowedFetch('https://amuse-lefty.mushroomtrack.com/video'),/需要允许/);assert.equal(fetched,false);
});
