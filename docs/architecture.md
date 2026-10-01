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
| core/sites | YouTube / Douyin / Bilibili 的规范来源、公开播放数据与轨道选择 |
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

基础权限为 activeTab / tabs / scripting / storage / downloads / sidePanel / webRequest / offscreen / alarms。HTTP/HTTPS host 权限随安装声明，用于页面识别和 CDN 访问；Chrome 限制站点访问时提供恢复入口。来源头规则使用 declarativeNetRequestWithHostAccess，仅作用于扩展发起的对应站点请求；抖音分享页请求使用移动端 User-Agent，媒体来源头为官网。无 cookies、debugger 或 nativeMessaging 权限。

响应体消费前核对重定向 CDN 的权限；范围请求核对状态、Content-Range 与长度。后台验证扩展 UI、内容脚本和 offscreen 的消息来源。页面标题文本渲染，脚本只读字面 URL、不执行。资源链接保留签名查询参数，不删 query 去重，也不在诊断中导出。

数据模型/清单解析可用纯测试验证；Chrome 的原生权限、offscreen 生命周期与 downloads 最终落盘必须在实际扩展环境验证。具体已验证范围见 validation.md。

## 国际化

`src/i18n/messages.ts` 是中英文文本的唯一来源，类型化键由 `src/i18n/index.ts` 读取。默认使用 `chrome.i18n.getUILanguage()`，中文 locale 映射简体中文，其余映射英文；本地偏好可覆盖为 `auto / zh_CN / en`。侧栏通过快照切换，内容脚本与保存页监听偏好变更。offscreen 只提供 runtime API，后台在 RUN / LANGUAGE 消息中传入已解析的语言，不依赖 offscreen 的 storage 或 i18n API。

用户可见错误和状态在产生时按当前语言输出，旧任务错误通过已知模板匹配在显示时转换。匹配只应用于扩展错误和画质字段，不翻译网页标题、URL 或文件名。Chrome 原生文件窗口使用系统语言；扩展只能本地化窗口外的页面与文件类型说明。

构建从同一文本源生成 `_locales/en/messages.json` 和 `_locales/zh_CN/messages.json`，用于 manifest 的名称、简介与工具栏标题，`default_locale` 为 `en`。这些 Chrome 元数据跟随浏览器语言；扩展内手动选择不会修改 Chrome 的语言或商店目录语言。

## 平台适配

规范来源与用户选中的播放器及当次 sourceKey 绑定，优先于独立音轨、视频轨道和预加载资源。YouTube watch / Shorts 统一为确切 video ID，广告 class 改变时解绑正片；抖音 modal_id / video 路径绑定确切作品 ID，多播放器无法确认时不关联分享页。SPA 导航清理选择与解析状态。

YouTube 只读页面字面 JSON，再按需请求公开播放器响应，筛选含 init/index 字节范围的 H.264 / AAC。不执行签名脚本或处理验证码、DRM；正常播放接口拒绝、CDN 拒绝均失败。抖音建立官方分享页正常会话，再读取渲染数据中 exact aweme_id 的完整 MP4，保留原播放地址。重试重新解析签名；B 站普通 BV 重试使用原 URL 的 p 分集，YouTube 保留原画质。

## 自动选择主播放器（0.3.2）

顶层页面中已就绪、可见的明确主播放器自动绑定（已适配站点使用主容器）；通用页面只接受单个正在播放或面积显著更大的播放器。广告、不可见和未就绪元素排除，多个相近大小的视频保留用户选择。自动绑定只解析元数据，不启动下载。

手动点击与侧栏切换均标记 manual，后续自动播放不能覆盖；暂停保留选择，SPA 导航重置并重新识别。B 站规范页面接口包含于 sourceKey，防止元素和 blob 地址复用时旧页面结果串入。

侧栏的其他视频按实际 playerId 和最新 sourceKey 合并，只展示绑定到播放器的资源；未绑定的网络音视频轨道不生成视频行。切换发往原 documentId / frameId，由内容脚本复核当前 sourceKey 后选择，不直接下载轨道。

## 取消与暂停（0.3.3）

取消先原子进入 cancelling，拒绝迟到进度、清晰度续期和最终保存预约。等待原生下载创建 / 执行器启动完成，再停止下载并等待执行器清理确认；清理完成后删除文件句柄、保存请求窗口和任务记录。cancelling 不参与“清理记录”，失败时保留重试取消入口。后台启动可继续处理未完成的取消。原生下载已完成时保留完成记录，预选文件开始最终提交后禁止取消。

HLS / DASH 暂停保留同一个磁盘写入流及已完成分片，继续下载时重试当前未完成分片。预选位置的 MP4 / WebM 暂停丢弃当前写入暂存，继续时从头读取；默认下载目录直链调用 Chrome 原生 pause / resume。浏览器重启后的流式任务不支持续传，重试从头开始。
