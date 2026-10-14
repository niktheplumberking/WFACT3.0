/**
 * Track A colour tokens from the brand's four colours, with WCAG contrast computed, never assumed.
 * The brand accent is kept for shapes and rules; text and buttons use `accentInk`, the accent darkened
 * just enough to reach 4.5:1 on the paper (e.g. Summit Line's copper #B5642A is 3.9:1 on its cream, so
 * links and buttons use a deeper copper). A palette that cannot reach AA is an error the builder gets back.
 *
 * ON-BRIEF RULE (2026-10-14, Lanternworks run 4c35703b): every token this engine adds beyond the brief's four
 * colours is a TINT or SHADE of exactly one brief colour, i.e. that colour mixed with pure white or pure black.
 * Mixing with white/black keeps the colour's hue (up to 8-bit rounding), so a derived token never introduces a
 * new hue. Two brief colours are never blended together (that makes a hue the brief does not contain), and no
 * colour is ever picked from outside the brief. If no tint or shade of a brief colour reaches the contrast it
 * needs, the engine refuses with a message naming the colour, rather than inventing one. `tintShadeSource`
 * checks the rule and `buildPalette` runs it on its own output before returning (defence in depth).
 */

export interface BrandColors {
  ink: string;
  paper: string;
  accent: string;
  deep: string;
}

export interface Palette extends BrandColors {
  /** Accent for text and button fills: >= 4.5:1 against paper. */
  accentInk: string;
  /** Text on accentInk. */
  onAccent: string;
  /** Text on the deep brand field. */
  onDeep: string;
  /** Secondary text on paper, >= 4.5:1. */
  muted: string;
  /** Tinted section background (paper with a little deep), ink still >= 4.5:1 on it. */
  surface: string;
  /** Panel on the deep field. */
  deepPanel: string;
}

type Rgb = [number, number, number];

const toRgb = (hex: string): Rgb => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = ([r, g, b]: Rgb) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
export const mix = (a: string, b: string, t: number): string => {
  const x = toRgb(a);
  const y = toRgb(b);
  return toHex([0, 1, 2].map((i) => x[i]! + (y[i]! - x[i]!) * t) as Rgb);
};

export function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const AA = 4.5;
const WHITE = "#FFFFFF";
const BLACK = "#000000";

/** Hue in degrees (0-360) and chroma (max - min channel, 0-255) of a hex colour. */
export function hueChroma(hex: string): { hue: number; chroma: number } {
  const [r, g, b] = toRgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  if (chroma === 0) return { hue: 0, chroma: 0 };
  let h: number;
  if (max === r) h = ((g - b) / chroma) % 6;
  else if (max === g) h = (b - r) / chroma + 2;
  else h = (r - g) / chroma + 4;
  return { hue: (h * 60 + 360) % 360, chroma };
}

/**
 * The brief colour `token` is a tint or shade of (that colour mixed with white or black, any amount, allowing
 * 8-bit rounding), or null when it is not one: a token derived from two blended colours or a new hue.
 */
export function tintShadeSource(token: string, brief: string[]): { from: string; toward: "white" | "black"; t: number } | null {
  const c = toRgb(token);
  for (const from of brief) {
    const f = toRgb(from);
    for (const [toward, end] of [["white", 255], ["black", 0]] as const) {
      // Least-squares t for c = f + (end - f) * t, then check every channel is within rounding.
      let num = 0;
      let den = 0;
      for (let i = 0; i < 3; i += 1) {
        num += (c[i]! - f[i]!) * (end - f[i]!);
        den += (end - f[i]!) ** 2;
      }
      const t = den === 0 ? 0 : Math.min(1, Math.max(0, num / den));
      if ([0, 1, 2].every((i) => Math.abs(f[i]! + (end - f[i]!) * t - c[i]!) <= 1.5)) return { from, toward, t };
    }
  }
  return null;
}

/** Moves `color` toward `toward` in small steps until it reaches `min` (plus a margin) on every background. */
function reach(color: string, bgs: string[], toward: string, min: number): string | null {
  for (let i = 0; i <= 40; i += 1) {
    const c = mix(color, toward, i * 0.025);
    if (bgs.every((bg) => contrast(c, bg) >= min + 0.1)) return c;
  }
  return null;
}

/** Builds the tokens, or lists why the brand colours cannot meet WCAG AA. */
export function buildPalette(colors: BrandColors): { palette: Palette | null; problems: string[] } {
  const problems: string[] = [];
  const { ink, paper, accent, deep } = colors;
  const paperIsLight = luminance(paper) > luminance(ink);
  const away = paperIsLight ? BLACK : WHITE;
  /** The paper's end of the scale: tints toward it lighten on a light page and darken on a dark one. */
  const paperEnd = paperIsLight ? WHITE : BLACK;

  if (contrast(ink, paper) < AA) problems.push(`brand.colors: ink ${ink} on paper ${paper} is ${contrast(ink, paper).toFixed(2)}:1; body text needs at least 4.5:1.`);
  // The tinted section background: visibly different from the paper, still AA for ink. Links and buttons
  // sit on both, so the accent is tuned against both (tuning it on the paper alone made the tint fail
  // AA and silently fall back to the paper, so pages lost their section rhythm; found in the M3 live run).
  // It is a pale tint of the deep colour (deep mixed with the paper's end of the scale), never a blend of
  // paper and deep, which would be a hue the brief does not contain (on-brief rule above).
  let surface = mix(deep, paperEnd, 0.88);
  if (contrast(ink, surface) < AA) surface = paper;
  const accentInk = reach(accent, [paper, surface], away, AA);
  if (!accentInk) {
    problems.push(
      `brand.colors: no tint or shade of the accent ${accent} reaches 4.5:1 on paper ${paper}; the engine will not invent a new colour. Ask the client for a ${paperIsLight ? "darker" : "lighter"} accent or a different paper.`,
    );
  }
  const onDeep = contrast(paper, deep) >= contrast(ink, deep) ? paper : ink;
  if (contrast(onDeep, deep) < AA) problems.push(`brand.colors: deep ${deep} has no readable text colour (best is ${contrast(onDeep, deep).toFixed(2)}:1); it needs 4.5:1 with paper or ink.`);
  if (problems.length) return { palette: null, problems };

  const onAccent = contrast(paper, accentInk!) >= contrast(ink, accentInk!) ? paper : ink;
  if (contrast(onAccent, accentInk!) < AA) {
    return { palette: null, problems: [`brand.colors: no text colour reaches 4.5:1 on the adjusted accent ${accentInk}.`] };
  }
  // Secondary text appears on both the paper and the tinted surface: it must clear AA on each.
  // A lighter (or, on a dark page, darker) tint of the ink itself, not a blend of ink and paper.
  let muted = mix(ink, paperEnd, 0.2);
  if (Math.min(contrast(muted, paper), contrast(muted, surface)) < AA) muted = ink;
  // The panel on the deep field: the deep colour moved toward its text colour's end of the scale.
  const deepPanel = mix(deep, luminance(onDeep) > luminance(deep) ? WHITE : BLACK, 0.08);

  const palette: Palette = { ink, paper, accent, deep, accentInk: accentInk!, onAccent, onDeep, muted, surface, deepPanel };
  const offBrief = offBriefTokens(palette, [ink, paper, accent, deep]);
  if (offBrief.length) return { palette: null, problems: offBrief };
  return { palette, problems: [] };
}

/** Problems for every token that is not a brief colour or a tint/shade of one (empty when the palette is on-brief). */
export function offBriefTokens(tokens: object, brief: string[]): string[] {
  return Object.entries(tokens)
    .filter(([, v]) => typeof v === "string" && /^#[0-9A-F]{6}$/i.test(v) && !tintShadeSource(v, brief))
    .map(([k, v]) => `brand.colors: derived token ${k} ${v} is not a tint or shade of a brief colour (${brief.join(", ")}); the engine refuses to invent a colour.`);
}
