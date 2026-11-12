# niri-desktop-blog

Felix 的桌面风格博客。Node.js 和 pnpm 由项目的 `mise.toml` 固定，Vite 负责本地开发和静态构建。

```sh
mise install
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm dev
```

打开终端打印的 `Local` 地址（默认是 [4397 端口](http://127.0.0.1:4397/)，被占用时自动顺延）。Shell 已启用 mise 时，可以直接运行 `pnpm`。

`pnpm check` 检查 JavaScript 语法并运行终端测试，`pnpm build` 生成 `dist/`，`pnpm preview` 在 [4398 端口](http://127.0.0.1:4398/) 预览构建产物。

## Docker

```sh
docker build -t niri-desktop-blog .
docker run --rm -p 127.0.0.1:8080:8080 niri-desktop-blog
```

容器启动后打开 [本地博客](http://127.0.0.1:8080/)。镜像在构建阶段生成静态页面，运行时由非 root Nginx 提供首页、文章和资源。

## 桌面操作

- 左上角的药丸切换工作区。也可以用 `Alt+1/2/3`、`Alt+↑/↓`，或在宽屏桌面的空白处滚动。
- 点窗口标题栏右侧的按钮可以最大化、还原或关闭窗口；左上角的九宫格可重新打开应用。
- 右上角打开控制中心。网络、蓝牙和勿扰是界面状态；音量影响播放器，亮度和夜间模式作用在页面上。
- 便笺和控制中心设置保存在当前浏览器。

## 工作区和文章

首页的文件窗口列出最近文章。点击文章会打开文章工作区，浏览器的前进和后退会恢复对应的窗口、列表和滚动位置。关于工作区从 `profile.js` 和 `public/interests.json` 读取资料。便笺和日历可以从启动器打开。

阅读器标题栏的目录按钮可以展开当前文章的章节。点击章节即可跳转，阅读时目录会标出当前章节。

新文章放在 `content/posts/`。文件名用英文小写和连字符，它会成为文章地址的一部分。文件开头的 YAML front matter 填写 `title`、`date`（`YYYY-MM-DD`）、`description` 和可选的 `tags`。构建后，`dist/articles/<文件名>/index.html` 包含正文，文章链接可以直接打开和分享。

工作区默认打开哪些应用由 `blog/routes.js` 配置。应用在 `apps.js` 注册，沿用桌面的窗口管理。

## 终端

点击终端内容区可跳到输入行，用上下键回溯命令。欢迎画面会运行 `kubectl describe pod felix` 和 `cat interests.json`。输入 `help` 可查看命令的中文说明。`Tab` 补全命令、路径和文章名，有多个候选时用上下键选择，再按 Enter 确认。

```sh
cd 文章
ls
search 命令行
read browser-terminal
```

- `profile.js` 保存关于页和模拟 Pod 共用的资料，`terminal/profile.js` 管理欢迎画面。
- `terminal/shell.js` 解析输入并分发命令。扩展时在 `terminal/commands.js` 注册 `{ name, usage, description, run(args, context) }`，也可以为参数提供 `complete`。命令支持异步返回，`help` 会自动列出用法和说明。
- `terminal/files.js` 登记 `cat` 可读取的静态文件，`interests.json` 的原文来自 `public/interests.json`。`terminal/view.js` 负责渲染和输入，不需要为新命令或文件改动。

工作区切换和窗口重排参考 [niri 的动画配置](https://github.com/niri-wm/niri/wiki/Configuration%3A-Animations) 使用临界阻尼曲线；页面遵循系统的减少动态效果设置。

壁纸保存在 `assets/dusk.webp`，使用内置 imagegen 生成。生成提示词：

> Use case: stylized-concept. Asset: full-bleed desktop wallpaper for a dark graphite, rounded Linux desktop. Create an exquisite, quiet 16:9 landscape painting of a Japanese coastal headland at blue hour: expansive hazy lilac and warm dusty peach sky fading into cool slate-blue, a tiny pale moon upper left, layers of faraway island silhouettes and a still, softly reflective bay. A dark indigo coastal slope curves in from the bottom right; subtle reeds and rock details along the bottom edge. Hand-painted anime background art with subtle film grain and luminous atmospheric perspective. Keep the upper third airy, the center low in detail for windows placed over it, and the coastline beautiful and discernible along the bottom and sides. Mid-to-low contrast, softened sunset colors, restrained highlights, visually clear at wallpaper size. Full edge-to-edge landscape, no borders, no people, no lettering, no icons, no UI, no watermark.
