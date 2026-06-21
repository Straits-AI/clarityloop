import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

const NODE_STUB = fileURLToPath(new URL("./src/dev-node-stub.ts", import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    {
      // @clarityloop/evals' report writer transitively imports node:fs/promises + node:path.
      // The browser never calls them, so stub EVERY node:* builtin to a no-op in BOTH dev and
      // build. (Externalizing them — the old approach — shipped unresolved `node:` imports in the
      // production bundle, which the browser blocks, so React never mounted.)
      name: "stub-node-builtins",
      enforce: "pre",
      resolveId(id) {
        if (id.startsWith("node:")) return NODE_STUB;
      },
    },
  ],
  resolve: {
    alias: {
      "@clarityloop/core": fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url)),
      "@clarityloop/evals": fileURLToPath(new URL("../../packages/evals/src/index.ts", import.meta.url)),
      "@clarityloop/qwen": fileURLToPath(new URL("../../packages/qwen/src/index.ts", import.meta.url)),
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
