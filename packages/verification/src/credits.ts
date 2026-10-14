/**
 * Out-of-money detection shared by the evaluator (modelClient.ts) and the screenshot reviewer (packages/rendered-qa).
 * Dependency-free on purpose so the reviewer can import it without the Anthropic SDK.
 *
 * HTTP 402, Anthropic's 400 "credit balance is too low" and OpenAI's 429 insufficient_quota all mean the provider
 * account has no credit left. Retrying cannot help, so callers fail at once, with a reason containing the words
 * "credits exhausted": the Cockpit's recovery classifier maps that to the "money" bucket (a human tops up).
 */
export const CREDITS_EXHAUSTED = "credits exhausted";

/** True when an HTTP status + response text means the account has no credit left (never retry these). */
export function isCreditsExhausted(status: number | undefined, body: string): boolean {
  if (status === 402) return true;
  return (status === 400 || status === 429) && /credit balance is too low|insufficient_quota|exceeded your current quota|credits exhausted/i.test(body);
}
