import { describe, expect, it, vi } from "vitest";

vi.mock("../supabaseClient", () => ({ supabase: {} }));
import { framePage, pageForHref, pageLabel, rewriteRefs } from "./sitePreview";

const pagesB = ["index.html", "services/index.html", "how-we-work/index.html", "contact/index.html"];
const pagesA = ["index.html", "services.html", "contact.html"];

describe("the built-site preview", () => {
  it("names pages plainly", () => {
    expect(pageLabel("index.html")).toBe("Home");
    expect(pageLabel("how-we-work/index.html")).toBe("How We Work");
    expect(pageLabel("services.html")).toBe("Services");
  });

  it("maps a link inside the site to one of its pages, and nothing else", () => {
    expect(pageForHref("/", pagesB)).toBe("index.html");
    expect(pageForHref("/services/", pagesB)).toBe("services/index.html");
    expect(pageForHref("/contact", pagesB)).toBe("contact/index.html");
    expect(pageForHref("services.html", pagesA)).toBe("services.html");
    expect(pageForHref("index.html#top", pagesA)).toBe("index.html");
    expect(pageForHref("https://evil.example/", pagesB)).toBeNull();
    expect(pageForHref("//evil.example/x", pagesB)).toBeNull();
    expect(pageForHref("mailto:a@b.co", pagesB)).toBeNull();
    expect(pageForHref("javascript:alert(1)", pagesB)).toBeNull();
    expect(pageForHref("/nope/", pagesB)).toBeNull();
  });

  it("points every stored file at its signed link, in attributes and in inline CSS; page links are untouched", () => {
    const urls = new Map([
      ["_next/static/css/a.css", "https://s/a.css?t=1"],
      ["_next/static/media/f.woff2", "https://s/f.woff2?t=1"],
      ["logo.svg", "https://s/logo.svg?t=1"],
    ]);
    const html = `<link rel="stylesheet" href="/_next/static/css/a.css"><style>@font-face{src:url(/_next/static/media/f.woff2)}</style><img src="logo.svg"><img src='/logo.svg'><a href="/services/">S</a>`;
    const out = rewriteRefs(html, urls);
    expect(out).toContain('href="https://s/a.css?t=1"');
    expect(out).toContain("url(https://s/f.woff2?t=1)");
    expect(out).toContain('src="https://s/logo.svg?t=1"');
    expect(out).toContain("src='https://s/logo.svg?t=1'");
    expect(out).toContain('href="/services/"');
  });

  it("leaves out the site's script files (a framework runtime can't start in the frame) but keeps inline scripts", () => {
    const html = `<head><link rel="preload" as="script" fetchPriority="low" href="/_next/a.js"/><link rel="stylesheet" href="/s.css"></head><body><script src="/_next/a.js" async=""></script><script>self.x=1</script></body>`;
    const out = framePage(html, new Map());
    expect(out).not.toContain("/_next/a.js");
    expect(out).toContain('<link rel="stylesheet" href="/s.css">');
    expect(out).toContain("<script>self.x=1</script>");
  });

  it("adds the link-catching script first in <head>, so the frame never navigates", () => {
    const out = framePage("<html><head><title>x</title></head><body></body></html>", new Map());
    expect(out.indexOf("wfactPreviewHref")).toBeLessThan(out.indexOf("<title>"));
    expect(framePage("<p>no head</p>", new Map()).startsWith("<script>")).toBe(true);
  });
});
