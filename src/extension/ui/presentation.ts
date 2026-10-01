import {activeStates,clearableStates,type DownloadRecord} from '../../core/model';
export type TaskFilter='all'|'active'|'failed'|'ended';
export const statusLabels:Record<DownloadRecord['state'],string>={resolving:'解析中',downloading:'下载中',paused:'已暂停',merging:'合并中',saving:'保存中',completed:'已完成',failed:'下载失败',cancelled:'已取消'};
export function formatProgress(value?:number){
  if(value===undefined||!Number.isFinite(value))return '';
  return value>0&&value<1?'<1%':Math.floor(Math.max(0,Math.min(100,value)))+'%';
}
export function formatSize(bytes?:number){
  if(bytes===undefined||bytes<0)return '大小未知';
  if(bytes<1000)return Math.round(bytes)+' B';
  return bytes>=1e9?(bytes/1e9).toFixed(2)+' GB':bytes>=1e6?(bytes/1e6).toFixed(1)+' MB':(bytes/1e3).toFixed(0)+' KB';
}
export function formatDuration(value?:number){
  if(!value||!Number.isFinite(value))return '时长未知';
  const seconds=Math.round(value),h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),s=seconds%60;
  return (h?h+':'+String(m).padStart(2,'0'):String(m))+':'+String(s).padStart(2,'0');
}
export function matchesFilter(task:DownloadRecord,filter:TaskFilter){return filter==='all'||(filter==='active'?activeStates.includes(task.state):filter==='failed'?task.state==='failed':clearableStates.includes(task.state));}
