# 扩展架构

正式实现沿用 Vite + esbuild + TypeScript + React，入口清晰、构建可直接检查，因此没有引入早期提案中的 WXT。Chrome MV3 配置集中于 `src/extension/manifest.ts`，构建脚本生成单独的 `dist-extension`。

## 数据流

```text
content script / authorized webRequest
                ↓ evidence
background → session page catalog → typed messages → sidepanel
     ↓ task commands                       ↓ user actions
local task repository ← progress ← offscreen HLS / DASH / direct runner
                                        ↓ streamed writes
save picker → IDB file handle → chosen filesystem destination
                                        ↓ atomic close
                                   complete video file

Without a chosen destination: HLS / DASH → OPFS / Blob → Chrome downloads
```

侧栏切换/关闭不会销毁执行器。后台作为控制面，消息事件唤醒时读取任务记录；不依赖后台计时器维持长下载。预选保存位置时，HLS、DASH 和直链均由独立 offscreen 文档边下载边写入所选文件句柄。File System Access 使用磁盘暂存并在 close 时原子提交，不把完整视频放进内存，也不再先写一份 OPFS 再整文件复制。关闭预选位置时，直链由 Chrome downloads 管理，HLS / DASH 使用 OPFS / Blob 输出。文档创建理由为 BLOBS；offscreen 只调用 chrome.runtime，权限判断委托后台。

## 模块与依赖

| 路径 | 职责 |
| --- | --- |
| core/model | 媒体、规格、任务、设置和进度模型 |
| core/discovery/catalog | 精确 URL 去重、证据融合、主播放器排序和广告提示 |
| core/hls/parser | HLS 清单、范围、初始化、密钥、IV 与可支持性线索 |
| core/hls/fetch | 授权请求、超时、重试调用所需的范围与字节上限 |
| core/hls/transmux、mp4 | TS 增量转封装、初始化与轨道校验 |
| platform/messages | 类型化命令/事件，不暴露执行器内部对象给 UI |
| platform/repository | local/session 存储，串行任务写入 |
| extension/content | 视频与脚本线索；不下载、不执行页面代码 |
| extension/background | 权限、标签页隔离、消息验证、任务调度、Chrome 下载桥接 |
| extension/offscreen | 网络读取、AES 解密、暂停取消、磁盘写入与输出生命周期 |
| extension/ui | 正式侧栏，通过消息操作任务；不抓取分片 |

HLS/parser、媒体模型与目录归并可以独立测试。Chrome 请求和存储实现是平台适配边界；未来可将后台用例拆成单独 service 文件，保持消息协议稳定。

## 生命周期与一致性

- 页面目录按 tab 保存，导航清理，documentId 拒绝已知旧文档的请求；主视频策略结合播放器标识、时长和尺寸，播放状态只是证据之一。
- UI 刷新有代次检查，过期响应不会覆盖新标签页快照。
- 任务持久化在 local storage；写入串行，重复下载按原始资源 URL 判定。
- 新任务与重试串行检查并发上限；流式视频最多两个活动任务。
- 暂停中断当前请求，HLS / DASH 保留已写入分片，直链恢复时从头读取；取消等待执行器结束后确认，清理写入与文件输出。
- 转封装增量写盘，不解码帧；使用相同轨道配置，拒绝中途配置切换。
- 预选保存位置默认开启，完成前通过后台 PREPARE_SAVE 串行预约，再关闭写入流并发 SAVED；取消与失败 abort 暂存，不替换原有文件。无预选位置时才在完成后交给 Chrome downloads，并释放输出 URL 和 OPFS 临时文件。
- 浏览器重启时把未完成 HLS 标记为失败并明确从头重试；不声称有跨会话分片续传。
- 使用 OPFS 的执行器先清理上次中断遗留的 MP4 临时文件。所选文件写入不使用 OPFS；内存只保留当前处理块，单分片读取上限 64 MB，单输出上限 8 GB。

## 权限与边界

基础权限为 activeTab / tabs / scripting / storage / downloads / sidePanel / webRequest / offscreen / alarms。HTTP/HTTPS host 权限随安装声明，用于页面识别和 CDN 访问；Chrome 限制站点访问时提供恢复入口。Bilibili 来源头规则使用 declarativeNetRequestWithHostAccess。无 cookies、debugger 或 nativeMessaging 权限。

响应体消费前核对重定向 CDN 的权限；范围请求核对状态、Content-Range 与长度。后台验证扩展 UI、内容脚本和 offscreen 的消息来源。页面标题文本渲染，脚本只读字面 URL、不执行。资源链接保留签名查询参数，不删 query 去重，也不在诊断中导出。

数据模型/清单解析可用纯测试验证；Chrome 的原生权限、offscreen 生命周期与 downloads 最终落盘必须在实际扩展环境验证。具体已验证范围见 validation.md。
