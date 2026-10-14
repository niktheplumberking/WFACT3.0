import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_APPEARANCE, applyAppearance, normalise, readAppearance, saveAppearance } from "./appearance";

afterEach(() => {
  localStorage.clear();
  const root = document.documentElement;
  ["data-theme", "data-accent", "data-density", "data-motion", "style"].forEach((a) => root.removeAttribute(a));
});

describe("appearance", () => {
  it("defaults to light, ink accent, comfortable, 100%, motion on", () => {
    expect(readAppearance()).toEqual(DEFAULT_APPEARANCE);
    expect(DEFAULT_APPEARANCE.theme).toBe("light");
  });

  it("rejects values the design does not offer", () => {
    expect(normalise({ theme: "neon", accent: "pink", density: "tight", textSize: 140, reduceMotion: "yes" })).toEqual(DEFAULT_APPEARANCE);
  });

  it("carries a theme chosen before v2 over, once", () => {
    localStorage.setItem("cockpit-theme", "dark");
    expect(readAppearance().theme).toBe("dark");
  });

  it("round-trips through storage", () => {
    const a = { theme: "system", accent: "clay", density: "compact", textSize: 125, reduceMotion: true } as const;
    saveAppearance(a);
    expect(readAppearance()).toEqual(a);
  });

  it("sets the root attributes tokens.css reads", () => {
    const root = document.documentElement;
    applyAppearance({ theme: "dark", accent: "harbour", density: "compact", textSize: 112, reduceMotion: true });
    expect(root.getAttribute("data-theme")).toBe("dark");
    expect(root.getAttribute("data-accent")).toBe("harbour");
    expect(root.getAttribute("data-density")).toBe("compact");
    expect(root.getAttribute("data-motion")).toBe("reduce");
    expect(root.style.getPropertyValue("--text-scale")).toBe("1.12");

    applyAppearance(DEFAULT_APPEARANCE);
    for (const a of ["data-theme", "data-accent", "data-density", "data-motion"]) expect(root.hasAttribute(a)).toBe(false);
    expect(root.style.getPropertyValue("--text-scale")).toBe("1");
  });

  it("'Match my device' follows the device (jsdom reports light)", () => {
    applyAppearance({ ...DEFAULT_APPEARANCE, theme: "system" });
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });
});
