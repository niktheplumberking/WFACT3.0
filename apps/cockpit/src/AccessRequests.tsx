/**
 * Access requests — owners and admins review new sign-ups here (migration 0010). Everything that
 * matters is enforced by the database, not this component: a request only becomes access through
 * decide_account_request(), which checks the caller's role (an admin can only approve `pm`), refuses
 * self-approval, allows one decision per request and writes an audit_log row. This UI just collects
 * the decision; a role the caller isn't allowed to grant is simply not offered, and the database
 * would refuse it anyway.
 */
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

interface RequestRow {
  user_id: string;
  email: string;
  full_name: string | null;
  status: "pending" | "approved" | "rejected";
  requested_at: string;
  decided_role: string | null;
  decision_note: string | null;
}

type Role = "owner" | "admin" | "pm";

export function AccessRequests() {
  const [rows, setRows] = useState<RequestRow[] | null>(null);
  const [myRole, setMyRole] = useState<Role | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [roles, setRoles] = useState<Record<string, Role>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function load() {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;
    setMyId(uid);
    if (uid) {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", uid).maybeSingle();
      setMyRole((profile?.role as Role | undefined) ?? null);
    }
    const { data, error: fetchError } = await supabase
      .from("account_requests")
      .select("user_id,email,full_name,status,requested_at,decided_role,decision_note")
      .order("requested_at", { ascending: false })
      .limit(50);
    if (fetchError) setError(fetchError.message);
    else setRows(data as RequestRow[]);
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(row: RequestRow, decision: "approve" | "reject") {
    const role = roles[row.user_id] ?? "pm";
    const note = (notes[row.user_id] ?? "").trim();
    if (decision === "reject" && !note) {
      setError("Add a note before rejecting, so there's a record of why.");
      return;
    }
    setBusyId(row.user_id);
    setError(null);
    const { error: rpcError } = await supabase.rpc("decide_account_request", {
      p_user_id: row.user_id,
      p_decision: decision,
      p_role: decision === "approve" ? role : null,
      p_note: note || null,
    });
    setBusyId(null);
    if (rpcError) {
      setError(`Could not record the decision: ${rpcError.message}`);
      return;
    }
    await load();
  }

  // Only owners/admins are decision-makers; everyone else sees nothing here.
  if (!rows || (myRole !== "owner" && myRole !== "admin")) return null;
  const others = rows.filter((r) => r.user_id !== myId);
  const pending = others.filter((r) => r.status === "pending");
  const decided = others.filter((r) => r.status !== "pending").slice(0, 5);
  const grantable: Role[] = myRole === "owner" ? ["pm", "admin", "owner"] : ["pm"];

  return (
    <section className="plan-approvals">
      <h2 className="section-title">Account requests</h2>
      {error && <p className="error-state">{error}</p>}
      {pending.length === 0 && <p className="empty-state">No accounts waiting for approval.</p>}
      {pending.map((row) => (
        <article key={row.user_id} className="panel plan-card">
          <header className="plan-head">
            <div>
              <h3 className="plan-title">{row.full_name ?? "(no name given)"}</h3>
              <p className="plan-meta">
                {row.email} · requested {new Date(row.requested_at).toLocaleString()}
              </p>
            </div>
          </header>
          <div className="plan-actions">
            <select
              className="plan-note"
              aria-label={`Role for ${row.email}`}
              value={roles[row.user_id] ?? "pm"}
              onChange={(e) => setRoles({ ...roles, [row.user_id]: e.target.value as Role })}
            >
              {grantable.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <input
              className="plan-note"
              placeholder="Note (required to reject)"
              value={notes[row.user_id] ?? ""}
              onChange={(e) => setNotes({ ...notes, [row.user_id]: e.target.value })}
            />
            <button className="btn" disabled={busyId === row.user_id} onClick={() => decide(row, "reject")}>
              Reject
            </button>
            <button className="btn primary" disabled={busyId === row.user_id} onClick={() => decide(row, "approve")}>
              Approve
            </button>
          </div>
        </article>
      ))}
      {decided.length > 0 && (
        <p className="plan-sub">
          Recent:{" "}
          {decided.map((r) => `${r.email} ${r.status}${r.decided_role ? ` as ${r.decided_role}` : ""}`).join(" · ")}
        </p>
      )}
    </section>
  );
}
