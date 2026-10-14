/* Appearance (Cockpit v2, docs/design/cockpit-v2): light by default, dark and "match my device" by choice.
   Accent is personal and never means status. Everything here is a root attribute that tokens.css reads:
   data-theme, data-accent, data-density, data-motion, and --text-scale for the text-size setting.
   Kept in this browser until per-person settings land with the Settings room (phase 13). */

export type Theme = "light" | "dark" | "system";
export type Accent = "ink" | "harbour" | "clay" | "moss";
export type Density = "comfortable" | "compact";
export type TextSize = 100 | 112 | 125;

export interface Appearance {
  theme: Theme;
  accent: Accent;
  density: Density;
  textSize: TextSize;
  reduceMotion: boolean;
}

export const DEFAULT_APPEARANCE: Appearance = { theme: "light", accent: "ink", density: "comfortable", textSize: 100, reduceMotion: false };

const KEY = "cockpit-appearance";
const LEGACY_THEME_KEY = "cockpit-theme";

const THEMES: Theme[] = ["light", "dark", "system"];
const ACCENTS: Accent[] = ["ink", "harbour", "clay", "moss"];
const DENSITIES: Density[] = ["comfortable", "compact"];
const SIZES: TextSize[] = [100, 112, 125];

/** Accepts anything (stored JSON may be old or hand-edited) and returns a valid Appearance. */
export function normalise(raw: unknown): Appearance {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pick = <T>(list: T[], v: unknown, d: T): T => (list.includes(v as T) ? (v as T) : d);
  return {
    theme: pick(THEMES, r.theme, DEFAULT_APPEARANCE.theme),
    accent: pick(ACCENTS, r.accent, DEFAULT_APPEARANCE.accent),
    density: pick(DENSITIES, r.density, DEFAULT_APPEARANCE.density),
    textSize: pick(SIZES, r.textSize, DEFAULT_APPEARANCE.textSize),
    reduceMotion: r.reduceMotion === true,
  };
}

export function readAppearance(): Appearance {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored) return normalise(JSON.parse(stored));
    // A theme chosen before v2 carries over; everything else starts at the default.
    const legacy = localStorage.getItem(LEGACY_THEME_KEY);
    return normalise({ theme: legacy });
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

export function saveAppearance(a: Appearance): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(a));
  } catch {
    /* private mode: the choice lasts for this visit */
  }
}

/** Whether the theme resolves to dark right now ("system" follows the device). */
export function isDark(theme: Theme): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return !!window.matchMedia?.("(prefers-color-scheme: dark)").matches;
}

export function applyAppearance(a: Appearance, root: HTMLElement = document.documentElement): void {
  const dark = isDark(a.theme);
  if (dark) root.setAttribute("data-theme", "dark");
  else root.removeAttribute("data-theme");
  if (a.accent === "ink") root.removeAttribute("data-accent");
  else root.setAttribute("data-accent", a.accent);
  if (a.density === "compact") root.setAttribute("data-density", "compact");
  else root.removeAttribute("data-density");
  if (a.reduceMotion) root.setAttribute("data-motion", "reduce");
  else root.removeAttribute("data-motion");
  root.style.setProperty("--text-scale", String(a.textSize / 100));
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute("content", dark ? "#121211" : "#F4F2ED");
}

/** Re-applies when the device switches light/dark, for people on "Match my device". Returns a cleanup. */
export function followDevice(get: () => Appearance): () => void {
  const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
  if (!mq?.addEventListener) return () => {};
  const on = () => {
    const a = get();
    if (a.theme === "system") applyAppearance(a);
  };
  mq.addEventListener("change", on);
  return () => mq.removeEventListener("change", on);
}
