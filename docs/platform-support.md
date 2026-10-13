# Platform support / 平台支持

## v0.3.4 · yfsp.tv / 爱壹帆

验证日期：2026-10-13。实际操作用户已安装拾影的 Google Chrome，重新加载 v0.3.4 并刷新 [《美人余》01](https://www.yfsp.tv/play/uHcU4Clu390)。侧栏自动识别正片 47:40，播放器内快捷入口可正常选择清晰度；此前显示的一秒条目是网站的 `assets/javascript/empty2.mp4` 占位文件，现已过滤。通过实际侧栏启动正式 HLS 执行器，Chrome 默认下载目录完成 MP4 保存，任务显示 100%。

- 视频：H.264，864×362；音频：HE-AAC，48 kHz，双声道。原站菜单标注 576P，实际流的像素尺寸为 864×362，扩展按实际视频高度显示 362p。
- 文件：135,267,143 字节；容器时长 00:47:40.07。FFmpeg 使用原生 90 kHz 视频时基对完整音视频解码，退出码 0、错误输出为空。
- 额外打开第 02 集，侧栏正确显示独立的标题、46:07 时长及 362p 来源；未对第 02 集执行完整下载。
- 来源追踪：公开 Hls.js 的 `media` / `url` 与加载、附加、分离事件绑定真实视频元素；支持 Worker 转封装，不依赖 TS 与 MP4 字节指纹匹配，不将无关联的广告或网络清单绑定到正片。
- 切换播放清单、分离播放器或换集会使旧关联失效。离线测试涵盖 Hls.js 异步加载、两种调用顺序、签名地址保留、其他播放器隔离、占位视频过滤、重新检测和同 Blob 换集。
- 本次实机验证覆盖正常可播放的该集 HLS 点播及默认目录保存；其他作品、预选保存位置、权限受限内容与 DRM 不能由这一样本作全站保证。

v0.3.4 was tested in the user’s installed native Chrome extension. The complete normally playable HLS episode above was saved through the production runner and Chrome downloads. Worker playback provenance is linked through the public Hls.js media/url pair; the one-second placeholder is excluded. Actual dimensions are 864×362 despite the site’s 576P label. Full audio/video decoding with the original 90 kHz video timebase passed with exit code 0 and no errors. Episode 02 was also correctly identified as a separate 46:07 source, without a full download. Other works, preselected file handles, restricted content and DRM are outside this native test’s scope.

v0.3.1 adds YouTube and Douyin adapters and verifies ordinary Bilibili uploads. These are real network and media-engine tests. Chrome APIs and file handles use test adapters; media requests, MP4 processing, incremental disk writes and full FFmpeg decoding are real. No browser was operated. Native Chrome UI, cookies, DNR headers and file permissions have not been verified on a device.

v0.3.1 新增 YouTube、抖音适配，并确认 B 站普通投稿的完整下载。测试使用真实 HTTP 请求、正式执行器、磁盘增量写入和 FFmpeg 全文件解码；Chrome API、文件句柄通过测试适配器替代。未操控浏览器，原生界面、Cookie、DNR 请求头与保存权限仍需 Chrome 实机验证。

## Verified downloads / 成功样本

| Platform | Source | Download | Full decoding |
| --- | --- | --- | --- |
| YouTube | [jNQXAC9IVRw](https://www.youtube.com/watch?v=jNQXAC9IVRw) | H.264 240p + AAC → MP4; 19.06 s; 742,006 bytes | Video + audio, no errors |
| Bilibili | [BV1GJ411x7h7](https://www.bilibili.com/video/BV1GJ411x7h7) | H.264 480p + AAC → MP4; 3:32.31; 26,279,321 bytes | Video + audio, no errors |
| Douyin | [7677919026948967689](https://www.douyin.com/jingxuan?modal_id=7677919026948967689) | Official complete MP4; 21:18.51; 368,841,025 bytes | Video + audio, no errors |

测试日期：2026-10-01。抖音页面元数据标注 1275.496 秒，实际官方 MP4 容器为 1278.51 秒；原文件完整保存，未裁剪。媒体测试文件保存在被 Git 忽略的 `work/platform-tests/`，不随仓库或安装包发布。

Douyin page metadata reports 1275.496 seconds; its official MP4 container reports 1278.51 seconds. The complete original file is preserved. Downloaded test media stays in ignored `work/platform-tests/` and is not distributed.

## Behavior and limits / 行为与限制

- **YouTube:** watch, Shorts and short-link IDs share the same resolver. Only public, directly available indexed H.264/AAC streams are supported. Active live video, restricted playback, cipher-only tracks and DRM are rejected. Another test video, `aqz-KE-bpKQ`, returned valid initial bytes but its CDN rejected later ranges with HTTP 403; it did **not** complete. Route tests for Shorts pass, but a genuine Shorts work has not been fully downloaded in this run.
- **Douyin / 抖音:** selected `modal_id` or `/video/` work → official mobile share page → exact `aweme_id` → muxed MP4. The normal share session is established first. The original official playback address is preserved, including any watermark. Challenge pages or missing metadata fail clearly. Multi-player feeds require a matching work ID or a single visible player.
- **Bilibili:** ordinary BV uploads and existing bangumi `ep` / `ss` playback. H.264/AAC quality is limited to normal account and regional playback access. Retry of a BV multipart video keeps the requested `p` page.
- Since v0.3.2, a clear main player is selected automatically; manual selection takes priority over later autoplay. YouTube ad playback invalidates the main-video binding. Quality resolution is automatic; downloading still requires a click.
- Only the listed samples are confirmed complete. Site updates, account requirements and signed CDN URLs can affect other videos.

YouTube 并非全站保证可下载；额外长视频测试中途 403，未计为成功。Shorts 的路由与播放器绑定已做回归测试，本轮没有真实 Shorts 作品的整文件验证。各平台的登录、地区与 DRM 边界保持原站正常播放权限。

## Reproduce / 复测

Requires Node.js 24.15+, Python 3 and FFmpeg. This opt-in command accesses public websites and downloads the three test videos, about 400 MB in total. It is separate from offline CI. Set `STREAM_LENS_FFMPEG` if FFmpeg is not on PATH. Results and media are written under ignored `work/platform-tests/`; the HTTP cookie jar there is also private local test data.

需要 Node.js 24.15+、Python 3 与 FFmpeg。此可选命令会访问真实站点并下载约 400 MB 测试视频；离线 CI 不执行它。`STREAM_LENS_FFMPEG` 可指定 FFmpeg 路径。结果、媒体和测试 Cookie 均保存在忽略目录中。

```sh
npm run test:platforms            # all three platforms
npm run test:platforms -- douyin # one platform: youtube / bilibili / douyin
```

The production `allowedFetch` checks permissions, redirected hosts and exact byte ranges. The smoke test's HTTP bridge uses Python to honor local proxy configuration and supplies the same site headers intended by the extension. Native Chrome request behavior must be checked separately.
