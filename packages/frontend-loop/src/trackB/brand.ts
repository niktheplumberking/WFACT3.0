/**
 * What the brand promises, for the Track B brand checks in rendered QA (Build-quality Package 2): computed here from the
 * brief, the content and the palette engine, never read from the built page.
 */
import type { PilotBrief } from "../brief.js";
import type { SiteContent } from "./content.js";
import { buildTrackBPalette } from "./palette.js";

/**
 * True when the client reserves the accent for actions ("one signal orange for buttons and links only", "reserved for
 * interactive elements"). Read from the client's own request and the approved brand notes.
 */
export function accentForActionsOnly(brief: Pick<PilotBrief, "brandNotes" | "requestText">): boolean {
  const text = `${brief.brandNotes}\n${brief.requestText ?? ""}`.toLowerCase();
  return text.split(/[.\n;]+/).some(
    (s) =>
      /\b(accent|orange|red|yellow|green|blue|colou?r|#[0-9a-f]{6})\b/.test(s) &&
      (/\b(for|on)\s+(the\s+)?(buttons?|links?|actions?|calls? to action|ctas?)(\s+(and|or)\s+(buttons?|links?|actions?))?\s+only\b/.test(s) ||
        /\bonly\s+(for|on)\s+(the\s+)?(buttons?|links?|actions?|ctas?)\b/.test(s) ||
        /\breserved\s+for\s+(interactive\s+elements|buttons?|links?|actions?|ctas?)\b/.test(s)),
  );
}

export interface TrackBBrand {
  logo: boolean;
  primaryActionLabel: string;
  accent: string;
  accentDerived: string[];
  accentActionsOnly: boolean;
}

export function trackBBrand(content: SiteContent, brief: Pick<PilotBrief, "brandNotes" | "requestText">, hasLogo: boolean): TrackBBrand {
  const { palette } = buildTrackBPalette(content.brand.colors);
  const accent = content.brand.colors.accent.toUpperCase();
  return {
    logo: hasLogo,
    primaryActionLabel: content.primaryAction.label,
    accent,
    accentDerived: palette && palette.accentInk.toUpperCase() !== accent ? [palette.accentInk.toUpperCase()] : [],
    accentActionsOnly: accentForActionsOnly(brief),
  };
}
