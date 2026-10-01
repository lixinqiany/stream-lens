// The browser's IDB structured clone supports native FileSystemFileHandle.
// This adapter retains mocked handle methods for runner and background tests.
export function destinationDatabase() {
  const records=new Map<string,FileSystemFileHandle>();
  const db={close(){},transaction(){
    const tx:any={error:null,objectStore:()=>({
      get:(key:string)=>request(()=>records.get(key)),
      put:(value:FileSystemFileHandle,key:string)=>request(()=>{records.set(key,value);return key;}),
      delete:(key:string)=>request(()=>{records.delete(key);}),
    })};
    function request(run:()=>unknown){const req:any={error:null};queueMicrotask(()=>{req.result=run();tx.oncomplete?.();});return req;}
    return tx;
  }};
  Object.assign(globalThis,{indexedDB:{open:()=>{const req:any={result:db,error:null};queueMicrotask(()=>req.onsuccess?.());return req;}}});
  return records;
}
export function destinationFile(name='chosen.mp4') {
  let committed:Uint8Array|undefined,allowed=true,fail=false,opens=0,aborts=0,staged=0;
  const handle={name,kind:'file',isSameEntry:async(other:unknown)=>other===handle,queryPermission:async()=>allowed?'granted':'prompt',
    getFile:async()=>new Blob([(committed||new Uint8Array()) as Uint8Array<ArrayBuffer>]),
    createWritable:async()=>{
      opens++;staged=0;
      const chunks:Uint8Array[]=[];
      return new WritableStream<Uint8Array>({write(value){if(fail)throw new Error('disk full');chunks.push(value.slice());staged+=value.byteLength;},close(){committed=new Uint8Array(Buffer.concat(chunks));},abort(){aborts++;staged=0;chunks.length=0;}});
    }};
  return {handle:handle as unknown as import('../../../platform/destination').DestinationHandle,
    bytes:()=>committed,stats:()=>({opens,aborts,staged}),seed:(bytes:Uint8Array)=>{committed=bytes.slice();},deny:()=>{allowed=false;},fail:()=>{fail=true;}};
}
