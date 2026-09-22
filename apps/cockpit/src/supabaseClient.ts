/**
 * Client-side Supabase connection. Deliberately the anon key only, never the service-role key —
 * this is a browser bundle, so any key placed here is public. Access control is enforced entirely
 * by the RLS policies built and attack-tested in Phase 2 (packages/db/migrations/0003, 0005),
 * scoped by whoever is actually signed in via Supabase Auth (see Login.tsx).
 */
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  throw new Error(
    "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set — see apps/cockpit/.env.example.",
  );
}

export const supabase = createClient(url, anonKey);
