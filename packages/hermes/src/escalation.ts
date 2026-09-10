/**
 * Bounded retry with exponential backoff, then escalate. Per CLAUDE.md §6: "Retries: bounded,
 * exponential backoff, hard cap, then escalate to a human. Never retry silently forever."
 */

export class EscalationError extends Error {
  constructor(
    public readonly reason: string,
    public readonly attempts: number,
    public readonly lastError: unknown,
  ) {
    super(`Escalating to a human after ${attempts} attempt(s): ${reason}`);
    this.name = "EscalationError";
  }
}

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  /** Injectable so tests don't sleep for real. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function withBoundedRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: RetryOptions,
): Promise<T> {
  const sleep = opts.sleep ?? defaultSleep;
  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (attempt < opts.maxAttempts) {
        const delay = opts.baseDelayMs * 2 ** (attempt - 1);
        await sleep(delay);
      }
    }
  }

  const reason = lastError instanceof Error ? lastError.message : String(lastError);
  throw new EscalationError(reason, opts.maxAttempts, lastError);
}
