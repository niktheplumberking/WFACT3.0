/**
 * Step 7 evaluation registry: the deterministic text checks added on top of the Phase 5 six and the claims
 * gate. Ported, in priority order, from what survives of 2.0 in this repo (docs/WFACT SOPS/: the Stage 4/6/7
 * gates and QA checklist quoted in the Factory Audit, and the "tells" named in the Factory Book §4F); see
 * config/eval-registry.json for each check's source, severity, stage and fixtures. Each check reads only the
 * built files (no network, no browser, no model), so it runs the same in every entry point.
 *
 * Every detail line names the exact element or file, so FrontendLoop.revise() can act on it.
 */
import path from "node:path";
import { parse, type HTMLElement } from "node-html-parser";
import type { Check, CheckResult, VerificationContext } from "./types.js";
import type { SiteLevelCheck } from "../runCheck.js";
import { nonPublicHostReason } from "../net.js";

const NON_VISIBLE = "script, style, noscript, template";

const root = (html: string): HTMLElement => parse(html, { comment: false });
const result = (checkId: string, details: string[]): CheckResult => ({ checkId, passed: details.length === 0, details: [...new Set(details)] });
const na = (checkId: string, reason: string): CheckResult => ({ checkId, passed: true, details: [], notApplicable: reason });
const short = (s: string, max = 90) => (s.length > max ? `${s.slice(0, max)}…` : s);
const tagOf = (el: HTMLElement) => `<${el.tagName.toLowerCase()}${el.id ? ` id="${el.id}"` : ""}>`;

/** Every URL a page references: subresources, links, form targets, srcset entries and CSS url(...). */
interface PageUrl {
  url: string;
  attr: string;
  el: string;
  /** True when the browser fetches it while loading the page (not a link the visitor follows). */
  subresource: boolean;
}

const URL_ATTRS: [attr: string, subresource: boolean][] = [
  ["href", false], ["src", true], ["action", false], ["formaction", false], ["poster", true], ["data", true], ["xlink:href", false], ["background", true],
];

function pageUrls(html: string): PageUrl[] {
  const doc = root(html);
  const out: PageUrl[] = [];
  for (const el of doc.querySelectorAll("*")) {
    const tag = el.tagName.toLowerCase();
    for (const [attr, sub] of URL_ATTRS) {
      const v = el.getAttribute(attr);
      if (v === undefined || v.trim() === "") continue;
      // <link href> is fetched (stylesheet, icon, preload) unless it only names a page (canonical, alternate...).
      const fetched = tag === "link" ? !/\b(canonical|alternate|author|help|license|next|prev|search|me|dns-prefetch|preconnect)\b/i.test(el.getAttribute("rel") ?? "") : sub;
      out.push({ url: v.trim(), attr, el: tag, subresource: fetched });
    }
    for (const attr of ["srcset", "imagesrcset"]) {
      const v = el.getAttribute(attr);
      if (!v) continue;
      for (const part of v.split(",")) {
        const u = part.trim().split(/\s+/)[0];
        if (u) out.push({ url: u, attr, el: tag, subresource: true });
      }
    }
    const style = el.getAttribute("style");
    if (style) for (const u of cssUrls(style)) out.push({ url: u, attr: "style", el: tag, subresource: true });
    if (tag === "meta" && /refresh/i.test(el.getAttribute("http-equiv") ?? "")) {
      const m = (el.getAttribute("content") ?? "").match(/url\s*=\s*['"]?([^'"]+)/i);
      if (m) out.push({ url: m[1]!.trim(), attr: "http-equiv=refresh", el: tag, subresource: false });
    }
  }
  for (const s of doc.querySelectorAll("style")) for (const u of cssUrls(s.text)) out.push({ url: u, attr: "css url()", el: "style", subresource: true });
  return out;
}

function cssUrls(css: string): string[] {
  const urls: string[] = [];
  for (const m of css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi)) urls.push(m[2]!.trim());
  for (const m of css.matchAll(/@import\s+(['"])([^'"]+)\1/gi)) urls.push(m[2]!.trim());
  return urls;
}

const absolute = (u: string): URL | null => {
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u) && !u.startsWith("//")) return null;
  try {
    return new URL(u.startsWith("//") ? `https:${u}` : u);
  } catch {
    return null;
  }
};

// ------------------------------------------------------------------------------------------------
// Security and integrity
// ------------------------------------------------------------------------------------------------

export const devUrlsCheck: Check = {
  id: "sec.dev-urls",
  description: "No URL on the page points at this machine or a private network (localhost, 127.x, 10.x, 192.168.x, 169.254.x, file:, .local...).",
  run(ctx: VerificationContext): CheckResult {
    const details: string[] = [];
    for (const u of pageUrls(ctx.html)) {
      if (/^file:/i.test(u.url)) {
        details.push(`<${u.el} ${u.attr}="${short(u.url)}"> points at a local file (file:); a built site may only reference its own files or public URLs.`);
        continue;
      }
      const abs = absolute(u.url);
      if (!abs || !/^(https?|wss?|ftp):$/i.test(abs.protocol)) continue;
      const why = nonPublicHostReason(abs.hostname);
      if (why) details.push(`<${u.el} ${u.attr}="${short(u.url)}"> points at ${abs.hostname} (${why}); development and internal addresses never ship.`);
    }
    return result("sec.dev-urls", details);
  },
};

export const mixedContentCheck: Check = {
  id: "sec.mixed-content",
  description: "Nothing the page loads or submits to uses plain http:// (mixed content is blocked or flagged by browsers; form data would travel unencrypted).",
  run(ctx: VerificationContext): CheckResult {
    const details: string[] = [];
    for (const u of pageUrls(ctx.html)) {
      if (!/^http:\/\//i.test(u.url)) continue;
      if (u.subresource) details.push(`<${u.el} ${u.attr}="${short(u.url)}"> loads over plain http://; use https:// or a file of the site.`);
      else if (u.attr === "action" || u.attr === "formaction") details.push(`<${u.el} ${u.attr}="${short(u.url)}"> submits form data over plain http://; use https://.`);
    }
    return result("sec.mixed-content", details);
  },
};

const SOURCE_MAP_RE = /[#@]\s*sourceMappingURL\s*=\s*(?!data:)\S+/;

export const sourceMapsCheck: SiteLevelCheck = {
  id: "sec.source-maps",
  siteLevel: true,
  description: "No source maps ship (no .map files, no sourceMappingURL comments): they publish the original source (a 2.0 'tell').",
  run(ctx: VerificationContext): CheckResult {
    const details: string[] = [];
    const files: Record<string, string> = ctx.site ? ctx.site.files : { "index.html": ctx.html };
    const binary = new Set(ctx.site?.binary ?? []);
    for (const [name, body] of Object.entries(files)) {
      if (/\.map$/i.test(name)) details.push(`${name}: a source map file is part of the site; remove it from the build output.`);
      if (binary.has(name)) continue;
      const m = body.match(SOURCE_MAP_RE);
      if (m) details.push(`${name}: references a source map ("${short(m[0], 60)}"); build without source maps.`);
    }
    return result("sec.source-maps", details);
  },
};

export const targetBlankCheck: Check = {
  id: "sec.target-blank",
  description: 'Links that open a new tab carry rel="noopener" (or noreferrer), so the opened page cannot script this one.',
  run(ctx: VerificationContext): CheckResult {
    const details: string[] = [];
    for (const a of root(ctx.html).querySelectorAll('a[target="_blank" i], area[target="_blank" i], form[target="_blank" i]')) {
      if (!/\bno(opener|referrer)\b/i.test(a.getAttribute("rel") ?? "")) details.push(`${tagOf(a)} "${short(a.text.trim() || a.getAttribute("href") || "", 50)}" opens a new tab without rel="noopener".`);
    }
    return result("sec.target-blank", details);
  },
};

export const duplicateIdsCheck: Check = {
  id: "integrity.duplicate-ids",
  description: "Every id on a page is unique (a duplicate breaks anchors, form labels and aria references).",
  run(ctx: VerificationContext): CheckResult {
    const seen = new Map<string, number>();
    for (const el of root(ctx.html).querySelectorAll("[id]")) {
      const id = el.getAttribute("id") ?? "";
      if (id) seen.set(id, (seen.get(id) ?? 0) + 1);
    }
    return result("integrity.duplicate-ids", [...seen].filter(([, n]) => n > 1).map(([id, n]) => `id="${id}" is used ${n} times on the page; ids must be unique.`));
  },
};

/** Words of text a visitor gets without running any script (view-source). */
function staticWords(html: string): number {
  const doc = root(html);
  for (const el of doc.querySelectorAll(NON_VISIBLE)) el.remove();
  const body = doc.querySelector("body") ?? doc;
  return (body.text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
}
const MIN_STATIC_WORDS = 20;

export const prerenderedContentCheck: Check = {
  id: "integrity.prerendered-content",
  description: `The page's content is in the HTML itself, not only built by script after load (at least ${MIN_STATIC_WORDS} words in view-source; an empty view-source is a 2.0 'tell').`,
  run(ctx: VerificationContext): CheckResult {
    const words = staticWords(ctx.html);
    return result(
      "integrity.prerendered-content",
      words < MIN_STATIC_WORDS ? [`only ${words} word(s) of content are in the HTML before scripts run (view-source is near empty); render the content into the page, not only from JavaScript.`] : [],
    );
  },
};

// ------------------------------------------------------------------------------------------------
// Content honesty
// ------------------------------------------------------------------------------------------------

const PLACEHOLDER_HOSTS = /(^|\.)(placehold\.co|placehold\.it|placeholder\.com|placeholder\.pics|dummyimage\.com|picsum\.photos|placekitten\.com|placebear\.com|loremflickr\.com|lorempixel\.com|fakeimg\.pl|source\.unsplash\.com|baconmockup\.com|placeimg\.com)$/i;
const EXAMPLE_HOSTS = /(^|\.)(example\.(com|org|net)|[a-z0-9-]+\.example)$/i;

export const placeholderMediaCheck: Check = {
  id: "content.placeholder-media",
  description: "No placeholder images (placehold.co, picsum, dummyimage...) and no links to example domains: placeholder media and dead example links never ship.",
  run(ctx: VerificationContext): CheckResult {
    const details: string[] = [];
    for (const u of pageUrls(ctx.html)) {
      const abs = absolute(u.url);
      if (!abs || !/^https?:$/.test(abs.protocol)) continue;
      if (PLACEHOLDER_HOSTS.test(abs.hostname)) details.push(`<${u.el} ${u.attr}="${short(u.url)}"> uses a placeholder image service (${abs.hostname}); use the client's real asset or leave a labelled empty state.`);
      else if (EXAMPLE_HOSTS.test(abs.hostname)) details.push(`<${u.el} ${u.attr}="${short(u.url)}"> points at an example domain (${abs.hostname}); link the client's real page or remove the link.`);
    }
    return result("content.placeholder-media", details);
  },
};

// ------------------------------------------------------------------------------------------------
// Accessibility (text-level; axe in render.a11y covers the rendered page)
// ------------------------------------------------------------------------------------------------

export const htmlLangCheck: Check = {
  id: "a11y.html-lang",
  description: "The <html> element declares the page language (lang), so screen readers pronounce it correctly.",
  run(ctx: VerificationContext): CheckResult {
    const html = root(ctx.html).querySelector("html");
    const lang = html?.getAttribute("lang")?.trim() ?? "";
    return result("a11y.html-lang", /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i.test(lang) ? [] : [lang ? `<html lang="${lang}"> is not a valid language tag.` : "<html> has no lang attribute; add lang=\"en\" (or the page's language)."]);
  },
};

export const formLabelsCheck: Check = {
  id: "a11y.form-labels",
  description: "Every form field has an accessible name: a <label for>, a wrapping <label>, aria-label or aria-labelledby.",
  run(ctx: VerificationContext): CheckResult {
    const doc = root(ctx.html);
    const labelled = new Set(doc.querySelectorAll("label[for]").map((l) => l.getAttribute("for")));
    const details: string[] = [];
    for (const field of doc.querySelectorAll("input, select, textarea")) {
      const type = (field.getAttribute("type") ?? "text").toLowerCase();
      if (field.tagName.toLowerCase() === "input" && ["hidden", "submit", "button", "reset", "image"].includes(type)) continue;
      const id = field.getAttribute("id");
      let wrapped = false;
      for (let p = field.parentNode; p; p = p.parentNode) if (p.tagName?.toLowerCase() === "label") wrapped = true;
      const aria = (field.getAttribute("aria-label") ?? "").trim() || (field.getAttribute("aria-labelledby") ?? "").trim();
      if (!(id && labelled.has(id)) && !wrapped && !aria) {
        details.push(`${tagOf(field)}${field.getAttribute("name") ? ` name="${field.getAttribute("name")}"` : ""} has no label; add <label for="…"> or aria-label.`);
      }
    }
    return result("a11y.form-labels", details);
  },
};

export const headingOrderCheck: Check = {
  id: "a11y.heading-order",
  description: "Heading levels do not skip on the way down (an h2 is followed by h3, not h4), so the outline reads in order.",
  run(ctx: VerificationContext): CheckResult {
    const details: string[] = [];
    let prev = 0;
    for (const h of root(ctx.html).querySelectorAll("h1, h2, h3, h4, h5, h6")) {
      const level = Number(h.tagName[1]);
      if (prev > 0 && level > prev + 1) details.push(`<h${level}> "${short(h.text.trim(), 50)}" follows an <h${prev}>; use <h${prev + 1}> or restructure.`);
      prev = level;
    }
    return result("a11y.heading-order", details);
  },
};

// ------------------------------------------------------------------------------------------------
// SEO basics
// ------------------------------------------------------------------------------------------------

const titlesOf = (html: string) => root(html).querySelectorAll("title").map((t) => t.text.trim());
const meta = (doc: HTMLElement, key: string) =>
  doc.querySelectorAll("meta").find((m) => (m.getAttribute("name") ?? m.getAttribute("property") ?? "").toLowerCase() === key)?.getAttribute("content")?.trim() ?? "";

export const titleCheck: Check = {
  id: "seo.title",
  description: "The page has exactly one non-empty <title>.",
  run(ctx: VerificationContext): CheckResult {
    const titles = titlesOf(ctx.html);
    const details: string[] = [];
    if (titles.length === 0) details.push("the page has no <title>; add one that names the page and the business.");
    else if (titles.length > 1) details.push(`the page has ${titles.length} <title> elements; keep exactly one.`);
    else if (!titles[0]) details.push("the page's <title> is empty.");
    return result("seo.title", details);
  },
};

export const metaDescriptionCheck: Check = {
  id: "seo.meta-description",
  description: 'The page has a non-empty <meta name="description"> (2.0 Stage 4 gate: title/meta present).',
  run(ctx: VerificationContext): CheckResult {
    return result("seo.meta-description", meta(root(ctx.html), "description") ? [] : ['the page has no <meta name="description" content="…">; add a one- or two-sentence summary of the page.']);
  },
};

export const singleH1Check: Check = {
  id: "seo.single-h1",
  description: "The page has exactly one <h1> (2.0 Stage 4 gate: single h1).",
  run(ctx: VerificationContext): CheckResult {
    const n = root(ctx.html).querySelectorAll("h1").length;
    return result("seo.single-h1", n === 1 ? [] : [n === 0 ? "the page has no <h1>; the main heading must be one <h1>." : `the page has ${n} <h1> elements; keep exactly one and make the others <h2>.`]);
  },
};

export const openGraphCheck: Check = {
  id: "seo.open-graph",
  description: "The page has og:title and og:description, so a shared link shows a real preview (2.0 Stage 4 gate: OG present).",
  run(ctx: VerificationContext): CheckResult {
    const doc = root(ctx.html);
    return result("seo.open-graph", ["og:title", "og:description"].filter((k) => !meta(doc, k)).map((k) => `the page has no <meta property="${k}">.`));
  },
};

export const duplicateTitlesCheck: SiteLevelCheck = {
  id: "seo.duplicate-titles",
  siteLevel: true,
  description: "No two pages of a site share a <title> (duplicate titles are a 2.0 'tell').",
  run(ctx: VerificationContext): CheckResult {
    if (!ctx.site || ctx.site.pages.length < 2) return na("seo.duplicate-titles", "a single page has no other page to share a title with");
    const byTitle = new Map<string, string[]>();
    for (const page of ctx.site.pages) {
      const t = titlesOf(ctx.site.files[page] ?? "")[0]?.toLowerCase();
      if (t) byTitle.set(t, [...(byTitle.get(t) ?? []), page]);
    }
    return result("seo.duplicate-titles", [...byTitle].filter(([, p]) => p.length > 1).map(([t, p]) => `${p.join(", ")} share the title "${short(t, 60)}"; give each page its own.`));
  },
};

export const faviconCheck: SiteLevelCheck = {
  id: "tells.favicon",
  siteLevel: true,
  description: 'The site has a favicon: a favicon file at the root or a <link rel="icon"> on every page (2.0 Stage 7 checklist).',
  run(ctx: VerificationContext): CheckResult {
    const hasIcon = (html: string) => root(html).querySelectorAll("link").some((l) => /(^|\s)icon(\s|$)/i.test(l.getAttribute("rel") ?? ""));
    if (ctx.site && Object.keys(ctx.site.files).some((f) => /^favicon\.(ico|svg|png)$/i.test(f))) return result("tells.favicon", []);
    const pages = ctx.site ? ctx.site.pages.map((p) => [p, ctx.site!.files[p] ?? ""] as const) : [["the page", ctx.html] as const];
    return result("tells.favicon", pages.filter(([, h]) => !hasIcon(h)).map(([p]) => `${p}: no favicon (no favicon file at the site root and no <link rel="icon">).`));
  },
};

// ------------------------------------------------------------------------------------------------
// Link and asset integrity (against the built files, no network)
// ------------------------------------------------------------------------------------------------

const safeDecode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/** The site file a root-relative or page-relative path resolves to, the way a static host serves it. */
export function resolveSitePath(fromPage: string, ref: string): string {
  const raw = ref.split(/[?#]/)[0]!;
  let clean = raw;
  try {
    clean = decodeURIComponent(raw);
  } catch {
    /* malformed escape: resolve it as written, it will not match a file */
  }
  let p = clean.startsWith("/") ? clean.slice(1) : path.posix.join(path.posix.dirname(fromPage), clean);
  p = path.posix.normalize(p);
  if (p === "." || p === "") return "index.html";
  if (clean.endsWith("/") || p.endsWith("/")) return `${p.replace(/\/$/, "")}/index.html`;
  return p;
}

export const siteInternalLinksCheck: SiteLevelCheck = {
  id: "links.site-internal",
  siteLevel: true,
  description: "Every same-site link, image, script and stylesheet resolves to a file the build contains, and every #anchor exists on its page; checked against the built files, no network.",
  run(ctx: VerificationContext): CheckResult {
    const files = ctx.site?.files ?? { "index.html": ctx.html };
    const pages = ctx.site?.pages ?? ["index.html"];
    const ids = new Map<string, Set<string>>();
    const idsOf = (file: string) => {
      if (!ids.has(file)) ids.set(file, new Set(root(files[file] ?? "").querySelectorAll("[id], a[name]").map((e) => e.getAttribute("id") ?? e.getAttribute("name") ?? "")));
      return ids.get(file)!;
    };
    const details: string[] = [];
    for (const page of pages) {
      for (const u of pageUrls(files[page] ?? "")) {
        if (u.attr === "css url()" || u.attr === "style") continue; // CSS-relative urls resolve against the stylesheet; render.links loads them
        const ref = u.url;
        if (/^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith("//")) continue; // external, mailto:, tel:, data: (other checks)
        const [pathPart, hash] = [ref.split("#")[0]!, ref.includes("#") ? ref.slice(ref.indexOf("#") + 1) : null];
        let target = page;
        if (pathPart.split("?")[0] !== "") {
          if (!ctx.site) continue; // a single file cannot resolve other pages; render.links serves and checks it
          target = resolveSitePath(page, pathPart);
          if (files[target] === undefined) {
            details.push(`${page}: <${u.el} ${u.attr}="${short(ref)}"> points at ${target}, which is not in the build (it would 404).`);
            continue;
          }
        }
        if (hash && target.endsWith(".html") && !idsOf(target).has(safeDecode(hash))) {
          details.push(`${page}: <${u.el} ${u.attr}="${short(ref)}"> points at #${hash}, which does not exist on ${target}.`);
        }
      }
    }
    return result("links.site-internal", details);
  },
};

// ------------------------------------------------------------------------------------------------
// Launch-candidate checks (stage "launch": need the production domain; N/A at preview)
// ------------------------------------------------------------------------------------------------

const siteOnly = (id: string): CheckResult => na(id, "a single-file page has no site files; this site-level check needs the whole site");

export const notFoundPageCheck: SiteLevelCheck = {
  id: "tells.404-page",
  siteLevel: true,
  description: "The site ships a 404 page (404.html or 404/index.html); a missing 404 is a 2.0 'tell'.",
  run(ctx: VerificationContext): CheckResult {
    if (!ctx.site) return siteOnly("tells.404-page");
    return result("tells.404-page", ctx.site.files["404.html"] !== undefined || ctx.site.files["404/index.html"] !== undefined ? [] : ["the site has no 404 page; add 404.html with the site's header, a plain message and a link home."]);
  },
};

export const sitemapCheck: SiteLevelCheck = {
  id: "tells.sitemap",
  siteLevel: true,
  description: "sitemap.xml exists, is a <urlset>, and lists every page with an absolute https:// <loc>.",
  run(ctx: VerificationContext): CheckResult {
    if (!ctx.site) return siteOnly("tells.sitemap");
    const xml = ctx.site.files["sitemap.xml"];
    if (xml === undefined) return result("tells.sitemap", ["the site has no sitemap.xml; add one listing every page by its production URL."]);
    if (!/<urlset\b[^>]*>/i.test(xml)) return result("tells.sitemap", ["sitemap.xml is not a <urlset> sitemap."]);
    const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]!);
    const details = locs.filter((l) => !/^https:\/\/[^/]+/i.test(l)).map((l) => `sitemap.xml <loc>${short(l, 60)}</loc> is not an absolute https:// URL.`);
    const paths = new Set(locs.map((l) => absolute(l)?.pathname ?? "").map((p) => resolveSitePath("index.html", p || "/")));
    for (const page of ctx.site.pages) if (!paths.has(page)) details.push(`sitemap.xml does not list ${page}.`);
    return result("tells.sitemap", details);
  },
};

export const robotsCheck: SiteLevelCheck = {
  id: "tells.robots",
  siteLevel: true,
  description: "robots.txt exists and does not block the whole site for every crawler (2.0 Stage 6 gate).",
  run(ctx: VerificationContext): CheckResult {
    if (!ctx.site) return siteOnly("tells.robots");
    const txt = ctx.site.files["robots.txt"];
    if (txt === undefined) return result("tells.robots", ["the site has no robots.txt; add one (User-agent: *, Allow: /, and a Sitemap: line)."]);
    const lines = txt.split(/\r?\n/).map((l) => l.replace(/#.*/, "").trim()).filter(Boolean);
    let all = false;
    for (const l of lines) {
      const [k, v = ""] = l.split(/:(.*)/).map((s) => s.trim());
      if (/^user-agent$/i.test(k!)) all = v === "*";
      else if (all && /^disallow$/i.test(k!) && v === "/") return result("tells.robots", ['robots.txt blocks every crawler from the whole site ("User-agent: *" + "Disallow: /").']);
    }
    return result("tells.robots", []);
  },
};

export const llmsTxtCheck: SiteLevelCheck = {
  id: "tells.llms-txt",
  siteLevel: true,
  description: "llms.txt exists and is not empty (2.0 Stage 6 gate; missing llms.txt is a 2.0 'tell').",
  run(ctx: VerificationContext): CheckResult {
    if (!ctx.site) return siteOnly("tells.llms-txt");
    const txt = ctx.site.files["llms.txt"];
    return result("tells.llms-txt", txt === undefined ? ["the site has no llms.txt; add a short plain-text summary of the business and its pages."] : txt.trim() === "" ? ["llms.txt is empty."] : []);
  },
};

export const canonicalCheck: Check = {
  id: "tells.canonical",
  description: 'The page has <link rel="canonical"> with an absolute https:// URL (a missing canonical is a 2.0 \'tell\').',
  run(ctx: VerificationContext): CheckResult {
    const links = root(ctx.html).querySelectorAll("link").filter((l) => /(^|\s)canonical(\s|$)/i.test(l.getAttribute("rel") ?? ""));
    if (links.length === 0) return result("tells.canonical", ['the page has no <link rel="canonical" href="https://…">.']);
    const href = links[0]!.getAttribute("href") ?? "";
    return result("tells.canonical", [...(links.length > 1 ? [`the page has ${links.length} canonical links; keep one.`] : []), ...(/^https:\/\/[^/]+/i.test(href) ? [] : [`canonical href "${short(href, 60)}" is not an absolute https:// URL.`])]);
  },
};

export const ogImageCheck: Check = {
  id: "tells.og-image",
  description: "The page has og:image with an absolute https:// URL (a missing og:image is a 2.0 'tell').",
  run(ctx: VerificationContext): CheckResult {
    const img = meta(root(ctx.html), "og:image");
    return result("tells.og-image", !img ? ['the page has no <meta property="og:image" content="https://…">.'] : /^https:\/\/[^/]+/i.test(img) ? [] : [`og:image "${short(img, 60)}" is not an absolute https:// URL.`]);
  },
};

/** Every Step 7 text check by id. The registry (config/eval-registry.json) decides severity, stage and order. */
export const STEP7_TEXT_CHECKS: Check[] = [
  devUrlsCheck, mixedContentCheck, sourceMapsCheck, targetBlankCheck, duplicateIdsCheck, prerenderedContentCheck,
  placeholderMediaCheck, htmlLangCheck, formLabelsCheck, headingOrderCheck,
  titleCheck, metaDescriptionCheck, singleH1Check, openGraphCheck, duplicateTitlesCheck, faviconCheck,
  siteInternalLinksCheck,
  notFoundPageCheck, sitemapCheck, robotsCheck, llmsTxtCheck, canonicalCheck, ogImageCheck,
];
