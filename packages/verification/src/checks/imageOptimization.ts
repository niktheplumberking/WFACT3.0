/**
 * Image optimization — one of the Manual's 5 named Phase 5 example checks. Two checks in one,
 * both cheap and deterministic against the raw HTML: every <img> must carry a non-empty `alt`
 * (accessibility + SEO, ties into `ecc:accessibility`/`ecc:seo` conventions this repo references
 * elsewhere), and no embedded base64 `data:image` URI may exceed a size threshold — a bloated
 * inline image is a real page-weight defect a template-driven builder can easily produce by
 * embedding an oversized placeholder instead of describing an empty state (see
 * `templates.ts`'s "no stock-photo placeholders" guidance for `clean-agency`).
 */
import type { Check, CheckResult, VerificationContext } from "./types.js";

const IMG_TAG_PATTERN = /<img\b[^>]*>/gi;
const ALT_ATTR_PATTERN = /\balt\s*=\s*(["'])(.*?)\1/i;
const DATA_URI_PATTERN = /src\s*=\s*["'](data:image\/[a-zA-Z+.-]+;base64,([A-Za-z0-9+/=]+))["']/i;

/** ~150KB decoded, a generous-but-real ceiling for a single embedded image on a marketing page. */
const MAX_BASE64_IMAGE_BYTES = 150_000;

export const imageOptimizationCheck: Check = {
  id: "image-optimization",
  description: "Every <img> needs a real alt attribute, and no embedded image may be bloated.",
  run(ctx: VerificationContext): CheckResult {
    const details: string[] = [];
    let match: RegExpExecArray | null;
    let imgIndex = 0;
    IMG_TAG_PATTERN.lastIndex = 0;
    while ((match = IMG_TAG_PATTERN.exec(ctx.html)) !== null) {
      imgIndex += 1;
      const tag = match[0];

      const altMatch = tag.match(ALT_ATTR_PATTERN);
      if (!altMatch || (altMatch[2] ?? "").trim().length === 0) {
        details.push(`<img> #${imgIndex} is missing a non-empty alt attribute.`);
      }

      const dataUriMatch = tag.match(DATA_URI_PATTERN);
      if (dataUriMatch) {
        // Base64 inflates size by ~4/3 — approximate decoded bytes from the encoded length.
        const decodedBytes = Math.floor(((dataUriMatch[2] ?? "").length * 3) / 4);
        if (decodedBytes > MAX_BASE64_IMAGE_BYTES) {
          details.push(
            `<img> #${imgIndex} embeds a base64 image of ~${Math.round(decodedBytes / 1024)}KB — ` +
              `over the ${Math.round(MAX_BASE64_IMAGE_BYTES / 1024)}KB threshold, unoptimized.`,
          );
        }
      }
    }
    return { checkId: "image-optimization", passed: details.length === 0, details };
  },
};
