/**
 * Durable artifact store (Blueprint §14 "Artifact store: Yes") for Cockpit-triggered runs. A GitHub
 * Actions runner's disk vanishes when the job ends, so a page built there must live somewhere the
 * checkpoint can still point at: the private `artifacts` bucket (migration 0009). Same contract as
 * `FileArtifactStore` — the sha256 in the checkpoint is re-verified on every read, so a changed or
 * missing object is refused, never verified.
 *
 * Service-role only (writes and reads). The Cockpit reads via RLS (owner/admin) for previews.
 */
import { createHash } from "node:crypto";
import { ARTIFACT_PATH_RE, CheckpointIntegrityError, type ArtifactStore, type StoredArtifact } from "./buildAndVerify.js";

const BUCKET = "artifacts";
// Same allow-list as the file store: one page under pages/, or a site's files under sites/<site>/ (Step 4B M3).
const PATH_RE = ARTIFACT_PATH_RE;
const sha256 = (s: string | Buffer) => (typeof s === "string" ? createHash("sha256").update(s, "utf8") : createHash("sha256").update(s)).digest("hex");

/**
 * Content type per file extension. Must stay inside the bucket's allowed list (migrations 0009, 0012, 0014):
 * the static export (html, css, js, txt, svg, woff2, ico) and the Track B source (ts, tsx, mjs as text/plain).
 */
const CONTENT_TYPES: Record<string, string> = {
  html: "text/html",
  json: "application/json",
  webmanifest: "application/json",
  css: "text/css",
  js: "text/javascript",
  txt: "text/plain",
  xml: "text/plain",
  ts: "text/plain",
  tsx: "text/plain",
  mjs: "text/plain",
  svg: "image/svg+xml",
  woff2: "font/woff2",
  ico: "image/x-icon",
};
export const contentTypeFor = (relPath: string): string => {
  const type = CONTENT_TYPES[relPath.slice(relPath.lastIndexOf(".") + 1).toLowerCase()];
  if (!type) throw new CheckpointIntegrityError(`no artifact content type for ${JSON.stringify(relPath)}`);
  return type;
};

export class SupabaseArtifactStore implements ArtifactStore {
  private readonly base: string;

  constructor(url: string, private readonly serviceKey: string, private readonly fetchImpl: typeof fetch = fetch) {
    this.base = `${url.replace(/\/+$/, "")}/storage/v1/object/${BUCKET}`;
  }

  private headers(extra: Record<string, string> = {}) {
    return { apikey: this.serviceKey, Authorization: `Bearer ${this.serviceKey}`, ...extra };
  }

  async write(relPath: string, content: string): Promise<StoredArtifact> {
    await this.upload(relPath, content);
    return { path: relPath, sha256: sha256(content), bytes: Buffer.byteLength(content, "utf8") };
  }

  /** Step 4B M4: fonts and other binary files of a Track B site, stored as real bytes. */
  async writeBytes(relPath: string, bytes: Buffer): Promise<StoredArtifact> {
    await this.upload(relPath, bytes);
    return { path: relPath, sha256: sha256(bytes), bytes: bytes.length };
  }

  private async upload(relPath: string, body: string | Buffer): Promise<void> {
    if (!PATH_RE.test(relPath)) throw new CheckpointIntegrityError(`artifact path ${JSON.stringify(relPath)} is outside clients/<slug>/pages/ and clients/<slug>/sites/`);
    const res = await this.fetchImpl(`${this.base}/${relPath}`, {
      method: "POST",
      headers: this.headers({ "Content-Type": contentTypeFor(relPath), "x-upsert": "true" }),
      body: typeof body === "string" ? body : new Uint8Array(body),
    });
    if (!res.ok) throw new Error(`artifact upload failed (HTTP ${res.status}): ${(await res.text()).slice(0, 300)}`);
  }

  /** Raw read for callers that don't hold a checkpoint (e.g. a Cockpit "verify this page" job). */
  async read(relPath: string): Promise<string | null> {
    if (!PATH_RE.test(relPath)) throw new CheckpointIntegrityError(`artifact path ${JSON.stringify(relPath)} is outside clients/<slug>/pages/ and clients/<slug>/sites/`);
    const res = await this.fetchImpl(`${this.base}/${relPath}`, { headers: this.headers() });
    if (res.status === 400 || res.status === 404) return null;
    if (!res.ok) throw new Error(`artifact download failed (HTTP ${res.status})`);
    return res.text();
  }

  async readVerifiedBytes(artifact: StoredArtifact): Promise<Buffer> {
    if (!PATH_RE.test(artifact.path)) throw new CheckpointIntegrityError(`artifact path ${JSON.stringify(artifact.path)} is outside clients/<slug>/pages/ and clients/<slug>/sites/`);
    const res = await this.fetchImpl(`${this.base}/${artifact.path}`, { headers: this.headers() });
    if (res.status === 400 || res.status === 404) throw new CheckpointIntegrityError(`checkpointed artifact ${artifact.path} is missing from storage`);
    if (!res.ok) throw new Error(`artifact download failed (HTTP ${res.status})`);
    const bytes = Buffer.from(await res.arrayBuffer());
    if (sha256(bytes) !== artifact.sha256) {
      throw new CheckpointIntegrityError(`checkpointed artifact ${artifact.path} no longer matches its checkpoint hash — refusing to verify a changed file`);
    }
    return bytes;
  }

  async readVerified(artifact: StoredArtifact): Promise<string> {
    const content = await this.read(artifact.path);
    if (content === null) throw new CheckpointIntegrityError(`checkpointed artifact ${artifact.path} is missing from storage`);
    if (sha256(content) !== artifact.sha256) {
      throw new CheckpointIntegrityError(`checkpointed artifact ${artifact.path} no longer matches its checkpoint hash — refusing to verify a changed file`);
    }
    return content;
  }
}
