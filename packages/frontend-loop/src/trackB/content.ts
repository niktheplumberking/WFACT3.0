/**
 * Track B content as data (Step 4B M4). As in Track A, the builder never writes code: it fills this
 * schema, and the committed Next.js starter (`starters/track-b/`) turns it into a multi-page static
 * export. Validation here runs before any build, so the expensive, isolated Next.js build only ever sees
 * content that is already known to be well-formed, sourced and readable:
 *
 *   - Business facts are `Fact`s: `source: "brief"` only when the value is in the approved brief (checked),
 *     otherwise `source: "sample"` and the starter prints a SAMPLE label next to it.
 *   - Work items carry a source too; SAMPLE ones are labelled where they appear. Quotes only ever come
 *     from the brief: an invented quote, even labelled SAMPLE, is fake social proof (DR-FAKE-SOCIAL-PROOF,
 *     Cockpit job f696ba43), so a brief without quotes gets no quote section.
 *   - Page count follows the brief: one page for a landing-page brief (pageScope "single"), 3-7 otherwise.
 *   - Colours are validated hex; contrast is computed (buildTrackBPalette), never assumed.
 *   - Page structure keeps one h1 per page, one hero, no repeated layout back to back, and the brief's
 *     required section ids somewhere on the site.
 *
 * Versioned: change the schema = bump CONTENT_SCHEMA_VERSION (and the starter's lib/content.ts types).
 */
import { z } from "zod";
import { pageScopeOf, type PilotBrief } from "../brief.js";
import { briefFactText, extractJson, inBrief, missingRequiredMessage, waivedSocialProof } from "../trackA/content.js";
import { buildTrackBPalette } from "./palette.js";
import { collectStrings, floorErrors, metaCopyErrors, requestCoverageErrors } from "../request.js";
import { MediaSchema, mediaSlots } from "../media.js";

export { extractJson };

/**
 * track-b/2 (Build-quality Package 3): optional `media` on hero, work items, services items and prose, and a `team`
 * section. track-b/1 content (every stored build before 2026-10-14) is upgraded on read (upgradeTrackBContent): all new
 * fields are optional, so the upgrade only renames the version.
 */
export const CONTENT_SCHEMA_VERSION = "track-b/2";
export const PREVIOUS_SCHEMA_VERSIONS = ["track-b/1"] as const;

/** track-b/1 -> track-b/2. Anything that is not an object with an older version is returned unchanged for the schema to judge. */
export function upgradeTrackBContent(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  const r = raw as { schemaVersion?: unknown };
  return (PREVIOUS_SCHEMA_VERSIONS as readonly unknown[]).includes(r.schemaVersion) ? { ...r, schemaVersion: CONTENT_SCHEMA_VERSION } : raw;
}

const Slug = z.string().regex(/^[a-z][a-z0-9-]{0,39}$/, "lowercase letters, digits and hyphens, starting with a letter");
const Text = (max: number) => z.string().trim().min(1).max(max);
const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "a 6-digit hex colour like #1D2B27");
const Source = z.enum(["brief", "sample"]);

export const FactSchema = z.object({ value: Text(200), source: Source });
export type Fact = z.infer<typeof FactSchema>;

export const TYPE_PAIRINGS = ["studio", "editorial", "technical"] as const;
export const MOTION_LEVELS = ["measured", "expressive"] as const;

const Hero = z.object({ type: z.literal("hero"), id: Slug, heading: Text(90), intro: Text(200), showAction: z.boolean(), media: MediaSchema.optional() });
const Statement = z.object({ type: z.literal("statement"), id: Slug, label: Text(40), text: Text(420) });
const Work = z.object({
  type: z.literal("work"),
  id: Slug,
  heading: Text(60),
  intro: Text(200).optional(),
  items: z
    .array(z.object({ title: Text(40), client: Text(60), summary: Text(200), disciplines: z.array(Text(30)).min(1).max(4), source: Source, media: MediaSchema.optional() }))
    .min(2)
    .max(6),
});
const Services = z.object({
  type: z.literal("services"),
  id: Slug,
  heading: Text(60),
  intro: Text(240).optional(),
  items: z.array(z.object({ name: Text(50), summary: Text(220), details: z.array(Text(60)).max(5), media: MediaSchema.optional() })).min(2).max(8),
});
const Process = z.object({
  type: z.literal("process"),
  id: Slug,
  heading: Text(60),
  intro: Text(240).optional(),
  steps: z.array(z.object({ title: Text(40), text: Text(220) })).min(3).max(6),
});
const Quote = z.object({
  type: z.literal("quote"),
  id: Slug,
  heading: Text(60),
  quotes: z.array(z.object({ text: Text(240), attribution: Text(60), source: Source })).min(1).max(3),
});
const Faq = z.object({ type: z.literal("faq"), id: Slug, heading: Text(60), items: z.array(z.object({ q: Text(120), a: Text(500) })).min(2).max(10) });
const Contact = z.object({
  type: z.literal("contact"),
  id: Slug,
  heading: Text(60),
  intro: Text(240),
  /** Shown above the submit button; must say honestly what happens next. */
  formNote: Text(240),
  showDetails: z.boolean(),
  /** enquiry = project enquiry (name, email, organisation, plans, timing); signup = email updates only (email, optional first name). */
  form: z.enum(["enquiry", "signup"]).default("enquiry"),
});
const Prose = z.object({
  type: z.literal("prose"),
  id: Slug,
  heading: Text(90),
  paragraphs: z.array(Text(600)).min(1).max(5),
  aside: z.object({ heading: Text(50), text: Text(260) }).optional(),
  media: MediaSchema.optional(),
});
/** The people behind the business: names and roles only from the client's request or the owner's facts, never invented. */
const Team = z.object({
  type: z.literal("team"),
  id: Slug,
  heading: Text(60),
  intro: Text(300),
  members: z.array(z.object({ name: Text(60), role: Text(60).optional() })).max(12).default([]),
  /** A group photo slot (a placeholder card until the client supplies one). */
  media: MediaSchema.optional(),
});
const Cta = z.object({ type: z.literal("cta"), id: Slug, heading: Text(70), text: Text(200) });

export const SectionSchema = z.discriminatedUnion("type", [Hero, Statement, Work, Services, Process, Quote, Faq, Contact, Prose, Team, Cta]);
export type Section = z.infer<typeof SectionSchema>;
export const SECTION_TYPES = ["hero", "statement", "work", "services", "process", "quote", "faq", "contact", "prose", "team", "cta"] as const;

export const PageSchema = z.object({
  slug: Slug,
  navLabel: Text(20),
  title: Text(70),
  description: Text(170),
  sections: z.array(SectionSchema).min(1).max(8),
});
export type Page = z.infer<typeof PageSchema>;

export const SiteContentSchema = z.object({
  schemaVersion: z.literal(CONTENT_SCHEMA_VERSION),
  business: z.object({
    name: Text(40),
    /** One plain line in the footer; no claims. */
    tagline: Text(100).optional(),
    email: FactSchema.optional(),
    phone: FactSchema.optional(),
    location: FactSchema.optional(),
  }),
  brand: z.object({
    /** ink = text, paper = page background (dark paper = dark site), accent = actions, deep = colour fields and the closing band. */
    colors: z.object({ ink: Hex, paper: Hex, accent: Hex, deep: Hex }),
    typePairing: z.enum(TYPE_PAIRINGS),
    /** expressive = smooth scroll and pinned sequences; measured = the same content without them. Reduced motion always wins. */
    motion: z.enum(MOTION_LEVELS),
  }),
  /** The one primary action, labelled the same everywhere. */
  primaryAction: z.object({ label: Text(28), page: Slug }),
  /** 1 page for a single landing page (brief.pageScope "single"), otherwise 3-7; checked in validateSiteContent. */
  pages: z.array(PageSchema).min(1).max(7),
  /** Questions the brief left open. Kept in content.json for a human, never shown as copy. */
  // Never shown as copy, so the caps only stop runaway output. They were 10 x 300 chars until Cockpit job 4d6e1abb (2026-10-07):
  // the Planner hands over 11+ open questions, the builder merged two to fit 10, and the merged one broke 300 chars three times.
  openQuestions: z.array(Text(800)).max(25).default([]),
});
export type SiteContent = z.infer<typeof SiteContentSchema>;

/** JSON Schema of the content, given to the builder so it knows the exact shape. */
export const SITE_CONTENT_JSON_SCHEMA = z.toJSONSchema(SiteContentSchema);

/** The home page leads; detail lives on the other pages. */
export const MAX_HOME_SECTIONS = 6;
/** A single landing page carries the whole story, so it may hold more (PageSchema's cap). */
export const MAX_SINGLE_PAGE_SECTIONS = 8;
/** Pages in a multi-page site. */
export const MIN_SITE_PAGES = 3;
/** Section types that open a page with its h1. Any other first section would leave the page without one. */
const H1_TYPES = new Set(["hero", "prose", "contact", "team"]);
/** Layouts that read as a list; three in a row is one repeated rhythm. */
const LISTLIKE = new Set(["services", "process", "faq"]);
/** Element ids and route names the starter itself uses. */
const RESERVED_IDS = new Set(["main"]);
const RESERVED_SLUGS = new Set(["api", "fonts", "not-found", "_next"]);

/**
 * Parses and validates builder output. Returns the content, or the exact problems to send back to the
 * builder (each names the JSON path), never a half-valid site.
 */
export function validateSiteContent(raw: unknown, brief: PilotBrief): { content: SiteContent | null; errors: string[] } {
  const parsed = SiteContentSchema.safeParse(upgradeTrackBContent(raw));
  if (!parsed.success) {
    return { content: null, errors: parsed.error.issues.slice(0, 25).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`) };
  }
  const c = parsed.data;
  const errors: string[] = [];
  const briefText = briefFactText(brief);

  for (const [where, fact] of [
    ["business.email", c.business.email],
    ["business.phone", c.business.phone],
    ["business.location", c.business.location],
  ] as const) {
    if (fact?.source === "brief" && !inBrief(fact.value, briefText)) {
      errors.push(`${where}: "${fact.value}" is marked source "brief" but is not in the brief. Use the brief's exact value, or source "sample".`);
    }
  }
  errors.push(...buildTrackBPalette(c.brand.colors).problems);

  const slugs = c.pages.map((p) => p.slug);
  const single = pageScopeOf(brief) === "single";
  if (single && c.pages.length !== 1) {
    errors.push(`pages: the brief asks for a single landing page, but there are ${c.pages.length} pages; put every section on the one "index" page.`);
  }
  if (!single && c.pages.length < MIN_SITE_PAGES) errors.push(`pages: ${c.pages.length} page(s); a multi-page site has ${MIN_SITE_PAGES} to 7.`);
  if (slugs[0] !== "index") errors.push(`pages[0].slug must be "index" (the home page); got "${slugs[0]}".`);
  for (const dup of slugs.filter((s, i) => slugs.indexOf(s) !== i)) errors.push(`pages: slug "${dup}" is used twice.`);
  for (const s of slugs) if (RESERVED_SLUGS.has(s)) errors.push(`pages: slug "${s}" is reserved by the starter; choose another.`);
  if (!slugs.includes(c.primaryAction.page)) errors.push(`primaryAction.page "${c.primaryAction.page}" is not one of the pages (${slugs.join(", ")}).`);

  let contactForms = 0;
  c.pages.forEach((page, pi) => {
    const where = `pages[${pi}] (${page.slug})`;
    const types = page.sections.map((s) => s.type);
    const ids = page.sections.map((s) => s.id);
    for (const dup of ids.filter((s, i) => ids.indexOf(s) !== i)) errors.push(`${where}: section id "${dup}" is used twice on one page.`);
    if (!H1_TYPES.has(types[0]!)) errors.push(`${where}: the first section must be a hero, prose, contact or team section (it carries the page's h1); got "${types[0]}".`);
    if (types.filter((t) => t === "hero").length > 1 || (types.includes("hero") && types[0] !== "hero")) errors.push(`${where}: at most one hero, and only as the first section.`);
    for (const once of ["statement", "work", "cta", "contact"] as const) {
      if (types.filter((t) => t === once).length > 1) errors.push(`${where}: more than one "${once}" section; one per page.`);
    }
    if (pi === 0 && !single && types.length > MAX_HOME_SECTIONS) errors.push(`${where}: ${types.length} sections; keep the home page to ${MAX_HOME_SECTIONS} and move the rest to their own pages.`);
    for (let i = 1; i < types.length; i += 1) {
      if (types[i] === types[i - 1]) errors.push(`${where}: sections ${i - 1} and ${i} are both "${types[i]}" (DR-REPEATED-RHYTHM); put a different section between them.`);
      if (i >= 2 && LISTLIKE.has(types[i]!) && LISTLIKE.has(types[i - 1]!) && LISTLIKE.has(types[i - 2]!)) {
        errors.push(`${where}: sections ${i - 2}-${i} (${types.slice(i - 2, i + 1).join(", ")}) are three list-like layouts in a row (DR-REPEATED-RHYTHM); put a statement, quote, prose or cta between them.`);
      }
    }
    page.sections.forEach((s, si) => {
      if (RESERVED_IDS.has(s.id) || s.id.endsWith("-label")) errors.push(`${where}.sections[${si}].id "${s.id}" is reserved by the starter; choose another id.`);
      if (s.type === "contact") contactForms += 1;
      if (s.type === "quote") {
        s.quotes.forEach((q, qi) => {
          if (q.source === "sample") {
            errors.push(`${where}.sections[${si}].quotes[${qi}]: an invented quote, even labelled SAMPLE, is fake social proof (DR-FAKE-SOCIAL-PROOF). Use only quotes the brief supplies; without any, remove the quote section.`);
          } else if (!inBrief(q.text, briefText)) {
            errors.push(`${where}.sections[${si}].quotes[${qi}]: marked source "brief" but the quote is not in the brief. Use only quotes the brief supplies; without any, remove the quote section.`);
          }
        });
      }
      if (s.type === "work") {
        s.items.forEach((it, ii) => {
          if (it.source === "brief" && !inBrief(it.client, briefText)) errors.push(`${where}.sections[${si}].items[${ii}]: client "${it.client}" is marked source "brief" but is not in the brief. Use source "sample".`);
        });
      }
    });
  });

  const allIds = new Set(c.pages.flatMap((p) => p.sections.map((s) => s.id)));
  for (const required of brief.requiredSections) {
    if (!allIds.has(required) && !waivedSocialProof(required, c.openQuestions)) errors.push(missingRequiredMessage(required));
  }
  if (contactForms === 0) errors.push(`No page has a "contact" section; the primary action needs a form to land on.`);
  const target = c.pages.find((p) => p.slug === c.primaryAction.page);
  if (target && !target.sections.some((s) => s.type === "contact")) errors.push(`primaryAction.page "${c.primaryAction.page}" has no "contact" section for the action to land on.`);
  errors.push(...requestChecks(c, brief, single));
  errors.push(...mediaChecks(c, brief, briefText));
  return { content: errors.length ? null : c, errors };
}

/** Form fields each Track B form holds (starters/track-b ContactForm): kinds as in request.ts. */
const FORM_FIELDS: Record<"enquiry" | "signup", string[]> = { enquiry: ["name", "email", "organisation", "plans", "timing"], signup: ["email", "name"] };

/** Build-quality Package 1: content floors, copy about the site itself, and coverage of what the client asked for. */
function requestChecks(c: SiteContent, brief: PilotBrief, single: boolean): string[] {
  const sections = c.pages.flatMap((p) => p.sections);
  const textOf = (types: string[]) => collectStrings(sections.filter((s) => types.includes(s.type)), "", []).map((x) => x.text).join("\n");
  const forms = sections.flatMap((s) => (s.type === "contact" ? [s.form] : []));
  const copy = collectStrings(c.pages.map((p) => ({ ...p, sections: p.sections.map((s) => (s.type === "contact" ? { ...s, formNote: undefined } : s)) })), "pages", []);
  copy.push(...collectStrings(c.business, "business", []), { path: "primaryAction.label", text: c.primaryAction.label });
  return [
    ...floorErrors(c.pages, single),
    ...metaCopyErrors(copy, brief.requestText, c.business.name),
    ...requestCoverageErrors({
      requested: brief.requested,
      servicesText: textOf(["services"]),
      stepsText: textOf(["process"]),
      primaryActionLabel: c.primaryAction.label,
      pages: c.pages,
      heldFormFields: new Set(forms.flatMap((f) => FORM_FIELDS[f])),
      formName: `Track B ${[...new Set(forms)].join(" / ") || "enquiry"}`,
      openQuestions: c.openQuestions,
    }),
  ];
}

/**
 * Build-quality Package 3: media slots. The builder never sets an image source and never asks for a generated image; it may
 * mark a slot "supplied" only when the owner uploaded an image for it. The home hero and every work item need a slot, so a
 * site always shows where the client's pictures go. Team names and roles come only from the client's own words.
 */
function mediaChecks(c: SiteContent, brief: PilotBrief, briefText: string): string[] {
  const errors: string[] = [];
  const supplied = new Set((brief.images ?? []).map((i) => i.slot));
  for (const slot of mediaSlots(c, supplied)) {
    const m = slot.media;
    if (m.src !== undefined) errors.push(`media ${slot.slot}: remove "src"; the image is set by code from the owner's uploads, never written by the builder.`);
    if (m.kind === "generated") errors.push(`media ${slot.slot}: generated images are not available; use kind "placeholder" with a note saying what the picture should show.`);
    if (m.kind === "supplied" && !supplied.has(slot.slot)) errors.push(`media ${slot.slot}: no image was supplied for this slot; use kind "placeholder".`);
  }
  const home = c.pages[0];
  const hero = home?.sections[0];
  if (hero?.type === "hero" && !hero.media) errors.push(`pages[0] (index) hero "${hero.id}": add media (the home hero always shows a picture or a labelled placeholder for one).`);
  c.pages.forEach((p, pi) =>
    p.sections.forEach((s, si) => {
      if (s.type === "work") s.items.forEach((it, ii) => !it.media && errors.push(`pages[${pi}].sections[${si}].items[${ii}] (${it.title}): add media; every work item shows a picture or a labelled placeholder.`));
      if (s.type === "team") {
        s.members.forEach((mem, mi) => {
          if (!inBrief(mem.name, briefText)) errors.push(`pages[${pi}].sections[${si}].members[${mi}]: "${mem.name}" is not named in the client's request or the owner's facts; never invent people. Leave members empty and describe the team in the intro.`);
          if (mem.role && !inBrief(mem.role, briefText)) errors.push(`pages[${pi}].sections[${si}].members[${mi}]: the role "${mem.role}" is not in the client's request or the owner's facts; leave it out.`);
        });
      }
    }),
  );
  return errors;
}
