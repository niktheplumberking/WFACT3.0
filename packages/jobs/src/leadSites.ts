/**
 * Step 25 / MVP M4: where a client's contact form sends. The runner reads the client's ACTIVE lead_sites row (migration
 * 0025; one per client slug) with the service role and puts { endpoint, siteKey } on the brief, so the starters wire the
 * form to the submit-lead Edge Function. The builder model never sees or writes these. No row: the form stays "not
 * connected" and the launch check `launch.form-connected` fails the site at launch, which is the honest outcome.
 */
import type { LeadForm } from "@wfact/frontend-loop/leadForm";

export interface LeadSiteLookup {
  /** The client's lead form, or null when the client has no active lead site. Throws when the read fails. */
  leadFormFor(clientSlug: string): Promise<LeadForm | null>;
}

const SLUG = /^[a-z][a-z0-9-]{0,62}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export class SupabaseLeadSiteLookup implements LeadSiteLookup {
  private readonly rest: string;
  private readonly endpoint: string;
  constructor(url: string, private readonly key: string, private readonly fetchImpl: typeof fetch = fetch) {
    const base = url.replace(/\/+$/, "");
    this.rest = `${base}/rest/v1/lead_sites`;
    this.endpoint = `${base}/functions/v1/submit-lead`;
  }
  async leadFormFor(clientSlug: string): Promise<LeadForm | null> {
    if (!SLUG.test(clientSlug)) return null;
    const res = await this.fetchImpl(`${this.rest}?client_slug=eq.${clientSlug}&active=is.true&select=site_key&limit=1`, {
      headers: { apikey: this.key, Authorization: `Bearer ${this.key}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`lead_sites read failed (HTTP ${res.status})`);
    const [row] = (await res.json()) as { site_key?: unknown }[];
    if (!row) return null;
    if (typeof row.site_key !== "string" || !UUID.test(row.site_key)) throw new Error("lead_sites row has no readable site_key");
    return { endpoint: this.endpoint, siteKey: row.site_key };
  }
}
