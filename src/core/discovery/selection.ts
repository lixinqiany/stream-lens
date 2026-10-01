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

// Network tracks are evidence, not separate videos. Offer only resources tied
// to another player's most recently observed source, collapsed to one row.
export function otherPlayerAssets(assets:MediaAsset[],selection?:PlayerSelection):MediaAsset[]{
  const latest=new Map<string,{sourceKey:string;seenAt:number}>();
  for(const asset of assets)for(const b of asset.playerBindings||[]){
    if(b.playerId===selection?.playerId)continue;
    const old=latest.get(b.playerId);if(!old||(b.seenAt||0)>(old.seenAt||0))latest.set(b.playerId,{sourceKey:b.sourceKey,seenAt:b.seenAt||0});
  }
  const results:MediaAsset[]=[];
  for(const [playerId,binding]of latest){
    const bound=selectedAssets(assets,{playerId,sourceKey:binding.sourceKey,title:'',playing:false,selectedAt:0});
    const asset=bound[0];if(asset&&!results.some(a=>a.id===asset.id))results.push({...asset,playerBindings:asset.playerBindings?.filter(b=>b.playerId===playerId&&b.sourceKey===binding.sourceKey)});
  }
  return results;
}
