/**
 * Code that runs INSIDE the page under test. Kept as plain-JavaScript strings (not TS functions
 * handed to page.evaluate) so the TypeScript toolchain can never inject helpers that do not exist
 * in the browser. Each script is an expression of a function taking one JSON argument.
 *
 * DESIGN_DETECTORS implements the `dom` detectors named in packages/frontend-loop/design/rulebook.json.
 * They are heuristics with stated thresholds, tuned so the clean fixture passes and each planted
 * fixture fails; they will miss some real cases, which is why the screenshot reviewer also checks
 * every rule.
 */

const HELPERS = String.raw`
  const vis = (el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display !== "none" && s.visibility !== "hidden" && r.width > 0 && r.height > 0 && r.right > 0 && r.left < innerWidth;
  };
  const short = (s, n = 70) => { s = (s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n) + "…" : s; };
  const where = (el) => el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.classList.length ? "." + [...el.classList].slice(0, 2).join(".") : "");
`;

export const DESIGN_DETECTORS = String.raw`(names) => {
  ${HELPERS}
  const hsl = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
    if (d === 0) return { h: 0, s: 0, l };
    const s = d / (1 - Math.abs(2 * l - 1));
    let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
    return { h, s, l };
  };
  const textBlocks = [...document.querySelectorAll("main p, main li, main dd, main dt, main h1, main h2, main h3, main blockquote")]
    .filter(vis).filter((e) => e.innerText.trim().length > 20);
  const D = {
    gradientHero() {
      const hero = document.querySelector("#hero") || document.querySelector("main > section, main > *");
      if (!hero) return [];
      for (const e of [hero, ...hero.querySelectorAll("*")].slice(0, 60)) {
        const bg = getComputedStyle(e).backgroundImage;
        if (!/gradient/.test(bg)) continue;
        const bad = (bg.match(/rgba?\([^)]+\)/g) || []).filter((c) => {
          const [r, g, b] = c.match(/[\d.]+/g).map(Number);
          const x = hsl(r, g, b);
          return x.s > 0.25 && x.h >= 200 && x.h <= 300;
        });
        if (bad.length) return ["hero background is a purple/blue gradient (" + short(bg, 80) + ")"];
      }
      return [];
    },
    threeCardRow() {
      const out = [];
      for (const p of document.querySelectorAll("main *")) {
        const kids = [...p.children].filter(vis);
        if (kids.length !== 3) continue;
        const rs = kids.map((k) => k.getBoundingClientRect());
        if (rs[0].width < 180) continue;
        if (!rs.every((r) => Math.abs(r.top - rs[0].top) < 4 && Math.abs(r.width - rs[0].width) < 8)) continue;
        if (!kids.every((k) => k.querySelector("h2, h3, h4, h5") && k.querySelector("p") && k.innerText.length < 260)) continue;
        out.push("three equal cards with heading + blurb in one row at " + where(p));
      }
      return out;
    },
    emojiIcons() {
      const out = new Set();
      const re = /\p{Extended_Pictographic}|[☰✓✔✗✘★☆♥●▶►]/u;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const t = n.textContent.replace(/[©®™]/g, "");
        const el = n.parentElement;
        if (!el || !re.test(t) || ["SCRIPT", "STYLE"].includes(el.tagName) || !vis(el)) continue;
        out.add('"' + t.match(re)[0] + '" in ' + where(el));
      }
      return [...out].slice(0, 8).map((s) => "emoji or glyph used as an icon: " + s);
    },
    centredEverything() {
      if (textBlocks.length < 6) return [];
      const c = textBlocks.filter((e) => getComputedStyle(e).textAlign === "center").length;
      return c / textBlocks.length > 0.6 ? [Math.round((100 * c) / textBlocks.length) + "% of text blocks are centred (" + c + "/" + textBlocks.length + ")"] : [];
    },
    singleDefaultFont() {
      const DEFAULTS = ["inter", "roboto", "arial", "helvetica", "helvetica neue", "open sans", "system-ui", "-apple-system", "blinkmacsystemfont", "segoe ui", "sans-serif", "serif", "times new roman", "times"];
      const fam = (e) => getComputedStyle(e).fontFamily.split(",")[0].trim().replace(/["']/g, "").toLowerCase();
      const body = [...document.querySelectorAll("main p, main li")].find(vis);
      const head = [...document.querySelectorAll("h1, h2")].find(vis);
      if (!body || !head) return [];
      const fams = new Set([fam(body), fam(head)]);
      return fams.size === 1 && DEFAULTS.includes([...fams][0]) ? ["headings and body both use " + [...fams][0] + " (a default face, no pairing)"] : [];
    },
    fakeSocialProof() {
      const out = [];
      const m = document.body.innerText.match(/trusted by|as seen (in|on)|featured in|loved by/i);
      if (m) out.push('"' + m[0] + '" strip with no supplied logos');
      const avatars = [...document.querySelectorAll("body *")].filter((e) => {
        if (!vis(e) || e.children.length) return false;
        const r = e.getBoundingClientRect(), s = getComputedStyle(e);
        const radius = parseFloat(s.borderTopLeftRadius) || 0;
        return /^[A-Z]{1,3}$/.test(e.innerText.trim()) && r.width <= 72 && r.height <= 72 && Math.abs(r.width - r.height) < 6 && (radius >= r.width * 0.3 || s.borderTopLeftRadius.endsWith("%"));
      });
      if (avatars.length >= 2) out.push(avatars.length + " initials avatars (" + avatars.slice(0, 4).map((a) => a.innerText.trim()).join(", ") + ")");
      return out;
    },
    fillerCopy() {
      const re = /unlock (your|the)\b[^.]{0,20}potential|\bseamless(ly)?\b|cutting[- ]edge|\belevate\b|\brevolutioni[sz]e|game[- ]changer|next[- ]level|\bempower(s|ing)?\b|\bsupercharge|\bunleash|in today's fast[- ]paced/gi;
      return [...new Set(document.body.innerText.match(re) || [])].map((p) => 'filler phrase "' + p + '"');
    },
    glassEverywhere() {
      const blur = [...document.querySelectorAll("body *")].filter((e) => {
        const s = getComputedStyle(e);
        return /blur/.test(s.backdropFilter || s.webkitBackdropFilter || "") && vis(e);
      });
      const loose = blur.filter((e) => !["fixed", "sticky"].includes(getComputedStyle(e).position));
      return loose.length >= 2 || blur.length > 2 ? [blur.length + " elements use backdrop blur (" + loose.length + " not fixed/sticky)"] : [];
    },
    gratuitousMotion() {
      const loops = document.getAnimations().filter((a) => a.playState === "running" && a.effect && a.effect.getComputedTiming().iterations === Infinity);
      return loops.length > 1 ? [loops.length + " infinite animations running (" + [...new Set(loops.map((a) => a.animationName || "unnamed"))].join(", ") + ")"] : [];
    },
    thinLowContrast() {
      const opacityOf = (e) => { let o = 1; for (let x = e; x; x = x.parentElement) o *= parseFloat(getComputedStyle(x).opacity); return o; };
      const thin = [...document.querySelectorAll("main p, main li, main dd")].filter(vis).filter((e) => {
        const s = getComputedStyle(e);
        return parseFloat(s.fontSize) < 18 && (parseInt(s.fontWeight, 10) <= 300 || opacityOf(e) < 0.75) && e.innerText.trim().length > 20;
      });
      return thin.length >= 3 ? [thin.length + " body text blocks are thin (weight 300 or less) or faded below 0.75 opacity, e.g. " + where(thin[0])] : [];
    },
    eyebrowOveruse() {
      const sections = document.querySelectorAll("main > section").length || document.querySelectorAll("section").length;
      const eyebrows = [...document.querySelectorAll("main h2")].filter((h) => {
        const p = h.previousElementSibling;
        if (!p || !vis(p) || p.innerText.trim().length >= 40) return false;
        const s = getComputedStyle(p);
        return parseFloat(s.fontSize) <= 14 && (s.textTransform === "uppercase" || parseFloat(s.letterSpacing) >= 1 || p.innerText === p.innerText.toUpperCase());
      });
      return eyebrows.length > Math.ceil(sections / 3) ? [eyebrows.length + " small uppercase labels above section headings across " + sections + " sections (limit " + Math.ceil(sections / 3) + ")"] : [];
    },
  };
  const out = {};
  for (const n of names) out[n] = D[n] ? D[n]() : ["unknown detector " + n];
  return out;
}`;

/** Overflow, tiny text and small tap targets at the current viewport. */
export const LAYOUT_PROBE = String.raw`(opts) => {
  ${HELPERS}
  const out = [];
  if (document.documentElement.scrollWidth > innerWidth + 1) out.push("horizontal scroll: page is " + document.documentElement.scrollWidth + "px wide in a " + innerWidth + "px viewport");
  if (!opts.mobile) return out;
  const tiny = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || !n.textContent.trim() || ["SCRIPT", "STYLE", "OPTION"].includes(el.tagName) || !vis(el)) continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (size < opts.minFontPx) tiny.add(size + "px text at " + where(el) + ' ("' + short(n.textContent, 30) + '")');
  }
  if (tiny.size) out.push(tiny.size + " text element(s) below " + opts.minFontPx + "px: " + [...tiny].slice(0, 4).join("; "));
  const small = [];
  for (const el of document.querySelectorAll("a[href], button, input, select, textarea, summary, [role=button]")) {
    if (!vis(el) || el.type === "hidden") continue;
    const s = getComputedStyle(el);
    const parent = el.parentElement;
    // WCAG 2.5.8 exception: a link inline in a sentence.
    if (el.tagName === "A" && s.display === "inline" && parent && parent.innerText.trim().length > el.innerText.trim().length + 3) continue;
    const r = el.getBoundingClientRect();
    if (r.width < opts.minTargetPx || r.height < opts.minTargetPx) small.push(where(el) + ' "' + short(el.innerText || el.getAttribute("aria-label") || "", 24) + '" ' + Math.round(r.width) + "x" + Math.round(r.height));
  }
  if (small.length) out.push(small.length + " tap target(s) below " + opts.minTargetPx + "px: " + small.slice(0, 5).join("; "));
  return out;
}`;

/** Every link on the page, with whether its in-page anchor target exists. */
export const LINK_PROBE = String.raw`() => [...document.querySelectorAll("a[href]")].map((a) => {
  const href = a.getAttribute("href");
  const id = href.startsWith("#") && href.length > 1 ? decodeURIComponent(href.slice(1)) : null;
  return { href, abs: a.href, text: (a.innerText || a.getAttribute("aria-label") || "").trim().slice(0, 40), anchorOk: id === null ? null : !!document.getElementById(id) };
})`;

/** Animations still running under prefers-reduced-motion: reduce. */
export const MOTION_PROBE = String.raw`() => document.getAnimations()
  .filter((a) => a.playState === "running" && a.effect)
  .map((a) => ({ name: a.animationName || a.transitionProperty || "script animation", t: a.effect.getComputedTiming() }))
  .filter((x) => x.t.iterations === Infinity || x.t.endTime > 1000)
  .map((x) => x.name + (x.t.iterations === Infinity ? " (infinite)" : " (" + Math.round(x.t.endTime) + "ms)"))`;

/** Total bytes of inline <script> text. */
export const INLINE_JS_BYTES = String.raw`() => [...document.querySelectorAll("script:not([src])")].reduce((n, s) => n + new TextEncoder().encode(s.textContent || "").length, 0)`;

/** Scroll to the bottom in steps so scroll-reveal content is shown before screenshots. */
export const SCROLL_THROUGH = String.raw`async () => {
  for (let y = 0; y < document.documentElement.scrollHeight; y += Math.max(200, innerHeight / 2)) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 60));
  }
  window.scrollTo(0, 0);
  await new Promise((r) => setTimeout(r, 300));
}`;
