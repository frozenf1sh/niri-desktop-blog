# niri-desktop-blog

Felix 的桌面风格博客。Node.js 和 pnpm 由项目的 `mise.toml` 固定，Vite 负责本地开发和静态构建。

```sh
mise install
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm dev
```

打开终端打印的 `Local` 地址（默认是 [4397 端口](http://127.0.0.1:4397/)，被占用时自动顺延）。Shell 已启用 mise 时，可以直接运行 `pnpm`。

`pnpm check` 检查 JavaScript 语法并运行测试，`pnpm build` 生成 `dist/`，`pnpm preview` 在 [4398 端口](http://127.0.0.1:4398/) 预览构建产物。

## Docker

```sh
docker build -t niri-desktop-blog .
docker run --rm -p 127.0.0.1:8080:8080 niri-desktop-blog
```

容器启动后打开 [本地博客](http://127.0.0.1:8080/)。镜像在构建阶段生成静态页面，运行时由非 root Nginx 提供首页、文章和资源。

## 桌面操作

- 左上角的药丸切换工作区。也可以用 `Alt+1/2/3`、`Alt+↑/↓`，或在宽屏桌面的空白处滚动。
- 左上角的九宫格会定位到应用所在的工作区。首次打开便笺、日历等应用时，窗口会接到当前工作区右侧。用触控板横滑、`Shift` 加滚轮、`Alt+←/→` 或桌面底部的箭头切换窗口列。
- 拖标题栏到另一扇窗口。放在中央交换位置，放在上边或下边叠到同一列，放在左边或右边拆成并排的列。横向拖到桌面边缘可继续滚动。
- 拖窗口左右边缘调整列宽，拖底边或叠放窗口之间的边缘调整高度。同列窗口共用宽度并分配高度。双击相应边缘恢复自动尺寸。
- 点窗口标题栏右侧的按钮可以最大化、还原或关闭窗口。
- 右上角打开控制中心。网络、蓝牙和勿扰是界面状态；音量影响播放器，亮度和夜间模式作用在页面上。
- 便笺和控制中心设置保存在当前浏览器。

顶部的音乐控件从左到右是上一首、播放或暂停、下一首和曲名。长曲名会在限宽区域内滚动。点击曲名打开播放列表，点击面板里的模式图标依次切换顺序播放、单曲循环和随机播放。文件窗口的「音乐」目录也使用同一个播放器。把浏览器支持的音频放进 `assets/music/` 即可加入列表，顺序按文件名排列。

## 工作区和文章

首页的文件窗口列出最近文章。点击文章会打开文章工作区，浏览器的前进和后退会恢复对应的窗口、列表和滚动位置。关于工作区从 `profile.js` 和 `public/interests.json` 读取资料。便笺和日历可以从启动器打开。

阅读器右侧显示章节目录和当前阅读位置。窗口宽度不足时，目录收成一列短横线。鼠标划过或手指按住横线可查看附近的章节标题，点击标题或横线即可跳转，也可以按住横线滑动后松手选中章节。

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
