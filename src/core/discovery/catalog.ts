import {t} from '../../i18n';
import { httpUrl, type MediaAsset, type VideoEvidence, type Protocol } from '../model.ts';
export function protocolFor(url: string, contentType = ''): Protocol | undefined {
  const path = new URL(url).pathname.toLowerCase();
  if (/\.m3u8$/.test(path) || /mpegurl/i.test(contentType)) return 'HLS';
  if (/\.mpd$/.test(path) || /dash\+xml/i.test(contentType)) return 'DASH';
  if (/\.webm$/.test(path) || /video\/webm/i.test(contentType)) return 'WEBM';
  if (/\.mp4$/.test(path) || /video\/mp4/i.test(contentType)) return 'MP4';
}
export function assetId(url: string): string {
  // Keep signed URLs exact. Hash is an identity hint, not an authorization token.
  let hash = 2166136261;
  for (const char of url) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return 'asset-' + (hash >>> 0).toString(36);
}
export function mergeEvidence(assets: MediaAsset[], evidence: VideoEvidence): MediaAsset[] {
  const url = httpUrl(evidence.url);
  if (!url) return assets;
  const protocol = protocolFor(url, evidence.contentType);
  if (!protocol) return assets;
  const existing = assets.find(a => a.url === url);
  const meaningfulDuration = Number.isFinite(evidence.duration) && (evidence.duration || 0) > 0 ? evidence.duration : undefined;
  const asset: MediaAsset = {
    ...existing, id: existing?.id || assetId(url), url, protocol: evidence.format === 'DASH' || existing?.protocol === 'DASH' ? 'DASH' : protocol,
    title: (existing?.primary && !evidence.primary ? existing.title : evidence.title || existing?.title || t("page_video")).slice(0, 300),
    pageUrl: httpUrl(evidence.pageUrl) || existing?.pageUrl || '',
    duration: meaningfulDuration ?? existing?.duration, width: evidence.width || existing?.width,
    height: evidence.height || existing?.height, playing: evidence.source === 'player' ? evidence.playing : existing?.playing || false,
    primary: existing?.primary || evidence.primary, protected: existing?.protected || evidence.protected,
    poster: httpUrl(evidence.poster) || existing?.poster, size: evidence.size || existing?.size,
    suspectedAd: !evidence.primary && !existing?.primary && (((meaningfulDuration ?? existing?.duration) !== undefined && (meaningfulDuration ?? existing?.duration)! <= 30) || ((evidence.width || existing?.width || 0) > 0 && (evidence.width || existing?.width || 0) < 480)),
    evidence: [...new Set([...(existing?.evidence || []), evidence.source])],
    playerBindings: evidence.playerId && evidence.sourceKey ? [...(existing?.playerBindings || []).filter(b=>b.playerId!==evidence.playerId), {playerId:evidence.playerId,sourceKey:evidence.sourceKey}] : existing?.playerBindings,
  };
  return [...assets.filter(a => a.url !== url), asset].sort((a,b) => score(b) - score(a)).slice(0, 100);
}
export function score(asset: MediaAsset) {
  return (asset.primary ? 100 : 0) + (asset.playing ? 10 : 0) + (asset.duration && asset.duration > 60 ? 10 : 0) + (asset.width || 0) / 1000 - (asset.suspectedAd ? 100 : 0);
}
