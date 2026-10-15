// submit-lead — the public endpoint client sites' contact forms post to (Step 25 / MVP M4). Deployed with verify_jwt
// false: a visitor has no token, so the function does its own checks (lead.ts): the site key picks an active lead_sites
// row, the Origin must be one of that site's allowed origins, the fields are validated per form, spam is dropped and
// counted, and a per-IP rate limit applies. The only writer of `leads` (migration 0025). Nothing is sent anywhere.
//
// Secrets: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided by Supabase. LEAD_IP_SALT must be set by the owner
// (any long random string); without it the function accepts nothing and says so.
import { createClient } from "npm:@supabase/supabase-js@2";
import { handle, type LeadStore } from "./lead.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const store: LeadStore = {
  async siteByKey(siteKey) {
    const { data, error } = await db.from("lead_sites").select("id,client_id,allowed_origins,is_test").eq("site_key", siteKey).eq("active", true).maybeSingle();
    if (error) throw new Error(`lead_sites read: ${error.code ?? error.message}`);
    return data;
  },
  async originAllowed(origin) {
    const { data, error } = await db.from("lead_sites").select("id").eq("active", true).contains("allowed_origins", [origin]).limit(1);
    if (error) throw new Error(`lead_sites read: ${error.code ?? error.message}`);
    return (data ?? []).length > 0;
  },
  async recentCount(siteId, ipHash, sinceIso) {
    let q = db.from("leads").select("id", { count: "exact", head: true }).eq("lead_site_id", siteId).gte("created_at", sinceIso);
    if (ipHash) q = q.eq("ip_hash", ipHash);
    const { count, error } = await q;
    if (error) throw new Error(`leads count: ${error.code ?? error.message}`);
    return count ?? 0;
  },
  async insertLead(row) {
    const { error } = await db.from("leads").insert(row);
    if (error) throw new Error(`leads insert: ${error.code ?? error.message}`);
  },
  async recordDrop(siteId, reason) {
    const { error } = await db.rpc("record_lead_drop", { p_site: siteId, p_reason: reason });
    if (error) throw new Error(`record_lead_drop: ${error.code ?? error.message}`);
  },
};

Deno.serve((req) => handle(req, { store, salt: Deno.env.get("LEAD_IP_SALT") || null }));
