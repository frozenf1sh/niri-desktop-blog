import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: { host: "127.0.0.1", port: 4397, strictPort: true },
  preview: { port: 4398, strictPort: true },
});
