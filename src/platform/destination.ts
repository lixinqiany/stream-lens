// File handles are structured cloned in extension-origin IndexedDB, never sent
// through Chrome's JSON messaging. Offscreen and the picker share this store.
export type DestinationHandle = FileSystemFileHandle & {queryPermission(options:{mode:'readwrite'}):Promise<PermissionState>};
function database():Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('stream-lens-destinations',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('files');
    request.onblocked=()=>reject(new Error('保存位置存储正在更新，请关闭旧保存窗口后重试'));
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
}
async function operation<T>(mode:IDBTransactionMode,run:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T> {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('files',mode);const request=run(tx.objectStore('files'));
    tx.oncomplete=()=>{db.close();resolve(request.result);};
    tx.onabort=tx.onerror=()=>{db.close();reject(tx.error||request.error||new Error('无法记录保存位置'));};
  });
}
export async function rememberDestination(handle:DestinationHandle):Promise<string> {
  const id=crypto.randomUUID();await operation('readwrite',store=>store.put(handle,id));return id;
}
export async function forgetDestination(id:string) {await operation('readwrite',store=>store.delete(id));}
export async function getDestination(id:string):Promise<DestinationHandle> {
  const handle=await operation<DestinationHandle|undefined>('readonly',store=>store.get(id));
  if(!handle)throw new Error('保存位置已失效，请重新选择');return handle;
}
export async function checkDestination(id:string) {
  const handle=await getDestination(id);
  if(await handle.queryPermission({mode:'readwrite'})!=='granted')throw new Error('保存位置需重新授权，请重新选择');
  return handle;
}
export type SavePicker = (options:{suggestedName:string;types:{description:string;accept:Record<string,string[]>}[]})=>Promise<DestinationHandle>;
export async function pickDestination(filename:string,picker:SavePicker):Promise<{id:string;filename:string}|undefined> {
  try {
    // Invoke before the first await to preserve the button's user activation.
    const handle=await picker({suggestedName:filename,types:[{description:'视频文件',accept:filename.toLowerCase().endsWith('.webm')?{'video/webm':['.webm']}:{'video/mp4':['.mp4']}}]});
    if(await handle.queryPermission({mode:'readwrite'})!=='granted')throw new Error('无法写入所选位置');
    return {id:await rememberDestination(handle),filename:handle.name};
  }catch(error){if(error instanceof DOMException&&error.name==='AbortError')return;throw error;}
}
export async function writeDestination(id:string,file:Blob,signal:AbortSignal) {
  const handle=await checkDestination(id);signal.throwIfAborted();
  const writer=await handle.createWritable();
  try {
    await file.stream().pipeTo(writer,{signal});
  }catch(error){await writer.abort().catch(()=>{});throw error;}
}
