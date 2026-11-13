import { defineConfig } from "vite";
import { blogPages } from "./blog/vite-blog.js";

const musicProxy = {
  "/music-api": { target: "https://monster-siren.hypergryph.com", changeOrigin: true, rewrite: (path) => path.replace(/^\/music-api/, "/api") },
  "/music-media": { target: "https://web.hycdn.cn", changeOrigin: true, rewrite: (path) => path.replace(/^\/music-media/, ""), configure: (proxy) => proxy.on("proxyReq", (request) => { request.removeHeader("referer"); request.removeHeader("origin"); }) },
};

export default defineConfig({
  base: "./",
  plugins: [blogPages()],
  server: { host: "127.0.0.1", port: 4397, proxy: musicProxy },
  preview: { port: 4398, strictPort: true, proxy: musicProxy },
});
