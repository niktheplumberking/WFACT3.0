/**
 * SupabaseArtifactStore reads must not be served from Supabase's CDN cache. Live, a plain GET of
 * /object/artifacts/<path> returned the previous copy right after an upsert, so a correction cycle that
 * overwrote site.manifest.json was refused as "no longer matches its checkpoint hash" (Cockpit jobs
 * 21350a42 and 5ed238ac, 2026-10-01). The fake below caches plain GETs the way the edge did.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { SupabaseArtifactStore } from "../src/supabaseArtifacts.js";
import { CheckpointIntegrityError } from "../src/buildAndVerify.js";

const URL_ROOT = "https://example.supabase.co";

function cachingStorage() {
  const origin = new Map<string, Buffer>();
  const edge = new Map<string, Buffer>(); // keyed by the full request URL, as the CDN keys it
  const reads: string[] = [];
  const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const u = new URL(url);
    const objectPath = u.pathname.replace(/^\/storage\/v1\/object\/(authenticated\/)?artifacts\//, "");
    if (init?.method === "POST") {
      const body = init.body;
      origin.set(objectPath, typeof body === "string" ? Buffer.from(body, "utf8") : Buffer.from(body as Uint8Array));
      return new Response("{}", { status: 200 });
    }
    reads.push(url);
    const cacheable = !u.pathname.includes("/authenticated/");
    if (cacheable && edge.has(url)) return new Response(new Uint8Array(edge.get(url)!), { status: 200 });
    const bytes = origin.get(objectPath);
    if (!bytes) return new Response("not found", { status: 404 });
    if (cacheable) edge.set(url, bytes);
    return new Response(new Uint8Array(bytes), { status: 200 });
  }) as typeof fetch;
  return { fetchImpl, reads };
}

test("an overwritten checkpoint reads back fresh, not the CDN's previous copy", async () => {
  const { fetchImpl, reads } = cachingStorage();
  const store = new SupabaseArtifactStore(URL_ROOT, "service-key", fetchImpl);
  const p = "clients/summit-line-roofing/sites/track-a/site.manifest.json";

  const first = await store.write(p, '{"cycle":0}\n');
  assert.equal(await store.readVerified(first), '{"cycle":0}\n');
  const second = await store.write(p, '{"cycle":1}\n');
  assert.equal(await store.readVerified(second), '{"cycle":1}\n');

  const font = "clients/summit-line-roofing/sites/track-b/fonts/a.woff2";
  const before = await store.writeBytes(font, Buffer.from([1, 2, 3]));
  await store.readVerifiedBytes(before);
  const after = await store.writeBytes(font, Buffer.from([4, 5, 6]));
  assert.deepEqual([...(await store.readVerifiedBytes(after))], [4, 5, 6]);

  // Every read went to the authenticated endpoint with a one-off query string.
  assert.ok(reads.every((u) => u.includes("/object/authenticated/artifacts/") && /\?fresh=[0-9a-f-]{36}$/.test(u)));
  assert.equal(new Set(reads).size, reads.length);
});

test("a genuinely changed artifact is still refused", async () => {
  const { fetchImpl } = cachingStorage();
  const store = new SupabaseArtifactStore(URL_ROOT, "service-key", fetchImpl);
  const p = "clients/summit-line-roofing/sites/track-a/site.manifest.json";
  const checkpoint = await store.write(p, '{"cycle":0}\n');
  await store.write(p, '{"tampered":true}\n');
  await assert.rejects(store.readVerified(checkpoint), CheckpointIntegrityError);
});
