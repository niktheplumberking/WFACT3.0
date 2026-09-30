/**
 * Shown to a signed-in account that has no profile yet (migration 0010). Such an account can read
 * nothing but its own account_requests row, so this screen is all it can do: show where the request
 * stands and let the person sign out. It never grants anything; only an owner/admin decision does.
 */
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

type Status = "pending" | "approved" | "rejected" | "none";

export function AccessPending({ email }: { email: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from("account_requests")
        .select("status,decision_note")
        .maybeSingle();
      if (cancelled) return;
      setStatus((data?.status as Status | undefined) ?? "none");
      setNote((data?.decision_note as string | null | undefined) ?? null);
    }
    load();
    // Re-check while the tab is open so an approval shows up without a manual refresh.
    const timer = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const message =
    status === "rejected"
      ? "This account request wasn't approved."
      : status === "approved"
        ? "Approved. Reload the page to continue."
        : "Your account is waiting for approval by an owner. You'll be able to use the Cockpit once it's approved.";

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-mark">
          <span className="sidebar-mark-dot" />
          <h1 className="login-title">WFACT Cockpit</h1>
        </div>
        <p className="login-sub">Signed in as {email}</p>
        <p className="login-notice" role="status">{status === null ? "Checking your request…" : message}</p>
        {status === "rejected" && note && <p className="login-fine">Note from the reviewer: {note}</p>}
        <div className="login-links">
          <button type="button" className="btn" onClick={() => supabase.auth.signOut()}>Sign out</button>
          {status === "approved" && (
            <button type="button" className="btn primary" onClick={() => window.location.reload()}>Reload</button>
          )}
        </div>
      </div>
    </div>
  );
}
