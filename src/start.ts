import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev
export default defineConfig({
  base: "/script-save-pro/",
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // ⚡ STATIC CAPTURE ENGINE: Forces Vite to render as a standalone client application
  build: {
    ssr: false,
    outDir: "dist",
  }
});
