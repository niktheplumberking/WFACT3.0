/**
 * The on-brief colour rule (2026-10-14, Lanternworks run 4c35703b): every token the palette engines derive is a
 * tint or shade of one brief colour, so its hue stays within a few degrees of that colour, and greys only appear
 * as tints/shades of a brief colour. A colour the engine would have to invent is refused with a message instead.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { buildPalette, contrast, hueChroma, mix, offBriefTokens, tintShadeSource, type BrandColors } from "../src/trackA/palette.js";
import { buildTrackBPalette } from "../src/trackB/palette.js";

const HUE_TOLERANCE = 5; // degrees
const GREY_CHROMA = 20; // below this (0-255 scale) 8-bit rounding makes hue meaningless: treated as a grey

const hueGap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

/** Every derived token is on-brief: a chromatic one keeps the hue of a brief colour, a grey is a tint/shade of one. */
function assertOnBrief(name: string, colors: BrandColors, tokens: Record<string, string>) {
  const brief = [colors.ink, colors.paper, colors.accent, colors.deep];
  for (const [key, value] of Object.entries(tokens)) {
    if (brief.includes(value)) continue;
    const { hue, chroma } = hueChroma(value);
    if (chroma >= GREY_CHROMA) {
      const near = brief.filter((b) => hueChroma(b).chroma > 0).map((b) => hueGap(hueChroma(b).hue, hue));
      assert.ok(Math.min(...near) <= HUE_TOLERANCE, `${name}: ${key} ${value} hue ${hue.toFixed(1)} is not within ${HUE_TOLERANCE} degrees of any brief colour (${brief.join(", ")})`);
    }
    assert.ok(tintShadeSource(value, brief), `${name}: ${key} ${value} is not a tint or shade of a brief colour`);
  }
}

const BRANDS: [string, BrandColors][] = [
  ["Summit Line (Track A)", { ink: "#1B2622", paper: "#F6F1E7", accent: "#B5642A", deep: "#1F3D36" }],
  ["Northfold (Track B, dark)", { ink: "#ECEEE9", paper: "#0F1211", accent: "#FF4F1A", deep: "#1D2B27" }],
  // The brief that failed 3 of 3 rounds: navy #14213D, paper, orange #F26B38.
  ["Lanternworks", { ink: "#14213D", paper: "#FBF7F0", accent: "#F26B38", deep: "#14213D" }],
  ["Bennett-like green", { ink: "#1A1A1A", paper: "#FFFFFF", accent: "#2E8B57", deep: "#0E3B2E" }],
  ["Dark plum", { ink: "#F4EEF6", paper: "#140B18", accent: "#C77DFF", deep: "#3A1F47" }],
];

for (const [name, colors] of BRANDS) {
  test(`palette: every derived token of ${name} is a tint or shade of a brief colour (both tracks)`, () => {
    const a = buildPalette(colors);
    assert.deepEqual(a.problems, [], name);
    assertOnBrief(`${name} A`, colors, a.palette! as unknown as Record<string, string>);
    const b = buildTrackBPalette(colors);
    assert.deepEqual(b.problems, [], name);
    assertOnBrief(`${name} B`, colors, b.palette! as unknown as Record<string, string>);
  });
}

test("palette: Lanternworks accentInk is a shade of the brief orange, never a new hue", () => {
  const { palette } = buildPalette(BRANDS[2]![1]);
  const src = tintShadeSource(palette!.accentInk, ["#F26B38"]);
  assert.equal(src?.toward, "black");
  assert.ok(hueGap(hueChroma(palette!.accentInk).hue, hueChroma("#F26B38").hue) <= HUE_TOLERANCE);
  assert.ok(contrast(palette!.accentInk, palette!.paper) >= 4.5);
});

test("palette: many random brands stay on-brief whenever the engine accepts them", () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const hex = (lo: number, hi: number) =>
    `#${[0, 1, 2].map(() => Math.round(lo + rnd() * (hi - lo)).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
  let accepted = 0;
  for (let i = 0; i < 300; i += 1) {
    const light = rnd() > 0.5;
    const colors: BrandColors = light
      ? { ink: hex(0, 60), paper: hex(225, 255), accent: hex(0, 255), deep: hex(0, 90) }
      : { ink: hex(215, 255), paper: hex(0, 30), accent: hex(0, 255), deep: hex(20, 90) };
    for (const r of [buildPalette(colors), buildTrackBPalette(colors)]) {
      if (!r.palette) continue;
      accepted += 1;
      assertOnBrief(JSON.stringify(colors), colors, r.palette as unknown as Record<string, string>);
    }
  }
  assert.ok(accepted > 100, `only ${accepted} random palettes were accepted`);
});

test("palette: a blend of two brief colours (the old surface) or an invented hue is detected as off-brief", () => {
  const brief = ["#14213D", "#FBF7F0", "#F26B38", "#14213D"];
  assert.equal(tintShadeSource(mix("#FBF7F0", "#14213D", 0.12), brief), null, "paper+navy blend is not a tint of either");
  assert.equal(tintShadeSource("#9D4624", ["#14213D", "#FBF7F0"]), null, "a rust colour is not derived from navy or paper");
  assert.ok(tintShadeSource(mix("#F26B38", "#000000", 0.35), brief), "a shade of the orange is on-brief");
  assert.equal(offBriefTokens({ accentInk: "#2A9D8F" }, brief).length, 1);
});

test("palette: when no tint or shade can reach AA the engine refuses with a clear message instead of inventing a colour", () => {
  // On a mid-grey paper even pure black is under 4.5:1, so no shade of the accent can reach AA.
  const r = buildPalette({ ink: "#000000", paper: "#6E6E6E", accent: "#7A7A7A", deep: "#000000" });
  assert.equal(r.palette, null);
  assert.ok(r.problems.some((p) => /will not invent a new colour/.test(p)), r.problems.join(" | "));
});
