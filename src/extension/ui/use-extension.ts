import {t} from '../../i18n';
import { useCallback, useEffect, useRef, useState } from 'react';
import { defaults, httpUrl, originPattern, type Snapshot } from '../../core/model';
import type { Response, UiCommand } from '../../platform/messages';
import {automaticAccessGranted,requestAccess} from '../../platform/access';
const empty:Snapshot={page:null,tasks:[],preferences:defaults};
export function useExtension() {
  const [snapshot,setSnapshot]=useState<Snapshot>(empty);
  const [tab,setTab]=useState<chrome.tabs.Tab>();
  const [authorized,setAuthorized]=useState(false);
  const [automaticAccess,setAutomaticAccessState]=useState(false);
  const [error,setError]=useState('');
  const [pendingOrigins,setPendingOrigins]=useState<string[]>([]);
  const [ready,setReady]=useState(false);
  const generation=useRef(0);
  const scanned=useRef('');
  const refresh=useCallback(async()=>{
    const current=++generation.current;
    try {
      const [active]=await chrome.tabs.query({active:true,currentWindow:true});
      const granted=!!httpUrl(active?.url)&&await chrome.permissions.contains({origins:[originPattern(active!.url!)]});
      const automatic=await automaticAccessGranted();
      const response=await chrome.runtime.sendMessage({type:'SNAPSHOT',tabId:active?.id??-1}) as Response<Snapshot>;
      if(current!==generation.current)return;
      setTab(active);setAuthorized(granted);setAutomaticAccessState(automatic);
      if(response?.ok)setSnapshot(response.value);else setError(response?.error||t("cannot_read_download_records"));
      setReady(true);
      const key=active?.id+':'+active?.url;
      if(granted&&active?.id!==undefined&&scanned.current!==key){scanned.current=key;void chrome.runtime.sendMessage({type:'SCAN',tabId:active.id}).catch(()=>{});}
    }catch(e){if(current===generation.current)setError(e instanceof Error?e.message:t("connection_failed"));}
  },[]);
  useEffect(()=>{
    void refresh();
    const storage=(changes:Record<string,chrome.storage.StorageChange>,area:string)=>{if(area==='local'||area==='session')void refresh();};
    const activated=()=>void refresh();
    const updated=(_id:number,change:chrome.tabs.TabChangeInfo)=>{if(change.url||change.status==='complete')void refresh();};
    chrome.storage.onChanged.addListener(storage);chrome.tabs.onActivated.addListener(activated);chrome.tabs.onUpdated.addListener(updated);chrome.permissions.onAdded.addListener(activated);chrome.permissions.onRemoved.addListener(activated);
    const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh();},2000);
    return()=>{generation.current++;clearInterval(timer);chrome.storage.onChanged.removeListener(storage);chrome.tabs.onActivated.removeListener(activated);chrome.tabs.onUpdated.removeListener(updated);chrome.permissions.onAdded.removeListener(activated);chrome.permissions.onRemoved.removeListener(activated);};
  },[refresh]);
  const send=useCallback(async<T=unknown>(message:UiCommand):Promise<T>=>{
    const response=await chrome.runtime.sendMessage(message) as Response<T>;
    if(!response?.ok){setPendingOrigins(response?.origins||[]);throw Object.assign(new Error(response?.error||t("operation_failed")),{origins:response?.origins||[]});}
    await refresh();return response.value;
  },[refresh]);
  async function grant(origins?:string[]) {
    const requested=origins?.length?origins:tab?.url&&httpUrl(tab.url)?[originPattern(tab.url)]:[];
    if(!requested.length)throw new Error(t("open_a_website_first"));
    await requestAccess(requested,async()=>{
      setPendingOrigins([]);setError('');await send({type:'SYNC_HOSTS'});
      if(tab?.id!==undefined&&httpUrl(tab.url)&&await chrome.permissions.contains({origins:[originPattern(tab.url!)]}))await send({type:'SCAN',tabId:tab.id,retryPermissions:true});
    });
  }
  return{snapshot,tab,authorized,automaticAccess,ready,error,setError,pendingOrigins,setPendingOrigins,refresh,send,grant};
}
