/**
 * DEV ONLY: the test double for the Supabase client (src/test/fake.ts), with its SYNTHETIC fixture rows, so the signed-in
 * Cockpit can be screenshotted and axe-checked without a real account. Reached only through the `resolve.alias` in
 * vite.config.ts when the dev server runs with COCKPIT_FAKE_DB=1 (launch config "cockpit-fake"); a production build
 * never sets it, so this file never ships. Open /?fake-role=pm (or admin) to see another role; the fake ignores RLS.
 */
import { createFake, fixtures } from "../test/fake";

const role = new URLSearchParams(location.search).get("fake-role");
const rows = fixtures();
// ?fake-role=pm|admin signs in the synthetic user with that role instead of owner.
if (role === "pm" || role === "admin") rows.profiles = rows.profiles.map((p) => ({ ...p, role }));
const fake = createFake(rows);

const signedIn = {
  user: { id: "00000000-0000-4000-8000-0000000000aa", email: "owner@example.test" },
  access_token: "synthetic",
};

// App.tsx asks for a session and a profile; answer as a signed-in synthetic owner (or the role in ?fake-role=).
const auth = {
  ...fake.client.auth,
  getSession: async () => ({ data: { session: signedIn }, error: null }),
  getUser: async () => ({ data: { user: signedIn.user }, error: null }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
};

export const supabase = { ...fake.client, auth } as unknown as typeof import("../supabaseClient").supabase;
