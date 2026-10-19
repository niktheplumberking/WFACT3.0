/**
 * Cockpit v2: the honest "Coming later" rooms, the phone "More" screen, Notifications (Inbox from the same source as
 * Home attention; Preferences say the Cockpit is the only channel) and Not found. Costs is pages/Costs.tsx; Settings is pages/Settings.tsx.
 */
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { SignOut, CaretRight, Coins, UsersThree, Bell, GearSix } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { supabase } from "../supabaseClient";
import { canDecide, useFactory, useMe, useNotifications } from "../lib/state";
import { NOTIFY_LINES } from "../lib/prefs";
import { useDetail } from "../lib/detail";
import { COMING } from "../shell/Shell";
import { LoadError, PageHead } from "../components/ui";
import { EmptyState, Segmented, StatusChip, Tabs } from "../components/kit";
import { dateTime } from "../lib/model";

/* ---------------- coming later ---------------- */

export function ComingSoon() {
  const { slug } = useParams();
  const room = COMING.find((c) => c.slug === slug);
  if (!room) return <NotFound />;
  return (
    <div className="soon-page">
      <p className="t-eyebrow">Coming later</p>
      <h1 className="t-title">{room.label}</h1>
      <p className="t-lead muted">{room.what}</p>
      <p className="coming-later">This room is not built yet, so it shows nothing rather than made-up numbers.</p>
    </div>
  );
}

/* ---------------- phone "More" ---------------- */

export function More() {
  const me = useMe();
  const decider = canDecide(me.role);
  const { detail, setDetail } = useDetail();
  const links: [string, Icon, string][] = [
    ...(me.role === "owner" ? [["Costs", Coins, "/costs"] as [string, Icon, string]] : []),
    ...(decider ? [["Team and access", UsersThree, "/team"] as [string, Icon, string]] : []),
    ["Notifications", Bell, "/notifications"],
    ["Settings", GearSix, "/settings"],
  ];
  return (
    <div className="more-page">
      <h1 className="t-title">More</h1>
      <ul className="more-list">
        {links.map(([label, I, to]) => (
          <li key={to}>
            <Link to={to}>
              <I aria-hidden="true" />
              <span>{label}</span>
              <CaretRight aria-hidden="true" />
            </Link>
          </li>
        ))}
        <li>
          <button type="button" onClick={() => supabase.auth.signOut()}>
            <SignOut aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </li>
      </ul>
      <Segmented label="Detail level" value={detail} onChange={setDetail} options={[{ value: "simple", label: "Simple" }, { value: "detailed", label: "Detailed" }]} />
      <p className="t-eyebrow">Coming later</p>
      <ul className="more-list soon-list">
        {COMING.map((c) => (
          <li key={c.slug}>
            <Link to={`/soon/${c.slug}`}>
              <c.icon aria-hidden="true" />
              <span>{c.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- notifications (brief §6 screen 14): Inbox and Preferences ---------------- */

/** The events the Cockpit really tells you about: the three groups of Home attention (lib/attention.ts). The design's
 *  "Spend near the cap" and "Client details supplied" rows have no notification behind them (BLOCKED-ON-NICK.md). */
const NOTIFY_EVENTS: [string, string][] = [
  ["Something needs me", "Approvals, missing details and requests for access"],
  ["A build finished", "Ready for approval"],
  ["A build stopped", "With the reason and the fix"],
];

export function Notifications() {
  const me = useMe();
  const decider = canDecide(me.role);
  const f = useFactory();
  const { items, isUnread, markAllRead } = useNotifications();
  const [tab, setTab] = useState<"inbox" | "prefs">("inbox");
  const nav = useNavigate();
  const loading = !f.clients && !f.error;
  const sorted = [...items].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <div className="notif-page">
      <header className="notif-head">
        <h1 className="t-title">Notifications</h1>
        <Tabs label="Notifications" idBase="notif" value={tab} onChange={setTab} options={[{ value: "inbox", label: "Inbox" }, { value: "prefs", label: "Preferences" }]} />
      </header>
      <div role="tabpanel" id="notif-panel-inbox" aria-labelledby="notif-tab-inbox" className="notif-panel" hidden={tab !== "inbox"}>
        {f.error ? (
          <LoadError what="your notifications" error={f.error} onRetry={f.reload} />
        ) : loading ? (
          <p className="muted" role="status">
            Loading your notifications…
          </p>
        ) : sorted.length === 0 ? (
          decider ? (
            <EmptyState title="Nothing needs you right now.">Approvals, missing details and stopped builds appear here and on Home as soon as they happen.</EmptyState>
          ) : (
            <EmptyState title="Nothing needs you right now.">Approvals, missing details and stopped builds go to the owner and admins. Your clients and where each one stands are on Projects.</EmptyState>
          )
        ) : (
          <>
            <div className="notif-actions">
              <button type="button" className="notif-mark" onClick={markAllRead}>
                Mark all as read
              </button>
            </div>
            <ul className="inbox">
              {sorted.map((n) => {
                const unread = isUnread(n);
                return (
                  <li key={n.key}>
                    <button type="button" onClick={() => nav(n.href)}>
                      <span className={unread ? "unread-dot" : "unread-dot read"} aria-hidden="true" />
                      <span className="inbox-body">
                        <span className="inbox-meta">
                          {unread && <span className="sr-only">Unread.</span>}
                          <StatusChip tone={n.tone === "stop" ? "stop" : "need"}>{n.tone === "stop" ? "Stopped" : "Needs you"}</StatusChip>
                          <span className="quiet t-small">{dateTime(n.at)}</span>
                        </span>
                        <b>{n.client ? `${n.client}: ${n.title}` : n.title}</b>
                        <span className="muted">{n.why}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
      <div role="tabpanel" id="notif-panel-prefs" aria-labelledby="notif-tab-prefs" className="notif-panel" hidden={tab !== "prefs"}>
        {decider ? (
          <table className="notif-prefs">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">In the app</th>
              </tr>
            </thead>
            <tbody>
              {NOTIFY_EVENTS.map(([e, d]) => (
                <tr key={e}>
                  <th scope="row">
                    <b>{e}</b>
                    <br />
                    <span>{d}</span>
                  </th>
                  <td>Always on</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>Approvals, missing details and stopped builds go to the owner and admins, so nothing is sent to you here yet. Your clients and where each one stands are on Projects.</p>
        )}
        <ul className="notif-notes">
          {decider && <li>{NOTIFY_LINES.where}</li>}
          <li>{NOTIFY_LINES.channels}</li>
          <li>{NOTIFY_LINES.quiet}</li>
          {me.role === "owner" && (
            <li>
              Spend near the cap is not a notification yet. This week’s spend against the cap is on Home and in <Link to="/costs">Costs</Link>.
            </li>
          )}
          {decider && <li>When someone adds a file or an answer, the client’s page and Home change straight away. There is no separate notification for it yet.</li>}
        </ul>
        <p className="t-small quiet">
          The same is said in <Link to="/settings?group=notify">Settings, Notifications</Link>.
        </p>
      </div>
    </div>
  );
}

/* ---------------- settings ---------------- */

export function NotFound() {
  return (
    <>
      <PageHead title="There's nothing at this address." lead="The link may be old, or the page may need a role you don't have." />
      <Link className="btn primary" to="/">
        Go to Home
      </Link>
    </>
  );
}
