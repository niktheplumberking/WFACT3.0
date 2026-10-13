/**
 * fetch for model calls that may take longer than five minutes.
 *
 * Node's built-in fetch (undici) gives up when no response headers arrive within 300 s (`headersTimeout`) or
 * the body stalls for 300 s (`bodyTimeout`). It then throws a bare "fetch failed" (cause UND_ERR_HEADERS_TIMEOUT),
 * whatever AbortSignal.timeout the caller set. That cut every Agent 37 screenshot review at 300.4-300.9 s
 * (model_traces, 2026-10-13; reproduced locally: 301,008 ms, UND_ERR_HEADERS_TIMEOUT), so a caller's own 6- or
 * 10-minute timeout never applied. This fetch raises both limits a little above the caller's timeout, so the
 * caller's AbortSignal is always the one that ends a slow call, with its own message.
 *
 * Same file in packages/frontend-loop and packages/rendered-qa (no shared package between them).
 */
import { Agent, fetch as undiciFetch } from "undici";

/** Headroom above the caller's own timeout, so its AbortSignal fires first. */
export const DISPATCHER_HEADROOM_MS = 30_000;

export function fetchWithTimeout(callerTimeoutMs: number): typeof fetch {
  const limit = callerTimeoutMs + DISPATCHER_HEADROOM_MS;
  const dispatcher = new Agent({ headersTimeout: limit, bodyTimeout: limit });
  return ((input: Parameters<typeof fetch>[0], init?: RequestInit) =>
    undiciFetch(input as Parameters<typeof undiciFetch>[0], { ...(init as Parameters<typeof undiciFetch>[1]), dispatcher })) as unknown as typeof fetch;
}
