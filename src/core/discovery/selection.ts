import type {MediaAsset, PlayerSelection} from '../model';
import {isBiliEndpoint} from '../sites/bilibili';
import {isYoutubeEndpoint} from '../sites/youtube';
import {isDouyinEndpoint} from '../sites/douyin';

// A player may have unrelated sources over its lifetime (ads, playlists, SPA navigation).
// Never reuse a binding from a previous MediaSource merely because the element is the same.
export function selectedAssets(assets: MediaAsset[], selection?: PlayerSelection): MediaAsset[] {
  if (!selection) return [];
  const bound=assets.filter(a=>a.playerBindings?.some(b=>b.playerId===selection.playerId && b.sourceKey===selection.sourceKey));
  const configured=bound.find(a=>(isBiliEndpoint(a.pageUrl,a.url)||isYoutubeEndpoint(a.pageUrl,a.url)||isDouyinEndpoint(a.pageUrl,a.url)));
  return configured?[configured]:bound;
}

export function playerKey(documentId: string | undefined, frameId: number | undefined, id: string): string {
  return `${documentId || 'frame-'+(frameId ?? 0)}:${id}`;
}
