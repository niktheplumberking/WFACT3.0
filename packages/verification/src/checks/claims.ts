/**
 * Claims gate (Step 4B M1). Four deterministic text checks that the Step 4 human review proved the
 * original six were missing: agent-tool text after </html>, unlabelled sample testimonials and
 * fictional contact details, banned claims (memory/context.md R-10), and factual claims (phone,
 * hours, promises, prices, service areas) that no fact source supports.
 *
 * Rules are data (`config/claims-rules.json`, versioned). Every detail line names the rule and the
 * exact text found, so the builder can act on it in `FrontendLoop.revise()` (the workflow prefixes
 * each line with `[checkId]`).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { parse, type HTMLElement } from "node-html-parser";
import type { Check, CheckResult, VerificationContext } from "./types.js";

interface ClaimsRules {
  version: string;
  sampleLabel: string;
  bannedClaims: { id: string; pattern: string; why: string }[];
  factPatterns: { id: string; kind: string; pattern: string }[];
  serviceAreaLabel: string;
  fictionalContact: { phone: string; email: string };
}

export const CLAIMS_RULES: ClaimsRules = JSON.parse(
  readFileSync(path.join(import.meta.dirname, "..", "..", "config", "claims-rules.json"), "utf-8"),
);

const SAMPLE = new RegExp(CLAIMS_RULES.sampleLabel); // case-sensitive on purpose: the label is "SAMPLE"
const NON_VISIBLE = "script, style, noscript, template, head";
const BLOCK_STOP = new Set(["section", "article", "aside", "footer", "header", "main", "body", "html"]);

const snippet = (s: string, max = 120) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
};

/** Parsed page with non-visible elements removed. Shared by the claims checks. */
function visibleRoot(html: string): HTMLElement {
  const root = parse(html, { comment: false });
  for (const el of root.querySelectorAll(NON_VISIBLE)) el.remove();
  return root;
}

function textAfterHtml(html: string): string {
  const idx = html.toLowerCase().lastIndexOf("</html>");
  if (idx < 0) return "";
  return html.slice(idx + "</html>".length).replace(/<!--[\s\S]*?-->/g, "");
}

/** All text a visitor or screen-reader user meets: rendered text plus labelling attributes. */
function visibleText(root: HTMLElement, html: string): string {
  const attrs = root
    .querySelectorAll("[aria-label], [alt], [title]")
    .flatMap((el) => [el.getAttribute("aria-label"), el.getAttribute("alt"), el.getAttribute("title")])
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  return [spacedText(root), ...attrs, textAfterHtml(html)].join("\n");
}

const isElement = (n: unknown): n is HTMLElement => typeof (n as HTMLElement)?.tagName === "string";

/** Text with a space between every text node, so "<strong>Email</strong>hello@x" reads "Email hello@x". */
function spacedText(el: HTMLElement): string {
  const parts: string[] = [];
  const walk = (node: HTMLElement) => {
    for (const child of node.childNodes) {
      if (isElement(child)) walk(child);
      else parts.push(child.text);
    }
  };
  walk(el);
  return parts.join(" ").replace(/[ \t]+/g, " ");
}

/** Deepest element whose text contains `needle` (case-insensitive). */
function deepestContaining(root: HTMLElement, needle: string): HTMLElement | null {
  const n = needle.toLowerCase();
  let best: HTMLElement | null = null;
  const walk = (el: HTMLElement) => {
    if (!el.text.toLowerCase().includes(n)) return;
    best = el;
    for (const child of el.childNodes) if (isElement(child)) walk(child);
  };
  walk(root);
  return best;
}

const INLINE = new Set(["a", "span", "strong", "b", "em", "i", "small", "mark", "abbr", "time", "code", "u", "s"]);

/**
 * True when the text's own block carries the SAMPLE label: climb from the deepest element holding
 * the text through inline wrappers only (an <a> inside an <li>), never to a sibling's container,
 * so one labelled list item cannot excuse an invented fact in the next one.
 */
function labelledSample(root: HTMLElement, matched: string): boolean {
  let el = deepestContaining(root, matched);
  while (el && INLINE.has(el.tagName?.toLowerCase() ?? "") && el.parentNode) el = el.parentNode;
  return el ? SAMPLE.test(el.text) : false;
}

const contains = (ancestor: HTMLElement, el: HTMLElement): boolean => {
  for (let p = el.parentNode; p; p = p.parentNode) if (p === ancestor) return true;
  return false;
};

// ---------------------------------------------------------------------------------------------

export const contentAfterHtmlCheck: Check = {
  id: "claims.after-html",
  description: "Nothing but whitespace or comments may follow </html> (leaked tool or model output renders as visible text).",
  run(ctx: VerificationContext): CheckResult {
    const details: string[] = [];
    if (!/<\/html>/i.test(ctx.html)) {
      details.push("The document has no closing </html> tag; output must be one complete HTML document.");
    } else {
      const rest = textAfterHtml(ctx.html).trim();
      if (rest) {
        details.push(`Text after </html> renders on the page: "${snippet(rest, 160)}". Remove everything after </html>.`);
      }
    }
    return { checkId: "claims.after-html", passed: details.length === 0, details };
  },
};

const QUOTE_UNITS =
  'blockquote, q, [class*="quote"], [class*="testimonial"], [class*="review"], [id*="testimonial"], [id*="review"]';
const PROOF_HEADING = /testimonial|review|what (our )?(customers|clients|homeowners) say|kind words/i;

export const sampleLabelCheck: Check = {
  id: "claims.sample-label",
  description:
    "Every testimonial and every fictional contact detail (555-01xx numbers, .example addresses) must carry a visible SAMPLE label (R-10).",
  run(ctx: VerificationContext): CheckResult {
    const root = visibleRoot(ctx.html);
    const details: string[] = [];

    // Testimonials. A card is a repeated sibling (same tag + class, 2+ of them) that holds a quote
    // unit; a lone testimonial falls back to its innermost unit climbed to the section boundary.
    const units = root.querySelectorAll(QUOTE_UNITS);
    const holdsUnit = (el: HTMLElement) => units.some((u) => u === el || contains(el, u));
    const signature = (el: HTMLElement) => `${el.tagName}.${el.getAttribute("class") ?? ""}`;
    let cards = new Set<HTMLElement>();
    for (const el of root.querySelectorAll("*")) {
      const parent = el.parentNode;
      if (!parent || !holdsUnit(el)) continue;
      const same = parent.childNodes.filter((c): c is HTMLElement => isElement(c) && signature(c) === signature(el));
      if (same.length >= 2 && same.every(holdsUnit)) cards.add(el);
    }
    cards = new Set([...cards].filter((c) => ![...cards].some((o) => o !== c && contains(o, c))));
    if (cards.size === 0) {
      for (const unit of units.filter((u) => !units.some((o) => o !== u && contains(u, o)))) {
        let card = unit;
        while (card.parentNode && !BLOCK_STOP.has(card.tagName.toLowerCase()) && !BLOCK_STOP.has(card.parentNode.tagName?.toLowerCase() ?? "")) {
          card = card.parentNode;
        }
        cards.add(card);
      }
    }
    for (const card of cards) {
      if (card.text.trim().length < 20) continue; // a "Reviews" nav link or empty wrapper is not a testimonial
      if (!SAMPLE.test(card.text)) {
        details.push(
          `Testimonial without a visible SAMPLE label: "${snippet(card.text, 90)}". Label it "SAMPLE - replace with real customer feedback" or use supplied, real feedback.`,
        );
      }
    }
    // A testimonials section built from plain paragraphs still needs a label somewhere.
    for (const section of root.querySelectorAll("section")) {
      const heading = section.querySelector("h1, h2, h3")?.text ?? "";
      const hasCards = [...cards].some((c) => c === section || contains(section, c));
      if (PROOF_HEADING.test(heading) && !hasCards && !SAMPLE.test(section.text)) {
        details.push(`Section "${snippet(heading, 60)}" presents customer feedback with no SAMPLE label.`);
      }
    }

    // Fictional contact details.
    const text = spacedText(root);
    const fictional: [string, RegExp][] = [
      ["phone", new RegExp(CLAIMS_RULES.fictionalContact.phone, "gi")],
      ["email", new RegExp(`[a-z0-9._%+-]+${CLAIMS_RULES.fictionalContact.email}`, "gi")],
    ];
    for (const [kind, re] of fictional) {
      for (const m of new Set(text.match(re) ?? [])) {
        if (!labelledSample(root, m)) {
          details.push(`Fictional ${kind} "${m}" is shown without a SAMPLE label next to it. Mark it "SAMPLE" until the client supplies the real one.`);
        }
      }
    }
    return { checkId: "claims.sample-label", passed: details.length === 0, details: [...new Set(details)] };
  },
};

export const bannedClaimsCheck: Check = {
  id: "claims.banned",
  description:
    "No banned claim from memory/context.md R-10 (licences, warranties, superlatives, invented years, counts, ratings, awards, promises, placeholders).",
  run(ctx: VerificationContext): CheckResult {
    const text = visibleText(visibleRoot(ctx.html), ctx.html);
    const details: string[] = [];
    for (const rule of CLAIMS_RULES.bannedClaims) {
      const re = new RegExp(rule.pattern, "gi");
      const found = new Set<string>();
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        if (m[0].length === 0) {
          re.lastIndex += 1;
          continue;
        }
        const start = Math.max(0, m.index - 40);
        found.add(`"${m[0]}" in "${snippet(text.slice(start, m.index + m[0].length + 40), 100)}"`);
      }
      for (const f of found) details.push(`${rule.id}: ${f}. ${rule.why} Remove it.`);
    }
    return { checkId: "claims.banned", passed: details.length === 0, details };
  },
};

const norm = (s: string) => s.toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
const digits = (s: string) => s.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");

/** Names listed after a "Service area" / "Neighborhoods we serve" label (aria-label or visible label). */
function serviceAreaNames(root: HTMLElement): string[] {
  const label = new RegExp(CLAIMS_RULES.serviceAreaLabel, "i");
  const names: string[] = [];
  for (const el of root.querySelectorAll("*")) {
    if (label.test(el.getAttribute("aria-label") ?? "")) {
      const leaves = el.querySelectorAll("*").filter((c) => !c.childNodes.some(isElement));
      if (leaves.length > 0) leaves.forEach((c) => names.push(c.text));
      else names.push(...el.text.split(/,|\n|·|•/));
      continue;
    }
    const isLabel = /^(strong|b|dt|th|h[2-6]|span|label)$/i.test(el.tagName) && el.text.trim().length < 40 && label.test(el.text);
    if (isLabel && el.parentNode) {
      names.push(...el.parentNode.text.replace(el.text, "").split(/,|\n|·|•|\band\b/));
    }
  }
  return names.map((n) => n.replace(/\s+/g, " ").trim()).filter((n) => n.length >= 2 && n.length <= 40 && /[a-z]/i.test(n) && !label.test(n));
}

export const unsourcedFactsCheck: Check = {
  id: "claims.unsourced-fact",
  description:
    "Every factual claim (phone, email, hours, time promise, price, percentage, address, service area) must appear in the run's fact sources or be labelled SAMPLE.",
  run(ctx: VerificationContext): CheckResult {
    const root = visibleRoot(ctx.html);
    const text = spacedText(root);
    const sources = (ctx.factSources ?? []).join("\n");
    const normSources = norm(sources);
    const phoneRule = CLAIMS_RULES.factPatterns.find((f) => f.id === "FACT-PHONE")!;
    const sourcePhones = new Set((sources.match(new RegExp(phoneRule.pattern, "gi")) ?? []).map(digits));
    const details: string[] = [];

    for (const fact of CLAIMS_RULES.factPatterns) {
      for (const m of new Set(text.match(new RegExp(fact.pattern, "gi")) ?? [])) {
        const sourced = fact.id === "FACT-PHONE" ? sourcePhones.has(digits(m)) : normSources.includes(norm(m));
        if (!sourced && !labelledSample(root, m)) {
          details.push(`${fact.id}: ${fact.kind} "${m.trim()}" is not in the brief's facts. Use the brief's value, or a visibly labelled SAMPLE placeholder.`);
        }
      }
    }
    const seen = new Set<string>();
    for (const name of serviceAreaNames(root)) {
      if (seen.has(norm(name))) continue;
      seen.add(norm(name));
      if (!normSources.includes(norm(name)) && !labelledSample(root, name)) {
        details.push(`FACT-AREA: service area "${name}" is not in the brief's facts. List only areas the client supplied, or label the list SAMPLE.`);
      }
    }

    if (details.length > 0 && !ctx.factSources?.length) {
      details.push("No fact sources were supplied to this run, so no factual claim can be sourced.");
    }
    return { checkId: "claims.unsourced-fact", passed: details.length === 0, details: [...new Set(details)] };
  },
};

/** The claims gate, in the order the builder should fix things. */
export const CLAIMS_CHECKS: Check[] = [contentAfterHtmlCheck, sampleLabelCheck, bannedClaimsCheck, unsourcedFactsCheck];
