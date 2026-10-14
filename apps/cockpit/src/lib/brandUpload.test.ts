import { describe, expect, it, vi } from "vitest";

vi.mock("../supabaseClient", () => ({ supabase: {} }));
import { checkSiteUrl, inspectLogoFile, isTestAddress } from "./brandUpload";

// SYNTHETIC Lanternworks Studio logo (copy of clients/lanternworks-studio/logo.svg, which the build tests use).
const LOGO = new TextEncoder().encode("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 240 48\" role=\"img\" aria-label=\"Lanternworks\"><title>Lanternworks (synthetic logo)</title><g fill=\"none\" stroke=\"#14213D\" stroke-width=\"2.5\" stroke-linejoin=\"round\"><path d=\"M14 6h12M20 6v4\"/><path d=\"M11 14h18l-2 24H13z\"/><path d=\"M10 42h20\"/></g><path d=\"M20 20c3 4 3 8 0 12c-3-4-3-8 0-12z\" fill=\"#F26B38\"/><text x=\"42\" y=\"31\" font-family=\"Georgia, serif\" font-size=\"20\" fill=\"#14213D\">Lanternworks</text></svg>");
const file = (data: BlobPart, name: string, type: string) => new File([data], name, { type });

describe("the logo is checked in the browser with the build's own rules", () => {
  it("accepts the Lanternworks SVG and reads its size; the fingerprint is the file's sha256", async () => {
    const r = await inspectLogoFile(file(LOGO, "logo.svg", "image/svg+xml"));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.record).toMatchObject({ mime: "image/svg+xml", width: 240, height: 48, bytes: LOGO.length });
      expect(r.record.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("an SVG with an empty type is recognised by its name", async () => {
    expect((await inspectLogoFile(file(LOGO, "logo.svg", ""))).ok).toBe(true);
  });

  it.each([
    ["<script>alert(1)</script>", /a script/],
    ['<rect onclick="x()"/>', /event handler/],
    ['<image href="https://evil.example/x.png"/>', /outside file/],
    ["<foreignObject><div>hi</div></foreignObject>", /embedded HTML/],
  ])("refuses an SVG containing %s", async (inner, why) => {
    const r = await inspectLogoFile(file(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${inner}</svg>`, "x.svg", "image/svg+xml"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(why);
  });

  it("refuses other formats, empty and oversized files, and a PNG that is not one", async () => {
    expect(await inspectLogoFile(file("x", "logo.jpg", "image/jpeg"))).toEqual({ ok: false, reason: "The logo must be an SVG, PNG or WebP file." });
    expect((await inspectLogoFile(file("", "logo.svg", "image/svg+xml"))).ok).toBe(false);
    const big = await inspectLogoFile(file(new Uint8Array(600 * 1024), "logo.png", "image/png"));
    expect(!big.ok && big.reason).toMatch(/limit is 512 KB/);
    const fake = await inspectLogoFile(file(LOGO, "logo.png", "image/png"));
    expect(!fake.ok && fake.reason).toMatch(/not a valid PNG/);
  });
});

describe("the live address", () => {
  it("takes an https origin, trims a trailing slash, refuses a path or http", () => {
    expect(checkSiteUrl(" https://bennettandco.com/ ")).toEqual({ ok: true, value: "https://bennettandco.com" });
    expect(checkSiteUrl("http://bennettandco.com").ok).toBe(false);
    expect(checkSiteUrl("https://bennettandco.com/about").ok).toBe(false);
    expect(checkSiteUrl("bennettandco.com").ok).toBe(false);
  });
  it("flags test addresses, which get no search or share tags", () => {
    expect(isTestAddress("https://lanternworks.example")).toBe(true);
    expect(isTestAddress("https://x.vercel.app")).toBe(true);
    expect(isTestAddress("https://bennettandco.com")).toBe(false);
  });
});
