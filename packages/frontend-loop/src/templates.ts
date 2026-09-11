/**
 * Hand-picked template presets. Phase 4's real target is dynamic template selection through the
 * Motion Sites + 21st.dev MCPs (`docs/wfact-3.0-operator-manual.html`, Phase 4 checklist: "Wire
 * Motion Sites MCP," "Wire 21st.dev MCP"). Both are still OPEN in `BLOCKED-ON-NICK.md` ("Motion
 * Sites MCP credentials," "21st.dev premium account credentials," due Day 9). The Manual's own
 * named fallback for this: "21st.dev's React/Tailwind lean doesn't match how sites actually ship →
 * Hand-pick 2–3 templates manually for this proof instead of full dynamic selection. Note it as a
 * fix-later item, don't let it block the phase." This file is that fix-later item, taken openly.
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
      "Single-page, semantic HTML5 + inline CSS (no build step). Generous whitespace, one accent " +
      "color, a sans-serif system font stack, sharp corners over rounded, no stock-photo placeholders " +
      "(use described empty states instead). Mobile-first responsive via CSS Grid/Flexbox.",
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
