// Proves the locked v2 tokens (docs/design/cockpit-v2) are in tokens.css exactly, and that every text colour
// clears WCAG AA 4.5:1 on every surface it can sit on, in light and dark. Reads the real stylesheet.
import { describe, expect, it } from "vitest";
import css from "./tokens.css?raw";
import appCss from "./app.css?raw";

function block(selector: string): Record<string, string> {
  const at = css.indexOf(`${selector} {`);
  if (at < 0) throw new Error(`no ${selector} block`);
  const body = css.slice(css.indexOf("{", at) + 1, css.indexOf("}", at));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)) out[m[1]] = m[2].toUpperCase();
  return out;
}

const light = block(":root");
const dark = { ...light, ...block('[data-theme="dark"]') };

function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

describe("v2 tokens", () => {
  it("match the locked values", () => {
    expect(light).toMatchObject({
      paper: "#F4F2ED", sheet: "#FBFAF7", sunk: "#ECE9E2", line: "#DFDBD2", "line-2": "#C7C1B5",
      ink: "#1C1B18", "ink-2": "#46433D", "ink-3": "#625E55", inv: "#FBFAF7",
      need: "#8A4F00", "need-dot": "#D4891F", "need-w": "#F5E6CC", done: "#2A6641", "done-w": "#DCEADF",
      stop: "#A93322", "stop-w": "#F6DDD7", acc: "#1C1B18", "acc-ink": "#FBFAF7",
    });
    expect(dark).toMatchObject({
      paper: "#121211", sheet: "#1B1B19", sunk: "#232220", line: "#2F2E2B", "line-2": "#4A4843",
      ink: "#EEECE6", "ink-2": "#C4C0B7", "ink-3": "#A09B91", inv: "#121211",
      need: "#F2B865", "need-dot": "#F2B865", "need-w": "#3A2B14", done: "#82CC9C", "done-w": "#17301F",
      stop: "#F59380", "stop-w": "#3D1C15", acc: "#EEECE6", "acc-ink": "#121211",
    });
  });

  for (const [name, t] of [["light", light], ["dark", dark]] as const) {
    it(`${name}: every text colour clears 4.5:1 on paper, sheet and sunk`, () => {
      for (const fg of ["ink", "ink-2", "ink-3", "need", "done", "stop"])
        for (const bg of ["paper", "sheet", "sunk"]) expect(contrast(t[fg], t[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    });
    it(`${name}: status text clears 4.5:1 on its own wash, and ink does too`, () => {
      for (const [fg, bg] of [["need", "need-w"], ["done", "done-w"], ["stop", "stop-w"], ["ink", "need-w"], ["ink", "done-w"], ["ink", "stop-w"]])
        expect(contrast(t[fg], t[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    });
    it(`${name}: inverse text on ink (primary button, toast) clears 4.5:1`, () => {
      expect(contrast(t.inv, t.ink)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t["acc-ink"], t.acc)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("every accent clears 4.5:1 against its button text in both themes", () => {
    const accents = [...css.matchAll(/(\[data-theme="dark"\])?\[data-accent="(\w+)"\]\s*\{\s*--acc: (#[0-9A-F]{6});\s*\}/g)];
    expect(accents).toHaveLength(6);
    for (const [, isDark, , hex] of accents) expect(contrast(hex, isDark ? dark["acc-ink"] : light["acc-ink"])).toBeGreaterThanOrEqual(4.5);
  });
});

describe("the pre-v2 alias names are gone (phase 19)", () => {
  const OLD = /var\(--(ground|plate|plate-2|plate-sunk|seam|seam-strong|ink-inverse|track-idle|track-proven|clear|clear-wash|caution|caution-wash|stop-wash|lamp|face-plate|t-xs|t-sm|t-md|t-lg|t-xl|t-2xl|t-3xl|r-plate|r-control|d-route)\)/;
  it("no stylesheet reads or defines an old signal-box name", () => {
    for (const sheet of [css, appCss]) {
      expect(sheet).not.toMatch(OLD);
      expect(sheet).not.toMatch(/--(ground|plate|seam|lamp|face-plate|r-plate|r-control|d-route|t-[a-z0-9]+):/);
    }
  });
});
