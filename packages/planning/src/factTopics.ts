/**
 * The topics an owner fact or an open question can be about (Step 28 follow-up, 2026-10-15). Deterministic, not a model:
 * a fact belongs to a topic by its canonical key (the Cockpit's slots, apps/cockpit/src/lib/inputs.ts) or, for answers to
 * open questions (keys q1, q2, ...), by keywords in its label. First match wins, so the order below matters ("opening-day
 * offer" is an offer, not an opening date; "email address" is an email, not a street address).
 *
 * NOT COVERED: a fact phrased without any of these keywords has no topic, so two answers about it are never compared.
 * Harbor Street e6a71046: q2 and q7 (opening date) and q3 and q8 (the offer) both reached the builder; that is the case this
 * table exists for.
 */
export type CompareAs = "date" | "phone" | "email" | "url" | "name" | "text";

export interface FactTopic {
  id: string;
  /** Plain words for the owner and a neutral label for the builder. */
  name: string;
  /** Canonical plan-input keys that are this topic. */
  keys: string[];
  label: RegExp;
  compare: CompareAs;
}

export const FACT_TOPICS: FactTopic[] = [
  { id: "offer", name: "Opening offer", keys: ["offer"], label: /\boffers?\b|\bdiscounts?\b|\bpromo(tion)?s?\b|\bdeals?\b|%\s*off\b/i, compare: "text" },
  { id: "opening_date", name: "Opening date", keys: ["opening_date"], label: /\b(opening|launch|grand opening) date\b|\bdate (of )?(the )?(opening|launch)\b|\bwhen (do|does|will) .{0,30}\bopen\b/i, compare: "date" },
  { id: "site_url", name: "Live site address", keys: ["site_url"], label: /\b(live|web)?\s?site (address|url)\b|\bwebsite (address|url)\b|\bdomain( name)?\b/i, compare: "url" },
  { id: "email", name: "Business email", keys: ["email"], label: /\be-?mail\b/i, compare: "email" },
  { id: "phone", name: "Business phone number", keys: ["phone"], label: /\b(tele)?phone\b|\bmobile number\b/i, compare: "phone" },
  { id: "address", name: "Street address", keys: ["address"], label: /\b(street|postal|business|shop|store) address\b|\baddress or suburb\b|\bwhere (is|are) (the|your) (shop|store|office|premises)\b/i, compare: "text" },
  { id: "hours", name: "Opening hours", keys: ["hours"], label: /\b(opening|business|trading) hours\b|\bhours of (business|operation)\b/i, compare: "text" },
  { id: "service_areas", name: "Areas served", keys: ["service_areas"], label: /\bservice areas?\b|\bareas? (you|we) serve\b|\bareas served\b/i, compare: "text" },
  { id: "pricing", name: "Prices", keys: ["pricing"], label: /\bprices?\b|\bpricing\b|\bfrom-prices?\b|\bfees?\b/i, compare: "text" },
  { id: "contact_name", name: "Contact person", keys: ["contact_name"], label: /\bcontact (person|name)\b|\b(primary|main) contact\b|\bwho is the contact\b|\b(full|first|last) name\b/i, compare: "name" },
];

/** The topic a fact (or an open question, label only) is about, or null when the table does not know it. */
export function topicOf(key: string | null, label: string): FactTopic | null {
  if (key) {
    const byKey = FACT_TOPICS.find((t) => t.keys.includes(key));
    if (byKey) return byKey;
  }
  return FACT_TOPICS.find((t) => t.label.test(label)) ?? null;
}

/**
 * The questions an owner should see, once per topic. Harbor Street plan 4acbde1f asked 12 questions on overlapping topics:
 * the intake's ambiguities and the Planner's own questions about the same things, so the Cockpit numbered both (q2 and q7
 * were the opening date) and the owner answered both differently. A Planner question replaces an ambiguity on the same topic
 * (it is phrased as a question); questions with no known topic are all kept.
 */
export function mergeOpenQuestions(ambiguities: string[], questions: string[]): string[] {
  const seen = new Set<string>();
  const firstPerTopic = (q: string) => {
    const t = topicOf(null, q);
    if (!t) return true;
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  };
  const keptQuestions = questions.filter(firstPerTopic);
  const keptAmbiguities = ambiguities.filter(firstPerTopic);
  return [...keptAmbiguities, ...keptQuestions];
}
