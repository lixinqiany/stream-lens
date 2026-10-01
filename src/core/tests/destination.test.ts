import {test} from 'node:test';import assert from 'node:assert/strict';
import {destinationDatabase,destinationFile} from './support/destinations';
import {pickDestination,rememberDestination,checkDestination,writeDestination,forgetDestination} from '../../platform/destination';
const records=destinationDatabase();
test('save picker opens immediately in the click and cancellation records no destination',async()=>{
  let called=false;const promise=pickDestination('test.mp4',()=>{called=true;return Promise.reject(new DOMException('cancel','AbortError'));});
  assert.equal(called,true);assert.equal(await promise,undefined);assert.equal(records.size,0);
});
test('chosen filename and handle survive foreground closure; complete output commits atomically',async()=>{
  const file=destinationFile('renamed.mp4');const chosen=await pickDestination('test.mp4',async()=>file.handle);
  assert.equal(chosen?.filename,'renamed.mp4');assert.equal(await checkDestination(chosen!.id),file.handle);
  await writeDestination(chosen!.id,new Blob(['whole video']),new AbortController().signal);
  assert.equal(new TextDecoder().decode(file.bytes()),'whole video');await forgetDestination(chosen!.id);assert.equal(records.size,0);
});
test('revoked destination is rejected before any output, failed writes and cancellation cannot commit',async()=>{
  const file=destinationFile();const id=await rememberDestination(file.handle);file.fail();
  await assert.rejects(writeDestination(id,new Blob(['video']),new AbortController().signal),/disk full/);assert.equal(file.bytes(),undefined);
  file.deny();await assert.rejects(checkDestination(id),/重新授权/);assert.equal(file.bytes(),undefined);await forgetDestination(id);
  const next=destinationFile();const nextId=await rememberDestination(next.handle);const controller=new AbortController();controller.abort();
  await assert.rejects(writeDestination(nextId,new Blob(['video']),controller.signal),{name:'AbortError'});assert.equal(next.bytes(),undefined);await forgetDestination(nextId);
});
