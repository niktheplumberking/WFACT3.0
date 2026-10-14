/**
 * Track B colour tokens. Same contrast engine as Track A (`buildPalette`: computed WCAG ratios, an
 * accent darkened or lightened just enough for text), with one difference: Track B's tinted surface (the
 * process and contact fields, the third work panel) is pushed much further toward the brand's deep
 * colour, because on a dark page Track A's 12% tint is indistinguishable from the paper. The strongest
 * tint at which body text, secondary text and the accent all still reach 4.5:1 is used.
 *
 * It also adds `dim`: the faintest text colour (ink moved toward the paper) that still reaches 4.5:1 on
 * the paper. The statement's scroll-reading effect lights words from `dim` to `ink`, so text is readable
 * at every point of the effect (Step 4B M4: dimming by opacity failed axe colour-contrast).
 *
 * Same ON-BRIEF RULE as Track A (see trackA/palette.ts): every derived token is a tint or shade of ONE brief
 * colour (mixed with white or black only), never a blend of two brief colours and never a new hue. The surface
 * is the deep colour moved toward the paper's end of the scale; `dim` is the ink moved toward it.
 */
import { buildPalette, contrast, luminance, mix, offBriefTokens, type BrandColors, type Palette } from "../trackA/palette.js";

export interface TrackBPalette extends Palette {
  /** Faintest readable text on the paper (>= 4.5:1); the scroll-reading effect starts here. */
  dim: string;
  /**
   * The fill of a button (Build-quality Package 2): the brand accent itself whenever ink or paper reads on it at 4.5:1
   * (ink #14213D on Lanternworks' #F26B38 is about 5.0:1), so buttons are the client's colour, not a darkened shade the
   * client never chose (rehearsal log #16: CTAs used #9D4624). Otherwise the text-safe accentInk, as before.
   */
  action: string;
  /** Button text on `action`: ink or paper, whichever reads better (>= 4.5:1). */
  onAction: string;
}

const AA = 4.5;

export function buildTrackBPalette(colors: BrandColors): { palette: TrackBPalette | null; problems: string[] } {
  const base = buildPalette(colors);
  if (!base.palette) return { palette: null, problems: base.problems };
  const p = base.palette;
  const paperEnd = luminance(p.paper) > luminance(p.ink) ? "#FFFFFF" : "#000000";
  const readable = (bg: string) => [p.ink, p.muted, p.accentInk].every((fg) => contrast(fg, bg) >= AA + 0.1);
  let surface = p.surface;
  for (let t = 0.6; t > 0.12; t -= 0.04) {
    const candidate = mix(p.deep, paperEnd, 1 - t);
    if (readable(candidate)) {
      surface = candidate;
      break;
    }
  }
  // Text on the panel tone is onDeep; keep the lifted panel only while that stays readable.
  const deepPanel = contrast(p.onDeep, p.deepPanel) >= AA + 0.1 ? p.deepPanel : p.deep;
  let dim = p.ink;
  for (let t = 0.7; t > 0; t -= 0.02) {
    const candidate = mix(p.ink, paperEnd, t);
    if (contrast(candidate, p.paper) >= AA + 0.1) {
      dim = candidate;
      break;
    }
  }
  const onBrandAccent = contrast(p.ink, p.accent) >= contrast(p.paper, p.accent) ? p.ink : p.paper;
  const brandFill = contrast(onBrandAccent, p.accent) >= AA + 0.1;
  const action = brandFill ? p.accent : p.accentInk;
  const onAction = brandFill ? onBrandAccent : p.onAccent;
  const palette: TrackBPalette = { ...p, surface, deepPanel, dim, action, onAction };
  const offBrief = offBriefTokens(palette, [colors.ink, colors.paper, colors.accent, colors.deep]);
  if (offBrief.length) return { palette: null, problems: offBrief };
  return { palette, problems: [] };
}
