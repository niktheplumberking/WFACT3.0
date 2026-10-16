/**
 * Team and access (Cockpit v2 phase 16, brief §6.12): account requests (approve as a role, or decline with a note on
 * record) through the existing decide_account_request rpc, the people list with the clients each one follows, and the
 * roles in plain words. Owners and admins only (account_requests, profiles and profile_clients are owner/admin under
 * RLS); an admin can approve project managers only (the rpc enforces it). The design's "Invite someone" and the
 * per-person "Change" have nothing behind them in the database today, so they are not offered (BLOCKED-ON-NICK.md).
 */
import { useState } from "react";
import { Diamond } from "@phosphor-icons/react";
import { supabase } from "../supabaseClient";
import type { AccountRequestRow, Role } from "../lib/model";
import { canDecide, useFactory, useLoad, useMe, useToast } from "../lib/state";
import { Button, EmptyState } from "../components/kit";
import { ConfirmDialog, LoadError, Loading, Notice } from "../components/ui";

export const ROLE_NAME: Record<Role, string> = { owner: "Owner", admin: "Admin", pm: "Project manager" };
const ROLE_WITH_ARTICLE: Record<Role, string> = { owner: "an owner", admin: "an admin", pm: "a project manager" };
const ROLE_WORDS: { role: Role; what: string }[] = [
  { role: "owner", what: "Approves proposals, finished sites, launches and money. Sees everything." },
  { role: "admin", what: "Runs the factory day to day: sends requests, starts builds, fixes stops. Cannot approve money or launches." },
  // The design adds "and adds their details"; project managers cannot read or add details under RLS today (logged).
  { role: "pm", what: "Follows the clients assigned to them. Cannot approve money or launches." },
];

export interface Person {
  id: string;
  role: Role;
  full_name: string | null;
}
interface Assignment {
  profile_id: string;
  client_id: string;
  clients: { name: string } | null;
}

async function fetchTeam(): Promise<{ people: Person[]; assignments: Assignment[] }> {
  const [p, a] = await Promise.all([supabase.from("profiles").select("id,role,full_name").order("created_at", { ascending: true }), supabase.from("profile_clients").select("profile_id,client_id,clients(name)")]);
  for (const res of [p, a]) if (res.error) throw new Error(res.error.message);
  return { people: (p.data ?? []) as Person[], assignments: (a.data ?? []) as unknown as Assignment[] };
}

/** "just now", "12 minutes ago", "2 hours ago", "yesterday", else the date. */
export function ago(iso: string, now = Date.now()): string {
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  if (h < 48) return "yesterday";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(iso));
}

/** Which clients a person follows, in words. Owners and admins see every client (RLS), so they are not assigned. */
export function clientsLine(p: Person, assignments: Assignment[]): string {
  if (p.role !== "pm") return "All clients";
  const names = assignments.filter((a) => a.profile_id === p.id).map((a) => a.clients?.name ?? "A client you cannot see");
  return names.length ? names.join(", ") : "No clients assigned yet";
}

const initialOf = (name: string | null, email: string | null) => (name?.trim()[0] ?? email?.[0] ?? "?").toUpperCase();

export default function Team() {
  const me = useMe();
  const f = useFactory();
  const toast = useToast();
  const decider = canDecide(me.role);
  const team = useLoad(() => (decider ? fetchTeam() : Promise.resolve(null)), [decider]);
  const [roles, setRoles] = useState<Record<string, Role>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [declining, setDeclining] = useState<AccountRequestRow | null>(null);
  const [declineError, setDeclineError] = useState<string | null>(null);

  if (!decider) {
    return (
      <div className="team">
        <header className="team-head">
          <h1 className="t-title">Team and access</h1>
        </header>
        <EmptyState title="Team and access is for owners and admins.">Ask an owner if you need access to another client.</EmptyState>
      </div>
    );
  }

  const grantable: Role[] = me.role === "owner" ? ["pm", "admin", "owner"] : ["pm"];
  const pending = (f.accounts ?? []).filter((r) => r.status === "pending" && r.user_id !== me.userId);
  const emailOf = (id: string) => f.accounts?.find((r) => r.user_id === id)?.email ?? (id === me.userId ? me.email : null);

  async function decide(row: AccountRequestRow, decision: "approve" | "reject", note: string | null) {
    const role = roles[row.user_id] ?? "pm";
    setBusyId(row.user_id);
    setError(null);
    setDeclineError(null);
    const { error: e } = await supabase.rpc("decide_account_request", { p_user_id: row.user_id, p_decision: decision, p_role: decision === "approve" ? role : null, p_note: note });
    setBusyId(null);
    if (e) {
      const msg = `Your decision wasn't recorded: ${e.message}. Nothing changed.`;
      if (decision === "reject") setDeclineError(msg);
      else setError(msg);
      return;
    }
    setDeclining(null);
    toast(decision === "approve" ? `${row.email} can now sign in as ${ROLE_WITH_ARTICLE[role]}.` : `${row.email}'s request was declined.`);
    await Promise.all([f.reload(), team.reload()]);
  }

  return (
    <div className="team">
      <header className="team-head">
        <h1 className="t-title">Team and access</h1>
        <p className="muted">Who can see what, and who decides.</p>
      </header>

      <section aria-labelledby="req-h" className="team-section">
        <h2 id="req-h" className="team-h2">Waiting for your approval</h2>
        {f.error && <LoadError what="the account requests" error={f.error} onRetry={f.reload} />}
        {!f.accounts && !f.error && <Loading rows={1} label="Loading the account requests" />}
        {f.accounts && pending.length === 0 && <p className="muted">Nobody is waiting. New sign-ups appear here and see nothing until you approve them.</p>}
        {pending.length > 0 && (
          <ul className="team-requests">
            {pending.map((row, i) => {
              const role = roles[row.user_id] ?? "pm";
              return (
                <li key={row.user_id} className="team-request">
                  <Diamond weight="fill" aria-hidden="true" className="team-request-glyph" />
                  <span className="team-request-who">
                    <b>{row.email}</b> asked for an account{row.full_name ? ` (${row.full_name})` : ""} · {ago(row.requested_at)}
                  </span>
                  {grantable.length > 1 && (
                    <label className="select-field">
                      <span>Role</span>
                      <select value={role} onChange={(e) => setRoles({ ...roles, [row.user_id]: e.target.value as Role })}>
                        {grantable.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_NAME[r]}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <Button variant={i === 0 ? "primary" : "secondary"} disabled={busyId === row.user_id} onClick={() => void decide(row, "approve", null)}>
                    Approve as {ROLE_NAME[role].toLowerCase()}
                  </Button>
                  <Button variant="quiet" disabled={busyId === row.user_id} onClick={() => setDeclining(row)}>
                    Decline
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        {me.role === "admin" && pending.length > 0 && <p className="muted">As an admin you can approve project managers only.</p>}
        {error && <Notice tone="stop">{error}</Notice>}
      </section>

      <section aria-labelledby="inv-h" className="team-section">
        <h2 id="inv-h" className="team-h2">Invite someone</h2>
        <p className="muted">The Cockpit can’t send invites yet. Ask the person to sign up on the sign-in page with their work email; their request then appears above for you to approve.</p>
      </section>

      <section aria-labelledby="ppl-h" className="team-section">
        <h2 id="ppl-h" className="team-h2">People</h2>
        {team.error && <LoadError what="the people" error={team.error} onRetry={team.reload} />}
        {!team.data && !team.error && <Loading rows={2} label="Loading the people" />}
        {team.data && (
          <ul className="team-people">
            {team.data.people.map((p) => {
              const email = emailOf(p.id);
              return (
                <li key={p.id} className="team-person">
                  <span aria-hidden="true" className="team-initial">
                    {initialOf(p.full_name, email)}
                  </span>
                  <span className="team-person-who">
                    <b>
                      {p.full_name ?? "No name given"}
                      {p.id === me.userId ? " (you)" : ""}
                    </b>
                    <span className="team-person-email">{email ?? "No email on file"}</span>
                  </span>
                  <span className="team-person-role">{ROLE_NAME[p.role] ?? "Unknown role"}</span>
                  <span className="team-person-clients">{clientsLine(p, team.data!.assignments)}</span>
                </li>
              );
            })}
          </ul>
        )}
        {team.data && <p className="team-note">Changing someone’s role or the clients they follow can’t be done from the Cockpit yet.</p>}
      </section>

      <section aria-labelledby="roles-h" className="team-section">
        <h2 id="roles-h" className="team-h2">What each role can do</h2>
        <dl className="team-roles">
          {ROLE_WORDS.map((r) => (
            <div key={r.role}>
              <dt>{ROLE_NAME[r.role]}</dt>
              <dd>{r.what}</dd>
            </div>
          ))}
        </dl>
      </section>

      <ConfirmDialog
        open={!!declining}
        title={declining ? `Decline ${declining.email}?` : "Decline this request?"}
        body="They will not be able to sign in. Say why, so there is a record of the decision."
        reasonLabel="Why"
        confirmLabel="Decline the request"
        danger
        busy={!!declining && busyId === declining.user_id}
        error={declineError}
        onConfirm={(reason) => declining && void decide(declining, "reject", reason)}
        onCancel={() => {
          setDeclining(null);
          setDeclineError(null);
        }}
      />
    </div>
  );
}
