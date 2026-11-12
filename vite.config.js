import { defineConfig } from "vite";
import { blogPages } from "./blog/vite-blog.js";

export default defineConfig({
  base: "./",
  plugins: [blogPages()],
  server: { host: "127.0.0.1", port: 4397 },
  preview: { port: 4398, strictPort: true },
});
