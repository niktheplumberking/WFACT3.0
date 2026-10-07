/**
 * Rendered QA (Step 4B M1): loads the built page in headless Chromium and checks what a visitor
 * actually gets, which every Step 4 check skipped. One browser pass per page and viewport
 * (1440 / 768 / 375) yields these results, each with an exact check id the builder can act on:
 *
 *   render.load            page served and loaded (HTTP 2xx)
 *   render.console         console errors, uncaught exceptions, failed network requests
 *   render.links           in-page anchors, same-site pages and assets (against the built files), tel:/mailto:,
 *                          any request that tried to leave the site (blocked, Step 7), optional external links
 *                          (public addresses only, egress.ts)
 *   render.a11y            axe-core, WCAG 2.0/2.1/2.2 A + AA tags, at 1440 and 375
 *   render.layout          horizontal scroll at every viewport; tiny text and small tap targets at 375
 *   render.js-budget       total JavaScript bytes (inline + loaded) against the track budget
 *   render.reduced-motion  animations still running with prefers-reduced-motion: reduce
 *   render.design-rules    the design rulebook's DOM detectors (packages/frontend-loop/design/rulebook.json)
 *   render.perf            Lighthouse (mobile, applied throttling): LCP and CLS against the track budget; simulated LCP recorded, advisory
 *   render.motion-budget   (budgets with a motion part, i.e. Track B) what scrolling the page costs: no
 *                          layout properties animated, no long CSS/WAAPI entrances, main-thread blocking
 *                          during a scroll-through within the budget (Step 4B M4)
 *
 * render.reduced-motion also watches script-driven motion (GSAP, Motion, Lenis) since Step 4B M4: with
 * prefers-reduced-motion: reduce, no element may keep changing its transform or opacity while the page is
 * scrolled, and scrolling may not be smoothed by script.
 *
 * Screenshots are written to `outDir` (full page per viewport) and kept as viewport-sized JPEG slices
 * for the cross-vendor screenshot reviewer (`reviewer.ts`).
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import { SITE_FILE_RE, type AsyncCheckSuite, type CheckResult, type VerificationContext } from "@wfact/verification/checks/types";
import { serveDirectory, siteFileFor } from "./server.js";
import { checkExternalLink, confinedBrowserArgs, type EgressOptions } from "./egress.js";
import { DESIGN_DETECTORS, INLINE_JS_BYTES, SCRIPT_RESOURCE_BYTES, LAYOUT_PROBE, LINK_PROBE, MOTION_MARK, MOTION_PROBE, MOTION_REPORT, MOTION_WATCH, SCROLL_SAMPLE, SCROLL_THROUGH } from "./browserScripts.js";
import { loadRulebook, type Rulebook } from "./rulebook.js";

export interface MotionBudget {
  /** Main-thread blocking (long animation frames) allowed during one scroll-through of the page, ms. */
  maxBlockingMs: number;
  /** Longest allowed time-based (not scroll-linked, not infinite) CSS / Web Animations animation, ms. */
  maxAnimationMs: number;
  /** A layout property (width, top, margin...) that takes more distinct inline values than this while scrolling is being animated. */
  maxLayoutSteps: number;
}
export interface Budget {
  lcpMs: number;
  cls: number;
  jsKb: number;
  /** Track B only: what the site's motion may cost (render.motion-budget). */
  motion?: MotionBudget;
}
/** Track A (local business): LCP < 2.0 s mobile, total JS < 50 KB, CLS < 0.1 (FRONTEND-UPGRADE-DESIGN.md §2). */
export const TRACK_A_BUDGET: Budget = { lcpMs: 2000, cls: 0.1, jsKb: 50 };
/**
 * Track B (motion-rich brand site, Step 4B M4): LCP < 2.5 s mobile and CLS < 0.1 (FRONTEND-UPGRADE-DESIGN.md
 * §2), JavaScript per page within 700 KB (decoded bytes, as for Track A; about 200 KB gzipped), and the
 * motion budget. 700 KB is the starter's measured 625 KB (React + Next.js runtime about 442 KB, GSAP +
 * ScrollTrigger + Lenis about 125 KB) plus about 12% headroom; the motion numbers are set so the starter
 * passes with a wide margin and the planted fixture fails. Both are a proposal for Huraira to confirm,
 * not a published standard (PROGRESS.md, Step 4B M4).
 */
export const TRACK_B_BUDGET: Budget = { lcpMs: 2500, cls: 0.1, jsKb: 700, motion: { maxBlockingMs: 250, maxAnimationMs: 1500, maxLayoutSteps: 4 } };

/** Layout-affecting properties (Web Animations keyframe names). Animating any of them is over the motion budget. */
const LAYOUT_KEYFRAME_PROPS = new Set([
  "width", "height", "minWidth", "maxWidth", "minHeight", "maxHeight", "top", "left", "right", "bottom", "inset",
  "marginTop", "marginRight", "marginBottom", "marginLeft", "margin", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "padding",
  "fontSize", "lineHeight", "letterSpacing", "borderWidth", "gridTemplateColumns", "gridTemplateRows", "flexBasis",
]);
const LAYOUT_STYLE_PROPS = new Set([
  "width", "height", "top", "left", "right", "bottom", "margin-top", "margin-left", "margin-right", "margin-bottom",
  "padding-top", "padding-left", "padding-right", "padding-bottom", "font-size", "line-height", "max-width", "min-height", "inset",
]);
const SPATIAL_STYLE_PROPS = new Set(["transform", "translate", "scale", "rotate", "opacity"]);

/** URL of a page file: a folder's index.html is requested as the folder ("services/"), as a host would serve it. */
export const pageUrl = (origin: string, pageName: string) => `${origin}/${pageName.replace(/(^|\/)index\.html$/, "$1")}`;

interface MotionReport {
  styles: { el: string; prop: string; distinct: number }[];
  longFrames: number;
  blockingMs: number;
  worstFrameMs: number;
  anims: { name: string; props: string[]; endTime: number; infinite: boolean; scrollLinked: boolean }[];
  loafSupported: boolean;
}

/** Scrolls like a visitor (wheel steps), so smooth-scroll libraries and scroll-linked motion actually run. */
async function wheelThrough(page: Page, step = 300, gapMs = 45): Promise<void> {
  await page.mouse.move(200, 300);
  for (let i = 0; i < 160; i += 1) {
    await page.mouse.wheel(0, step);
    await page.waitForTimeout(gapMs);
    const atEnd = await evaluate<boolean>(page, "() => Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 2");
    if (atEnd) break;
  }
  await page.waitForTimeout(500);
}

export interface Viewport {
  name: "desktop" | "tablet" | "phone";
  width: number;
  height: number;
  mobile: boolean;
  slices: number;
}
export const VIEWPORTS: Viewport[] = [
  { name: "desktop", width: 1440, height: 900, mobile: false, slices: 4 },
  { name: "tablet", width: 768, height: 1024, mobile: false, slices: 2 },
  { name: "phone", width: 375, height: 812, mobile: true, slices: 5 },
];

export interface Shot {
  page: string;
  viewport: Viewport["name"];
  width: number;
  /** Full-page PNG on disk. */
  file: string;
  /** Viewport-sized JPEG slices from the top, for the screenshot reviewer. */
  slices: Buffer[];
}

export interface RenderedMetrics {
  /** Track B motion pass: main-thread blocking while scrolling, long frames, animations seen. */
  motion?: { blockingMs: number | null; longFrames: number | null; animations: number };
  jsBytes: number;
  lcpMs: number | null;
  /** Lighthouse's simulated (lantern) LCP: advisory, recorded for comparison, never gates (2026-10-07). */
  lcpSimulatedMs?: number | null;
  cls: number | null;
  performanceScore: number | null;
}

export interface RenderedRun {
  results: CheckResult[];
  shots: Shot[];
  metrics: Record<string, RenderedMetrics>;
}

export interface RenderedQaOptions {
  /** Where screenshots are written. */
  outDir: string;
  /** Pages relative to the site root; default ["index.html"]. */
  pages?: string[];
  budget?: Budget;
  /** Run Lighthouse (render.perf). Default true; tests turn it off for speed. */
  lighthouse?: boolean;
  /** HEAD-check external http(s) links. Default false (CI may have no outbound network). Public addresses only (egress.ts). */
  checkExternalLinks?: boolean;
  /** Step 7: egress policy overrides for the external link check (tests inject a resolver). */
  egress?: EgressOptions;
  minFontPx?: number;
  minTargetPx?: number;
  rulebook?: Rulebook;
}

/** Screenshot slices per viewport the reviewer gets for each page after the first. */
export const EXTRA_PAGE_SLICES = 2;

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const result = (checkId: string, details: string[]): CheckResult => ({ checkId, passed: details.length === 0, details: [...new Set(details)] });

async function evaluate<T>(page: Page, fn: string, arg?: unknown): Promise<T> {
  return page.evaluate(`(${fn})(${arg === undefined ? "" : JSON.stringify(arg)})`) as Promise<T>;
}

/** Same origin as the site server (exact origin match, not a string prefix: :1234 is not :12345). */
const sameOrigin = (url: string, origin: string): boolean => {
  try {
    return new URL(url).origin === origin;
  } catch {
    return false;
  }
};
/** A request the confined browser could not make leaves the site; the server's blocked list reports it once. */
const leavesSite = (url: string, origin: string) => /^(https?|wss?):/i.test(url) && !sameOrigin(url, origin);

function watch(page: Page, origin: string, sink: { console: string[]; assets: string[]; scriptBytes: number }) {
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    // The browser's own "Failed to load resource" line for a request the egress policy refused is reported
    // under render.links (as a blocked request), not twice.
    if (/^Failed to load resource/.test(m.text()) && leavesSite(m.location()?.url ?? "", origin)) return;
    sink.console.push(`console error: ${m.text().slice(0, 200)}`);
  });
  page.on("pageerror", (e) => sink.console.push(`uncaught exception: ${String(e.message ?? e).slice(0, 200)}`));
  page.on("requestfailed", (r) => {
    if (leavesSite(r.url(), origin)) return;
    const reason = r.failure()?.errorText ?? "unknown";
    // A request the page or the test cancelled (a framework's background prefetch when the page closes) is
    // not a failure of the site; a missing file shows as an HTTP status below, a dead host as another error.
    if (reason === "net::ERR_ABORTED") return;
    sink.console.push(`request failed: ${r.url().slice(0, 120)} (${reason})`);
  });
  page.on("response", async (r) => {
    const url = r.url();
    if (leavesSite(url, origin)) return;
    if (r.status() >= 400) sink.assets.push(`${r.request().resourceType()} ${url.replace(origin, "")} returned HTTP ${r.status()}`);
    if (r.request().resourceType() === "script" && r.ok()) {
      try {
        sink.scriptBytes += (await r.body()).length;
      } catch {
        /* redirected or evicted body: counted by Lighthouse instead */
      }
    }
  });
}

async function checkLink(
  link: { href: string; abs: string; text: string; anchorOk: boolean | null },
  origin: string,
  siteDir: string,
  external: boolean,
  egress: EgressOptions | undefined,
): Promise<string | null> {
  const label = `"${link.text || link.href}" (${link.href})`;
  const href = link.href.trim();
  if (href === "" || href === "#") return `link ${label} goes nowhere`;
  if (/^javascript:/i.test(href)) return `link ${label} uses javascript: instead of a real target`;
  if (link.anchorOk === false) return `link ${label} points at an anchor that does not exist on the page`;
  if (link.anchorOk === true) return null;
  if (/^mailto:/i.test(href)) return /^mailto:[^@\s]+@[^@\s]+\.[a-z]{2,}/i.test(href) ? null : `email link ${label} is malformed`;
  if (/^tel:/i.test(href)) return /^tel:\+?[\d\s().-]{7,}$/i.test(href) ? null : `phone link ${label} is malformed`;
  if (!/^https?:/i.test(link.abs)) return null;
  // Step 7: a same-site link is checked against the built files (the way the server would serve it), never fetched.
  if (sameOrigin(link.abs, origin)) {
    const file = siteFileFor(siteDir, new URL(link.abs).pathname);
    return file && existsSync(file) && statSync(file).isFile() ? null : `link ${label} returns HTTP 404 (no such file in the build)`;
  }
  if (!external) return null;
  const r = await checkExternalLink(link.abs, egress);
  if (r.outcome === "ok") return null;
  if (r.outcome === "http-error") return `link ${label} returns HTTP ${r.status}`;
  if (r.outcome === "refused") return `link ${label} was not checked: ${r.reason} (rendered QA only contacts public addresses)`;
  return `link ${label} is unreachable (${r.reason})`;
}

const LIGHTHOUSE_TIMEOUT_MS = 120_000;

/**
 * How render.perf measures (Huraira's decision 2026-10-07, option 1): the gate uses Lighthouse with APPLIED
 * ("devtools") throttling, which really slows the network and CPU and records when the page actually paints.
 * The default simulated ("lantern") model charged the Track B starter ~2.5 s of LCP for framework scripts that load
 * in parallel and do not delay the headline (Cockpit job c775c396: simulated 2.46-2.58 s; applied 0.72 s with or
 * without the scripts; real Chrome 0.05 s). The simulated figure is still measured and recorded as advisory only.
 */
export type ThrottlingMethod = "devtools" | "simulate";

async function lighthouseRun(url: string, methods: ThrottlingMethod[]): Promise<{ lcpMs: number; cls: number; score: number | null }[]> {
  const [{ default: lighthouse }, chromeLauncher] = await Promise.all([import("lighthouse"), import("chrome-launcher")]);
  // One Chrome for every measurement of the page: launching and killing a second one per page reset open
  // sockets mid-run (CI 37627375120).
  const chrome = await chromeLauncher.launch({
    chromePath: chromium.executablePath(),
    // Step 7: confined to the site's own server (egress.ts); nothing Lighthouse's Chrome loads can leave it.
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", ...confinedBrowserArgs(new URL(url).origin)],
    maxConnectionRetries: 100,
  });
  let timer: NodeJS.Timeout | undefined;
  try {
    const results: { lcpMs: number; cls: number; score: number | null }[] = [];
    for (const throttlingMethod of methods) {
      // A hung Lighthouse run must fail the check by name, not hang the job (first CI run, 2026-10-01).
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Lighthouse did not finish within ${LIGHTHOUSE_TIMEOUT_MS / 1000} s`)), LIGHTHOUSE_TIMEOUT_MS);
      });
      const run = await Promise.race([
        lighthouse(
          url,
          { port: chrome.port, output: "json", logLevel: "error", onlyCategories: ["performance"] },
          { extends: "lighthouse:default", settings: { throttlingMethod } },
        ),
        timeout,
      ]);
      clearTimeout(timer);
      if (!run) throw new Error("Lighthouse returned no result");
      const audits = run.lhr.audits;
      results.push({
        lcpMs: audits["largest-contentful-paint"]?.numericValue ?? Number.NaN,
        cls: audits["cumulative-layout-shift"]?.numericValue ?? Number.NaN,
        score: run.lhr.categories.performance?.score ?? null,
      });
    }
    return results;
  } finally {
    clearTimeout(timer);
    chrome.kill();
  }
}

/** Runs every rendered check against a site directory served over loopback HTTP. */
export async function runRenderedQa(siteDir: string, opts: RenderedQaOptions): Promise<RenderedRun> {
  const pages = opts.pages ?? ["index.html"];
  const budget = opts.budget ?? TRACK_A_BUDGET;
  const rulebook = opts.rulebook ?? loadRulebook();
  const domRules = rulebook.rules.filter((r) => r.detect.dom);
  mkdirSync(opts.outDir, { recursive: true });

  const details: Record<string, string[]> = {
    "render.load": [], "render.console": [], "render.links": [], "render.a11y": [], "render.layout": [],
    "render.js-budget": [], "render.reduced-motion": [], "render.design-rules": [], "render.perf": [],
    ...(budget.motion ? { "render.motion-budget": [] as string[] } : {}),
  };
  const shots: Shot[] = [];
  const metrics: Record<string, RenderedMetrics> = {};
  const server = await serveDirectory(siteDir);
  let browser: Browser | null = null;
  try {
    // Native smooth scrolling off, so any smoothing the reduced-motion probe sees comes from page script.
    // Step 7: every request goes to the site's own server, which serves only the built files (egress.ts).
    browser = await chromium.launch({ args: ["--disable-smooth-scrolling", ...confinedBrowserArgs(server.origin)] });
    for (const pageName of pages) {
      const url = pageUrl(server.origin, pageName);
      const sink = { console: [] as string[], assets: [] as string[], scriptBytes: 0 };
      const m: RenderedMetrics = { jsBytes: 0, lcpMs: null, cls: null, performanceScore: null };
      metrics[pageName] = m;
      const where = pages.length > 1 ? `${pageName}: ` : "";
      const blockedBefore = server.blocked.length;

      for (const vp of VIEWPORTS) {
        const context: BrowserContext = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, isMobile: vp.mobile, hasTouch: vp.mobile });
        const page = await context.newPage();
        watch(page, server.origin, sink);
        const res = await page.goto(url, { waitUntil: "load" }).catch((e: Error) => {
          details["render.load"]!.push(`${where}${vp.name}: page did not load (${e.message.slice(0, 120)})`);
          return null;
        });
        if (!res) {
          await context.close();
          continue;
        }
        if (!res.ok()) details["render.load"]!.push(`${where}${vp.name}: HTTP ${res.status()}`);
        await page.waitForTimeout(250);
        await evaluate(page, SCROLL_THROUGH);

        for (const d of await evaluate<string[]>(page, LAYOUT_PROBE, { mobile: vp.mobile, minFontPx: opts.minFontPx ?? 12, minTargetPx: opts.minTargetPx ?? 24 })) {
          details["render.layout"]!.push(`${where}${vp.width}px: ${d}`);
        }

        // Track B (budgets with a motion part): a pinned, scroll-driven scene has no faithful full-page still
        // (its pin leaves the scroll distance as an empty band). The stills are taken in the resting layout
        // the site shows with reduced motion, where every element is in place; all checks above ran with
        // motion on. Restored after the screenshots.
        if (budget.motion) {
          await page.emulateMedia({ reducedMotion: "reduce" });
          await page.waitForTimeout(400);
        }
        const file = path.join(opts.outDir, `${pageName.replace(/[^a-z0-9.-]/gi, "_")}-${vp.width}.png`);
        await page.screenshot({ path: file, fullPage: true });
        const height = await evaluate<number>(page, "() => document.documentElement.scrollHeight");
        const slices: Buffer[] = [];
        // The reviewer sees the first page in full and the top of every other page (Step 4B M3: keeps a
        // multi-page review inside one model call). Full-page PNGs of every page are still written.
        const maxSlices = pageName === pages[0] ? vp.slices : Math.min(vp.slices, EXTRA_PAGE_SLICES);
        for (let i = 0; i < maxSlices && i * vp.height < height; i += 1) {
          const y = i * vp.height;
          slices.push(await page.screenshot({ type: "jpeg", quality: 60, fullPage: true, clip: { x: 0, y, width: vp.width, height: Math.min(vp.height, height - y) } }));
        }
        shots.push({ page: pageName, viewport: vp.name, width: vp.width, file, slices });
        if (budget.motion) {
          await page.emulateMedia({ reducedMotion: null });
          await page.waitForTimeout(300);
        }

        if (vp.name !== "tablet") {
          const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
          for (const v of axe.violations) {
            details["render.a11y"]!.push(`${where}${v.id} (${v.impact ?? "n/a"}): ${v.help}; ${v.nodes.length} element(s), e.g. ${v.nodes[0]?.target.join(" ") ?? "?"}`);
          }
        }
        if (vp.name === "desktop") {
          const found = await evaluate<Record<string, string[]>>(page, DESIGN_DETECTORS, domRules.map((r) => r.detect.dom));
          for (const rule of domRules) for (const d of found[rule.detect.dom!] ?? []) details["render.design-rules"]!.push(`${where}${rule.id}: ${d}. ${rule.rule}`);
          const links = await evaluate<{ href: string; abs: string; text: string; anchorOk: boolean | null }[]>(page, LINK_PROBE);
          const unique = [...new Map(links.map((l) => [l.href, l])).values()];
          for (const issue of await Promise.all(unique.map((l) => checkLink(l, server.origin, siteDir, opts.checkExternalLinks ?? false, opts.egress)))) {
            if (issue) details["render.links"]!.push(`${where}${issue}`);
          }
          // External scripts: the larger of what the response hook read and what the browser's own resource
          // timing reports (decoded bytes). Since Step 4B M4: the hook alone missed chunks whose bodies were
          // already evicted, undercounting a Next.js page about 4x.
          m.jsBytes = (await evaluate<number>(page, INLINE_JS_BYTES)) + Math.max(sink.scriptBytes, await evaluate<number>(page, SCRIPT_RESOURCE_BYTES));
        }
        await context.close();
      }

      // Reduced motion: a fresh context that asks for it, checked after load settles.
      const rm = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
      await rm.addInitScript(MOTION_WATCH);
      const rmPage = await rm.newPage();
      if (await rmPage.goto(url, { waitUntil: "load" }).catch(() => null)) {
        await rmPage.waitForTimeout(800);
        const still = await evaluate<string[]>(rmPage, MOTION_PROBE);
        if (still.length) details["render.reduced-motion"]!.push(`${where}${still.length} animation(s) still run with prefers-reduced-motion: reduce: ${[...new Set(still)].slice(0, 5).join(", ")}`);
        // Script-driven motion (Step 4B M4): scroll like a visitor and watch inline transform/opacity changes.
        await evaluate(rmPage, MOTION_MARK, "rm-scroll");
        await wheelThrough(rmPage);
        const seen = await evaluate<MotionReport | null>(rmPage, MOTION_REPORT, "rm-scroll");
        const moving = (seen?.styles ?? []).filter((x) => SPATIAL_STYLE_PROPS.has(x.prop) && x.distinct >= 4);
        if (moving.length) {
          details["render.reduced-motion"]!.push(`${where}${moving.length} element(s) still animated by script with prefers-reduced-motion: reduce: ${moving.slice(0, 5).map((x) => `${x.el} ${x.prop} took ${x.distinct} values`).join(", ")}`);
        }
        await evaluate(rmPage, "() => window.scrollTo(0, 0)");
        await rmPage.waitForTimeout(300);
        const sampled = evaluate<number[]>(rmPage, SCROLL_SAMPLE);
        await rmPage.mouse.wheel(0, 600);
        const positions = await sampled;
        if (positions.length > 4) details["render.reduced-motion"]!.push(`${where}scrolling is smoothed by script with prefers-reduced-motion: reduce (one wheel step passed through ${positions.length} positions)`);
      }
      await rm.close();

      // Motion budget (Track B): what one scroll-through of the page costs with motion allowed.
      if (budget.motion) {
        const mb = budget.motion;
        const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        await ctx.addInitScript(MOTION_WATCH);
        const mp = await ctx.newPage();
        if (await mp.goto(url, { waitUntil: "load" }).catch(() => null)) {
          await mp.waitForTimeout(1200);
          await evaluate(mp, MOTION_MARK, "scroll");
          await wheelThrough(mp);
          const load = await evaluate<MotionReport | null>(mp, MOTION_REPORT, "load");
          const scroll = await evaluate<MotionReport | null>(mp, MOTION_REPORT, "scroll");
          const out = details["render.motion-budget"]!;
          for (const a of [...(load?.anims ?? []), ...(scroll?.anims ?? [])]) {
            const layout = a.props.filter((p) => LAYOUT_KEYFRAME_PROPS.has(p));
            if (layout.length) out.push(`${where}animation "${a.name}" animates layout (${layout.join(", ")}); animate transform or opacity instead`);
            if (!a.infinite && !a.scrollLinked && a.endTime > mb.maxAnimationMs) out.push(`${where}animation "${a.name}" runs ${a.endTime} ms; the budget is ${mb.maxAnimationMs} ms`);
          }
          const layoutSteps = (scroll?.styles ?? []).filter((x) => LAYOUT_STYLE_PROPS.has(x.prop) && x.distinct > mb.maxLayoutSteps);
          if (layoutSteps.length) {
            out.push(`${where}${layoutSteps.length} element(s) animate layout while scrolling: ${layoutSteps.slice(0, 5).map((x) => `${x.el} ${x.prop} took ${x.distinct} values`).join(", ")}`);
          }
          if (scroll && !scroll.loafSupported) out.push(`${where}long animation frames cannot be measured in this browser; scroll cost is unverified`);
          else if (scroll && scroll.blockingMs > mb.maxBlockingMs) {
            out.push(`${where}scrolling the page blocked the main thread for ${scroll.blockingMs} ms over ${scroll.longFrames} long frame(s) (worst ${scroll.worstFrameMs} ms); the budget is ${mb.maxBlockingMs} ms`);
          }
          m.motion = { blockingMs: scroll?.blockingMs ?? null, longFrames: scroll?.longFrames ?? null, animations: (load?.anims.length ?? 0) + (scroll?.anims.length ?? 0) };
        } else details["render.motion-budget"]!.push(`${where}page did not load for the motion pass`);
        await ctx.close();
      }

      details["render.console"]!.push(...sink.console.map((c) => `${where}${c}`));
      details["render.links"]!.push(...sink.assets.map((a) => `${where}${a}`));
      // Step 7: anything the page tried to load from outside the site was refused by the server; say so.
      for (const b of server.blocked.slice(blockedBefore)) {
        details["render.links"]!.push(`${where}request to outside the site blocked: ${b} (rendered QA serves only the built files; a page must be self-contained)`);
      }
      const kb = m.jsBytes / 1024;
      if (kb > budget.jsKb) details["render.js-budget"]!.push(`${where}${kb.toFixed(1)} KB of JavaScript; the budget is ${budget.jsKb} KB`);

      if (opts.lighthouse !== false) {
        try {
          // Applied throttling gates; the simulated run (home page only) is advisory and may fail without consequence.
          const isHome = pageName === pages[0];
          const [lh, sim] = await lighthouseRun(url, isHome ? ["devtools", "simulate"] : ["devtools"]).then(
            (r) => r,
            async (err) => (isHome ? [...(await lighthouseRun(url, ["devtools"])), undefined] : Promise.reject(err)),
          );
          if (!lh) throw new Error("Lighthouse returned no applied-throttling result");
          m.lcpMs = lh.lcpMs;
          m.cls = lh.cls;
          m.performanceScore = lh.score;
          if (!(lh.lcpMs < budget.lcpMs)) details["render.perf"]!.push(`${where}LCP ${(lh.lcpMs / 1000).toFixed(2)} s on mobile (Lighthouse, applied throttling); the budget is ${(budget.lcpMs / 1000).toFixed(1)} s`);
          // Advisory only: never fails the check; home page only, so multi-page QA stays inside the 30-minute job limit.
          if (isHome) m.lcpSimulatedMs = sim?.lcpMs ?? null;
          if (!(lh.cls < budget.cls)) details["render.perf"]!.push(`${where}CLS ${lh.cls.toFixed(3)}; the budget is ${budget.cls}`);
        } catch (err) {
          details["render.perf"]!.push(`${where}Lighthouse could not measure the page (${err instanceof Error ? err.message : String(err)}); performance is unverified`);
        }
      }
    }
  } finally {
    await browser?.close();
    await server.close();
  }

  const ids = Object.keys(details).filter((id) => id !== "render.perf" || opts.lighthouse !== false);
  return { results: ids.map((id) => result(id, details[id]!)), shots, metrics };
}

/**
 * The rendered checks as a VerificationLoop async suite. The page under test is ctx.html, written to a
 * private temp directory as index.html, or (Step 4B M3) every file of ctx.site, served together. The last run is kept so the screenshot reviewer can use its screenshots.
 */
export interface RenderedSuite extends AsyncCheckSuite {
  lastRun: RenderedRun | null;
}

export function createRenderedSuite(opts: RenderedQaOptions): RenderedSuite {
  const suite: RenderedSuite = {
    id: "rendered-qa",
    description: "Headless Chromium at 1440/768/375: console, links, axe, layout, JS budget, reduced motion, design rules, Lighthouse.",
    lastRun: null,
    async run(ctx: VerificationContext): Promise<CheckResult[]> {
      const dir = mkdtempSync(path.join(tmpdir(), "wfact-rqa-"));
      try {
        if (ctx.site) {
          // Step 4B M3: the whole site is served, so cross-page links and every page are checked. Since M4
          // files may sit in folders (a Next.js export) and fonts arrive as base64 (listed in site.binary).
          const binary = new Set(ctx.site.binary ?? []);
          for (const [name, content] of Object.entries(ctx.site.files)) {
            if (!SITE_FILE_RE.test(name)) throw new Error(`refusing site file name ${JSON.stringify(name)}`);
            const target = path.join(dir, name);
            if (!target.startsWith(dir + path.sep)) throw new Error(`refusing site file name ${JSON.stringify(name)}`);
            mkdirSync(path.dirname(target), { recursive: true });
            writeFileSync(target, binary.has(name) ? Buffer.from(content, "base64") : Buffer.from(content, "utf-8"));
          }
          suite.lastRun = await runRenderedQa(dir, { ...opts, pages: ctx.site.pages });
        } else {
          writeFileSync(path.join(dir, "index.html"), ctx.html, "utf-8");
          suite.lastRun = await runRenderedQa(dir, opts);
        }
        return suite.lastRun.results;
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  };
  return suite;
}
