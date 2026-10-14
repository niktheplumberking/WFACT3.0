/**
 * The client's logo, uploaded by an owner/admin (intake, or the details form on a stopped build). The same rules as the
 * build's own check (packages/frontend-loop/src/brandAsset.ts) run here first, so the owner hears a plain reason at once
 * instead of after a paid build; the database (migration 0021) and the build check again, so this is a convenience,
 * never the only gate. The file goes to the private client-assets bucket under the uploader's own folder, named by its
 * fingerprint, and is never changed afterwards.
 */
import { supabase } from "../supabaseClient";
// The same policy file the build uses (packages/frontend-loop/src/svgPolicy.ts), kept byte-identical by a test.
import { svgProblem } from "./svgPolicy";

export const LOGO_TYPES = ["image/svg+xml", "image/png", "image/webp"] as const;
export type LogoType = (typeof LOGO_TYPES)[number];
export const LOGO_MAX_BYTES = 512 * 1024;
const EXT: Record<LogoType, string> = { "image/svg+xml": "svg", "image/png": "png", "image/webp": "webp" };

/** What the brief records about the logo: a pointer and a fingerprint, never the file itself. */
export interface LogoRecord {
  path: string;
  mime: LogoType;
  sha256: string;
  bytes: number;
  width: number;
  height: number;
}

function typeOf(file: File): LogoType | null {
  if ((LOGO_TYPES as readonly string[]).includes(file.type)) return file.type as LogoType;
  // Some systems leave the type empty for SVG; the name decides then, and the content checks below still apply.
  const ext = file.name.toLowerCase().split(".").pop();
  return ext === "svg" ? "image/svg+xml" : ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : null;
}

function svgSize(text: string): { width: number; height: number } | null {
  const tag = /<svg\b[^>]*>/i.exec(text)?.[0];
  if (!tag) return null;
  const vb = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*["']/i.exec(tag);
  if (vb) return { width: Math.round(Number(vb[1])), height: Math.round(Number(vb[2])) };
  const w = /\swidth\s*=\s*["']\s*([\d.]+)(px)?\s*["']/i.exec(tag);
  const h = /\sheight\s*=\s*["']\s*([\d.]+)(px)?\s*["']/i.exec(tag);
  return w && h ? { width: Math.round(Number(w[1])), height: Math.round(Number(h[1])) } : null;
}

function rasterSize(b: Uint8Array, type: LogoType): { width: number; height: number } | null {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
  if (type === "image/png") {
    const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (b.length < 24 || sig.some((v, i) => b[i] !== v) || ascii(12, 16) !== "IHDR") return null;
    return { width: dv.getUint32(16), height: dv.getUint32(20) };
  }
  if (b.length < 30 || ascii(0, 4) !== "RIFF" || ascii(8, 12) !== "WEBP") return null;
  const chunk = ascii(12, 16);
  const u24 = (o: number) => b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16);
  if (chunk === "VP8X") return { width: 1 + u24(24), height: 1 + u24(27) };
  if (chunk === "VP8L") {
    const bits = dv.getUint32(21, true);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8 ") return { width: dv.getUint16(26, true) & 0x3fff, height: dv.getUint16(28, true) & 0x3fff };
  return null;
}

async function sha256Hex(b: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", b);
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** Checks the chosen file; returns its record without the storage path, or a plain reason the owner can act on. */
export async function inspectLogoFile(file: File): Promise<{ ok: true; record: Omit<LogoRecord, "path"> } | { ok: false; reason: string }> {
  const type = typeOf(file);
  if (!type) return { ok: false, reason: "The logo must be an SVG, PNG or WebP file." };
  if (file.size === 0) return { ok: false, reason: "That file is empty." };
  if (file.size > LOGO_MAX_BYTES) return { ok: false, reason: `That file is ${Math.ceil(file.size / 1024)} KB; the limit is 512 KB. Export a smaller version.` };
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let size: { width: number; height: number } | null;
  if (type === "image/svg+xml") {
    const text = new TextDecoder("utf-8").decode(bytes);
    if (text.includes("�")) return { ok: false, reason: "That SVG is not valid text." };
    const lower = text.toLowerCase();
    const problem = svgProblem(text);
    if (problem) return { ok: false, reason: `That SVG contains ${problem}, which is not allowed on a client site. Export a plain SVG and try again.` };
    if (!/^﻿?\s*(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/.test(lower) || !lower.trimEnd().endsWith("</svg>")) return { ok: false, reason: "That file is not a single SVG image." };
    size = svgSize(text);
    if (!size) return { ok: false, reason: "That SVG has no size (viewBox). Export it again with one." };
  } else {
    size = rasterSize(bytes, type);
    if (!size) return { ok: false, reason: `That file is not a valid ${type === "image/png" ? "PNG" : "WebP"} image.` };
  }
  if (size.width < 1 || size.height < 1 || size.width > 10000 || size.height > 10000) return { ok: false, reason: "That image's size is not usable." };
  return { ok: true, record: { mime: type, sha256: await sha256Hex(buf), bytes: file.size, width: size.width, height: size.height } };
}

/** Uploads a checked logo to the private bucket and returns its record, or a plain-words error. */
export async function uploadLogo(file: File): Promise<{ ok: true; record: LogoRecord } | { ok: false; reason: string }> {
  const checked = await inspectLogoFile(file);
  if (!checked.ok) return checked;
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return { ok: false, reason: "You're signed out. Sign in again, then add the logo." };
  const path = `uploads/${userId}/${checked.record.sha256}.${EXT[checked.record.mime]}`;
  const { error } = await supabase.storage.from("client-assets").upload(path, file, { contentType: checked.record.mime, upsert: false });
  // The same file uploaded before has the same name: that is fine, it is the same logo.
  if (error && !/already exists|duplicate/i.test(error.message)) {
    if (/bucket not found/i.test(error.message)) return { ok: false, reason: "Logo uploads aren't switched on yet: a database update is still waiting to be applied. Ask Huraira to apply it." };
    return { ok: false, reason: `The logo didn't upload: ${error.message}. Nothing was saved; try again.` };
  }
  return { ok: true, record: { ...checked.record, path } };
}

/** The live address as the database accepts it: https and a host, no path. Returns the cleaned value or a reason. */
export function checkSiteUrl(raw: string): { ok: true; value: string } | { ok: false; reason: string } {
  const v = raw.trim().replace(/\/+$/, "");
  if (!/^https:\/\/[^/\s]+$/i.test(v)) return { ok: false, reason: "Use the full address starting with https://, with nothing after the domain (for example https://bennettandco.com)." };
  return { ok: true, value: v };
}

/** True for addresses that are not a real live site; launch tags stay off for them (packages/frontend-loop/src/launch.ts). */
export function isTestAddress(url: string): boolean {
  return /\.(example|test|invalid|localhost)$|\.vercel\.app$|^https:\/\/localhost/i.test(url.replace(/\/+$/, ""));
}
