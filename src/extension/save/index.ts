import {t,watchLanguage,applyDocumentLanguage,localizeText} from '../../i18n';
import {forgetDestination,pickDestination,type SavePicker} from '../../platform/destination';
import type {Response,SaveCommand,SaveRequest,StartResult} from '../../platform/messages';
import './styles.css';
const requestId=new URL(location.href).searchParams.get('request')||'';
const choose=document.querySelector<HTMLButtonElement>('#choose')!;
const cancel=document.querySelector<HTMLButtonElement>('#cancel')!;
const status=document.querySelector<HTMLElement>('#status')!;
let request:SaveRequest|undefined,taskId:string|undefined,refreshing=false,busy=false;
let selected:{id:string;filename:string}|undefined;
function renderLanguage(){
  applyDocumentLanguage();document.title=t("save_title");
  const heading=document.querySelector('h1');if(heading)heading.textContent=t("save_location");
  cancel.textContent=t("cancel");choose.textContent=localizeText(choose.textContent||'')||t("choose_location_download");
  status.textContent=localizeText(status.textContent||'');
}
status.textContent=t("save_instructions");choose.textContent=t("choose_location_download");renderLanguage();watchLanguage(renderLanguage);
async function send<T>(message:SaveCommand):Promise<T>{
  const response=await chrome.runtime.sendMessage(message) as Response<T>;
  if(!response?.ok)throw new Error(response?.error||t("the_download_service_did_not_respond_182"));return response.value;
}
function setBusy(value:boolean){busy=value;choose.disabled=value;cancel.disabled=value;choose.setAttribute('aria-busy',String(value));}
async function started(result:StartResult){
  selected=undefined;
  if(result.duplicate||result.failed){window.close();return;}
  taskId=result.id;status.textContent=t("downloading_view_progress_in_the_sidebar");choose.hidden=true;cancel.hidden=true;
  // Keep an extension-origin document alive while an older Chrome temporary
  // File System Access grant is in use. Background task history stays visible.
  const current=await chrome.windows.getCurrent().catch(()=>({id:undefined}));
  if(current.id!==undefined)await chrome.windows.update(current.id,{state:'minimized'}).catch(()=>{});
  void checkTask();
}
void send<SaveRequest>({type:'SAVE_INFO',requestId}).then(async value=>{
  request=value;document.querySelector('#filename')!.textContent=value.filename;
  if(value.result){await started(value.result);return;}
  choose.disabled=false;choose.focus();
}).catch(error=>{status.textContent=localizeText(error.message);status.setAttribute('role','alert');});
async function dismiss(){
  if(busy||taskId)return;
  await send({type:'SAVE_CANCEL',requestId}).catch(()=>{});
  if(selected)await forgetDestination(selected.id).catch(()=>{});window.close();
}
cancel.addEventListener('click',()=>void dismiss());
document.addEventListener('keydown',event=>{if(event.key==='Escape')void dismiss();});
choose.addEventListener('click',async()=>{
  if(!request||busy||taskId)return;
  const picker=(window as unknown as {showSaveFilePicker?:SavePicker}).showSaveFilePicker;
  if(!picker){status.textContent=t("this_browser_does_not_support_choosing_a_save");status.setAttribute('role','alert');return;}
  setBusy(true);status.setAttribute('role','status');
  try{
    if(!selected){
      status.textContent=t("choose_a_filename_and_save_location");
      selected=await pickDestination(request.filename,picker.bind(window));
      if(!selected){status.textContent=t("selection_cancelled_the_download_has_not_started");choose.textContent=t("choose_location_download");choose.focus();return;}
      document.querySelector('#filename')!.textContent=selected.filename;
    }
    status.textContent=t("starting_download");
    const result=await send<StartResult>({type:'SAVE_COMMIT',requestId,destinationId:selected.id,filename:selected.filename});
    if(result.duplicate)await forgetDestination(selected.id).catch(()=>{});
    await started(result);
  }catch(error){
    // A lost response may already have launched the runner. Query the durable
    // request result before discarding the destination or asking for another one.
    let confirmed=false;
    try{
      const latest=await send<SaveRequest>({type:'SAVE_INFO',requestId});
      if(latest.result){await started(latest.result);return;}
      confirmed=true;
    }catch{/* Keep the selected handle and retry the same idempotent commit. */}
    if(confirmed&&selected){await forgetDestination(selected.id).catch(()=>{});selected=undefined;}
    status.textContent=error instanceof Error?localizeText(error.message):t("cannot_start_the_download");status.setAttribute('role','alert');
    choose.textContent=selected?t("retry"):t("choose_another_location");
  }finally{setBusy(false);if(!taskId&&!choose.hidden)choose.focus();}
});
async function checkTask(){
  if(!taskId||refreshing)return;refreshing=true;
  try{
    const response=await chrome.runtime.sendMessage({type:'SNAPSHOT',tabId:request?.tabId??-1}) as Response<import('../../core/model').Snapshot>;
    if(response.ok){const task=response.value.tasks.find(t=>t.id===taskId);if(!task||!['resolving','downloading','paused','merging','saving'].includes(task.state))window.close();}
  }catch{/* Service worker can restart; retry on the next update. */}finally{refreshing=false;}
}
chrome.storage.onChanged.addListener((_changes,area)=>{if(area==='local')void checkTask();});
setInterval(()=>void checkTask(),5000);
