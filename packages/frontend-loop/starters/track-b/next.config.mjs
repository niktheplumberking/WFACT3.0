// Track B starter build config (Step 4B M4). Static export only: the output is plain files any host can
// serve (Hostinger for live sites, CLAUDE.md section 5). trailingSlash makes every page a folder with an
// index.html, so /services/ works on a plain static server without rewrites. Images are unoptimised
// because a static export has no image server.
//
// The build runs with no network at all (src/trackB/isolate.ts), so it uses webpack: Turbopack opens a
// loopback port for its workers, which a fully network-isolated sandbox refuses. The build id is the hash
// of the content and theme, so the same content always produces the same file names.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

const contentHash = createHash("sha256")
  .update(readFileSync(path.join(import.meta.dirname, "content/site.json")))
  .update(readFileSync(path.join(import.meta.dirname, "content/theme.json")))
  .digest("hex")
  .slice(0, 20);

/** @type {import('next').NextConfig} */
const config = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  generateBuildId: () => `b-${contentHash}`,
  // The stylesheet is inlined into each page, so the first paint (the hero text, the LCP element) needs
  // only the HTML and does not wait behind a CSS request (Step 4B M4, measured on the Northfold fixture:
  // mobile LCP 2.30 s without, 1.95-2.17 s with, for about 20 KB more inline payload). The motion
  // libraries load after first paint (lib/gsap.ts); together these hold LCP inside the 2.5 s budget.
  experimental: { inlineCss: true },
};
export default config;
