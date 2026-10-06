/** No network, no credits: the SDK client is a fake. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { configureFromEnv, generateSeedanceVideo, SeedanceError, SEEDANCE_TEXT_TO_VIDEO, type SubscribeClient } from "../src/seedance.js";

const fake = (res: Awaited<ReturnType<SubscribeClient["subscribe"]>>) => {
  const calls: Parameters<SubscribeClient["subscribe"]>[] = [];
  return { calls, client: { subscribe: async (...a: Parameters<SubscribeClient["subscribe"]>) => (calls.push(a), res) } as SubscribeClient };
};
const INPUT = { prompt: "A cinematic scene at sunset", duration: 5, resolution: "720p", aspect_ratio: "16:9" } as const;

test("a completed request with a video URL is the only success; the exact model and input are sent, polling on", async () => {
  const f = fake({ status: "completed", request_id: "r1", video: { url: "https://cdn.example/v.mp4" } });
  assert.deepEqual(await generateSeedanceVideo(INPUT, f.client), { requestId: "r1", url: "https://cdn.example/v.mp4" });
  assert.deepEqual(f.calls[0], [SEEDANCE_TEXT_TO_VIDEO, { input: INPUT, withPolling: true }]);
});

for (const [status, why] of [["failed", /failed/], ["nsfw", /moderation/], ["canceled", /canceled/], ["queued", /ended in status "queued"/]] as const) {
  test(`status "${status}" is an error naming the request, never a success`, async () => {
    const err = await generateSeedanceVideo(INPUT, fake({ status: status as never, request_id: "r2" }).client).catch((e) => e);
    assert.ok(err instanceof SeedanceError);
    assert.equal(err.status, status);
    assert.match(err.message, /r2/);
    assert.match(err.message, why);
  });
}

test("completed without a video URL is not a success", async () => {
  await assert.rejects(generateSeedanceVideo(INPUT, fake({ status: "completed", request_id: "r3" }).client), /without a video URL/);
});

test("bad input is refused before any request", async () => {
  const f = fake({ status: "completed", request_id: "r4", video: { url: "x" } });
  await assert.rejects(generateSeedanceVideo({ ...INPUT, duration: 3 }, f.client), /4 to 30/);
  await assert.rejects(generateSeedanceVideo({ ...INPUT, prompt: "  " }, f.client), /prompt is required/);
  assert.equal(f.calls.length, 0);
});

test("credentials: missing or malformed is refused, and the error never contains the value", () => {
  assert.throws(() => configureFromEnv({}), /HF_CREDENTIALS is not set/);
  const err = (() => { try { configureFromEnv({ HF_CREDENTIALS: "no-colon-secret-value" }); } catch (e) { return e as Error; } })();
  assert.match(err!.message, /key-id:key-secret/);
  assert.doesNotMatch(err!.message, /no-colon-secret-value/);
});
