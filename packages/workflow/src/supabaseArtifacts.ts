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
import { CheckpointIntegrityError, type ArtifactStore, type StoredArtifact } from "./buildAndVerify.js";

const BUCKET = "artifacts";
const PATH_RE = /^clients\/[a-z][a-z0-9-]*\/pages\/[a-z0-9-]+\.html$/;
const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

export class SupabaseArtifactStore implements ArtifactStore {
  private readonly base: string;

  constructor(url: string, private readonly serviceKey: string, private readonly fetchImpl: typeof fetch = fetch) {
    this.base = `${url.replace(/\/+$/, "")}/storage/v1/object/${BUCKET}`;
  }

  private headers(extra: Record<string, string> = {}) {
    return { apikey: this.serviceKey, Authorization: `Bearer ${this.serviceKey}`, ...extra };
  }

  async write(relPath: string, content: string): Promise<StoredArtifact> {
    if (!PATH_RE.test(relPath)) throw new CheckpointIntegrityError(`artifact path ${JSON.stringify(relPath)} is outside clients/<slug>/pages/`);
    const res = await this.fetchImpl(`${this.base}/${relPath}`, {
      method: "POST",
      headers: this.headers({ "Content-Type": "text/html", "x-upsert": "true" }),
      body: content,
    });
    if (!res.ok) throw new Error(`artifact upload failed (HTTP ${res.status}): ${(await res.text()).slice(0, 300)}`);
    return { path: relPath, sha256: sha256(content), bytes: Buffer.byteLength(content, "utf8") };
  }

  /** Raw read for callers that don't hold a checkpoint (e.g. a Cockpit "verify this page" job). */
  async read(relPath: string): Promise<string | null> {
    if (!PATH_RE.test(relPath)) throw new CheckpointIntegrityError(`artifact path ${JSON.stringify(relPath)} is outside clients/<slug>/pages/`);
    const res = await this.fetchImpl(`${this.base}/${relPath}`, { headers: this.headers() });
    if (res.status === 400 || res.status === 404) return null;
    if (!res.ok) throw new Error(`artifact download failed (HTTP ${res.status})`);
    return res.text();
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
