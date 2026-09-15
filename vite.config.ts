import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import viteReact from "@vitejs/plugin-react";

// Plain static Vite + React SPA — no server framework, no SSR, no Nitro
// worker build. YouTube Playables ships as a static ZIP (index.html +
// assets/, no backend), so `vite build` here produces exactly that in
// dist/. See the migration report for why TanStack Start (a server
// framework) was removed in favour of this.
export default defineConfig({
  // Relative, not root-absolute, asset URLs — the Playables ZIP can be
  // mounted at any path once uploaded, so "/assets/..." would 404 off
  // of a subpath while "./assets/..." always resolves (§39/§41).
  base: "./",
  resolve: {
    alias: { "@": `${process.cwd()}/src` },
  },
  server: { host: "::", port: 8080 },
  plugins: [tailwindcss(), tsConfigPaths({ projects: ["./tsconfig.json"] }), viteReact()],
  build: {
    outDir: "dist",
    assetsDir: "assets",
    // Keep individual chunks under the Playables per-file guidance (§31).
    chunkSizeWarningLimit: 512,
  },
});
