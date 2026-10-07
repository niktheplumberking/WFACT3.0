/**
 * Details an owner can add to an approved plan (Step 4D, migration 0018): the facts a site needs that the client's
 * request never gave, and the answers to the planner's open questions. Plain words only; the database rules
 * (approved plans, owner/admin, append-only) are in 0018, not here.
 */
import { supabase } from "../supabaseClient";

export interface Slot {
  key: string;
  label: string;
  hint: string;
  multiline: boolean;
}

/** What a local-business site is most often missing. Same keys the failure detector maps to. */
export const SLOTS: Slot[] = [
  { key: "phone", label: "Business phone number", hint: "The number visitors should ring, exactly as it should appear.", multiline: false },
  { key: "email", label: "Business email", hint: "Where enquiries and the contact form go.", multiline: false },
  { key: "address", label: "Street address or suburb", hint: "As it should appear on the site.", multiline: false },
  { key: "hours", label: "Opening hours", hint: "For example: Mon to Fri 8am to 5pm, Sat 9am to 1pm.", multiline: true },
  { key: "service_areas", label: "Areas you serve", hint: "Suburbs or towns, separated by commas.", multiline: true },
  { key: "pricing", label: "Prices or from-prices", hint: "Only if the client wants prices on the site.", multiline: true },
  { key: "quotes", label: "Real customer quotes", hint: "Word for word, one per line, with the customer's first name. The factory never invents these.", multiline: true },
  { key: "opening_date", label: "Opening date", hint: "For a new business: the day it opens.", multiline: false },
];

export interface PlanInputRow {
  id: string;
  created_at: string;
  plan_id: string;
  kind: "fact" | "answer";
  key: string;
  label: string;
  value: string | null;
  waived: boolean;
}

/** Newest row per key is the current one (the table is append-only). */
export function currentInputs(rows: PlanInputRow[]): PlanInputRow[] {
  const byKey = new Map<string, PlanInputRow>();
  for (const r of [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at))) byKey.set(r.key, r);
  return [...byKey.values()];
}

const NOT_SWITCHED_ON = /relation .*plan_inputs.* does not exist|schema cache|PGRST205|42P01/i;
export const NOT_SWITCHED_ON_MESSAGE = "Adding details isn't switched on yet: a database update is still waiting to be applied. Ask Huraira to apply it, then try again.";

export async function fetchPlanInputs(planId: string): Promise<{ rows: PlanInputRow[]; unavailable: boolean }> {
  const res = await supabase.from("plan_inputs").select("id,created_at,plan_id,kind,key,label,value,waived").eq("plan_id", planId).order("created_at", { ascending: true }).limit(500);
  if (res.error) {
    if (NOT_SWITCHED_ON.test(`${res.error.message} ${(res.error as { code?: string }).code ?? ""}`)) return { rows: [], unavailable: true };
    throw new Error(res.error.message);
  }
  return { rows: currentInputs((res.data ?? []) as PlanInputRow[]), unavailable: false };
}

export interface NewInput {
  kind: "fact" | "answer";
  key: string;
  label: string;
  /** null together with `waived: true` means "build without it". */
  value: string | null;
  waived: boolean;
}

export const VALUE_MAX = 2000;

/** A password, key or token has no business in a site brief; stop it before it is stored. */
export function looksLikeSecret(value: string): boolean {
  return /\b(sk|pk|rk)[-_][A-Za-z0-9_-]{16,}|\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY|\b(password|passwd|api[_ -]?key|secret|token)\s*[:=]\s*\S{6,}/i.test(value);
}

/** One insert for all rows: either everything is saved or nothing is. Returns a plain-words error, or null. */
export async function savePlanInputs(planId: string, inputs: NewInput[]): Promise<string | null> {
  if (inputs.length === 0) return null;
  for (const i of inputs) {
    if (i.value && i.value.length > VALUE_MAX) return `“${i.label}” is too long (the limit is ${VALUE_MAX} characters).`;
    if (i.value && looksLikeSecret(i.value)) return `“${i.label}” looks like a password or key. Never put those here; nothing was saved.`;
  }
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return "You're signed out. Sign in again, then save.";
  const { error } = await supabase.from("plan_inputs").insert(inputs.map((i) => ({ plan_id: planId, provided_by: userId, ...i })));
  if (!error) return null;
  if (NOT_SWITCHED_ON.test(`${error.message} ${(error as { code?: string }).code ?? ""}`)) return NOT_SWITCHED_ON_MESSAGE;
  if (/not approved/i.test(error.message)) return "This plan isn't approved, so it can't take details. Approve it first.";
  return `Nothing was saved: ${error.message}.`;
}
