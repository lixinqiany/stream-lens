import {forgetDestination,pickDestination,type SavePicker} from '../../platform/destination';
import type {Response,SaveCommand,SaveRequest,StartResult} from '../../platform/messages';
import './styles.css';
const requestId=new URL(location.href).searchParams.get('request')||'';
const choose=document.querySelector<HTMLButtonElement>('#choose')!;
const cancel=document.querySelector<HTMLButtonElement>('#cancel')!;
const status=document.querySelector<HTMLElement>('#status')!;
let request:SaveRequest|undefined,taskId:string|undefined,refreshing=false,busy=false;
let selected:{id:string;filename:string}|undefined;
async function send<T>(message:SaveCommand):Promise<T>{
  const response=await chrome.runtime.sendMessage(message) as Response<T>;
  if(!response?.ok)throw new Error(response?.error||'下载服务未响应');return response.value;
}
function setBusy(value:boolean){busy=value;choose.disabled=value;cancel.disabled=value;choose.setAttribute('aria-busy',String(value));}
async function started(result:StartResult){
  selected=undefined;
  if(result.duplicate||result.failed){window.close();return;}
  taskId=result.id;status.textContent='下载中，可在侧栏查看进度。';choose.hidden=true;cancel.hidden=true;
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
}).catch(error=>{status.textContent=error.message;status.setAttribute('role','alert');});
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
  if(!picker){status.textContent='当前浏览器不支持选择保存位置。';status.setAttribute('role','alert');return;}
  setBusy(true);status.setAttribute('role','status');
  try{
    if(!selected){
      status.textContent='请选择文件名和保存位置…';
      selected=await pickDestination(request.filename,picker.bind(window));
      if(!selected){status.textContent='已取消选择，下载尚未开始。';choose.textContent='选择位置并下载';choose.focus();return;}
      document.querySelector('#filename')!.textContent=selected.filename;
    }
    status.textContent='正在开始下载…';
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
    status.textContent=error instanceof Error?error.message:'无法开始下载';status.setAttribute('role','alert');
    choose.textContent=selected?'重试':'重新选择位置';
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
