import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    target: "esnext",
    emptyOutDir: true,
    outDir: "dist",
    rollupOptions: {
      input: {
        background: resolve(__dirname, "src/background.js"),
        content: resolve(__dirname, "src/content.js"),
        index: resolve(__dirname, "src/index.js"),
        popup: resolve(__dirname, "src/popup/popup.html"),
        options: resolve(__dirname, "src/options/options.html"),
      },
    },
    minify: false,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
    extensions: [".js", ".mjs", ".cjs", ".json"],
  },
  optimizeDeps: {
    entries: ["./src/content.js", "./src/background.js", "./src/index.js"],
  },
  // Add explicit module resolution
  esbuild: {
    target: "esnext",
  },
});
