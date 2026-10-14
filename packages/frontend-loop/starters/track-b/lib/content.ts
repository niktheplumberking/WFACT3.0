/**
 * The site's content, as the build wrote it (content/site.json), and the colour tokens derived from the
 * brand colours by reviewed code (content/theme.json). Both are validated in
 * packages/frontend-loop/src/trackB/content.ts before a build starts; these types mirror that schema
 * (track-b/2). The starter never invents content: everything visible comes from here. content/media.json (written by the
 * build from the owner's verified uploads, never by the builder) maps a media slot to its image; a slot without one shows
 * a labelled placeholder card.
 */
import site from "../content/site.json";
import theme from "../content/theme.json";
import launch from "../content/launch.json";
import mediaFiles from "../content/media.json";

export type Source = "brief" | "sample";
export interface Fact {
  value: string;
  source: Source;
}

/** A media slot as the builder described it (track-b/2). The builder never sets the image; media.json does. */
export interface Media {
  kind: "supplied" | "placeholder" | "generated";
  alt: string;
  aspect: "16:9" | "3:2" | "4:3" | "1:1" | "4:5" | "3:4";
  note: string;
}
export interface Hero {
  type: "hero";
  id: string;
  heading: string;
  intro: string;
  showAction: boolean;
  media?: Media;
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
  items: { title: string; client: string; summary: string; disciplines: string[]; source: Source; media?: Media }[];
}
export interface Services {
  type: "services";
  id: string;
  heading: string;
  intro?: string;
  items: { name: string; summary: string; details: string[]; media?: Media }[];
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
  /** enquiry = a project enquiry (default); signup = email updates only (launches, openings, waitlists). */
  form?: "enquiry" | "signup";
}
export interface Prose {
  type: "prose";
  id: string;
  heading: string;
  paragraphs: string[];
  aside?: { heading: string; text: string };
  media?: Media;
}
export interface Team {
  type: "team";
  id: string;
  heading: string;
  intro: string;
  members: { name: string; role?: string }[];
  media?: Media;
}
export interface Cta {
  type: "cta";
  id: string;
  heading: string;
  text: string;
}

export type Section = Hero | Statement | Work | Services | Process | Quote | Faq | Contact | Prose | Team | Cta;

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
  /** Button fill: the brand accent itself when a text colour reads on it, else accentInk (track-b-starter 1.4.0). */
  action: string;
  onAction: string;
  /** The brief reserves the accent for buttons and links: no decorative accent (rules, numbers, panels). */
  accentActionsOnly: boolean;
}

export const content = site as SiteContent;
export const palette = theme as Theme;
/** The live site's https origin, from the owner (never the builder); null until it is known. */
export const siteUrl = (launch as { siteUrl: string | null }).siteUrl;
/**
 * The client's own logo, written to public/ by the build from the owner's verified upload (never the builder);
 * null when none was supplied. width/height are the display size, so the space is reserved (no layout shift).
 */
export const logo = ((launch as { logo?: Logo | null }).logo ?? null) as Logo | null;
export interface Logo {
  src: string;
  mime: string;
  width: number;
  height: number;
}
/** The share card the build writes to public/ (src/launch.ts). */
export const OG_IMAGE = "/og-image.png";

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

/** The image the owner supplied for a slot (verified by the build), or null: the slot then shows a placeholder card. */
export interface SlotImage {
  src: string;
  width: number;
  height: number;
}
const slotImages = mediaFiles as Record<string, SlotImage>;
export const imageForSlot = (slot: string): SlotImage | null => slotImages[slot] ?? null;
