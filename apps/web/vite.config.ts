import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@clarityloop/core": fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url)),
    },
  },
  server: {
    proxy: {
      "/runs": "http://localhost:8080",
      "/demo": "http://localhost:8080",
      "/score": "http://localhost:8080",
      "/qwen": "http://localhost:8080",
    },
  },
  build: { outDir: "dist" },
});
