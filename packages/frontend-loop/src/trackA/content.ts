/**
 * Track A content as data (Step 4B M3). The builder never writes HTML for Track A: it fills this
 * schema, and the committed starter (`render.ts` + `starters/track-a/`) turns it into a multi-page
 * static site. That keeps the design, accessibility and performance work in reviewed code, and makes
 * every factual claim checkable before anything renders:
 *
 *   - Every business fact (phone, email, address, hours, service areas) is a `Fact` that either quotes
 *     the approved brief (`source: "brief"`, checked here against the brief text) or is a visibly
 *     labelled SAMPLE placeholder (`source: "sample"`, the renderer prints the label).
 *   - Testimonials only ever quote the brief: an invented quote, even labelled SAMPLE, is fake social proof
 *     (DR-FAKE-SOCIAL-PROOF, Cockpit job f696ba43), so a brief without quotes gets no testimonials section.
 *   - Page count follows the brief: one page for a landing-page brief (pageScope "single"), 3-8 otherwise.
 *   - Colours are validated hex; contrast is computed, never assumed (`palette()` in render.ts).
 *
 * Versioned: change the schema = bump CONTENT_SCHEMA_VERSION.
 */
import { z } from "zod";
import { pageScopeOf, type PilotBrief } from "../brief.js";
import { buildPalette } from "./palette.js";

export const CONTENT_SCHEMA_VERSION = "track-a/1";

const Slug = z.string().regex(/^[a-z][a-z0-9-]{0,39}$/, "lowercase letters, digits and hyphens, starting with a letter");
const Text = (max: number) => z.string().trim().min(1).max(max);
const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "a 6-digit hex colour like #1F3D36");

export const FactSchema = z.object({
  value: Text(200),
  source: z.enum(["brief", "sample"]),
});
export type Fact = z.infer<typeof FactSchema>;

export const TYPE_PAIRINGS = ["workshop", "civic", "ledger"] as const;

const Hero = z.object({
  type: z.literal("hero"),
  id: Slug,
  heading: Text(90),
  intro: Text(220),
  showPhone: z.boolean(),
  aside: z.object({ heading: Text(60), points: z.array(Text(120)).min(2).max(5) }).optional(),
});
const Services = z.object({
  type: z.literal("services"),
  id: Slug,
  heading: Text(80),
  intro: Text(300).optional(),
  items: z
    .array(z.object({ name: Text(60), summary: Text(220), details: z.array(Text(140)).max(6), page: Slug.optional() }))
    .min(2)
    .max(8),
});
const Packages = z.object({
  type: z.literal("packages"),
  id: Slug,
  heading: Text(80),
  intro: Text(300).optional(),
  tiers: z.array(z.object({ name: Text(40), goodFor: Text(160), scope: Text(260), includes: z.array(Text(120)).min(1).max(6) })).min(2).max(4),
  note: Text(240).optional(),
});
const Steps = z.object({
  type: z.literal("steps"),
  id: Slug,
  heading: Text(80),
  intro: Text(300).optional(),
  steps: z.array(z.object({ title: Text(60), text: Text(240) })).min(3).max(6),
});
const Testimonials = z.object({
  type: z.literal("testimonials"),
  id: Slug,
  heading: Text(80),
  quotes: z.array(z.object({ text: Text(280), attribution: Text(60), source: z.enum(["brief", "sample"]) })).min(1).max(4),
});
const Faq = z.object({
  type: z.literal("faq"),
  id: Slug,
  heading: Text(80),
  items: z.array(z.object({ q: Text(140), a: Text(600) })).min(2).max(12),
});
const Contact = z.object({
  type: z.literal("contact"),
  id: Slug,
  heading: Text(80),
  intro: Text(300),
  /** Shown above the submit button; must say honestly what happens next. */
  formNote: Text(240),
  showDetails: z.boolean(),
});
const Prose = z.object({
  type: z.literal("prose"),
  id: Slug,
  heading: Text(80),
  paragraphs: z.array(Text(700)).min(1).max(6),
  aside: z.object({ heading: Text(60), text: Text(300) }).optional(),
});
const Areas = z.object({
  type: z.literal("areas"),
  id: Slug,
  heading: Text(80),
  intro: Text(300).optional(),
});
const Cta = z.object({
  type: z.literal("cta"),
  id: Slug,
  heading: Text(90),
  text: Text(220),
});

export const SectionSchema = z.discriminatedUnion("type", [Hero, Services, Packages, Steps, Testimonials, Faq, Contact, Prose, Areas, Cta]);
export type Section = z.infer<typeof SectionSchema>;
export const SECTION_TYPES = ["hero", "services", "packages", "steps", "testimonials", "faq", "contact", "prose", "areas", "cta"] as const;

export const PageSchema = z.object({
  slug: Slug,
  navLabel: Text(24),
  title: Text(70),
  description: Text(170),
  sections: z.array(SectionSchema).min(1).max(10),
});
export type Page = z.infer<typeof PageSchema>;

export const SiteContentSchema = z.object({
  schemaVersion: z.literal(CONTENT_SCHEMA_VERSION),
  business: z.object({
    name: Text(60),
    /** One line under the name in the footer; plain words, no claims. */
    tagline: Text(120).optional(),
    phone: FactSchema.optional(),
    email: FactSchema.optional(),
    address: FactSchema.optional(),
    hours: FactSchema.optional(),
    serviceAreas: z.object({ values: z.array(Text(40)).min(1).max(30), source: z.enum(["brief", "sample"]) }).optional(),
  }),
  brand: z.object({
    /** ink = text, paper = page background, accent = buttons and links, deep = the dark brand field (hero, footer). */
    colors: z.object({ ink: Hex, paper: Hex, accent: Hex, deep: Hex }),
    typePairing: z.enum(TYPE_PAIRINGS),
    corners: z.enum(["square", "soft"]),
  }),
  /** The one primary action, labelled the same everywhere (DQ-CONTENT-HIERARCHY). */
  primaryAction: z.object({ label: Text(40), page: Slug }),
  /** 1 page for a single landing page (brief.pageScope "single"), otherwise 3-8; checked in validateSiteContent. */
  pages: z.array(PageSchema).min(1).max(8),
  /** Questions the brief left open. Rendered as HTML comments for a human, never as visible copy. */
  openQuestions: z.array(Text(300)).max(10).default([]),
});
export type SiteContent = z.infer<typeof SiteContentSchema>;

/** JSON Schema of the content, given to the builder so it knows the exact shape. */
export const SITE_CONTENT_JSON_SCHEMA = z.toJSONSchema(SiteContentSchema);

const norm = (s: string) => s.toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
const digits = (s: string) => s.replace(/\D/g, "");

/** True when a brief-sourced value really is in the brief (phones compared by digits). */
export function inBrief(value: string, briefText: string): boolean {
  const d = digits(value);
  if (d.length >= 7 && /^[\d\s().+-]+$/.test(value.trim())) return digits(briefText).includes(d);
  return norm(briefText).includes(norm(value));
}

export function briefFactText(brief: PilotBrief): string {
  return [brief.goal, brief.brandNotes].join("\n");
}

/**
 * Parses and validates builder output. Returns the content, or the exact problems to send back to the
 * builder (each names the JSON path), never a half-valid site.
 */
export function validateSiteContent(raw: unknown, brief: PilotBrief): { content: SiteContent | null; errors: string[] } {
  const parsed = SiteContentSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      content: null,
      errors: parsed.error.issues.slice(0, 25).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
    };
  }
  const c = parsed.data;
  const errors: string[] = [];
  const briefText = briefFactText(brief);

  const facts: [string, Fact | undefined][] = [
    ["business.phone", c.business.phone],
    ["business.email", c.business.email],
    ["business.address", c.business.address],
    ["business.hours", c.business.hours],
  ];
  for (const [where, fact] of facts) {
    if (fact?.source === "brief" && !inBrief(fact.value, briefText)) {
      errors.push(`${where}: "${fact.value}" is marked source "brief" but is not in the brief. Use the brief's exact value, or source "sample".`);
    }
  }
  if (c.business.serviceAreas?.source === "brief") {
    for (const area of c.business.serviceAreas.values) {
      if (!inBrief(area, briefText)) errors.push(`business.serviceAreas: "${area}" is not in the brief. List only areas the brief names, or set source "sample".`);
    }
  }

  errors.push(...buildPalette(c.brand.colors).problems);

  const slugs = c.pages.map((p) => p.slug);
  const single = pageScopeOf(brief) === "single";
  if (single && c.pages.length !== 1) {
    errors.push(`pages: the brief asks for a single landing page, but there are ${c.pages.length} pages; put every section on the one "index" page.`);
  }
  if (!single && c.pages.length < MIN_SITE_PAGES) errors.push(`pages: ${c.pages.length} page(s); a multi-page site has ${MIN_SITE_PAGES} to 8.`);
  if (slugs[0] !== "index") errors.push(`pages[0].slug must be "index" (the home page); got "${slugs[0]}".`);
  for (const dup of slugs.filter((s, i) => slugs.indexOf(s) !== i)) errors.push(`pages: slug "${dup}" is used twice.`);
  if (!slugs.includes(c.primaryAction.page)) errors.push(`primaryAction.page "${c.primaryAction.page}" is not one of the pages (${slugs.join(", ")}).`);

  let contactForms = 0;
  c.pages.forEach((page, pi) => {
    const ids = page.sections.map((s) => s.id);
    for (const dup of ids.filter((s, i) => ids.indexOf(s) !== i)) errors.push(`pages[${pi}] (${page.slug}): section id "${dup}" is used twice on one page.`);
    if (page.sections.filter((s) => s.type === "hero").length > 1) errors.push(`pages[${pi}] (${page.slug}): only one hero per page.`);
    if (page.sections.some((s) => s.type === "hero") && page.sections[0]!.type !== "hero") errors.push(`pages[${pi}] (${page.slug}): the hero must be the first section.`);
    page.sections.forEach((s, si) => {
      if (RESERVED_IDS.has(s.id) || /-(title|aside)$/.test(s.id) || s.id.startsWith("rq-")) {
        errors.push(`pages[${pi}].sections[${si}].id "${s.id}" is reserved by the starter; choose another id.`);
      }
      if (s.type === "contact") contactForms += 1;
      if (s.type === "services") {
        s.items.forEach((it, ii) => {
          if (it.page && !slugs.includes(it.page)) errors.push(`pages[${pi}].sections[${si}].items[${ii}].page "${it.page}" is not one of the pages.`);
        });
      }
      if (s.type === "areas" && !c.business.serviceAreas) errors.push(`pages[${pi}].sections[${si}]: an "areas" section needs business.serviceAreas.`);
      if (s.type === "testimonials") {
        s.quotes.forEach((q, qi) => {
          if (q.source === "sample") {
            errors.push(`pages[${pi}].sections[${si}].quotes[${qi}]: an invented testimonial, even labelled SAMPLE, is fake social proof (DR-FAKE-SOCIAL-PROOF). Use only quotes the brief supplies; without any, remove the testimonials section.`);
          } else if (!inBrief(q.text, briefText)) {
            errors.push(`pages[${pi}].sections[${si}].quotes[${qi}]: marked source "brief" but the quote is not in the brief. Use only quotes the brief supplies; without any, remove the testimonials section.`);
          }
        });
      }
    });
  });
  // Information architecture and rhythm (from the first live run, 2026-10-01: eight sections piled on the
  // home page beside two one-section pages read as one repeated heading-then-list rhythm).
  const LISTLIKE = new Set(["services", "packages", "steps", "faq"]);
  c.pages.forEach((page, pi) => {
    const types = page.sections.map((s) => s.type);
    if (pi === 0 && !single && types.length > MAX_HOME_SECTIONS) {
      errors.push(`pages[0] (index) has ${types.length} sections; keep the home page to ${MAX_HOME_SECTIONS} and move the rest to their own pages.`);
    }
    if (pi > 0 && types.length < 2) errors.push(`pages[${pi}] (${page.slug}) has one section; give every page at least two, or fold it into another page.`);
    if (types.filter((t) => t === "cta").length > 1) errors.push(`pages[${pi}] (${page.slug}) has more than one "cta" section; one per page.`);
    for (let i = 2; i < types.length; i += 1) {
      if (LISTLIKE.has(types[i]!) && LISTLIKE.has(types[i - 1]!) && LISTLIKE.has(types[i - 2]!)) {
        errors.push(`pages[${pi}] (${page.slug}): sections ${i - 2}-${i} (${types.slice(i - 2, i + 1).join(", ")}) are three list-like layouts in a row (DR-REPEATED-RHYTHM); put prose, a cta or brief-supplied testimonials between them.`);
      }
    }
  });

  const allIds = new Set(c.pages.flatMap((p) => p.sections.map((s) => s.id)));
  for (const required of brief.requiredSections) {
    if (!allIds.has(required)) errors.push(`The brief requires a section with id "${required}" on some page; none has it.`);
  }
  if (contactForms === 0) errors.push(`No page has a "contact" section; the primary action needs a form to land on.`);
  const target = c.pages.find((p) => p.slug === c.primaryAction.page);
  if (target && !target.sections.some((s) => s.type === "contact")) {
    errors.push(`primaryAction.page "${c.primaryAction.page}" has no "contact" section for the action to land on.`);
  }
  return { content: errors.length ? null : c, errors };
}

/** The home page leads; detail lives on the other pages. */
export const MAX_HOME_SECTIONS = 6;
/** Pages in a multi-page site. A single landing page holds up to PageSchema's 10 sections. */
export const MIN_SITE_PAGES = 3;

/** Element ids the starter itself uses (skip link target, menu, request form). */
const RESERVED_IDS = new Set(["main", "site-nav", "request"]);

/** Builder output → JSON. Tolerates a code fence or prose around one JSON object; the object is validated strictly after. */
export function extractJson(raw: string): unknown {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON object in the builder's answer");
  return JSON.parse(raw.slice(start, end + 1));
}
