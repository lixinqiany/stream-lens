# 参与贡献

欢迎提交 bug、站点兼容性改进和交互优化。讨论较大的改动时，可以先创建 Issue 说明目标。

## 本地开发

使用 Node.js 24.15 或以上版本。

```sh
git clone https://github.com/lixinqiany/stream-lens.git
cd stream-lens
npm ci
npm test
npm run test:ui
npm run build:extension
```

Chrome 开发者模式加载 `dist-extension`。修改后重新构建、重新加载扩展并刷新视频页面。`npm run dev` 是早期设计原型，不是正式插件。

## 提交改动

1. Fork 仓库并创建分支。
2. 保持改动范围清晰，为媒体解析、任务一致性或错误恢复添加相关测试。
3. 运行核心测试、UI 模拟检查和扩展构建。
4. 创建 Pull Request，说明问题、行为变化和验证方式；实机未验证的部分请明确标注。

UI 模拟检查使用 jsdom，不启动浏览器。它无法替代 Chrome 的原生保存窗口、文件句柄权限、后台生命周期或实际站点验证。媒体测试使用人工生成的色块与音频样本，生成方式见 `src/core/tests/fixtures/README.md`。

请勿提交账号 Cookie、访问令牌、带签名的媒体链接、私人视频、`work` 或构建目录。贡献代码使用本项目 MIT 许可证；第三方代码和素材保留原许可与来源说明。
