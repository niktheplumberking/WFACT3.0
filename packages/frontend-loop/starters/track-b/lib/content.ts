/**
 * The site's content, as the build wrote it (content/site.json), and the colour tokens derived from the
 * brand colours by reviewed code (content/theme.json). Both are validated in
 * packages/frontend-loop/src/trackB/content.ts before a build starts; these types mirror that schema
 * (track-b/1). The starter never invents content: everything visible comes from here.
 */
import site from "../content/site.json";
import theme from "../content/theme.json";

export type Source = "brief" | "sample";
export interface Fact {
  value: string;
  source: Source;
}

export interface Hero {
  type: "hero";
  id: string;
  heading: string;
  intro: string;
  showAction: boolean;
}
export interface Statement {
  type: "statement";
  id: string;
  /** Names the passage for screen readers and the outline (rendered as a visually hidden h2). */
  label: string;
  text: string;
}
export interface Work {
  type: "work";
  id: string;
  heading: string;
  intro?: string;
  items: { title: string; client: string; summary: string; disciplines: string[]; source: Source }[];
}
export interface Services {
  type: "services";
  id: string;
  heading: string;
  intro?: string;
  items: { name: string; summary: string; details: string[] }[];
}
export interface Process {
  type: "process";
  id: string;
  heading: string;
  intro?: string;
  steps: { title: string; text: string }[];
}
export interface Quote {
  type: "quote";
  id: string;
  heading: string;
  quotes: { text: string; attribution: string; source: Source }[];
}
export interface Faq {
  type: "faq";
  id: string;
  heading: string;
  items: { q: string; a: string }[];
}
export interface Contact {
  type: "contact";
  id: string;
  heading: string;
  intro: string;
  formNote: string;
  showDetails: boolean;
}
export interface Prose {
  type: "prose";
  id: string;
  heading: string;
  paragraphs: string[];
  aside?: { heading: string; text: string };
}
export interface Cta {
  type: "cta";
  id: string;
  heading: string;
  text: string;
}

export type Section = Hero | Statement | Work | Services | Process | Quote | Faq | Contact | Prose | Cta;

export interface Page {
  slug: string;
  navLabel: string;
  title: string;
  description: string;
  sections: Section[];
}

export interface SiteContent {
  schemaVersion: "track-b/1";
  business: {
    name: string;
    tagline?: string;
    email?: Fact;
    phone?: Fact;
    location?: Fact;
  };
  brand: {
    colors: { ink: string; paper: string; accent: string; deep: string };
    typePairing: "studio" | "editorial" | "technical";
    motion: "measured" | "expressive";
  };
  primaryAction: { label: string; page: string };
  pages: Page[];
  openQuestions: string[];
}

export interface Theme {
  ink: string;
  paper: string;
  accent: string;
  deep: string;
  accentInk: string;
  onAccent: string;
  onDeep: string;
  muted: string;
  surface: string;
  deepPanel: string;
  /** Faintest readable text on the paper (>= 4.5:1); where the scroll-reading effect starts. */
  dim: string;
}

export const content = site as SiteContent;
export const palette = theme as Theme;

export const pageBySlug = (slug: string): Page => {
  const page = content.pages.find((p) => p.slug === slug);
  if (!page) throw new Error(`no page with slug ${slug}`);
  return page;
};

/** Site-relative URL of a page: the home page is "/", every other page is a folder ("/work/"). */
export const href = (slug: string) => (slug === "index" ? "/" : `/${slug}/`);

/** Where the primary action lands: the page that holds the contact section, at that section. */
export const actionHref = () => {
  const page = pageBySlug(content.primaryAction.page);
  const contact = page.sections.find((s) => s.type === "contact");
  return contact ? `${href(page.slug)}#${contact.id}` : href(page.slug);
};
