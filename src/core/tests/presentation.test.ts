import {test} from 'node:test';import assert from 'node:assert/strict';
import {formatDuration,formatSize,formatProgress} from '../../extension/ui/presentation';
test('display metadata uses padded durations and correct units for small files',()=>{
 assert.equal(formatDuration(61),'1:01');assert.equal(formatDuration(3601),'1:00:01');assert.equal(formatDuration(undefined),'时长未知');
 assert.equal(formatSize(0),'0 B');assert.equal(formatSize(32),'32 B');assert.equal(formatSize(1_500_000),'1.5 MB');
});
test('progress handles the first of 1771 segments and never rounds unfinished downloads up to 100%',()=>{
 assert.equal(formatProgress(100/1771),'<1%');assert.equal(formatProgress(0),'0%');
 assert.equal(formatProgress(42.5),'42%');assert.equal(formatProgress(99.99),'99%');
 assert.equal(formatProgress(100),'100%');assert.equal(formatProgress(undefined),'');
});
