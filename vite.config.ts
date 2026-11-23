import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

const server = { target: "http://localhost:8787", ws: true };
const proxy = { "/api": server, "/auth": server, "/live": server };

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit({
      preprocess: [vitePreprocess()],
      compilerOptions: { runes: true },
      adapter: adapter({ fallback: "index.html" }),
    }),
  ],
  resolve: { dedupe: ["yjs"] },
  server: {
    port: 5180,
    strictPort: true,
    proxy,
    watch: { ignored: ["**/vendor/viritura/engine/**"] },
  },
  preview: { port: 5180, strictPort: true, proxy },
  test: { include: ["{src,worker}/**/*.test.ts"] },
});
