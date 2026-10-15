/**
 * The one brand-colour rule every judge of a page applies (decided by Huraira, 2026-10-15, Lanternworks job e2a204fb).
 * The palette engines (frontend-loop trackA/trackB palette.ts) derive tints and shades of the brief's colours for WCAG
 * contrast, and fill buttons with the brief's accent itself whenever its text reaches 4.5:1. e2a204fb failed every
 * revision because a judge read "only the three brand colours" as "no derived tone at all", which the engine can
 * never satisfy without breaking contrast. The evaluator (evaluator.ts RUBRIC) and the screenshot reviewer
 * (rendered-qa reviewer.ts) both quote this text, so the engine and both judges hold the same rule.
 */
export const BRAND_COLOUR_RULE = [
  "Brand colours: tints and shades of the brief's colours (the same hue mixed with white or black, e.g. a darker",
  "orange for readable link text, a pale tint of the navy for a section background, a lighter ink for secondary",
  "text) are computed by the factory for WCAG contrast and are ON-BRIEF, also when the brief says to use only its",
  "colours: that means no other HUE, not no derived tone. Never flag them. Buttons use the brief's accent itself",
  "whenever their text reads on it at 4.5:1, otherwise a shade of that same accent, which is on-brief. Flag a colour",
  "only when its hue does not come from any of the brief's colours.",
].join(" ");
