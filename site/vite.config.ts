import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// GitHub Pages serves the site under /<repo>/. Override with SITE_BASE for a fork or a custom domain.
export default defineConfig(({ command, isPreview }) => ({
  base: command === "serve" && !isPreview ? "/" : (process.env.SITE_BASE ?? "/decision-models-lab/"),
  plugins: [react()],
  server: { fs: { allow: [resolve(__dirname, "..")] } },
  build: { outDir: "dist", chunkSizeWarningLimit: 1200 },
}));
