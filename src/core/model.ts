export type Protocol = 'HLS' | 'MP4' | 'WEBM' | 'DASH';
import type {DashSource} from './dash/mp4';
export type Variant = { id: string; url: string; label: string; height?: number; bandwidth?: number; codecs?: string; audioGroup?: string; dash?:DashSource };
export type VideoEvidence = { url?: string; playerId?: string; sourceKey?: string; format?: 'DASH'; title: string; pageUrl: string; poster?: string; width: number; height: number; duration?: number; playing: boolean; primary: boolean; protected: boolean; source: 'player' | 'network' | 'script'; contentType?: string; size?: number };
export type PlayerSelection = { playerId: string; sourceKey: string; title: string; playing: boolean; selectedAt: number };
export type MediaAsset = {
  id: string; url: string; title: string; pageUrl: string; protocol: Protocol;
  duration?: number; width?: number; height?: number; playing: boolean; primary: boolean;
  suspectedAd: boolean; protected: boolean; poster?: string; size?: number;
  variants?: Variant[]; resolutionError?: string; resolutionState?:'loading'|'ready'|'failed'; resolutionOrigins?:string[]; resolvedAt?:number; evidence: VideoEvidence['source'][];
  playerBindings?: {playerId: string; sourceKey: string}[];
};
export type DownloadState = 'resolving' | 'downloading' | 'paused' | 'merging' | 'saving' | 'completed' | 'failed' | 'cancelled';
export type DownloadRecord = {
  id: string; assetId: string; title: string; filename: string; pageUrl: string; url: string;
  protocol: Protocol; quality: string; state: DownloadState;
  createdAt: number; updatedAt: number; bytes: number; totalBytes?: number;
  segments: number; totalSegments?: number; speed: number; downloadId?: number;
  error?: string; neededOrigins?: string[]; outputUrl?: string;
  dash?:DashSource;
  resolutionUrl?:string;
  destinationId?:string;
};
export type Preferences = { quality: 'best' | '720' | '480'; editFilename: boolean; hideAds: boolean; theme: 'dark' | 'light'; saveAs: boolean };
export const defaults: Preferences = { quality: 'best', editFilename: false, hideAds: true, theme: 'dark', saveAs: true };
export type PageCatalog = { pageUrl: string; assets: MediaAsset[]; documentKey: string; updatedAt: number; selection?: PlayerSelection; shortcutError?: {message: string; origins: string[]} };
export type PendingSave = {id:string;filename:string;pageUrl:string;retryId?:string};
export type Snapshot = { page: PageCatalog | null; tasks: DownloadRecord[]; preferences: Preferences; pendingSaves?:PendingSave[] };
export const runningStates: DownloadState[] = ['resolving', 'downloading', 'merging', 'saving'];
export const activeStates: DownloadState[] = [...runningStates, 'paused'];
export const clearableStates: DownloadState[] = ['completed', 'cancelled'];
export function httpUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 16000) return;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined; } catch { return; }
}
// Chrome match patterns cover all ports and do not accept an explicit port.
export function originPattern(url: string) { const value=new URL(url);return value.protocol+'//'+value.hostname+'/*'; }
export function safeFilename(title: string, quality: string, extension: string): string {
  const name = title.replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_').replace(/^[. ]+|[. ]+$/g, '').slice(0, 110) || 'video';
  return `${name}${quality === '原始文件' ? '' : '_' + quality}.${extension}`;
}
export function taskProgress(task: DownloadRecord): number | undefined {
  if (task.state === 'completed') return 100;
  if (task.totalBytes && task.totalBytes > 0) return Math.min(100, task.bytes / task.totalBytes * 100);
  if (['HLS','DASH'].includes(task.protocol) && task.totalSegments) return Math.min(100, task.segments / task.totalSegments * 100);
}
