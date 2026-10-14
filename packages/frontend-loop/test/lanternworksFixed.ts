/**
 * The stored Lanternworks content (job 55ddba7c, SYNTHETIC) with every Package 1 gap closed the way a builder following the
 * new prompt would: the client's services, steps and button label, no copy about the site itself, pages at the floors.
 * Shared by frontend-loop's request tests and rendered-qa's Track B brand checks (Package 2).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { CONTENT_FLOORS, metaCopyErrors, pageWordCount } from "../src/request.js";
import type { SiteContent } from "../src/trackB/content.js";

const FX = path.join(import.meta.dirname, "fixtures", "lanternworks");
export const LANTERNWORKS_REQUEST = readFileSync(path.join(FX, "raw-request.txt"), "utf-8");
const REQUEST = LANTERNWORKS_REQUEST;
const stored = () => JSON.parse(readFileSync(path.join(FX, "content.json"), "utf-8")) as SiteContent;

const ABOUT =
  "Lanternworks Studio is three people who make brands and websites for small service businesses: clinics, trades and local professional firms. We keep the work calm and confident, and we stay with clients after launch.";

/** The stored content with every Package 1 gap closed the way a builder following the new prompt would. */
export function lanternworksFixed(): SiteContent {
  const c = stored();
  c.primaryAction.label = "Book a discovery call";
  c.openQuestions.push('The client asked for a "rough budget" field on the contact form; the starter\'s enquiry form has none, so a person adds it.');
  for (const page of c.pages) {
    for (const s of page.sections) {
      if (s.type === "services") {
        s.items = [
          { name: "Brand identity", summary: "Logos and brand guidelines that a small team can use every day.", details: [] },
          { name: "Websites", summary: "Sites that explain what you do and make the next step easy.", details: [] },
          { name: "Ongoing care", summary: "Monthly updates and small changes, so the site stays right.", details: [] },
        ];
      }
      if (s.type === "process") {
        s.steps = ["Discovery call", "Proposal", "Design", "Build", "Launch", "Care"].map((title) => ({ title, text: `${title}: what happens, who is involved and what you get at the end of it.` }));
      }
    }
  }
  // Replace copy about the website itself, then pad every page to the floors with request-sourced words.
  const clean = (v: unknown): unknown => {
    if (typeof v === "string") return metaCopyErrors([{ path: "", text: v }], REQUEST, "x").length ? "Brands and websites for clinics, trades and local firms." : v;
    if (Array.isArray(v)) return v.map(clean);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clean(x)]));
    return v;
  };
  c.pages = clean(c.pages) as SiteContent["pages"];
  c.business = clean(c.business) as SiteContent["business"];
  c.pages.forEach((page, i) => {
    if (!page.sections.some((s) => s.type === "cta")) {
      page.sections.push({ type: "cta", id: `${page.slug}-next`, heading: "Talk to us about your business", text: "A short call to hear what you need and whether we are the right studio for it." });
    }
    const minWords = i === 0 ? CONTENT_FLOORS.homeWords : CONTENT_FLOORS.pageWords;
    const minSections = i === 0 ? CONTENT_FLOORS.homeSections : CONTENT_FLOORS.pageSections;
    for (let n = 0; n < 3 && (page.sections.length < minSections || pageWordCount(page.sections) < minWords); n += 1) {
      const at = page.sections.length - 1; // just before the closing cta
      const near = [page.sections[at - 1]?.type, page.sections[at]?.type];
      const statementFree = !page.sections.some((s) => s.type === "statement");
      page.sections.splice(
        at,
        0,
        statementFree && !near.includes("statement")
          ? { type: "statement", id: `${page.slug}-more-${n}`, label: "Who we are", text: ABOUT }
          : { type: "prose", id: `${page.slug}-more-${n}`, heading: "Who we work with", paragraphs: [ABOUT, ABOUT, ABOUT, ABOUT] },
      );
    }
  });
  return c;
}
