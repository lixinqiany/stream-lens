import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filenameFor, transitionTask, type Task } from './task.ts';
const task: Task = { id: '1', mediaId: 'm', title: 'Video', filename: 'Video_720p.mp4', quality: '720p', status: 'downloading', progress: 30, failOnce: false, phaseTicks: 0, protocol: 'HLS' };
test('pause preserves progress and tick cannot advance a paused task', () => {
  const paused = transitionTask(task, { type: 'pause' });
  assert.equal(paused.status, 'paused');
  assert.equal(transitionTask(paused, { type: 'tick' }), paused);
  const resumed = transitionTask(paused, { type: 'resume' });
  assert.equal(resumed.progress, 30);
  assert.equal(transitionTask(resumed, { type: 'tick' }).progress, 33);
});
test('100% downloaded still needs merging and saving before completion', () => {
  let current = transitionTask({ ...task, progress: 99 }, { type: 'tick' });
  assert.equal(current.status, 'merging');
  assert.equal(current.progress, 100);
  for (let i = 0; i < 6; i++) current = transitionTask(current, { type: 'tick' });
  assert.equal(current.status, 'saving');
  for (let i = 0; i < 6; i++) current = transitionTask(current, { type: 'tick' });
  assert.equal(current.status, 'completed');
});
test('expired link fails once and retry explicitly restarts from zero', () => {
  const failed = transitionTask({ ...task, failOnce: true }, { type: 'tick' });
  assert.equal(failed.status, 'failed');
  assert.ok(failed.error);
  assert.equal(transitionTask(failed, { type: 'tick' }), failed);
  const retried = transitionTask(failed, { type: 'retry' });
  assert.equal(retried.status, 'resolving');
  assert.equal(retried.progress, 0);
  assert.equal(retried.failOnce, false);
  assert.equal(retried.error, undefined);
});
test('direct MP4 skips merging and proceeds to saving', () => {
  const current = transitionTask({ ...task, progress: 99, protocol: 'MP4' }, { type: 'tick' });
  assert.equal(current.status, 'saving');
});
test('cancelled and completed tasks cannot resume or mutate on ticks', () => {
  for (const status of ['cancelled', 'completed'] as const) {
    const ended = { ...task, status };
    assert.equal(transitionTask(ended, { type: 'tick' }), ended);
    assert.equal(transitionTask(ended, { type: 'resume' }), ended);
    assert.equal(transitionTask(ended, { type: 'cancel' }), ended);
  }
});
test('filename removes unsafe characters, strips trailing dots, and supplies fallback', () => {
  assert.equal(filenameFor('a/b:c?. ', '720p'), 'a_b_c__720p.mp4');
  assert.equal(filenameFor(' . ', '1080p'), 'video_1080p.mp4');
  assert.equal(filenameFor('中文标题', '720p'), '中文标题_720p.mp4');
});
