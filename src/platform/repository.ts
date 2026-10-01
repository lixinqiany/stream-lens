import { defaults, type DownloadRecord, type PageCatalog, type Preferences } from '../core/model';
import {setLanguage} from '../i18n';
// Serial writes prevent interleaving download events from overwriting newer task state.
let queue=Promise.resolve();
export function mutateTasks<T>(fn:(tasks:DownloadRecord[])=>{tasks:DownloadRecord[];value:T}):Promise<T> {
  const operation=queue.then(async()=>{const stored=await chrome.storage.local.get('tasks');const result=fn(stored.tasks||[]);await chrome.storage.local.set({tasks:result.tasks});return result.value;});
  queue=operation.then(()=>{},()=>{});return operation;
}
export async function getTasks():Promise<DownloadRecord[]> {await queue;return (await chrome.storage.local.get('tasks')).tasks||[];}
export async function patchTask(id:string,patch:Partial<DownloadRecord>) {
  return mutateTasks(tasks=>({tasks:tasks.map(task=>task.id===id?{...task,...patch,id:task.id,updatedAt:Date.now()}:task),value:undefined}));
}
export async function getPreferences():Promise<Preferences> {const prefs={...defaults,...(await chrome.storage.local.get('preferences')).preferences};setLanguage(prefs.language);return prefs;}
export async function upgradeSavePreferences(previousVersion?:string) {
  if(!previousVersion)return;
  const [major,minor,patch]=previousVersion.split('.').map(Number);
  if(major===0&&(minor<2||(minor===2&&patch<9)))await chrome.storage.local.set({preferences:{...await getPreferences(),saveAs:true}});
}
export async function getPage(tabId:number):Promise<PageCatalog|null> {return (await chrome.storage.session.get('page:'+tabId))['page:'+tabId]||null;}
export async function setPage(tabId:number,page:PageCatalog) {await chrome.storage.session.set({['page:'+tabId]:page});}
