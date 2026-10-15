import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");

// GitHub Pages serves the site under /<repo>/. Override with SITE_BASE for a fork or a custom domain.
export default defineConfig(({ command, isPreview, mode }) => {
  const localDev = command === "serve" && !isPreview;
  // Plug and play on your own machine: `npm run dev` reads the keys from the repo's .env so Live mode works
  // without pasting them. Only the dev server does this. A build (what GitHub Pages serves) always gets empty
  // strings, and CI fails if a key ever appears in site/dist.
  const env = localDev ? loadEnv(mode, root, ["OPENROUTER_", "ANTHROPIC_"]) : {};
  const devKeys = { openrouter: env.OPENROUTER_API_KEY ?? "", anthropic: env.ANTHROPIC_API_KEY ?? "" };
  return {
    base: localDev ? "/" : (process.env.SITE_BASE ?? "/decision-models-lab/"),
    plugins: [react()],
    define: { __DEV_KEYS__: JSON.stringify(devKeys) },
    server: { fs: { allow: [root] } },
    build: { outDir: "dist", chunkSizeWarningLimit: 1200 },
  };
});
