/**
 * Track A colour tokens from the brand's four colours, with WCAG contrast computed, never assumed.
 * The brand accent is kept for shapes and rules; text and buttons use `accentInk`, the accent darkened
 * just enough to reach 4.5:1 on the paper (e.g. Summit Line's copper #B5642A is 3.9:1 on its cream, so
 * links and buttons use a deeper copper). A palette that cannot reach AA is an error the builder gets back.
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
const mix = (a: string, b: string, t: number): string => {
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

/** Moves `color` toward `toward` in small steps until it reaches `min` (plus a margin) on `bg`. */
function reach(color: string, bg: string, toward: string, min: number): string | null {
  for (let i = 0; i <= 40; i += 1) {
    const c = mix(color, toward, i * 0.025);
    if (contrast(c, bg) >= min + 0.1) return c;
  }
  return null;
}

/** Builds the tokens, or lists why the brand colours cannot meet WCAG AA. */
export function buildPalette(colors: BrandColors): { palette: Palette | null; problems: string[] } {
  const problems: string[] = [];
  const { ink, paper, accent, deep } = colors;
  const paperIsLight = luminance(paper) > luminance(ink);
  const away = paperIsLight ? "#000000" : "#FFFFFF";

  if (contrast(ink, paper) < AA) problems.push(`brand.colors: ink ${ink} on paper ${paper} is ${contrast(ink, paper).toFixed(2)}:1; body text needs at least 4.5:1.`);
  const accentInk = reach(accent, paper, away, AA);
  if (!accentInk) problems.push(`brand.colors: accent ${accent} cannot be adjusted to 4.5:1 on paper ${paper}.`);
  const onDeep = contrast(paper, deep) >= contrast(ink, deep) ? paper : ink;
  if (contrast(onDeep, deep) < AA) problems.push(`brand.colors: deep ${deep} has no readable text colour (best is ${contrast(onDeep, deep).toFixed(2)}:1); it needs 4.5:1 with paper or ink.`);
  if (problems.length) return { palette: null, problems };

  const onAccent = contrast(paper, accentInk!) >= contrast(ink, accentInk!) ? paper : ink;
  if (contrast(onAccent, accentInk!) < AA) {
    return { palette: null, problems: [`brand.colors: no text colour reaches 4.5:1 on the adjusted accent ${accentInk}.`] };
  }
  let surface = mix(paper, deep, 0.1);
  if (contrast(ink, surface) < AA || contrast(accentInk!, surface) < AA) surface = paper;
  // Secondary text appears on both the paper and the tinted surface: it must clear AA on each.
  let muted = mix(ink, paper, 0.28);
  if (Math.min(contrast(muted, paper), contrast(muted, surface)) < AA) muted = ink;
  const deepPanel = mix(deep, onDeep, 0.08);

  return { palette: { ink, paper, accent, deep, accentInk: accentInk!, onAccent, onDeep, muted, surface, deepPanel }, problems: [] };
}
