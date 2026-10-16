/**
 * Cockpit v2: the honest "Coming later" rooms, the phone "More" screen, the Notifications inbox (same source as Home
 * attention) and Not found. Costs is pages/Costs.tsx; Settings is pages/Settings.tsx.
 */
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { SignOut, CaretRight, Coins, UsersThree, Bell, GearSix } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { supabase } from "../supabaseClient";
import { canDecide, useMe, useNotifications } from "../lib/state";
import { useDetail } from "../lib/detail";
import { COMING } from "../shell/Shell";
import { PageHead } from "../components/ui";
import { ComingLater, EmptyState, Segmented, StatusChip } from "../components/kit";
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

/* ---------------- notifications (inbox; preferences arrive with the Notifications room) ---------------- */

export function Notifications() {
  const { items, isUnread, markAllRead } = useNotifications();
  const [tab, setTab] = useState<"inbox" | "prefs">("inbox");
  const nav = useNavigate();
  const sorted = [...items].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <div className="notif-page">
      <header className="notif-head">
        <h1 className="t-title">Notifications</h1>
        <Segmented label="Notifications" value={tab} onChange={setTab} options={[{ value: "inbox", label: "Inbox" }, { value: "prefs", label: "Preferences" }]} />
      </header>
      {tab === "inbox" ? (
        sorted.length === 0 ? (
          <EmptyState title="Nothing needs you right now.">Approvals, missing details and stopped builds appear here and on Home as soon as they happen.</EmptyState>
        ) : (
          <>
            <div className="notif-actions">
              <button type="button" className="btn quiet" onClick={markAllRead}>
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
                          <StatusChip tone={n.tone === "stop" ? "stop" : "need"}>{n.tone === "stop" ? "Stopped" : "Needs you"}</StatusChip>
                          <span className="quiet t-small">{dateTime(n.at)}</span>
                          {unread && <span className="sr-only">Unread.</span>}
                        </span>
                        <b>{n.title}</b>
                        <span className="muted">{n.why}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )
      ) : (
        <ComingLater name="Preferences">which events reach you by email or phone, quiet hours and a daily digest arrive with the Notifications room. Until then everything shows here and on Home.</ComingLater>
      )}
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
