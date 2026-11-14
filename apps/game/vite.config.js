import { fileURLToPath } from "node:url";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import process from "node:process";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(() => ({
  plugins: [tailwindcss(), sveltekit()],
  resolve: {
    alias: {
      "@karmageddon/contract": fileURLToPath(new URL("../../packages/contract/src/index.ts", import.meta.url)),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || "127.0.0.1",
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
    proxy: {
      "/api": "http://127.0.0.1:8787",
    },
    fs: {
      allow: ["../.."],
    },
  },
  preview: {
    port: 4173,
    strictPort: true,
    host: "127.0.0.1",
    proxy: {
      "/api": "http://127.0.0.1:8787",
    },
  },
  ssr: {
    noExternal: ["@karmageddon/contract"],
  },
}));
