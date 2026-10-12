/**
 * Launch files (MVP item M5, `docs/MVP-CUTLINE.md`; the Step 7 launch-stage checks). Both starters ship the
 * same set, made here by reviewed code and never by the builder model:
 *
 *   robots.txt    always (Allow: /, plus a Sitemap: line once the production address is known)
 *   llms.txt      always (the business name, its tagline and its pages, from the validated content)
 *   og-image.png  always (a 1200x630 share card in the brand's deep and accent colours, no text)
 *   sitemap.xml   only with the production address (every <loc> must be an absolute https:// URL)
 *   canonical, og:url, og:image tags: only with the production address, for the same reason
 *
 * The production address comes from the owner (the brief's `siteUrl`, or an owner fact with key
 * `site_url` added in the Cockpit), never from the builder: a guessed domain would be an invented fact.
 * Without it the launch-stage checks fail at launch and name what is missing, which is the honest outcome.
 */
import { deflateSync } from "node:zlib";
import type { PilotBrief } from "./brief.js";

/** The owner fact key that carries the production address when the brief itself has none. */
export const SITE_URL_FACT_KEY = "site_url";
export const OG_IMAGE_FILE = "og-image.png";
export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

const NOT_PRODUCTION = /(^|\.)(localhost|local|internal|test|example|invalid|vercel\.app)$|^example\.(com|net|org)$|^\d+\.\d+\.\d+\.\d+$/i;

/**
 * A production origin ("https://bennettandco.com"), or null when the value is not one: https only, a real
 * public host name, no path, query or credentials. A Vercel address is a preview, never the live site
 * (hosting law, CLAUDE.md section 5).
 */
export function normalizeSiteUrl(raw: string | undefined | null): string | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password || u.port || u.search || u.hash) return null;
  if (u.pathname !== "/" && u.pathname !== "") return null;
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!host.includes(".") || NOT_PRODUCTION.test(host)) return null;
  return `https://${host}`;
}

/** The brief's production origin: its own `siteUrl`, else the owner fact `site_url`; null when neither is a usable address. */
export function siteUrlOf(brief: PilotBrief): string | null {
  return normalizeSiteUrl(brief.siteUrl) ?? normalizeSiteUrl(brief.ownerFacts?.find((f) => f.key === SITE_URL_FACT_KEY)?.value);
}

/** Absolute URL of a site-relative path ("/", "/services/", "services.html"). */
export function absoluteUrl(siteUrl: string, sitePath: string): string {
  return `${siteUrl}/${sitePath.replace(/^\/+/, "")}`;
}

const xmlEsc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** sitemap.xml listing every page by its production URL. `paths` are site-relative URL paths in navigation order. */
export function sitemapXml(siteUrl: string, paths: string[]): string {
  const urls = paths.map((p) => `  <url><loc>${xmlEsc(absoluteUrl(siteUrl, p))}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function robotsTxt(siteUrl: string | null): string {
  return `User-agent: *\nAllow: /\n${siteUrl ? `\nSitemap: ${absoluteUrl(siteUrl, "sitemap.xml")}\n` : ""}`;
}

export interface LlmsPage {
  path: string;
  title: string;
  description: string;
}

/** llms.txt (llmstxt.org shape): a plain summary of the business and its pages, from the validated content only. */
export function llmsTxt(info: { name: string; tagline?: string; siteUrl: string | null; pages: LlmsPage[] }): string {
  const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();
  const link = (p: string) => (info.siteUrl ? absoluteUrl(info.siteUrl, p) : `/${p.replace(/^\/+/, "")}`);
  return [
    `# ${oneLine(info.name)}`,
    "",
    ...(info.tagline ? [`> ${oneLine(info.tagline)}`, ""] : []),
    "## Pages",
    "",
    ...info.pages.map((p) => `- [${oneLine(p.title)}](${link(p.path)}): ${oneLine(p.description)}`),
    "",
  ].join("\n");
}

// ------------------------------------------------------------------------------------------------
// Share card: a plain PNG, deterministic for the same colours (the checkpoint hash depends on it)
// ------------------------------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];

/**
 * A 1200x630 share card: the brand's deep colour with an accent rule along the bottom. No words, so it can
 * never carry an unsourced claim; a designed card from the client's own assets replaces it when supplied.
 */
export function ogImagePng(colors: { deep: string; accent: string }): Buffer {
  const { width, height } = OG_IMAGE_SIZE;
  const [dr, dg, db] = rgb(colors.deep);
  const [ar, ag, ab] = rgb(colors.accent);
  const rule = Math.round(height * 0.06);
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 3 + 1);
    raw[row] = 0; // filter: none
    const [r, g, b] = y >= height - rule ? [ar, ag, ab] : [dr, dg, db];
    for (let x = 0; x < width; x += 1) {
      const i = row + 1 + x * 3;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
