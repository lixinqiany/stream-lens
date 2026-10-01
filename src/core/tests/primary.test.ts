import {test} from 'node:test';
import assert from 'node:assert/strict';
import {primaryPlayer,type PlayerCandidate} from '../discovery/primary';
const candidate=(player:string,extra:Partial<PlayerCandidate<string>>={})=>({player,visible:true,ready:true,playing:true,main:false,ad:false,area:640*360,...extra});
test('a ready main player is selected without a gesture even when paused, ignoring ads and recommendations',()=>{
 assert.equal(primaryPlayer([candidate('ad',{ad:true,area:1_000_000}),candidate('main',{main:true,playing:false}),candidate('recommendation')]),'main');
 assert.equal(primaryPlayer([candidate('not-ready',{main:true,ready:false}),candidate('hidden',{visible:false}),candidate('ad',{ad:true})]),undefined);
});
test('generic playback requires a single or clearly dominant visible player; comparable feeds stay unselected',()=>{
 assert.equal(primaryPlayer([candidate('one')]),'one');assert.equal(primaryPlayer([candidate('paused',{playing:false})]),undefined);
 assert.equal(primaryPlayer([candidate('big',{area:1_000_000}),candidate('tiny',{area:10000})]),'big');
 assert.equal(primaryPlayer([candidate('one'),candidate('two')]),undefined);assert.equal(primaryPlayer([candidate('one',{main:true}),candidate('two',{main:true})]),undefined);
});
