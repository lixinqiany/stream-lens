# Media compatibility / 媒体兼容性

## 格式与播放方式

| 视频格式 / 播放方式 | 下载方式与条件 |
| --- | --- |
| MP4 / WebM 直链 | 保存原文件；资源地址必须可正常访问 |
| HLS 点播 · TS H.264 / AAC | 转封装为 MP4，不重新编码 |
| HLS 点播 · fMP4 H.264 / AAC | 初始化信息一致的分片保存为 MP4 |
| HLS AES-128 identity | 普通 AES-CBC 分片解密 |
| HLS 点播 · 已支持的 Worker 播放器 | 通过播放器公开接口关联实际播放来源 |
| 已适配播放器 · H.264 + AAC DASH | 使用可获取的初始化和分段索引，合并音视频为 MP4 |

同一格式在不同播放器中的来源识别、权限与网络条件可能不同。通用 DASH、独立 HLS 音轨、直播、时间线切换和 DRM / SAMPLE-AES 不在当前支持范围内。试看内容不提供完整下载。

## 验证范围

- 离线自动化测试使用人工生成的媒体样本，覆盖 HLS / DASH 解析、AES-128、音视频转封装、增量写盘、权限拒绝、暂停恢复、取消清理和错误重试。
- Chrome API 适配器与 jsdom 验证后台消息、播放器选择、来源切换、侧栏操作和保存恢复。模拟测试不能替代浏览器原生行为。
- 已进行实际 Chrome 中的 HLS 来源识别、默认目录保存和输出音视频完整性检查；这些检查不构成对所有网页、画质或保存方式的保证。
- 历史网络测试保留成功与失败的边界；中途被服务器拒绝的任务不计为成功。公开文档不列具体站点、作品或视频链接。
- 下载媒体、Cookie、带签名的资源地址和本机测试结果不随仓库或安装包发布。详细技术记录见 [验证记录](validation.md)。

## 处理与恢复边界

同时最多两个流式任务，单文件最多 8 GB。画质和资源可用性取决于正常播放权限、编码、链接有效期和服务器响应。原文件已有的水印保持不变。

用户选择的播放器与当前来源必须明确关联。广告、预加载资源与占位视频不会被猜测绑定到主播放器；来源变化后旧关联失效。自动解析不会自动启动下载。

HLS / DASH 暂停保留已写入分片；取消等待清理完成。浏览器重启会中断流式任务，重试从头开始。默认目录的直链续传取决于服务器；预选位置的直链恢复会重新读取。

## 本地检查

```sh
npm test
npm run test:ui
npm run build:extension
```

离线检查不访问外部视频页面。浏览器验收应使用有权保存的测试媒体，分别检查内容脚本、扩展权限、原生保存窗口和最终文件。媒体请求会校验站点权限、重定向目标和字节范围。

## English

Support is described by media format and player integration rather than by named services or works. Direct MP4 / WebM, compatible HLS VOD, AES-128 identity and adapted H.264/AAC DASH players are supported within the conditions above. Format support does not guarantee that every webpage or quality option is downloadable.

Offline tests use generated media and cover parsing, merging, incremental writes, permissions and task recovery. Chrome API adapters and jsdom do not replace native browser verification. Native HLS detection, default-folder saving and output integrity have been checked within a limited scope. Public documentation does not identify external test works or link to their videos; downloaded media, cookies and signed resource URLs are not distributed.
