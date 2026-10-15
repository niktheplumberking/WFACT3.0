/**
 * Where a site's contact form sends (Step 25 / MVP M4): the submit-lead Edge Function and the site's public key, from the
 * client's lead_sites row (migration 0025). The build runner puts them on the brief (packages/jobs, leadSites.ts); the
 * builder model never sees or writes them, and both starters read them only through this shape check. Absent (rehearsals,
 * tests, a client with no lead site yet), the form keeps saying plainly that it is not connected and sends nothing, and the
 * launch check `launch.form-connected` fails the site at launch.
 */
import type { PilotBrief } from "./brief.js";

export interface LeadForm {
  /** https://<project ref>.supabase.co/functions/v1/submit-lead */
  endpoint: string;
  /** The client's lead_sites.site_key: public (it is in the page source), not a secret. */
  siteKey: string;
}

export const LEAD_ENDPOINT = /^https:\/\/[a-z0-9]{20}\.supabase\.co\/functions\/v1\/submit-lead$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export class LeadFormError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeadFormError";
  }
}

/** The lead form settings, checked; throws on anything else (an extra key included). */
export function parseLeadForm(v: unknown): LeadForm {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new LeadFormError('Brief "leadForm" must be {endpoint, siteKey}.');
  const r = v as Record<string, unknown>;
  const extra = Object.keys(r).filter((k) => k !== "endpoint" && k !== "siteKey");
  if (extra.length) throw new LeadFormError(`Brief "leadForm" has unknown keys: ${extra.join(", ")}.`);
  if (typeof r.endpoint !== "string" || !LEAD_ENDPOINT.test(r.endpoint)) {
    throw new LeadFormError('Brief "leadForm.endpoint" must be https://<project>.supabase.co/functions/v1/submit-lead.');
  }
  if (typeof r.siteKey !== "string" || !UUID.test(r.siteKey)) throw new LeadFormError('Brief "leadForm.siteKey" must be a lower-case UUID.');
  return { endpoint: r.endpoint, siteKey: r.siteKey };
}

/** The brief's lead form, or null when it has none. */
export function leadFormOf(brief: Pick<PilotBrief, "leadForm">): LeadForm | null {
  return brief.leadForm ? parseLeadForm(brief.leadForm) : null;
}
