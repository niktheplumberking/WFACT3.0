/**
 * Template presets. As of 2026-09-22 both Motion Sites and 21st.dev credentials are real (see
 * BLOCKED-ON-NICK.md) and `clean-agency`'s styleGuidance below is genuinely sourced from them —
 * Motion Sites prompt id `agency-services` (Kanit font, dark→white rounded-top services section,
 * numbered list) and a 21st.dev search for "clean agency services homepage hero" (id 28280,
 * "Agency Hero Section" — sticky nav, trust avatars, marquee of client logos).
 *
 * One real constraint stayed even with real access, and it's the exact one the Manual's own
 * fallback already named: both services return React + Tailwind + framer-motion (Motion Sites) /
 * shadcn React components (21st.dev) — this pipeline's builder produces a single static HTML5
 * document with inline CSS, no build step (see loop.ts's system prompt), by deliberate design for
 * this proof sprint. So the real fetched content is *translated* below into inline-CSS-compatible
 * guidance (the same fonts, colors, layout structure, numbered-list pattern, fade-in behavior via
 * CSS transitions instead of framer-motion) rather than literally installed as React components.
 * That's a disclosed adaptation of real sourced content, not a fabricated design.
 *
 * `bold-startup` and `minimal-portfolio` are unchanged from Phase 4's original hand-picked set —
 * DreamSign's actual brief only exercises `clean-agency`; the other two stay as-is until a brief
 * that actually needs them lands, rather than spending real API calls sourcing content nothing
 * will use yet.
 */

export interface PageTemplate {
  id: string;
  name: string;
  description: string;
  /** Fed directly into the builder's system prompt as style constraints. */
  styleGuidance: string;
  /** Structural sections the evaluator checks for — see loop.ts's review step. */
  requiredSections: string[];
}

export const HAND_PICKED_TEMPLATES: PageTemplate[] = [
  {
    id: "clean-agency",
    name: "Clean Agency",
    description: "Restrained, high-trust layout for a services business — the DreamSign-style default.",
    styleGuidance:
      "Single-page, semantic HTML5 + inline CSS (no build step). Sourced from real Motion Sites " +
      "prompt `agency-services` and 21st.dev component search 'clean agency services homepage " +
      "hero' (id 28280 'Agency Hero Section'), translated from their React/Tailwind/framer-motion " +
      "originals into inline CSS: load Google Font 'Kanit' (weights 300-900) via a <link> tag in " +
      "<head>, font-family: 'Kanit', sans-serif on html/body. Hero: sticky/fixed top nav, a row of " +
      "3 small overlapping circular trust avatars plus a 'X+ businesses served' line, a bold " +
      "uppercase headline, one clear primary CTA button above the fold — a subtle marquee or row " +
      "of client-name logos beneath it if content allows. Services section: white background with " +
      "large rounded top corners (border-radius ~40-60px) sitting visually on top of a darker " +
      "section above it (#0C0C0C or similar near-black), generous vertical padding (~5-8rem). " +
      "Services heading set in a huge, black, uppercase, tight-tracking display size (clamp(3rem, " +
      "12vw, 160px)). List each service as a horizontal row: a large uppercase zero-padded number " +
      "(01, 02, ...) on the left in the same huge display weight, name + description stacked on " +
      "the right (description at ~60% opacity of the body color), a thin 1px divider between rows " +
      "(not above the first). Fade each row in on scroll via a CSS `@starting-style`/transition or " +
      "an IntersectionObserver-triggered class (translateY(30px)→0, opacity 0→1, ~0.7s ease, " +
      "staggered ~0.1s per row) — same visual effect as the source's framer-motion FadeIn, done " +
      "with plain CSS/JS since there's no build step here. One accent color elsewhere, sharp " +
      "corners on secondary elements, no stock-photo placeholders (use described empty states " +
      "instead). Mobile-first responsive via CSS Grid/Flexbox.",
    requiredSections: ["hero", "services", "process", "contact"],
  },
  {
    id: "bold-startup",
    name: "Bold Startup",
    description: "Higher-contrast, product-led layout for a launch-stage brand.",
    styleGuidance:
      "Single-page, semantic HTML5 + inline CSS (no build step). Strong type scale, a saturated " +
      "primary color against a neutral ground, rounded corners, a visible primary CTA above the fold. " +
      "Mobile-first responsive via CSS Grid/Flexbox.",
    requiredSections: ["hero", "value-props", "social-proof", "cta"],
  },
  {
    id: "minimal-portfolio",
    name: "Minimal Portfolio",
    description: "Content-forward layout for a small studio or individual practitioner.",
    styleGuidance:
      "Single-page, semantic HTML5 + inline CSS (no build step). Monochrome palette with one accent, " +
      "serif display headings over a sans-serif body, minimal chrome, text-led rather than " +
      "graphic-led. Mobile-first responsive via CSS Grid/Flexbox.",
    requiredSections: ["intro", "work-samples", "about", "contact"],
  },
];

/**
 * Explicit, readable selection — not a scoring model. `templatePreference` (if the brief names
 * one) wins; otherwise defaults to `clean-agency`, since that's the closest match to the DreamSign
 * placeholder brief this phase is proven against. This *is* the "hand-picked" fallback: a human
 * (or the brief) picks, nothing infers taste from a design system automatically.
 */
export function selectTemplate(
  templatePreference: string | undefined,
  templates: PageTemplate[] = HAND_PICKED_TEMPLATES,
): PageTemplate {
  if (templatePreference) {
    const match = templates.find((t) => t.id === templatePreference);
    if (match) return match;
  }
  const fallback = templates.find((t) => t.id === "clean-agency") ?? templates[0];
  if (!fallback) {
    throw new Error("No hand-picked templates configured — HAND_PICKED_TEMPLATES is empty.");
  }
  return fallback;
}
