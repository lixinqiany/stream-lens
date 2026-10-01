import {t} from '../../i18n';
import {activeStates,clearableStates,type DownloadRecord} from '../../core/model';
export type TaskFilter='all'|'active'|'failed'|'ended';
export function statusLabel(state:DownloadRecord['state']){return t({resolving:'resolving',downloading:'downloading',paused:'paused',merging:'merging',saving:'saving',completed:'completed',failed:'download_failed',cancelled:'cancelled'}[state] as import('../../i18n/messages').MessageKey);}
export function formatProgress(value?:number){
  if(value===undefined||!Number.isFinite(value))return '';
  return value>0&&value<1?'<1%':Math.floor(Math.max(0,Math.min(100,value)))+'%';
}
export function formatSize(bytes?:number){
  if(bytes===undefined||bytes<0)return t("size_unknown");
  if(bytes<1000)return Math.round(bytes)+' B';
  return bytes>=1e9?(bytes/1e9).toFixed(2)+' GB':bytes>=1e6?(bytes/1e6).toFixed(1)+' MB':(bytes/1e3).toFixed(0)+' KB';
}
export function formatDuration(value?:number){
  if(!value||!Number.isFinite(value))return t("duration_unknown");
  const seconds=Math.round(value),h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),s=seconds%60;
  return (h?h+':'+String(m).padStart(2,'0'):String(m))+':'+String(s).padStart(2,'0');
}
export function matchesFilter(task:DownloadRecord,filter:TaskFilter){return filter==='all'||(filter==='active'?activeStates.includes(task.state):filter==='failed'?task.state==='failed':clearableStates.includes(task.state));}
