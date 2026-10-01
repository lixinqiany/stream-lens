import {t} from '../i18n';
import type { DownloadRecord, MediaAsset, PlayerSelection, Preferences, Snapshot, VideoEvidence } from '../core/model';
export type UiCommand =
  | { type: 'SNAPSHOT'; tabId: number }
  | { type: 'SCAN'; tabId: number; retryPermissions?:boolean }
  | { type:'SELECT_PLAYER';tabId:number;assetId:string;playerId:string;sourceKey:string }
  | { type: 'RESOLVE'; tabId: number; assetId: string }
  | { type: 'START'; tabId: number; assetId: string; variantId?: string; filename?: string }
  | { type: 'TASK'; id: string; action: 'pause'|'resume'|'cancel'|'retry'|'show'|'source' }
  | { type: 'CLEAR' }
  | { type:'SAVE_FOCUS'|'SAVE_CANCEL';requestId:string }
  | { type: 'PREFERENCES'; patch: Partial<Preferences> }
  | { type: 'SYNC_HOSTS' };
export type SaveCommand = {type:'SAVE_INFO';requestId:string} | {type:'SAVE_COMMIT';requestId:string;destinationId:string;filename:string} | {type:'SAVE_CANCEL';requestId:string} | {type:'SAVE_FOCUS';requestId:string};
export type SaveRequest = {tabId:number;assetId:string;variantId?:string;name?:string;filename:string;pageUrl:string;expectedPlayer?:{id:string;source:string};retryId?:string;createdAt:number;windowId?:number;result?:StartResult};
export type ContentMessage = {type:'EVIDENCE';pageUrl:string;evidence:VideoEvidence[];player?: PlayerSelection;select?: boolean};
export type PlayerCommand = {type:'PLAYER_PANEL'; playerId:string} | {type:'PLAYER_RESOLVE';playerId:string} | {type:'PLAYER_START';playerId:string;assetId:string;variantId:string;filename?:string};
export type PlayerResolveResult = {asset: MediaAsset; preferences: Preferences};
export type RunnerMessage = { target:'runner';type:'RUN';task:DownloadRecord;language?:Preferences['language'] } | {target:'runner';type:'LANGUAGE';language?:Preferences['language']} | {target:'runner';type:'CONTROL';id:string;action:'pause'|'resume'|'cancel'} | {target:'runner';type:'PING'} | {target:'runner';type:'RELEASE';id:string};
export type WorkerMessage = {type:'PROGRESS';task:Partial<DownloadRecord>&{id:string}} | {type:'OUTPUT';id:string;url:string} | {type:'SAVED';id:string};
export type Response<T> = {ok:true;value:T}|{ok:false;error:string;origins?:string[]};
export async function command<T=Snapshot>(message:UiCommand):Promise<T> {
  const response=await chrome.runtime.sendMessage(message) as Response<T>;
  if(!response?.ok) throw new Error(response?.error||t("connection_failed_reopen_the_extension"));
  return response.value;
}
export type StartResult = {id:string;duplicate:boolean;pending?:boolean;failed?:boolean};
export type ResolveResult = MediaAsset;
