<div align="center">
  <img src="public/icons/128.png" width="72" height="72" alt="StreamLens logo">
  <h1>StreamLens · 拾影</h1>
  <p><strong>Keep the videos you love.</strong></p>
  <p>Web video downloads · Automatic detection · Quality options · Streaming saves</p>
  <p>
    <a href="https://github.com/lixinqiany/stream-lens/releases/latest"><img src="https://img.shields.io/github/v/release/lixinqiany/stream-lens?style=flat-square&color=3869df" alt="Latest release"></a>
    <a href="https://github.com/lixinqiany/stream-lens/actions/workflows/ci.yml"><img src="https://github.com/lixinqiany/stream-lens/actions/workflows/ci.yml/badge.svg" alt="Build and tests"></a>
    <img src="https://img.shields.io/badge/Chrome-116%2B-3869df?style=flat-square" alt="Chrome 116 or later">
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-3869df?style=flat-square" alt="MIT license"></a>
  </p>
  <p><a href="README.md">简体中文</a> · <strong>English</strong></p>
  <p>
    <a href="https://github.com/lixinqiany/stream-lens/releases/latest">Download</a> ·
    <a href="#features">Features</a> ·
    <a href="#supported-media">Supported media</a> ·
    <a href="#development">Development</a> ·
    <a href="https://github.com/lixinqiany/stream-lens/discussions">Discussions</a>
  </p>
</div>

<p align="center">
  <img src="docs/images/overview-en.png" width="1200" alt="In-player download controls and StreamLens sidebar with automatically detected quality options">
  <br>
  <sub>UI illustration · Sample data</sub>
</p>

## Features

| Selection & detection | Downloading & management |
| --- | --- |
| **Select a player** — The main player is detected automatically. Switch using the video, its controls or the sidebar; manual selection takes priority. | **In-player access** — Confirm downloads from the video overlay or persistent sidebar. |
| **Automatic quality detection** — Discover available resolutions, apply your preference, or select another quality. | **Choose a location first** — Pick the filename and destination before downloading; stream the download to disk. |
| **Light & dark themes** — Compact cards keep the title, duration, quality and primary action in view. | **Local task queue** — Pause, resume, cancel, retry and filter tasks. Downloads continue after closing the sidebar. |

<p align="center">
  <img src="docs/images/workspace-en.png" width="1200" alt="Light video card, dark download queue and save preferences in StreamLens">
  <br>
  <sub>UI illustrations based on v0.2.8 with sample data, not browser screenshots. These images show the Chinese interface; v0.3.0 also supports English.</sub>
</p>

## Installation

**Chrome 116+ required.** Install in developer mode; the extension is not yet listed in the Chrome Web Store.

1. Download the ZIP from [Releases](https://github.com/lixinqiany/stream-lens/releases/latest) and extract it to a permanent folder.
2. Open `chrome://extensions`, enable **Developer mode**, select **Load unpacked**, and choose the folder containing `manifest.json`.
3. Pin StreamLens to the toolbar. Open a video page. The main player is detected automatically. Once detection finishes, confirm the quality and select **Choose location & download**.

**Updating:** Replace the contents of the original extension folder, reload the extension, then refresh video pages.

**Language:** Follows Chrome’s interface language by default: Simplified Chinese for Chinese locales, English for other languages. Select **Settings → Language** to choose **Browser default / 简体中文 / English**. Switching languages does not interrupt downloads.

**Save location:** Choose the filename and location first, then stream the download to disk. The complete file is committed when finished, without a second full-file copy. Updating to v0.2.9 enables this mode. Turn off **Choose location before download** to use Chrome’s download folder; HLS / DASH still use a local temporary file in that mode.

## Supported media

| Source / format | Output |
| --- | --- |
| Direct MP4 / WebM | Original file |
| HLS VOD · TS H.264 / AAC | MP4 remuxing without re-encoding |
| HLS VOD · fMP4 H.264 / AAC | MP4, with consistent initialization data |
| HLS AES-128 identity | Standard AES-CBC segment decryption |
| YouTube watch / Shorts · public H.264 + AAC indexed streams | Video and audio merged into MP4 |
| Douyin video / selected work on the featured page | Complete MP4 supplied by the official share page |
| Bilibili BV / bangumi `ep`, `ss` · H.264 + AAC DASH | Video and audio merged into MP4 |

**Download validation:** Real HTTP requests and the production runner downloaded a 19-second YouTube video, a 3:32 ordinary Bilibili upload and a 21:18 Douyin video. All three files contain audio and video and passed full decoding. An additional YouTube video was rejected by its CDN partway through and is not counted as successful. No browser was operated; native Chrome installation and saving still need device validation. See [platform tests](docs/platform-support.md).

**Limits:** Two concurrent streaming tasks, up to 8 GB per file. Quality depends on normal playback access. YouTube requires directly available indexed streams; some videos are rejected by the CDN. Douyin preserves the official playback file, which may contain a watermark.

<details>
<summary><strong>Compatibility and recovery</strong></summary>

- Live streams, DASH on sites without an adapter, separate HLS audio, timeline changes and DRM / SAMPLE-AES are not supported. Preview-only content is not offered as a full download.
- Worker-based transmuxing, closed Shadow DOM, custom media elements and shared ad players may prevent source detection.
- Pause or resume from the upper-right corner of a downloading task. HLS / DASH retain downloaded segments; closing the sidebar does not interrupt the task.
- Cancellation stops the download, discards unfinished data and removes its record automatically. Failed cleanup can be retried. Existing contents of a preselected file are preserved; a newly created picker file may remain empty (0 bytes).
- Closing the browser interrupts streaming tasks; retries restart from the beginning. Resuming direct downloads to the default folder depends on the server. Direct downloads to a preselected location restart when resumed.
- Automated checks do not replace real Chrome validation of native save dialogs, cross-document file access or website compatibility. See the [validation log](docs/validation.md) (Chinese).

</details>

## Privacy & permissions

Videos are processed locally. History, preferences and temporary files stay on your device: **no telemetry or cloud uploads**. Clearing records does not delete downloaded files.

HTTP/HTTPS permissions are declared at installation to detect players and access video CDNs. Adjust site access in Chrome's extension settings. Download only content you have permission to save. Report security issues through [private vulnerability reporting](https://github.com/lixinqiany/stream-lens/security/advisories/new).

## Development

**Node.js 24.15+**. Build the extension from source:

```sh
git clone https://github.com/lixinqiany/stream-lens.git
cd stream-lens
npm ci
npm run build:extension
```

Load `dist-extension` in Chrome. After changes, rebuild, reload the extension, and refresh the page.

| Command | Purpose |
| --- | --- |
| `npm test` | Regression tests for parsing, background logic and download runners |
| `npm run test:ui` | Component, player and save-recovery checks in jsdom; no browser is launched |
| `npm run dev` | Early design prototype with demonstration data |

[Architecture](docs/architecture.md) · [Design](docs/product-design.md) · [References](docs/research.md) · [Contributing](CONTRIBUTING.md) — detailed guides are currently in Chinese.

## Community & license

[Report a bug](https://github.com/lixinqiany/stream-lens/issues), [discuss an idea](https://github.com/lixinqiany/stream-lens/discussions), or open a pull request. Remove cookies, tokens and signed media URLs from reports.

[MIT](LICENSE) © lixinqiany. Dependencies retain their own licenses; release packages include `THIRD-PARTY-NOTICES.txt`. Test media consists of generated color patterns and audio, with no downloaded website videos.
