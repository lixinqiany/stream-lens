# 拾影 StreamLens

[![CI](https://github.com/lixinqiany/stream-lens/actions/workflows/ci.yml/badge.svg)](https://github.com/lixinqiany/stream-lens/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

一个在本机处理视频的 Chrome 扩展：点击网页播放器，自动识别视频和清晰度，再确认下载。支持 HLS 点播、MP4 / WebM 直链和 Bilibili H.264 / AAC DASH。

**[下载安装包](https://github.com/lixinqiany/stream-lens/releases/latest) · [问题反馈](https://github.com/lixinqiany/stream-lens/issues) · [参与贡献](CONTRIBUTING.md)**

## 安装与使用

需要 Chrome 116 或以上版本。当前通过开发者模式安装，尚未上架 Chrome Web Store。

1. 从 Releases 下载 `stream-lens-0.2.8.zip`，解压到固定文件夹。
2. 打开 `chrome://extensions`，开启开发者模式，点击“加载已解压的扩展程序”，选择含 `manifest.json` 的文件夹。
3. 将拾影固定到工具栏。打开视频网页，点击视频画面或播放器控件，播放几秒。
4. 从画面右上角“下载视频”或工具栏侧栏确认清晰度并下载。

升级时用新包替换原扩展目录内容，重新加载扩展，再刷新视频网页。下载前选择保存位置可在设置中开启；未开启时保存到 Chrome 默认下载目录。

## 功能

- 根据用户点击选择播放器，自动播放与其他页面视频不会自动改变下载目标。
- 自动识别可用清晰度，按偏好预选；同一来源共享解析请求，失败时提供重试。
- 深色和浅色侧栏、视频画面快捷入口、文件名编辑、下载前选择保存位置。
- 本机全局任务记录，支持暂停、继续、取消、重试和筛选；清理只移除已完成、已取消记录，不删除视频文件。
- 关闭侧栏后继续处理任务；流式下载使用 OPFS 临时存储，不将整段视频保存在内存。

## 支持范围

| 类型 | 行为 |
| --- | --- |
| MP4 / WebM 直链 | 保存原文件 |
| HLS 点播，TS H.264 / AAC | 增量转封装为 MP4，不重新编码 |
| HLS fMP4 点播 | 相同初始化信息、H.264 / AAC，顺序保存为 MP4 |
| HLS AES-128 identity | 支持普通 AES-CBC 分片加密 |
| Bilibili BV / 番剧 ep、ss，H.264 + AAC DASH | 按索引合并视频与音轨为 MP4 |
| 其他站点 DASH、HLS 独立音轨、直播、时间线切换、DRM / SAMPLE-AES | 暂不支持 |

最多同时处理两个流式任务，单文件上限 8 GB。浏览器关闭会中断流式任务，重试从头开始；默认目录直链续传取决于服务器。下载前选址模式的直链暂停后继续会从头读取。

播放器在 Worker 内部转封装、封闭 Shadow DOM、共用广告播放器或自定义媒体元素时，可能无法关联来源。部分站点要求登录、来源请求头或有效的临时链接；Bilibili 使用当前账号正常可访问的清晰度，试看和受保护视频不提供完整下载。请仅下载有权保存的内容。

## 从源码构建

使用 Node.js 24.15 或以上版本。

```sh
git clone https://github.com/lixinqiany/stream-lens.git
cd stream-lens
npm ci
npm test
npm run test:ui
npm run build:extension
```

在 Chrome 加载生成的 `dist-extension` 文件夹。`npm run dev` 展示早期设计原型与示例数据；正式扩展使用 `npm run build:extension`。

核心解析与后台/执行器有 93 项测试；UI 检查用 jsdom 执行正式组件，不启动浏览器。真实 Chrome 的最终布局、原生文件窗口、跨文档保存授权和后台生命周期仍需实机验证。验证记录见 [docs/validation.md](docs/validation.md)。

## 隐私与权限

任务和偏好保存在 `chrome.storage.local`，当前页面目录保存在 `chrome.storage.session`，视频临时文件保存在扩展自己的 OPFS。历史包含视频标题、来源页和媒体地址，仅存本机，没有遥测或云端上传。

HTTP/HTTPS 站点权限随安装声明，用于关联播放器与视频资源、访问 CDN。Chrome 安装、升级或恢复访问时可能要求确认，扩展不会跳过浏览器权限检查。可在 Chrome 扩展详情中调整站点访问范围。

## 项目结构

- `src/core`：媒体模型、发现归并、HLS / DASH 解析与转封装。
- `src/platform`：Chrome 消息、访问检查和存储仓库。
- `src/extension`：播放器探针、后台、独立下载执行器、正式侧栏与保存页面。
- `scripts/qa`：播放器、权限、界面与保存恢复的模拟检查。
- `src/ui`：保留的早期设计原型。

[架构说明](docs/architecture.md) · [设计说明](docs/product-design.md) · [参考来源](docs/research.md)

## 开源与贡献

采用 [MIT 许可证](LICENSE)。欢迎 Issue 和 Pull Request，详见 [贡献指南](CONTRIBUTING.md)。依赖保留各自许可证，构建包附带 `THIRD-PARTY-NOTICES.txt`；测试媒体为人工生成色块和音频，不包含网站视频。
