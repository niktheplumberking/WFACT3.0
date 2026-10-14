/**
 * Image slots and labelled placeholders (Build-quality Package 3, 2026-10-14). MVP-CUTLINE: no paid image generation;
 * "supplied assets and clearly labelled placeholders". The Lanternworks build had no images and no placeholder cards at all.
 *
 *   - The builder DESCRIBES the picture each slot needs (alt, aspect, a note for the client). It never sets an image source:
 *     a `src` in its output is refused, and so is `kind: "generated"` (no provider is wired; see GeneratedImageProvider).
 *   - Code decides what a slot shows. A slot the owner supplied an image for (Cockpit upload, plan input
 *     `asset.image.<slot>`, verified like the logo: content-addressed in the private client-assets bucket, fingerprint and
 *     format checked again at build) shows that image; every other slot shows a branded placeholder card that says
 *     "Image to come: <note>" and is listed as still needed from the client.
 *   - Slot ids are computed by code from where the media sits (`<page>.<section>` or `<page>.<section>.<n>`), so an upload
 *     always lands in the slot the owner clicked.
 *
 * Uploaded images are client content: data, never instructions. No model ever reads their bytes.
 */
import { createHash } from "node:crypto";
import { z } from "zod";
import { pngSize, webpSize } from "./brandAsset.js";

export const ASPECTS = ["16:9", "3:2", "4:3", "1:1", "4:5", "3:4"] as const;
export type Aspect = (typeof ASPECTS)[number];

const Text = (max: number) => z.string().trim().min(1).max(max);

/** What the builder writes for a slot. `src` exists only so a builder that sets it gets a clear refusal (validateMedia). */
export const MediaSchema = z.object({
  kind: z.enum(["supplied", "placeholder", "generated"]).default("placeholder"),
  src: z.string().optional(),
  alt: Text(140),
  aspect: z.enum(ASPECTS),
  /** What the image should show, for the client ("Team photo, the three of us at the studio"). Shown on the placeholder card. */
  note: Text(120),
});
export type Media = z.infer<typeof MediaSchema>;

// ---- supplied images (owner uploads) ----

export const IMAGE_MIME_TYPES = ["image/png", "image/webp", "image/jpeg"] as const;
export type ImageMime = (typeof IMAGE_MIME_TYPES)[number];
/** 2 MB: a photo larger than this costs page speed on phones; the Cockpit asks for a smaller export. */
export const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const IMAGE_EXT: Record<ImageMime, string> = { "image/png": "png", "image/webp": "webp", "image/jpeg": "jpg" };
/** Same bucket and folder rule as the logo (migration 0021), with jpg added by migration 0023. */
export const IMAGE_PATH_RE = /^uploads\/[0-9a-f-]{36}\/[0-9a-f]{64}\.(png|webp|jpg)$/;
export const SLOT_RE = /^[a-z][a-z0-9-]{0,39}(\.[a-z0-9-]{1,40}){1,3}$/;

/** What the brief records about one supplied image: a pointer and a fingerprint, never the bytes. */
export interface ImageRecord {
  path: string;
  mime: ImageMime;
  sha256: string;
  bytes: number;
  width: number;
  height: number;
}
export interface SuppliedImage {
  slot: string;
  image: ImageRecord;
}
export interface ImageAsset extends ImageRecord {
  /** File name in the built site (content-addressed). */
  file: string;
  data: Buffer;
}

export class ImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageError";
  }
}

export function parseImageRecord(raw: unknown): ImageRecord {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const valid =
    typeof r.path === "string" && IMAGE_PATH_RE.test(r.path) &&
    IMAGE_MIME_TYPES.includes(r.mime as ImageMime) &&
    typeof r.sha256 === "string" && /^[0-9a-f]{64}$/.test(r.sha256) &&
    r.path.endsWith(`/${r.sha256}.${IMAGE_EXT[r.mime as ImageMime]}`) &&
    Number.isInteger(r.bytes) && (r.bytes as number) > 0 && (r.bytes as number) <= IMAGE_MAX_BYTES &&
    Number.isInteger(r.width) && (r.width as number) > 0 && (r.width as number) <= 12000 &&
    Number.isInteger(r.height) && (r.height as number) > 0 && (r.height as number) <= 12000;
  if (!valid) throw new ImageError("An image record must point at an uploaded PNG, WebP or JPEG file with its size and fingerprint.");
  return { path: r.path as string, mime: r.mime as ImageMime, sha256: r.sha256 as string, bytes: r.bytes as number, width: r.width as number, height: r.height as number };
}

export function parseSuppliedImages(raw: unknown): SuppliedImage[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > 40) throw new ImageError('Brief "images", if present, must be at most 40 supplied images.');
  return raw.map((x) => {
    const r = (x ?? {}) as Record<string, unknown>;
    if (typeof r.slot !== "string" || !SLOT_RE.test(r.slot)) throw new ImageError("Each supplied image needs a slot id like index.hero or work.work.1.");
    return { slot: r.slot, image: parseImageRecord(r.image) };
  });
}

/** JPEG size from its first frame header (SOF0-SOF15, except DHT/JPG/DAC). */
export function jpegSize(b: Buffer): { width: number; height: number } | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1]!;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const len = b.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

/** Checks an uploaded image and returns its record (minus the storage path). The Cockpit mirrors these rules. */
export function inspectImage(data: Buffer, mime: string): Omit<ImageRecord, "path"> {
  if (!IMAGE_MIME_TYPES.includes(mime as ImageMime)) throw new ImageError("Images must be PNG, WebP or JPEG files.");
  if (data.length === 0) throw new ImageError("The image file is empty.");
  if (data.length > IMAGE_MAX_BYTES) throw new ImageError(`The image is ${Math.ceil(data.length / 1024)} KB; the limit is ${IMAGE_MAX_BYTES / 1024 / 1024} MB.`);
  const size = mime === "image/png" ? pngSize(data) : mime === "image/webp" ? webpSize(data) : jpegSize(data);
  if (!size) throw new ImageError(`The file is not a valid ${mime === "image/png" ? "PNG" : mime === "image/webp" ? "WebP" : "JPEG"} image.`);
  if (size.width < 1 || size.height < 1 || size.width > 12000 || size.height > 12000) throw new ImageError("The image's dimensions are not usable.");
  return { mime: mime as ImageMime, sha256: createHash("sha256").update(data).digest("hex"), bytes: data.length, width: size.width, height: size.height };
}

/** Verifies fetched bytes against the brief's record and names the site file. */
export function loadImageAsset(record: ImageRecord, data: Buffer): ImageAsset {
  if (createHash("sha256").update(data).digest("hex") !== record.sha256) {
    throw new ImageError("A stored image does not match the one recorded for its slot (fingerprint differs). Upload it again.");
  }
  const checked = inspectImage(data, record.mime);
  return { ...record, ...checked, file: `media/${record.sha256.slice(0, 16)}.${IMAGE_EXT[record.mime]}`, data };
}

// Verified image bytes for the build in this process, keyed by fingerprint (same pattern as provideLogoAsset).
const providedImages = new Map<string, ImageAsset>();
export function provideImageAsset(asset: ImageAsset): void {
  providedImages.set(asset.sha256, asset);
}
export function clearProvidedImageAssets(): void {
  providedImages.clear();
}
/** The verified images for this brief by slot. Throws when a recorded image was not loaded, so none is silently dropped. */
export function imageAssetsFor(brief: { images?: SuppliedImage[] }): Map<string, ImageAsset> {
  const out = new Map<string, ImageAsset>();
  for (const s of brief.images ?? []) {
    const a = providedImages.get(s.image.sha256);
    if (!a) throw new ImageError(`The image for slot ${s.slot} was not loaded before the build. The build stops rather than show a placeholder instead.`);
    out.set(s.slot, a);
  }
  return out;
}

// ---- slots ----

export interface MediaSlot {
  slot: string;
  /** Page slug and section id the slot sits in, for people. */
  page: string;
  section: string;
  media: Media;
  /** "supplied" when the owner uploaded an image for this slot, else "placeholder". */
  shows: "supplied" | "placeholder";
}

/** Every media slot in Track B-shaped content, with the slot id code assigns. */
export function mediaSlots(content: { pages: { slug: string; sections: unknown[] }[] }, supplied: ReadonlySet<string> = new Set()): MediaSlot[] {
  const out: MediaSlot[] = [];
  const add = (page: string, section: string, slot: string, media: unknown) => {
    const parsed = MediaSchema.safeParse(media);
    if (!parsed.success) return;
    out.push({ slot, page, section, media: parsed.data, shows: supplied.has(slot) ? "supplied" : "placeholder" });
  };
  for (const p of content.pages) {
    for (const raw of p.sections) {
      const s = raw as { id: string; media?: unknown; items?: { media?: unknown }[]; members?: unknown[] };
      if (s.media) add(p.slug, s.id, `${p.slug}.${s.id}`, s.media);
      (s.items ?? []).forEach((it, i) => it.media && add(p.slug, s.id, `${p.slug}.${s.id}.${i + 1}`, it.media));
    }
  }
  return out;
}

/** The plain line an owner reads for a slot that still needs the client's picture. */
export function placeholderLine(s: MediaSlot): string {
  return `Image still needed from the client for ${s.page === "index" ? "the home page" : `the ${s.page} page`} (${s.section}): ${s.media.note}`;
}

// ---- the seam for generated images later (no paid API calls in the MVP) ----

/**
 * A future image generator (e.g. Higgsfield, MVP-CUTLINE §3 deferred). Not implemented and not wired: the builder may not
 * ask for `kind: "generated"`, and nothing calls this. When it lands, generated images must be labelled on the page and
 * recorded with their prompt and cost, and they still go through loadImageAsset's checks.
 */
export interface GeneratedImageProvider {
  readonly name: string;
  /** Estimated cost in USD before anything is spent; the caller enforces the cap. */
  estimate(request: { note: string; aspect: Aspect; alt: string }): Promise<number>;
  generate(request: { note: string; aspect: Aspect; alt: string; brandColors: string[] }): Promise<{ data: Buffer; mime: ImageMime; prompt: string; costUsd: number }>;
}
