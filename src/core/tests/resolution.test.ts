import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ResolutionCache} from '../discovery/resolution';

test('metadata calls share pending work, cache success and refresh on explicit force',async()=>{
 const cache=new ResolutionCache<number>();let count=0,release!:(v:number)=>void;
 const resolver=()=>{count++;return new Promise<number>(r=>{release=r;});};
 const one=cache.get('player-source',resolver),two=cache.get('player-source',resolver,true);
 await Promise.resolve();assert.equal(count,1);assert(cache.hasPending('player-source'));release(7);
 assert.deepEqual(await Promise.all([one,two]),[7,7]);assert(!cache.hasPending('player-source'));
 assert.equal(await cache.get('player-source',async()=>99),7);
 assert.equal(await cache.get('player-source',async()=>9,true),9);
 assert.equal(await cache.get('other-source',async()=>11),11);
});
test('metadata failures can be retried and bounded cache evicts old sources',async()=>{
 const cache=new ResolutionCache<number>(60_000,1);
 await assert.rejects(cache.get('a',async()=>{throw new Error('offline');}),/offline/);
 assert(!cache.hasPending('a'));assert.equal(await cache.get('a',async()=>1),1);
 await cache.get('b',async()=>2);assert.equal(await cache.get('a',async()=>3),3);
});
test('expired metadata is resolved again',async()=>{
 const cache=new ResolutionCache<number>(0);await cache.get('a',async()=>1);
 assert.equal(await cache.get('a',async()=>2),2);
});
