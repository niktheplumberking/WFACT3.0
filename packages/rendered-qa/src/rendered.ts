/**
 * Rendered QA (Step 4B M1): loads the built page in headless Chromium and checks what a visitor
 * actually gets, which every Step 4 check skipped. One browser pass per page and viewport
 * (1440 / 768 / 375) yields these results, each with an exact check id the builder can act on:
 *
 *   render.load            page served and loaded (HTTP 2xx)
 *   render.console         console errors, uncaught exceptions, failed network requests
 *   render.links           in-page anchors, relative pages, assets (HTTP >= 400), tel:/mailto:, optional external
 *   render.a11y            axe-core, WCAG 2.0/2.1/2.2 A + AA tags, at 1440 and 375
 *   render.layout          horizontal scroll at every viewport; tiny text and small tap targets at 375
 *   render.js-budget       total JavaScript bytes (inline + loaded) against the track budget
 *   render.reduced-motion  animations still running with prefers-reduced-motion: reduce
 *   render.design-rules    the design rulebook's DOM detectors (packages/frontend-loop/design/rulebook.json)
 *   render.perf            Lighthouse (mobile, simulated throttling): LCP and CLS against the track budget
 *
 * Screenshots are written to `outDir` (full page per viewport) and kept as viewport-sized JPEG slices
 * for the cross-vendor screenshot reviewer (`reviewer.ts`).
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import type { AsyncCheckSuite, CheckResult, VerificationContext } from "@wfact/verification/checks/types";
import { serveDirectory } from "./server.js";
import { DESIGN_DETECTORS, INLINE_JS_BYTES, LAYOUT_PROBE, LINK_PROBE, MOTION_PROBE, SCROLL_THROUGH } from "./browserScripts.js";
import { loadRulebook, type Rulebook } from "./rulebook.js";

export interface Budget {
  lcpMs: number;
  cls: number;
  jsKb: number;
}
/** Track A (local business): LCP < 2.0 s mobile, total JS < 50 KB, CLS < 0.1 (FRONTEND-UPGRADE-DESIGN.md §2). */
export const TRACK_A_BUDGET: Budget = { lcpMs: 2000, cls: 0.1, jsKb: 50 };

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
  jsBytes: number;
  lcpMs: number | null;
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
  /** HEAD-check external http(s) links. Default false (CI may have no outbound network). */
  checkExternalLinks?: boolean;
  minFontPx?: number;
  minTargetPx?: number;
  rulebook?: Rulebook;
}

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const result = (checkId: string, details: string[]): CheckResult => ({ checkId, passed: details.length === 0, details: [...new Set(details)] });

async function evaluate<T>(page: Page, fn: string, arg?: unknown): Promise<T> {
  return page.evaluate(`(${fn})(${arg === undefined ? "" : JSON.stringify(arg)})`) as Promise<T>;
}

function watch(page: Page, origin: string, sink: { console: string[]; assets: string[]; scriptBytes: number }) {
  page.on("console", (m) => {
    if (m.type() === "error") sink.console.push(`console error: ${m.text().slice(0, 200)}`);
  });
  page.on("pageerror", (e) => sink.console.push(`uncaught exception: ${String(e.message ?? e).slice(0, 200)}`));
  page.on("requestfailed", (r) => sink.console.push(`request failed: ${r.url().slice(0, 120)} (${r.failure()?.errorText ?? "unknown"})`));
  page.on("response", async (r) => {
    const url = r.url();
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

async function checkLink(link: { href: string; abs: string; text: string; anchorOk: boolean | null }, origin: string, external: boolean): Promise<string | null> {
  const label = `"${link.text || link.href}" (${link.href})`;
  const href = link.href.trim();
  if (href === "" || href === "#") return `link ${label} goes nowhere`;
  if (/^javascript:/i.test(href)) return `link ${label} uses javascript: instead of a real target`;
  if (link.anchorOk === false) return `link ${label} points at an anchor that does not exist on the page`;
  if (link.anchorOk === true) return null;
  if (/^mailto:/i.test(href)) return /^mailto:[^@\s]+@[^@\s]+\.[a-z]{2,}/i.test(href) ? null : `email link ${label} is malformed`;
  if (/^tel:/i.test(href)) return /^tel:\+?[\d\s().-]{7,}$/i.test(href) ? null : `phone link ${label} is malformed`;
  if (!/^https?:/i.test(link.abs)) return null;
  const sameOrigin = link.abs.startsWith(origin);
  if (!sameOrigin && !external) return null;
  try {
    let res = await fetch(link.abs, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(8000) });
    if (res.status === 405 || res.status === 403) res = await fetch(link.abs, { redirect: "follow", signal: AbortSignal.timeout(8000) });
    return res.status >= 400 ? `link ${label} returns HTTP ${res.status}` : null;
  } catch (err) {
    return `link ${label} is unreachable (${err instanceof Error ? err.message : String(err)})`;
  }
}

async function lighthouseRun(url: string): Promise<{ lcpMs: number; cls: number; score: number | null }> {
  const [{ default: lighthouse }, chromeLauncher] = await Promise.all([import("lighthouse"), import("chrome-launcher")]);
  const chrome = await chromeLauncher.launch({ chromePath: chromium.executablePath(), chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"] });
  try {
    const run = await lighthouse(url, { port: chrome.port, output: "json", logLevel: "error", onlyCategories: ["performance"] });
    if (!run) throw new Error("Lighthouse returned no result");
    const audits = run.lhr.audits;
    return {
      lcpMs: audits["largest-contentful-paint"]?.numericValue ?? Number.NaN,
      cls: audits["cumulative-layout-shift"]?.numericValue ?? Number.NaN,
      score: run.lhr.categories.performance?.score ?? null,
    };
  } finally {
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
  };
  const shots: Shot[] = [];
  const metrics: Record<string, RenderedMetrics> = {};
  const server = await serveDirectory(siteDir);
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch();
    for (const pageName of pages) {
      const url = `${server.origin}/${pageName}`;
      const sink = { console: [] as string[], assets: [] as string[], scriptBytes: 0 };
      const m: RenderedMetrics = { jsBytes: 0, lcpMs: null, cls: null, performanceScore: null };
      metrics[pageName] = m;
      const where = pages.length > 1 ? `${pageName}: ` : "";

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

        const file = path.join(opts.outDir, `${pageName.replace(/[^a-z0-9.-]/gi, "_")}-${vp.width}.png`);
        await page.screenshot({ path: file, fullPage: true });
        const height = await evaluate<number>(page, "() => document.documentElement.scrollHeight");
        const slices: Buffer[] = [];
        for (let i = 0; i < vp.slices && i * vp.height < height; i += 1) {
          const y = i * vp.height;
          slices.push(await page.screenshot({ type: "jpeg", quality: 60, fullPage: true, clip: { x: 0, y, width: vp.width, height: Math.min(vp.height, height - y) } }));
        }
        shots.push({ page: pageName, viewport: vp.name, width: vp.width, file, slices });

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
          for (const issue of await Promise.all(unique.map((l) => checkLink(l, server.origin, opts.checkExternalLinks ?? false)))) {
            if (issue) details["render.links"]!.push(`${where}${issue}`);
          }
          m.jsBytes = (await evaluate<number>(page, INLINE_JS_BYTES)) + sink.scriptBytes;
        }
        await context.close();
      }

      // Reduced motion: a fresh context that asks for it, checked after load settles.
      const rm = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
      const rmPage = await rm.newPage();
      if (await rmPage.goto(url, { waitUntil: "load" }).catch(() => null)) {
        await rmPage.waitForTimeout(800);
        const still = await evaluate<string[]>(rmPage, MOTION_PROBE);
        if (still.length) details["render.reduced-motion"]!.push(`${where}${still.length} animation(s) still run with prefers-reduced-motion: reduce: ${[...new Set(still)].slice(0, 5).join(", ")}`);
      }
      await rm.close();

      details["render.console"]!.push(...sink.console.map((c) => `${where}${c}`));
      details["render.links"]!.push(...sink.assets.map((a) => `${where}${a}`));
      const kb = m.jsBytes / 1024;
      if (kb > budget.jsKb) details["render.js-budget"]!.push(`${where}${kb.toFixed(1)} KB of JavaScript; the budget is ${budget.jsKb} KB`);

      if (opts.lighthouse !== false) {
        try {
          const lh = await lighthouseRun(url);
          m.lcpMs = lh.lcpMs;
          m.cls = lh.cls;
          m.performanceScore = lh.score;
          if (!(lh.lcpMs < budget.lcpMs)) details["render.perf"]!.push(`${where}LCP ${(lh.lcpMs / 1000).toFixed(2)} s on mobile (Lighthouse, simulated throttling); the budget is ${(budget.lcpMs / 1000).toFixed(1)} s`);
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
 * The rendered checks as a VerificationLoop async suite. The page under test is ctx.html (today's
 * builder emits one file); it is written to a private temp directory as index.html and served from
 * there. The last run is kept so the screenshot reviewer can use its screenshots.
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
        writeFileSync(path.join(dir, "index.html"), ctx.html, "utf-8");
        suite.lastRun = await runRenderedQa(dir, opts);
        return suite.lastRun.results;
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  };
  return suite;
}
