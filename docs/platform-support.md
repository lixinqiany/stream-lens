# Platform support / 平台支持

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
- Selection is initiated by user interaction. Autoplay cannot change the selected target. YouTube ad playback invalidates the main-video binding. Quality resolution is automatic; downloading still requires a click.
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
