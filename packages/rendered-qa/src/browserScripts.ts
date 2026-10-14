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
  // SVG and MathML elements have no innerText; read their textContent instead of crashing the detector.
  const txt = (el) => (el && (el.innerText ?? el.textContent)) || "";
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
    .filter(vis).filter((e) => txt(e).trim().length > 20);
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
        if (!kids.every((k) => k.querySelector("h2, h3, h4, h5") && k.querySelector("p") && txt(k).length < 260)) continue;
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
        return /^[A-Z]{1,3}$/.test(txt(e).trim()) && r.width <= 72 && r.height <= 72 && Math.abs(r.width - r.height) < 6 && (radius >= r.width * 0.3 || s.borderTopLeftRadius.endsWith("%"));
      });
      if (avatars.length >= 2) out.push(avatars.length + " initials avatars (" + avatars.slice(0, 4).map((a) => txt(a).trim()).join(", ") + ")");
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
        return parseFloat(s.fontSize) < 18 && (parseInt(s.fontWeight, 10) <= 300 || opacityOf(e) < 0.75) && txt(e).trim().length > 20;
      });
      return thin.length >= 3 ? [thin.length + " body text blocks are thin (weight 300 or less) or faded below 0.75 opacity, e.g. " + where(thin[0])] : [];
    },
    eyebrowOveruse() {
      const sections = document.querySelectorAll("main > section").length || document.querySelectorAll("section").length;
      const eyebrows = [...document.querySelectorAll("main h2")].filter((h) => {
        const p = h.previousElementSibling;
        if (!p || !vis(p) || txt(p).trim().length >= 40) return false;
        const s = getComputedStyle(p);
        return parseFloat(s.fontSize) <= 14 && (s.textTransform === "uppercase" || parseFloat(s.letterSpacing) >= 1 || txt(p) === txt(p).toUpperCase());
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

/** Decoded bytes of every external script the page loaded, from the browser's resource timing. */
export const SCRIPT_RESOURCE_BYTES = String.raw`() => performance.getEntriesByType("resource")
  .filter((e) => e.initiatorType === "script" || /\.m?js(\?|$)/.test(e.name))
  .reduce((n, e) => n + (e.decodedBodySize || 0), 0)`;

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

/**
 * Step 4B M4: installed with addInitScript, so it runs before any page script. Records what motion the
 * page actually performs, including script-driven motion (GSAP, Motion, Lenis) that never shows up in
 * document.getAnimations():
 *   - every inline-style change, per element and property, as the set of distinct values it took;
 *   - long animation frames (the browser's own measure of main-thread jank), split at mark();
 *   - every CSS / Web Animations animation that started, with its properties and timing.
 * Read back with MOTION_REPORT. Not a check by itself: rendered.ts turns it into results.
 */
export const MOTION_WATCH = String.raw`(() => {
  const SPATIAL = ["transform", "translate", "scale", "rotate", "opacity"];
  const LAYOUT = ["width", "height", "top", "left", "right", "bottom", "margin-top", "margin-left", "margin-right", "margin-bottom",
    "padding-top", "padding-left", "padding-right", "padding-bottom", "font-size", "line-height", "max-width", "min-height", "inset"];
  const W = { phase: "load", values: new Map(), frames: [], anims: new Map(), ids: new WeakMap(), next: 0 };
  window.__wfactMotion = W;
  const idOf = (el) => {
    if (!W.ids.has(el)) W.ids.set(el, el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.classList && el.classList.length ? "." + [...el.classList].slice(0, 2).join(".") : "") + "@" + (W.next++));
    return W.ids.get(el);
  };
  const record = (el) => {
    if (!el.style) return;
    for (const p of [...SPATIAL, ...LAYOUT]) {
      const v = el.style.getPropertyValue(p);
      if (!v) continue;
      const key = W.phase + "|" + idOf(el) + "|" + p;
      let set = W.values.get(key);
      if (!set) W.values.set(key, (set = new Set()));
      if (set.size < 50) set.add(v);
    }
  };
  new MutationObserver((list) => { for (const m of list) record(m.target); })
    .observe(document, { attributes: true, attributeFilter: ["style"], subtree: true });
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) W.frames.push({ phase: W.phase, duration: e.duration, blocking: e.blockingDuration || 0 }); })
      .observe({ type: "long-animation-frame", buffered: false });
  } catch {}
  const seeAnimations = () => {
    for (const a of document.getAnimations()) {
      if (W.anims.has(a)) continue;
      const kf = a.effect && a.effect.getKeyframes ? a.effect.getKeyframes() : [];
      const props = [...new Set(kf.flatMap((k) => Object.keys(k)).filter((k) => !["offset", "easing", "composite", "computedOffset"].includes(k)))];
      const t = a.effect ? a.effect.getComputedTiming() : {};
      const scrollLinked = !!(a.timeline && a.timeline.constructor && /Scroll|View/.test(a.timeline.constructor.name));
      W.anims.set(a, { phase: W.phase, name: a.animationName || a.transitionProperty || a.id || "script animation", props, endTime: t.endTime, iterations: t.iterations, scrollLinked });
    }
  };
  const tick = () => { seeAnimations(); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
})()`;

/** Starts a new measurement phase (e.g. "scroll") so load-time work is not counted against scrolling. */
export const MOTION_MARK = String.raw`(phase) => { if (window.__wfactMotion) window.__wfactMotion.phase = phase; }`;

/** What the watcher saw, for one phase: style properties that changed, long frames, animations. */
export const MOTION_REPORT = String.raw`(phase) => {
  const W = window.__wfactMotion;
  if (!W) return null;
  const styles = [];
  for (const [key, set] of W.values) {
    const [ph, el, prop] = key.split("|");
    if (ph === phase) styles.push({ el: el.replace(/@\d+$/, ""), prop, distinct: set.size });
  }
  const frames = W.frames.filter((f) => f.phase === phase);
  const anims = [...W.anims.values()].filter((a) => a.phase === phase);
  return {
    styles,
    longFrames: frames.length,
    blockingMs: Math.round(frames.reduce((n, f) => n + f.blocking, 0)),
    worstFrameMs: Math.round(frames.reduce((n, f) => Math.max(n, f.duration), 0)),
    anims: anims.map((a) => ({ name: a.name, props: a.props, endTime: a.endTime === Infinity ? -1 : Math.round(a.endTime || 0), infinite: a.iterations === Infinity, scrollLinked: a.scrollLinked })),
    loafSupported: PerformanceObserver.supportedEntryTypes.includes("long-animation-frame"),
  };
}`;

/** Scroll position sampled every frame after one wheel step: many in-between values = smooth-scroll hijacking. */
export const SCROLL_SAMPLE = String.raw`async () => {
  const seen = [];
  const start = performance.now();
  await new Promise((resolve) => {
    const f = () => { seen.push(Math.round(scrollY)); performance.now() - start < 700 ? requestAnimationFrame(f) : resolve(); };
    requestAnimationFrame(f);
  });
  return [...new Set(seen)];
}`;

// ---- Build-quality Package 2 (2026-10-14): brand and motion-coverage probes (Track B) ----

/** The header logo's rendered box at the current scroll (render.logo-visible). The first image in the header row. */
export const LOGO_PROBE = String.raw`() => {
  window.scrollTo(0, 0);
  const img = document.querySelector("header img, header svg");
  if (!img) return { found: false };
  const r = img.getBoundingClientRect();
  const cs = getComputedStyle(img);
  return {
    found: true,
    width: Math.round(r.width), height: Math.round(r.height),
    shown: cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) > 0.1,
    inView: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth,
  };
}`;

/**
 * Is a control labelled exactly like the primary action visible and on top at three scroll positions (top, 60%, bottom)
 * (render.mobile-action-visible)? Also: the focused skip link is not covered, and the footer's last line is not covered
 * at the bottom of the page (a fixed bar must never hide content).
 */
export const ACTION_PROBE = String.raw`async (label) => {
  const norm = (s) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
  const want = norm(label);
  const onTop = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) return false;
    const x = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), y = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2));
    const hit = document.elementFromPoint(x, y);
    return !!hit && (hit === el || el.contains(hit));
  };
  const visibleAction = () => [...document.querySelectorAll("a, button")].some((el) => norm(el.textContent) === want && onTop(el));
  const wait = () => new Promise((r) => setTimeout(r, 350));
  const H = document.documentElement.scrollHeight;
  const out = { positions: {}, skipCovered: false, footerCovered: false };
  for (const [name, y] of [["top", 0], ["middle", Math.round(H * 0.6 - innerHeight / 2)], ["bottom", H]]) {
    window.scrollTo(0, Math.max(0, y));
    await wait();
    out.positions[name] = visibleAction();
  }
  const lines = [...document.querySelectorAll("footer p, footer a, footer li")].filter((el) => el.getBoundingClientRect().height > 0);
  const last = lines[lines.length - 1];
  if (last) {
    last.scrollIntoView({ block: "end" });
    window.scrollBy(0, 0);
    await wait();
    out.footerCovered = !onTop(last);
  }
  window.scrollTo(0, 0);
  await wait();
  const skip = document.querySelector('a[href="#main"]');
  if (skip) {
    skip.focus();
    await wait();
    out.skipCovered = !onTop(skip);
    skip.blur();
  }
  return out;
}`;

/**
 * Elements filled with the brand accent (or a tint/shade derived from it) that are not a control or inside one
 * (render.accent-usage), and the fill of every control labelled like the primary action.
 */
export const ACCENT_PROBE = String.raw`(opts) => {
  const hex = (rgb) => {
    const m = /rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)(?:[ ,/]+([\d.]+))?/.exec(rgb || "");
    if (!m || (m[4] !== undefined && Number(m[4]) < 0.5)) return null;
    return "#" + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("").toUpperCase();
  };
  const family = new Set(opts.colors.map((c) => c.toUpperCase()));
  const CONTROL = "a, button, summary, input, select, textarea, [role=button], label";
  const name = (el) => el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.classList.length ? "." + [...el.classList].slice(0, 2).join(".") : "");
  const panels = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    const bg = hex(getComputedStyle(el).backgroundColor);
    if (!bg || !family.has(bg)) continue;
    if (el.matches(CONTROL) || el.closest(CONTROL)) continue;
    panels.push(name(el) + " " + bg);
  }
  const norm = (s) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
  const fills = [...document.querySelectorAll("a, button")]
    .filter((el) => norm(el.textContent) === norm(opts.label) && el.getBoundingClientRect().width > 0)
    .map((el) => hex(getComputedStyle(el).backgroundColor))
    .filter(Boolean);
  return { panels: [...new Set(panels)].slice(0, 20), fills: [...new Set(fills)] };
}`;

/**
 * Installed with addInitScript (render.motion-coverage): marks each section of <main> that showed any motion while the
 * page loaded and was scrolled: a CSS or Web Animations animation (including scroll-driven ones), a transition, or a
 * script changing an inline style. Read back with MOTION_COVERAGE_REPORT.
 */
export const MOTION_COVERAGE_WATCH = String.raw`(() => {
  const touched = new Set();
  window.__wfactCoverage = touched;
  const mark = (el) => {
    const s = el && el.closest ? el.closest("main section") : null;
    if (s) touched.add(s);
  };
  addEventListener("animationstart", (e) => mark(e.target), true);
  addEventListener("transitionstart", (e) => mark(e.target), true);
  new MutationObserver((list) => { for (const m of list) mark(m.target); })
    .observe(document, { attributes: true, attributeFilter: ["style"], subtree: true });
  const poll = () => {
    for (const a of document.getAnimations()) mark(a.effect && a.effect.target);
    setTimeout(poll, 100);
  };
  poll();
})()`;

/** The sections of <main> (outermost only) that never moved, by id or position. */
export const MOTION_COVERAGE_REPORT = String.raw`() => {
  const touched = window.__wfactCoverage || new Set();
  const sections = [...document.querySelectorAll("main section")].filter((s) => !s.parentElement.closest("main section"));
  const moved = (s) => [...touched].some((t) => t === s || s.contains(t));
  const label = (s, i) => (s.id ? "#" + s.id : "section " + (i + 1)) + (s.className ? " (" + String(s.className).split(" ")[0] + ")" : "");
  return { total: sections.length, still: sections.map((s, i) => (moved(s) ? null : label(s, i))).filter(Boolean) };
}`;
