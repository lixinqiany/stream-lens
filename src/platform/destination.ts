import {t} from '../i18n';
// File handles are structured cloned in extension-origin IndexedDB, never sent
// through Chrome's JSON messaging. Offscreen and the picker share this store.
export type DestinationHandle = FileSystemFileHandle & {queryPermission(options:{mode:'readwrite'}):Promise<PermissionState>};
function database():Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('stream-lens-destinations',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('files');
    request.onblocked=()=>reject(new Error(t("save_location_storage_is_updating_close_older_save")));
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
}
async function operation<T>(mode:IDBTransactionMode,run:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T> {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('files',mode);const request=run(tx.objectStore('files'));
    tx.oncomplete=()=>{db.close();resolve(request.result);};
    tx.onabort=tx.onerror=()=>{db.close();reject(tx.error||request.error||new Error(t("cannot_store_the_save_location")));};
  });
}
export async function rememberDestination(handle:DestinationHandle):Promise<string> {
  const id=crypto.randomUUID();await operation('readwrite',store=>store.put(handle,id));return id;
}
export async function forgetDestination(id:string) {await operation('readwrite',store=>store.delete(id));}
export async function getDestination(id:string):Promise<DestinationHandle> {
  const handle=await operation<DestinationHandle|undefined>('readonly',store=>store.get(id));
  if(!handle)throw new Error(t("save_location_is_no_longer_available_choose_it"));return handle;
}
export async function checkDestination(id:string) {
  const handle=await getDestination(id);
  if(await handle.queryPermission({mode:'readwrite'})!=='granted')throw new Error(t("save_location_needs_permission_again_choose_it_again"));
  return handle;
}
export type SavePicker = (options:{suggestedName:string;types:{description:string;accept:Record<string,string[]>}[]})=>Promise<DestinationHandle>;
export async function pickDestination(filename:string,picker:SavePicker):Promise<{id:string;filename:string}|undefined> {
  try {
    // Invoke before the first await to preserve the button's user activation.
    const handle=await picker({suggestedName:filename,types:[{description:t("video_file"),accept:filename.toLowerCase().endsWith('.webm')?{'video/webm':['.webm']}:{'video/mp4':['.mp4']}}]});
    if(await handle.queryPermission({mode:'readwrite'})!=='granted')throw new Error(t("cannot_write_to_the_selected_location"));
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
export type DestinationWriter={write(data:Uint8Array<ArrayBuffer>):Promise<void>;close():Promise<void>;abort():Promise<void>};
export async function openDestination(id:string):Promise<DestinationWriter> {
  const handle=await checkDestination(id);
  // File System Access writes to disk with an atomic close. Keep the stream
  // open across network pauses; only cancel/failure should discard its staging.
  const stream=await handle.createWritable();const writer=stream.getWriter();let ended=false;let abortResult:Promise<void>|undefined;
  return {
    write:data=>writer.write(data),
    async close(){try{await writer.close();ended=true;}finally{if(ended)writer.releaseLock();}},
    abort(){if(abortResult)return abortResult;if(ended)return Promise.resolve();ended=true;return abortResult=writer.abort().finally(()=>writer.releaseLock());},
  };
}
