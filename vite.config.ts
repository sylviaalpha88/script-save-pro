// @lovable.dev/vite-tanstack-config already includes tanstackStart, viteReact, tailwindcss,
// tsConfigPaths, nitro, componentTagger, env injection, @ alias — do NOT add them manually.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // `npm run build` puts the website straight into dist/: assets/, index.html,
  // favicon.ico, placeholder.svg, robots.txt (server code goes to dist/server).
  nitro: {
    output: { dir: "dist", publicDir: "dist", serverDir: "dist/server" },
  },
  tanstackStart: {
    server: { entry: "server" },
    spa: { enabled: true, prerender: { outputPath: "/index.html" } },
  },
});
