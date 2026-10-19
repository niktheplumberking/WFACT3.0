import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "node:url";

// DEV ONLY: COCKPIT_FAKE_DB=1 swaps the Supabase client for the synthetic test fake (src/dev/fakeSupabase.ts) so the
// signed-in rooms can be screenshotted and axe-checked. Only `vite` serve honours it; `vite build` never does.
const fakeDb = process.env.COCKPIT_FAKE_DB === "1" && process.argv.every((a) => a !== "build");

export default defineConfig({
  resolve: fakeDb ? { alias: [{ find: /^(\.\.?\/)+supabaseClient$/, replacement: fileURLToPath(new URL("./src/dev/fakeSupabase.ts", import.meta.url)) }] } : undefined,
  // MVP M6: the Costs page reads the factory's one price table and spend caps (packages/hermes/config) at build time.
  server: { fs: { allow: [".", "../../packages/hermes/config"] } },
  plugins: [
    react(),
    // Step 4C: installable PWA. The service worker precaches only the app shell (built JS/CSS/fonts/icons);
    // it never caches Supabase or any other API call, so data is always live and RLS-scoped.
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "WFACT Cockpit",
        short_name: "Cockpit",
        description: "The WFACT control room: decisions, builds and checks in one place.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#F4F2ED",
        theme_color: "#F4F2ED",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,woff2,png,svg}"],
        navigateFallback: "/index.html",
        runtimeCaching: [],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // Vendors in their own long-cached chunks; rooms are already split by lazy routes (App.tsx).
        manualChunks: (id) => {
          if (id.includes("node_modules/@supabase/") || id.includes("node_modules/iceberg-js")) return "vendor-supabase";
          if (/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom)\//.test(id)) return "vendor-react";
          if (id.includes("node_modules/@phosphor-icons/")) return "vendor-icons";
          return undefined;
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // Stylesheets are not processed in tests, except tokens.css and app.css, which tokens.test.ts reads raw (contrast,
    // and no pre-v2 alias names).
    css: { include: [/styles\/(tokens|app)\.css/] },
  },
});
