import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev
export default defineConfig({
  // ⚡ CRITICAL FIX: Forces Vite to prefix all asset imports with your exact repository path name
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
});
