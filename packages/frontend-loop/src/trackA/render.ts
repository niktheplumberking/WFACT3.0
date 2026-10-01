/**
 * Track A renderer (Step 4B M3): validated SiteContent → a multi-page static site. Deterministic (same
 * content, same bytes), so the checkpoint hash means something and a fixture can be rendered in a test
 * without a model. Every page is self-contained HTML with the starter's CSS and JS inlined
 * (`starters/track-a/`): no framework, no web fonts, no third-party requests, one h1 per page, a skip
 * link, labelled form fields, and every SAMPLE fact visibly labelled where it appears.
 *
 * The builder never touches this file or the starter; it only fills the content (content.ts).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Fact, Page, Section, SiteContent } from "./content.js";
import { buildPalette, type Palette } from "./palette.js";

export const STARTER_VERSION = "track-a-starter/1.0.0";
const STARTER_DIR = path.join(import.meta.dirname, "..", "..", "starters", "track-a");
const STARTER_CSS = readFileSync(path.join(STARTER_DIR, "styles.css"), "utf-8");
const STARTER_JS = readFileSync(path.join(STARTER_DIR, "site.js"), "utf-8");

export interface RenderedSite {
  /** Relative path → file content. Pages only today (images arrive in M5). */
  files: Record<string, string>;
  /** Page files in navigation order; pages[0] is index.html. */
  pages: string[];
}

export class RenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RenderError";
  }
}

/** System font stacks per pairing. First family is the intended face; the rest are close fallbacks per OS. */
const TYPE: Record<SiteContent["brand"]["typePairing"], { display: string; body: string; weight: number; tracking: string }> = {
  // Sturdy condensed sans for headings, a highly readable serif for reading.
  workshop: {
    display: '"DIN Alternate", Bahnschrift, "Avenir Next Condensed", "Roboto Condensed", "Arial Narrow", sans-serif',
    body: 'Charter, "Bitstream Charter", "Sitka Text", Cambria, "Noto Serif", serif',
    weight: 700,
    tracking: "-0.005em",
  },
  // Warm humanist sans for headings, an old-style serif for reading.
  civic: {
    display: '"Avenir Next", Avenir, "Segoe UI Variable Display", "Nunito Sans", "Trebuchet MS", sans-serif',
    body: '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", "Noto Serif", serif',
    weight: 700,
    tracking: "-0.015em",
  },
  // Old-style serif headings over a clean humanist sans.
  ledger: {
    display: '"Iowan Old Style", "Palatino Linotype", Palatino, "Noto Serif Display", Georgia, serif',
    body: '"Avenir Next", "Segoe UI Variable Text", Seravek, "Noto Sans", sans-serif',
    weight: 700,
    tracking: "-0.01em",
  },
};

/** Tabler Icons (MIT, tabler.io/icons), outline set, one stroke weight. */
const ICONS: Record<string, string> = {
  phone: '<path d="M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2"/>',
  mail: '<path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10z"/><path d="M3 7l9 6l9 -6"/>',
  pin: '<path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/><path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z"/>',
  clock: '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/><path d="M12 7v5l3 3"/>',
  check: '<path d="M5 12l5 5l10 -10"/>',
  arrow: '<path d="M5 12l14 0"/><path d="M13 18l6 -6"/><path d="M13 6l6 6"/>',
  menu: '<path d="M4 6l16 0"/><path d="M4 12l16 0"/><path d="M4 18l16 0"/>',
  close: '<path d="M18 6l-12 12"/><path d="M6 6l12 12"/>',
  chevron: '<path d="M6 9l6 6l6 -6"/>',
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const icon = (name: string, cls = "") => `<svg class="icon${cls ? ` ${cls}` : ""}" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;
const sprite = () =>
  `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">${Object.entries(ICONS)
    .map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24">${v}</symbol>`)
    .join("")}</svg>`;
const sampleTag = (label = "SAMPLE") => ` <span class="sample">${esc(label)}</span>`;
const fact = (f: Fact) => `${esc(f.value)}${f.source === "sample" ? sampleTag() : ""}`;
const telHref = (v: string) => `tel:${v.replace(/[^\d+]/g, "")}`;
const pageFile = (slug: string) => `${slug}.html`;

const mixHex = (a: string, b: string, t: number) => {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const x = p(a);
  const y = p(b);
  return `#${x.map((v, i) => Math.round(v + (y[i]! - v) * t).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
};

function rootTokens(p: Palette, c: SiteContent): string {
  const t = TYPE[c.brand.typePairing];
  const soft = c.brand.corners === "soft";
  const vars: Record<string, string> = {
    ink: p.ink,
    paper: p.paper,
    accent: p.accent,
    "accent-ink": p.accentInk,
    "accent-hover": mixHex(p.accentInk, p.ink, 0.25),
    "on-accent": p.onAccent,
    deep: p.deep,
    "on-deep": p.onDeep,
    "deep-panel": p.deepPanel,
    "deep-line": mixHex(p.deep, p.onDeep, 0.22),
    muted: p.muted,
    surface: p.surface,
    field: mixHex(p.paper, "#FFFFFF", 0.6),
    line: mixHex(p.paper, p.ink, 0.16),
    "line-strong": mixHex(p.paper, p.ink, 0.55),
    error: "#A3231B",
    "font-display": t.display,
    "font-body": t.body,
    "display-weight": String(t.weight),
    "display-tracking": t.tracking,
    "radius-control": soft ? "10px" : "3px",
    "radius-panel": soft ? "16px" : "4px",
    gutter: "clamp(16px, 4vw, 40px)",
    pitch: "clamp(28px, 5vw, 64px)",
    ease: "cubic-bezier(0.22, 1, 0.36, 1)",
  };
  return `:root{${Object.entries(vars).map(([k, v]) => `--${k}:${v}`).join(";")}}`;
}

interface Ctx {
  content: SiteContent;
  page: Page;
}

function primaryHref(ctx: Ctx): string {
  const target = ctx.content.primaryAction.page;
  return target === ctx.page.slug ? "#request" : `${pageFile(target)}#request`;
}
const primaryButton = (ctx: Ctx) => `<a class="btn" href="${primaryHref(ctx)}">${esc(ctx.content.primaryAction.label)}${icon("arrow")}</a>`;

function callLine(ctx: Ctx, cls = "call-line"): string {
  const phone = ctx.content.business.phone;
  if (!phone) return "";
  return `<p class="${cls}"><a class="call" href="${telHref(phone.value)}">${icon("phone")}<span class="num">${esc(phone.value)}</span></a>${phone.source === "sample" ? sampleTag() : ""}</p>`;
}

function contactFacts(ctx: Ctx): string {
  const b = ctx.content.business;
  const items: string[] = [];
  if (b.phone) items.push(`<li>${icon("phone")}<span><a href="${telHref(b.phone.value)}">${esc(b.phone.value)}</a>${b.phone.source === "sample" ? sampleTag() : ""}</span></li>`);
  if (b.email) items.push(`<li>${icon("mail")}<span><a href="mailto:${esc(b.email.value)}">${esc(b.email.value)}</a>${b.email.source === "sample" ? sampleTag() : ""}</span></li>`);
  if (b.address) items.push(`<li>${icon("pin")}<span>${fact(b.address)}</span></li>`);
  if (b.hours) items.push(`<li>${icon("clock")}<span>${fact(b.hours)}</span></li>`);
  return items.length ? `<ul class="facts">${items.join("")}</ul>` : "";
}

type Level = 1 | 2;
const h = (lvl: Level, text: string, id?: string) => `<h${lvl}${id ? ` id="${id}"` : ""}>${esc(text)}</h${lvl}>`;
const sub = (lvl: Level) => (lvl + 1) as 2 | 3;

function renderSection(s: Section, ctx: Ctx, lvl: Level, tint: boolean): string {
  const cls = `section${tint ? " tint" : ""}`;
  const headId = `${s.id}-title`;
  const head = (heading: string, intro?: string) =>
    `<div class="section-head">${h(lvl, heading, headId)}${intro ? `<p>${esc(intro)}</p>` : ""}</div>`;
  const open = (extra = "") => `<section class="${cls}${extra}" id="${s.id}" aria-labelledby="${headId}">`;

  switch (s.type) {
    case "hero":
      return `<section class="hero on-deep" id="${s.id}" aria-labelledby="${headId}"><div class="wrap"><div>${h(lvl, s.heading, headId)}<p class="intro">${esc(s.intro)}</p><div class="actions">${primaryButton(ctx)}${s.showPhone ? callLine(ctx) : ""}</div></div>${
        s.aside
          ? `<aside class="hero-aside" aria-labelledby="${s.id}-aside"><h${sub(lvl)} id="${s.id}-aside">${esc(s.aside.heading)}</h${sub(lvl)}><ul class="checks">${s.aside.points.map((p) => `<li>${icon("check")}<span>${esc(p)}</span></li>`).join("")}</ul></aside>`
          : ""
      }</div><svg class="ridge" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true" focusable="false"><polyline points="0,10 64,0 100,10"/></svg></section>`;

    case "services": {
      const odd = s.items.length % 2 === 1;
      const items = s.items
        .map(
          (it) =>
            `<article class="service"><div><h${sub(lvl)}>${esc(it.name)}</h${sub(lvl)}><p>${esc(it.summary)}</p></div><div>${
              it.details.length ? `<ul class="detail-list">${it.details.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>` : ""
            }${it.page && it.page !== ctx.page.slug ? `<a class="more" href="${pageFile(it.page)}">More about ${esc(it.name.toLowerCase())}${icon("arrow")}</a>` : ""}</div></article>`,
        )
        .join("");
      return `${open()}<div class="wrap">${head(s.heading, s.intro)}<div class="services-grid${odd ? " odd" : ""}">${items}</div></div></section>`;
    }

    case "packages": {
      const rows = s.tiers
        .map(
          (t) =>
            `<tr><th scope="row"><span>${esc(t.name)}</span></th><td data-label="Good for">${esc(t.goodFor)}</td><td data-label="What we do">${esc(t.scope)}</td><td data-label="Includes"><ul>${t.includes.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></td></tr>`,
        )
        .join("");
      return `${open()}<div class="wrap">${head(s.heading, s.intro)}<table class="compare"><caption class="sr-only">${esc(s.heading)}</caption><thead><tr><th scope="col">Package</th><th scope="col">Good for</th><th scope="col">What we do</th><th scope="col">Includes</th></tr></thead><tbody>${rows}</tbody></table>${
        s.note ? `<p class="note">${esc(s.note)}</p>` : ""
      }</div></section>`;
    }

    case "steps":
      return `${open()}<div class="wrap split">${head(s.heading, s.intro)}<ol class="path">${s.steps
        .map((st) => `<li><h${sub(lvl)}>${esc(st.title)}</h${sub(lvl)}><p>${esc(st.text)}</p></li>`)
        .join("")}</ol></div></section>`;

    case "testimonials": {
      const one = (q: (typeof s.quotes)[number], featured: boolean) =>
        `<figure class="quote${featured ? " featured" : ""}"><blockquote><p>${esc(q.text)}</p></blockquote><figcaption>${esc(q.attribution)}${
          q.source === "sample" ? sampleTag("SAMPLE - replace with real customer feedback") : ""
        }</figcaption></figure>`;
      const [first, ...rest] = s.quotes;
      return `${open()}<div class="wrap">${head(s.heading)}<div class="quotes">${one(first!, true)}${
        rest.length ? `<div class="quote-stack">${rest.map((q) => one(q, false)).join("")}</div>` : ""
      }</div></div></section>`;
    }

    case "faq":
      return `${open()}<div class="wrap">${head(s.heading)}<div class="faq">${s.items
        .map((it) => `<details><summary><span>${esc(it.q)}</span>${icon("chevron")}</summary><p>${esc(it.a)}</p></details>`)
        .join("")}</div></div></section>`;

    case "contact":
      return `${open()}<div class="wrap contact-grid"><div>${head(s.heading, s.intro)}${s.showDetails ? contactFacts(ctx) : ""}</div><div class="form-panel">${requestForm(ctx, s.formNote)}</div></div></section>`;

    case "prose":
      return `${open()}<div class="wrap prose-grid"><div>${h(lvl, s.heading, headId)}${s.paragraphs.map((p) => `<p>${esc(p)}</p>`).join("")}</div>${
        s.aside ? `<aside class="aside-note"><h${sub(lvl)}>${esc(s.aside.heading)}</h${sub(lvl)}><p>${esc(s.aside.text)}</p></aside>` : ""
      }</div></section>`;

    case "areas": {
      const areas = ctx.content.business.serviceAreas!;
      const tag = areas.source === "sample" ? sampleTag() : "";
      // The heading sits alone in its wrapper so the area names are read only from the labelled list.
      return `${open()}<div class="wrap"><div class="section-head"><div>${h(lvl, s.heading, headId)}</div>${s.intro ? `<p>${esc(s.intro)}</p>` : ""}</div><ul class="area-list" aria-label="Service areas">${areas.values
        .map((a) => `<li>${esc(a)}${tag}</li>`)
        .join("")}</ul></div></section>`;
    }

    case "cta":
      return `<section class="section band on-deep" id="${s.id}" aria-labelledby="${headId}"><svg class="ridge" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true" focusable="false"><polyline points="0,10 64,0 100,10"/></svg><div class="wrap cta">${h(lvl, s.heading, headId)}<p>${esc(s.text)}</p>${primaryButton(ctx)}</div></section>`;
  }
}

function requestForm(ctx: Ctx, note: string): string {
  const field = (id: string, label: string, control: string, required: boolean, message?: string) =>
    `<div class="field"><label for="${id}">${esc(label)}${required ? ' <span aria-hidden="true">*</span>' : ""}</label>${control}${
      required ? `<p class="error" id="${id}-error" data-message="${esc(message!)}" aria-live="polite"></p>` : ""
    }</div>`;
  const req = (id: string) => ` required aria-required="true" aria-describedby="${id}-error"`;
  return `<form id="request" data-request novalidate aria-label="${esc(ctx.content.primaryAction.label)}" data-unconnected="Thank you. This form is not connected yet, so nothing was sent. Please call or email instead.">${[
    field("rq-name", "Your name", `<input id="rq-name" name="name" type="text" autocomplete="name"${req("rq-name")}>`, true, "Please enter your name."),
    field("rq-phone", "Phone", `<input id="rq-phone" name="phone" type="tel" autocomplete="tel"${req("rq-phone")}>`, true, "Please enter a phone number we can call."),
    field("rq-address", "Address or suburb", `<input id="rq-address" name="address" type="text" autocomplete="street-address">`, false),
    field("rq-need", "What you need", `<textarea id="rq-need" name="need" rows="4"${req("rq-need")}></textarea>`, true, "Please tell us briefly what you need."),
    field(
      "rq-time",
      "Preferred time of day",
      `<select id="rq-time" name="time"><option>No preference</option><option>Morning</option><option>Afternoon</option></select>`,
      false,
    ),
  ].join("")}<p class="form-note">${esc(note)}</p><button class="btn" type="submit">${esc(ctx.content.primaryAction.label)}${icon("arrow")}</button><p class="form-status" role="status" aria-live="polite"></p></form>`;
}

function header(ctx: Ctx): string {
  const { content, page } = ctx;
  const phone = content.business.phone;
  const nav = content.pages
    .map((p) => `<li><a href="${pageFile(p.slug)}"${p.slug === page.slug ? ' aria-current="page"' : ""}>${esc(p.navLabel)}</a></li>`)
    .join("");
  return `<header class="site-header"><div class="wrap"><a class="brand" href="index.html"><svg class="icon brand-mark" viewBox="0 0 30 22" aria-hidden="true" focusable="false"><polyline points="2,20 15,4 28,20"/></svg><span class="brand-name">${esc(content.business.name)}</span></a>${
    phone ? `<a class="header-call" href="${telHref(phone.value)}" aria-label="Call ${esc(phone.value)}${phone.source === "sample" ? " (SAMPLE number)" : ""}">${icon("phone")}</a>` : ""
  }<button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav"><span class="sr-only">Menu</span>${icon("menu", "icon-open")}${icon("close", "icon-close")}</button><nav class="site-nav" id="site-nav" aria-label="Main"><ul class="nav-list">${nav}</ul>${primaryButton(ctx)}</nav>${primaryButton(ctx)}</div></header>`;
}

function footer(ctx: Ctx): string {
  const { content } = ctx;
  const b = content.business;
  const anySample = [b.phone, b.email, b.address, b.hours].some((f) => f?.source === "sample") || b.serviceAreas?.source === "sample" ||
    content.pages.some((p) => p.sections.some((s) => s.type === "testimonials" && s.quotes.some((q) => q.source === "sample")));
  const contact = [
    b.phone ? `<li><a href="${telHref(b.phone.value)}">${esc(b.phone.value)}</a>${b.phone.source === "sample" ? sampleTag() : ""}</li>` : "",
    b.email ? `<li><a href="mailto:${esc(b.email.value)}">${esc(b.email.value)}</a>${b.email.source === "sample" ? sampleTag() : ""}</li>` : "",
    b.address ? `<li>${fact(b.address)}</li>` : "",
  ].join("");
  return `<footer class="site-footer on-deep"><div class="wrap"><div class="footer-grid"><div><p class="brand-name">${esc(b.name)}</p>${b.tagline ? `<p>${esc(b.tagline)}</p>` : ""}</div><nav aria-label="Footer"><h2>Pages</h2><ul>${content.pages
    .map((p) => `<li><a href="${pageFile(p.slug)}">${esc(p.navLabel)}</a></li>`)
    .join("")}</ul></nav><div><h2>Contact</h2>${contact ? `<ul>${contact}</ul>` : ""}</div></div>${
    anySample ? `<p class="fine">Details marked SAMPLE are placeholders until ${esc(b.name)} confirms them.</p>` : ""
  }</div></footer>`;
}

function jsonLd(content: SiteContent): string {
  const b = content.business;
  const data: Record<string, unknown> = { "@context": "https://schema.org", "@type": "LocalBusiness", name: b.name };
  // Only facts quoted from the brief go into structured data; a SAMPLE placeholder is never published as fact.
  if (b.phone?.source === "brief") data.telephone = b.phone.value;
  if (b.email?.source === "brief") data.email = b.email.value;
  if (b.address?.source === "brief") data.address = b.address.value;
  if (b.serviceAreas?.source === "brief") data.areaServed = b.serviceAreas.values;
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

const comment = (s: string) => `<!-- OPEN QUESTION for a human (not shown on the page): ${s.replace(/--+/g, "-").replace(/>/g, "&gt;")} -->`;

function renderPage(content: SiteContent, page: Page, palette: Palette): string {
  const ctx: Ctx = { content, page };
  // One h1 per page: the first section's heading. Plain sections alternate a tint for rhythm; the hero
  // and the call-to-action band are deep brand fields and reset the alternation.
  let tinted = true;
  const sections = page.sections
    .map((s, i) => {
      let tint = false;
      if (s.type === "hero" || s.type === "cta") tinted = true;
      else {
        tinted = !tinted;
        tint = tinted;
      }
      return renderSection(s, ctx, i === 0 ? 1 : 2, tint);
    })
    .join("");
  const isHome = page.slug === "index";
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}">`,
    `<meta name="theme-color" content="${palette.deep}">`,
    `<meta name="generator" content="WFACT ${STARTER_VERSION}">`,
    `<style>${rootTokens(palette, content)}\n${STARTER_CSS}</style>`,
    isHome ? jsonLd(content) : "",
    isHome ? content.openQuestions.map(comment).join("\n") : "",
    "</head>",
    "<body>",
    '<a class="skip" href="#main">Skip to content</a>',
    sprite(),
    header(ctx),
    `<main id="main">${sections}</main>`,
    footer(ctx),
    `<script>${STARTER_JS}</script>`,
    "</body>",
    "</html>",
    "",
  ]
    .filter((l, i, all) => l !== "" || i === all.length - 1)
    .join("\n");
}

/** Renders every page. Throws RenderError only for content that validateSiteContent would also reject. */
export function renderSite(content: SiteContent): RenderedSite {
  const { palette, problems } = buildPalette(content.brand.colors);
  if (!palette) throw new RenderError(problems.join(" "));
  const files: Record<string, string> = {};
  const pages: string[] = [];
  for (const page of content.pages) {
    const file = pageFile(page.slug);
    files[file] = renderPage(content, page, palette);
    pages.push(file);
  }
  return { files, pages };
}
