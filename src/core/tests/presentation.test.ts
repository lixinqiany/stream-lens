import {test} from 'node:test';import assert from 'node:assert/strict';
import {formatDuration,formatSize} from '../../extension/ui/presentation';
test('display metadata uses padded durations and correct units for small files',()=>{
 assert.equal(formatDuration(61),'1:01');assert.equal(formatDuration(3601),'1:00:01');assert.equal(formatDuration(undefined),'时长未知');
 assert.equal(formatSize(0),'0 B');assert.equal(formatSize(32),'32 B');assert.equal(formatSize(1_500_000),'1.5 MB');
});
