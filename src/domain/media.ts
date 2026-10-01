export type Quality = { id: string; label: string; size: string; recommended?: boolean };
export type Media = {
  id: string;
  title: string;
  domain: string;
  duration: string;
  protocol: 'HLS' | 'MP4' | 'DASH';
  qualities: Quality[];
  playing: boolean;
  artwork: 'coast' | 'abstract';
  supported: boolean;
  note?: string;
};
export type Scene = 'found' | 'jable' | 'empty' | 'permission' | 'expired' | 'protected';
export const scenes: { id: Scene; label: string }[] = [
  { id: 'found', label: '发现视频' },
  { id: 'jable', label: '指定测试页' },
  { id: 'empty', label: '尚未发现' },
  { id: 'permission', label: '需要权限' },
  { id: 'expired', label: '链接失效' },
  { id: 'protected', label: '受保护视频' },
];
export const sceneHints: Record<Scene, string> = {
  found: '先找到你想要的视频，再选择清晰度。分片与重复请求收进一张卡片。',
  jable: '页面已观察到 HLS 主播放器和广告视频；这里仅复现信息结构，尚未验证真实下载。',
  empty: '空状态给出具体下一步：先播放几秒，再重新检测。',
  permission: '在需要访问当前站点时再请求授权，让权限范围容易理解。',
  expired: '下载失败保留任务与选择；重新获取链接后重试，明确说明是否从头开始。',
  protected: '在下载前说明能力边界，保留查看详情的入口。',
};
export function mediaForScene(scene: Scene): Media[] {
  if (scene === 'empty' || scene === 'permission') return [];
  if (scene === 'jable') return [{
    id: 'jable-primary', title: 'START-640 · 页面主视频', domain: 'jable.tv', duration: '2:27:18',
    protocol: 'HLS', playing: false, artwork: 'abstract', supported: true,
    qualities: [{ id: '720', label: '720p', size: '大小待解析', recommended: true }],
    note: '720p 是播放器当前画面分辨率；可下载规格仍待清单解析。',
  }];
  return [{
    id: scene === 'protected' ? 'protected' : scene === 'expired' ? 'coast-expired' : 'coast', title: scene === 'protected' ? '受保护的流媒体视频' : '海岸线 · 午后的慢镜头',
    domain: 'demo.local', duration: '08:42', protocol: 'HLS', playing: true, artwork: 'coast', supported: scene !== 'protected',
    qualities: [{ id: '1080', label: '1080p', size: '约 128 MB', recommended: true }, { id: '720', label: '720p', size: '约 72 MB' }, { id: '480', label: '480p', size: '约 38 MB' }],
  }];
}

export const secondaryMedia: Media = {
  id: 'studio-tour', title: '工作室漫游 · 光与空间', domain: 'demo.local', duration: '03:16',
  protocol: 'MP4', playing: false, artwork: 'abstract', supported: true,
  qualities: [{ id: '720', label: '720p', size: '约 24 MB', recommended: true }],
};
