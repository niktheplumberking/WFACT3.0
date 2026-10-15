/**
 * Brief consistency check (Step 28 follow-up, 2026-10-15). Harbor Street continue e6a71046 ($1.22, run 38711602641) halted
 * after two paid revisions because its owner facts disagreed with themselves: q2 "15 December 2026" and q7 "20 December
 * 2026" (opening date), q3 "Main primary service at 20% off" and q8 "Our second flagship offer" (the offer). No page could
 * satisfy both, so the evaluator failed every round. This module finds that before anything is paid for:
 *
 *   conflicts  two or more owner facts on one topic (planning/factTopics.ts) whose values differ once normalised
 *              ("20 Dec 2026" and "20 December 2026" are the same date);
 *   leftovers  an answered fact whose label still states the question as unresolved ("...is unclear", "not provided").
 *              Reported only; resolveOwnerFacts gives it a neutral label so the builder is not told the fact is unclear.
 *
 * Pure: no I/O, no model. The owner's pick for a conflict comes back as a plan input `resolve.<topic>` (the Cockpit shows
 * every preflight need as a question and stores the answer under the need's key), and resolveOwnerFacts keeps it once and
 * drops the losing facts, so the next preflight passes. Waiving `resolve.<topic>` means "build without it": every fact on
 * that topic is dropped.
 */
import type { OwnerFact, PilotBrief } from "@wfact/frontend-loop/brief";
import { topicOf, type FactTopic } from "@wfact/planning/factTopics";

export const RESOLVE_PREFIX = "resolve.";

export interface FactConflict {
  topic: string;
  topicName: string;
  facts: OwnerFact[];
  /** The distinct values, as the owner wrote them (first spelling of each). */
  values: string[];
}

export interface FactLeftover {
  key: string;
  label: string;
  /** What the builder and evaluator see instead of the unresolved wording. */
  neutralLabel: string;
}

export interface BriefConsistency {
  ok: boolean;
  conflicts: FactConflict[];
  leftovers: FactLeftover[];
}

const UNRESOLVED = /\s*\b(?:is |are )?(?:unclear|not (?:provided|mentioned|specified|given|stated|confirmed)|unknown)\b\s*/i;

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** "15 December 2026", "Dec 15th, 2026", "Monday 15 Dec 2026", "2026-12-15" -> "2026-12-15"; anything else -> null. */
export function parseDate(value: string): string | null {
  const v = value.toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, "$1").replace(/[,.]/g, " ").replace(/\s+/g, " ").trim();
  const pad = (n: number) => String(n).padStart(2, "0");
  const ok = (y: number, m: number, d: number) => (m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(m)}-${pad(d)}` : null);
  const iso = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/.exec(v);
  if (iso) return ok(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const month = (w: string) => MONTHS.indexOf(w.slice(0, 3)) + 1;
  const dmy = /\b(\d{1,2}) ([a-z]{3,9}) (\d{4})\b/.exec(v);
  if (dmy && month(dmy[2]!) > 0) return ok(Number(dmy[3]), month(dmy[2]!), Number(dmy[1]));
  const mdy = /\b([a-z]{3,9}) (\d{1,2}) (\d{4})\b/.exec(v);
  if (mdy && month(mdy[1]!) > 0) return ok(Number(mdy[3]), month(mdy[1]!), Number(mdy[2]));
  return null;
}

/** Case, spacing and punctuation folded away; "&" reads as "and". */
export function foldText(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}%$£€]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalise(value: string, topic: FactTopic): string {
  switch (topic.compare) {
    case "date":
      return parseDate(value) ?? foldText(value);
    case "phone":
      return value.replace(/[^\d]/g, "");
    case "email":
      return value.trim().toLowerCase();
    case "url":
      return value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
    default:
      return foldText(value);
  }
}

/** Two values agree when they normalise the same; for a person's name, one may be part of the other ("Sheikh", "Huraira Sheikh"). */
function agree(a: string, b: string, topic: FactTopic): boolean {
  if (a === b) return true;
  if (topic.compare !== "name") return false;
  const [x, y] = [a.split(" "), b.split(" ")];
  return x.every((w) => y.includes(w)) || y.every((w) => x.includes(w));
}

/** The neutral label for an answered fact whose label still says the question is open; null when it says nothing of the kind. */
export function neutralLabelFor(key: string, label: string): string | null {
  if (!UNRESOLVED.test(label)) return null;
  const topic = topicOf(key, label);
  if (topic) return topic.name;
  const stripped = label.replace(UNRESOLVED, " ").replace(/^(what|which|any|specific)\s+/i, "").replace(/[\s?.:;,-]+$/, "").replace(/\s+/g, " ").trim();
  return stripped ? stripped[0]!.toUpperCase() + stripped.slice(1) : "Owner answer";
}

export function checkBriefConsistency(brief: Pick<PilotBrief, "ownerFacts">): BriefConsistency {
  const byTopic = new Map<string, { topic: FactTopic; facts: OwnerFact[] }>();
  const leftovers: FactLeftover[] = [];
  for (const f of brief.ownerFacts ?? []) {
    const neutral = neutralLabelFor(f.key, f.label);
    if (neutral) leftovers.push({ key: f.key, label: f.label, neutralLabel: neutral });
    const topic = topicOf(f.key, f.label);
    if (!topic) continue;
    const group = byTopic.get(topic.id) ?? { topic, facts: [] };
    group.facts.push(f);
    byTopic.set(topic.id, group);
  }
  const conflicts: FactConflict[] = [];
  for (const { topic, facts } of byTopic.values()) {
    if (facts.length < 2) continue;
    const distinct: { norm: string; value: string }[] = [];
    for (const f of facts) {
      const norm = normalise(f.value, topic);
      if (!distinct.some((d) => agree(d.norm, norm, topic))) distinct.push({ norm, value: f.value });
    }
    if (distinct.length > 1) conflicts.push({ topic: topic.id, topicName: topic.name, facts, values: distinct.map((d) => d.value) });
  }
  return { ok: conflicts.length === 0, conflicts, leftovers };
}

const COUNT = ["", "One", "Two", "Three", "Four", "Five"];
const listOf = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/** The question the owner sees for one conflict, and the plan-input key their answer is stored under. */
export function conflictNeed(c: FactConflict): { key: string; label: string; reason: string } {
  const n = COUNT[c.values.length] ?? String(c.values.length);
  return {
    key: `${RESOLVE_PREFIX}${c.topic}`,
    label: `${c.topicName}: which is right?`,
    reason: `${n} answers for the ${c.topicName.toLowerCase()}: ${listOf(c.values)}. Which is right? (answers ${listOf(c.facts.map((f) => f.key))}) Type the one to use; the others are dropped.`,
  };
}

/** A plan input as resolveOwnerFacts needs it (jobs/inputStore.ts PlanInput has these fields). */
export interface FactInput {
  key: string;
  label: string;
  value: string | null;
  waived: boolean;
}

/**
 * The owner facts the builder gets: every answered, non-waived input, with the owner's picks applied (a `resolve.<topic>`
 * answer replaces every fact on that topic, kept once under the topic's key; a waived pick drops them all) and leftover
 * labels made neutral. Callers filter out the inputs that are settings, not facts (asset.*, launch.*), first.
 */
export function resolveOwnerFacts(inputs: FactInput[]): OwnerFact[] {
  const picks = new Map<string, string>();
  const dropped = new Set<string>();
  for (const i of inputs) {
    if (!i.key.startsWith(RESOLVE_PREFIX)) continue;
    const topic = i.key.slice(RESOLVE_PREFIX.length);
    if (i.waived) dropped.add(topic);
    else if (i.value && i.value.trim()) picks.set(topic, i.value.trim());
  }
  const out: OwnerFact[] = [];
  for (const i of inputs) {
    if (i.waived || !i.value || i.key.startsWith(RESOLVE_PREFIX)) continue;
    const topic = topicOf(i.key, i.label);
    if (topic && (picks.has(topic.id) || dropped.has(topic.id))) continue;
    out.push({ key: i.key, label: neutralLabelFor(i.key, i.label) ?? i.label, value: i.value });
  }
  for (const [topicId, value] of picks) {
    const topic = topicOf(topicId, "");
    if (!topic) continue; // a pick for a topic this code does not know is not guessed at
    out.push({ key: topic.keys[0] ?? topic.id, label: topic.name, value });
  }
  return out;
}
