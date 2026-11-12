# niri desktop

一个用 HTML、CSS 和 JavaScript 写的桌面原型。Node.js 和 pnpm 由项目的 `mise.toml` 固定，Vite 负责本地开发和静态构建。

```sh
mise install
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm dev
```

打开终端打印的 `Local` 地址（默认是 [4397 端口](http://127.0.0.1:4397/)，被占用时自动顺延）。Shell 已启用 mise 时，可以直接运行 `pnpm`。

`pnpm check` 检查 JavaScript 语法，`pnpm build` 生成 `dist/`，`pnpm preview` 在 [4398 端口](http://127.0.0.1:4398/) 预览构建产物。

- 左上角的药丸切换工作区。也可以用 `Alt+1/2/3`、`Alt+↑/↓`，或在宽屏桌面的空白处滚动。
- 点窗口标题栏右侧的按钮可以最大化、还原或关闭窗口；左上角的九宫格可重新打开应用。
- 右上角打开控制中心。网络、蓝牙和勿扰是界面状态；音量影响播放器，亮度和夜间模式作用在页面上。
- 便笺和控制中心设置保存在当前浏览器。终端里的命令只操作示例内容。

工作区切换和窗口重排参考 [niri 的动画配置](https://github.com/niri-wm/niri/wiki/Configuration%3A-Animations) 使用临界阻尼曲线；页面遵循系统的减少动态效果设置。

壁纸保存在 `assets/dusk.webp`，使用内置 imagegen 生成。生成提示词：

> Use case: stylized-concept. Asset: full-bleed desktop wallpaper for a dark graphite, rounded Linux desktop. Create an exquisite, quiet 16:9 landscape painting of a Japanese coastal headland at blue hour: expansive hazy lilac and warm dusty peach sky fading into cool slate-blue, a tiny pale moon upper left, layers of faraway island silhouettes and a still, softly reflective bay. A dark indigo coastal slope curves in from the bottom right; subtle reeds and rock details along the bottom edge. Hand-painted anime background art with subtle film grain and luminous atmospheric perspective. Keep the upper third airy, the center low in detail for windows placed over it, and the coastline beautiful and discernible along the bottom and sides. Mid-to-low contrast, softened sunset colors, restrained highlights, visually clear at wallpaper size. Full edge-to-edge landscape, no borders, no people, no lettering, no icons, no UI, no watermark.
