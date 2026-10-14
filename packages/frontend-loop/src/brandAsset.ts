/**
 * The client's logo, supplied by the owner in the Cockpit (intake, or the details form on a stopped build). It is
 * client upload content, so it is data, never instructions (CLAUDE.md §6): no model ever reads its bytes. The
 * reviewed starters place it (header, footer, favicon); the builder model only knows that a logo exists.
 *
 * The file is served from the client's own domain, so an SVG is checked as strictly as a page: a script, an
 * event handler, an external reference or a DOCTYPE (entity tricks) is refused, not cleaned. A refused logo
 * stops the build before any paid step, with a plain reason the owner can act on.
 */
import { createHash } from "node:crypto";
import { svgProblem } from "./svgPolicy.js";

export const LOGO_MIME_TYPES = ["image/svg+xml", "image/png", "image/webp"] as const;
export type LogoMime = (typeof LOGO_MIME_TYPES)[number];

/** 512 KB: a logo bigger than this would cost page speed on every page. */
export const LOGO_MAX_BYTES = 512 * 1024;

/** Where an uploaded brand asset lives: the private `client-assets` bucket (migration 0021), one folder per uploader. */
export const BRAND_ASSET_PATH_RE = /^uploads\/[0-9a-f-]{36}\/[0-9a-f]{64}\.(svg|png|webp)$/;

/** The logo as recorded in the brief: a pointer and a fingerprint, never the bytes. */
export interface BriefLogo {
  /** Path in the `client-assets` bucket. */
  path: string;
  mime: LogoMime;
  /** sha256 of the file, hex. The build refuses bytes that do not match it. */
  sha256: string;
  bytes: number;
  /** Intrinsic size, so pages reserve the space (no layout shift). */
  width: number;
  height: number;
}

/** A logo ready to be placed in a site: the brief's record plus the verified bytes. */
export interface LogoAsset extends BriefLogo {
  /** The file name in the built site. */
  file: string;
  data: Buffer;
}

export class LogoError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "LogoError";
  }
}

const EXT: Record<LogoMime, string> = { "image/svg+xml": "svg", "image/png": "png", "image/webp": "webp" };

export function logoFileName(mime: LogoMime): string {
  return `logo.${EXT[mime]}`;
}

export function sha256Hex(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Validates the brief's logo record (shape only; the bytes are checked by loadLogoAsset). */
export function parseBriefLogo(raw: unknown): BriefLogo {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const ok =
    typeof r.path === "string" && BRAND_ASSET_PATH_RE.test(r.path) &&
    LOGO_MIME_TYPES.includes(r.mime as LogoMime) &&
    typeof r.sha256 === "string" && /^[0-9a-f]{64}$/.test(r.sha256) &&
    r.path.endsWith(`/${r.sha256}.${EXT[r.mime as LogoMime]}`) &&
    Number.isInteger(r.bytes) && (r.bytes as number) > 0 && (r.bytes as number) <= LOGO_MAX_BYTES &&
    Number.isInteger(r.width) && (r.width as number) > 0 && (r.width as number) <= 10000 &&
    Number.isInteger(r.height) && (r.height as number) > 0 && (r.height as number) <= 10000;
  if (!ok) throw new LogoError('Brief "logo", if present, must point at an uploaded SVG, PNG or WebP file with its size and fingerprint.');
  return { path: r.path as string, mime: r.mime as LogoMime, sha256: r.sha256 as string, bytes: r.bytes as number, width: r.width as number, height: r.height as number };
}

function svgSize(text: string): { width: number; height: number } | null {
  const tag = /<svg\b[^>]*>/i.exec(text)?.[0];
  if (!tag) return null;
  const vb = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*["']/i.exec(tag);
  if (vb) return { width: Math.round(Number(vb[1])), height: Math.round(Number(vb[2])) };
  const w = /\swidth\s*=\s*["']\s*([\d.]+)(px)?\s*["']/i.exec(tag);
  const h = /\sheight\s*=\s*["']\s*([\d.]+)(px)?\s*["']/i.exec(tag);
  if (w && h) return { width: Math.round(Number(w[1])), height: Math.round(Number(h[1])) };
  return null;
}

function pngSize(b: Buffer): { width: number; height: number } | null {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (b.length < 24 || !b.subarray(0, 8).equals(sig) || b.toString("ascii", 12, 16) !== "IHDR") return null;
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

function webpSize(b: Buffer): { width: number; height: number } | null {
  if (b.length < 30 || b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WEBP") return null;
  const chunk = b.toString("ascii", 12, 16);
  if (chunk === "VP8X") return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
  if (chunk === "VP8L") {
    const bits = b.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8 ") return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  return null;
}

/**
 * Checks an uploaded logo file and returns its brief record (minus the storage path). Throws LogoError with a
 * reason the owner can act on. The Cockpit upload mirrors these rules; the build checks again on the bytes it fetched.
 */
export function inspectLogo(data: Buffer, mime: string): Omit<BriefLogo, "path"> {
  if (!LOGO_MIME_TYPES.includes(mime as LogoMime)) throw new LogoError("The logo must be an SVG, PNG or WebP file.");
  if (data.length === 0) throw new LogoError("The logo file is empty.");
  if (data.length > LOGO_MAX_BYTES) throw new LogoError(`The logo is ${Math.ceil(data.length / 1024)} KB; the limit is ${LOGO_MAX_BYTES / 1024} KB.`);
  let size: { width: number; height: number } | null;
  if (mime === "image/svg+xml") {
    const text = data.toString("utf-8");
    if (text.includes("�")) throw new LogoError("The SVG logo is not valid text (UTF-8).");
    const lower = text.toLowerCase();
    // Banned content first, so the owner hears the specific reason.
    const problem = svgProblem(text);
    if (problem) throw new LogoError(`The SVG logo contains ${problem}, which is not allowed on a client site. Export a plain SVG and upload it again.`);
    if (!/^﻿?\s*(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/.test(lower) || !lower.trimEnd().endsWith("</svg>")) {
      throw new LogoError("The SVG logo must be a single <svg> element.");
    }
    size = svgSize(text);
    if (!size) throw new LogoError("The SVG logo needs a viewBox (or a width and height) so pages can reserve its space.");
  } else {
    size = mime === "image/png" ? pngSize(data) : webpSize(data);
    if (!size) throw new LogoError(`The file is not a valid ${mime === "image/png" ? "PNG" : "WebP"} image.`);
  }
  if (size.width < 1 || size.height < 1 || size.width > 10000 || size.height > 10000) throw new LogoError("The logo's dimensions are not usable.");
  return { mime: mime as LogoMime, sha256: sha256Hex(data), bytes: data.length, width: size.width, height: size.height };
}

/** Verifies fetched bytes against the brief's record (fingerprint, then the same content rules) and names the site file. */
export function loadLogoAsset(logo: BriefLogo, data: Buffer): LogoAsset {
  if (sha256Hex(data) !== logo.sha256) throw new LogoError("The stored logo does not match the one approved in the brief (fingerprint differs). Upload it again.");
  const checked = inspectLogo(data, logo.mime);
  return { ...logo, ...checked, file: logoFileName(logo.mime), data };
}

/** The logo's display size in the header: 40 px tall (32 px for a wide mark), width kept in proportion. */
export function logoDisplaySize(logo: Pick<BriefLogo, "width" | "height">): { width: number; height: number } {
  const ratio = logo.width / logo.height;
  const h = ratio > 4 ? 32 : 40;
  return { width: Math.max(1, Math.round(h * ratio)), height: h };
}

/**
 * True when the brief's own words say a logo is supplied or must be used. The build stops before any paid step
 * when this is true and no logo is attached: the builder cannot invent the client's logo, so every QA round
 * would fail on it (Lanternworks e2a204fb, 3 of 3 rounds).
 */
export function briefRequiresLogo(text: string): boolean {
  // Sentence by sentence, so "Don't use a logo. Our tone is warm." never joins words across sentences.
  for (const raw of text.toLowerCase().split(/[.;!?\n]+/)) {
    const t = raw.trim();
    if (!/\b(logo|logomark|brand mark)\b/.test(t)) continue;
    // Not a supplied logo: none yet, to be designed, or a request not to use one.
    if (/\b(no|without|don'?t|do not|not|never|new|design|create|redesign|draw|make)\b[\w\s'-]{0,25}\b(logo|logomark|brand mark)\b|\b(logo|logomark|brand mark)\b[\w\s'-]{0,25}\b(to be designed|tbd|later|needed|wanted)\b/.test(t)) continue;
    if (
      /\b(provided|supplied|attached|existing|current|our|their|client'?s|the client'?s)\s+(own\s+)?(svg\s+|png\s+)?(logo|logomark|brand mark)\b/.test(t) ||
      /\b(logo|logomark|brand mark)\b(\.svg|\.png)?[\w\s'-]{0,20}\b(provided|supplied|attached|fixed|locked|as-is|as is|no redrawing|unchanged)\b/.test(t) ||
      /\buse\s+(the\s+|our\s+|their\s+)?(provided\s+|supplied\s+|existing\s+)?(logo|logomark)\b/.test(t)
    ) {
      return true;
    }
  }
  return false;
}

// The verified logo bytes for the build running in this process, keyed by fingerprint. The workflow fetches and
// verifies the file once, before any paid step (provideLogoAsset); the starters then look it up by the brief's
// fingerprint (logoAssetFor). Content-addressed, so a stale or different logo can never be picked up.
const provided = new Map<string, LogoAsset>();

export function provideLogoAsset(asset: LogoAsset): void {
  provided.set(asset.sha256, asset);
}

/** Test helper and end-of-build cleanup. */
export function clearProvidedLogoAssets(): void {
  provided.clear();
}

/**
 * The logo to place for this brief: null when the brief has none. Throws when the brief names a logo whose bytes
 * were not provided, so a site is never built silently without the client's logo.
 */
export function logoAssetFor(brief: { logo?: BriefLogo }): LogoAsset | null {
  if (!brief.logo) return null;
  const asset = provided.get(brief.logo.sha256);
  if (!asset) throw new LogoError("The brief names a logo file, but it was not loaded before the build. The build stops rather than leave the logo out.");
  return asset;
}
