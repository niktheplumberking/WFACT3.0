/**
 * Seedance 2.5 text-to-video through the Higgsfield API (official SDK, `@higgsfield/client/v2`).
 *
 * Server-side only. The credential is read from HF_CREDENTIALS ("key-id:key-secret") at runtime, which
 * Doppler injects (`doppler run --`); it is never in a file in this repo, never logged, never echoed in an
 * error. A request counts as done only when the API says "completed" AND returns a video URL. Every other
 * outcome (failed, nsfw / moderated, canceled, a missing URL, an unknown status) is a SeedanceError naming
 * the request id, never a success. Polling is bounded (maxPollTime) and the SDK throws on the cap.
 */
import { config, higgsfield, type V2Response } from "@higgsfield/client/v2";

export const SEEDANCE_TEXT_TO_VIDEO = "bytedance/seedance-2.5/text-to-video";

export interface SeedanceInput {
  prompt: string;
  /** Seconds, 4-30 (API default 5). */
  duration?: number;
  resolution?: "480p" | "720p" | "1080p";
  aspect_ratio?: "16:9" | "4:3" | "1:1" | "3:4" | "9:16" | "21:9";
  output_format?: "mp4" | "mov";
  generate_audio?: boolean;
}

export interface SeedanceVideo {
  requestId: string;
  url: string;
}

export class SeedanceError extends Error {
  constructor(
    message: string,
    readonly status: string,
    readonly requestId: string | null,
  ) {
    super(message);
    this.name = "SeedanceError";
  }
}

/** The part of the SDK client this module uses; replaceable in tests so no test spends credits. */
export interface SubscribeClient {
  subscribe(endpoint: string, options: { input: SeedanceInput; withPolling: boolean }): Promise<Pick<V2Response, "status" | "request_id" | "video">>;
}

const CREDENTIALS = /^[^:\s]+:[^:\s]+$/;
/** Video takes longer than the SDK's 5-minute polling default; still a hard cap, then the SDK throws. */
export const MAX_POLL_MS = 15 * 60_000;

/** Configures the SDK from the environment. Throws without the value: the message names the variable, never its contents. */
export function configureFromEnv(env: NodeJS.ProcessEnv = process.env): void {
  const credentials = env.HF_CREDENTIALS;
  if (!credentials) throw new SeedanceError("HF_CREDENTIALS is not set; run through Doppler (doppler run -- ...).", "not_configured", null);
  if (!CREDENTIALS.test(credentials)) throw new SeedanceError('HF_CREDENTIALS must be in "key-id:key-secret" format.', "not_configured", null);
  config({ credentials, maxPollTime: MAX_POLL_MS });
}

export function validateInput(input: SeedanceInput): void {
  if (!input.prompt.trim()) throw new SeedanceError("prompt is required.", "bad_input", null);
  const d = input.duration;
  if (d !== undefined && (!Number.isInteger(d) || d < 4 || d > 30)) throw new SeedanceError("duration must be a whole number of seconds from 4 to 30.", "bad_input", null);
}

/** Submits, waits for the result, and returns the video URL only for a completed request. */
export async function generateSeedanceVideo(input: SeedanceInput, client: SubscribeClient = higgsfield): Promise<SeedanceVideo> {
  validateInput(input);
  const res = await client.subscribe(SEEDANCE_TEXT_TO_VIDEO, { input, withPolling: true });
  const status = String(res.status);
  const requestId = res.request_id ?? null;
  if (status === "completed") {
    const url = res.video?.url;
    if (!url) throw new SeedanceError(`request ${requestId} completed without a video URL; not treated as a success.`, status, requestId);
    return { requestId: requestId ?? "", url };
  }
  const why =
    status === "nsfw" ? "was blocked by content moderation" :
    status === "failed" ? "failed" :
    status === "canceled" || status === "cancelled" ? "was canceled" :
    `ended in status "${status}"`;
  throw new SeedanceError(`Seedance request ${requestId} ${why}; no video was produced.`, status, requestId);
}
