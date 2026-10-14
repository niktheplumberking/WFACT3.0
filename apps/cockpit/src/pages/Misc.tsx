/**
 * The honest "Coming in Step N" pages, the phone "More" menu, Settings and Not found. Costs moved to
 * pages/Costs.tsx (MVP M6).
 */
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ListChecks, Receipt, SignOut, GearSix, ChatCircleText, CaretRight } from "@phosphor-icons/react";
import { supabase } from "../supabaseClient";
import { applyTheme, canDecide, readThemePref, useMe, type ThemePref } from "../lib/state";
import { COMING } from "../shell/Shell";
import { Notice, PageHead, Plate } from "../components/ui";

/* ---------------- coming next ---------------- */

export function ComingSoon() {
  const { slug } = useParams();
  const room = COMING.find((c) => c.slug === slug);
  if (!room) return <NotFound />;
  return (
    <>
      <PageHead kicker={`Coming in Step ${room.step}`} title={room.label} lead={room.what} />
      <Notice tone="info">
        This room isn't built yet, so it shows nothing rather than made-up numbers. It arrives with Step {room.step} of the Factory Completion Plan.
      </Notice>
    </>
  );
}

/* ---------------- phone "More" ---------------- */

export function More() {
  const me = useMe();
  const decider = canDecide(me.role);
  return (
    <>
      <PageHead title="More" />
      <div className="stack">
        {decider && (
          <Plate title="Work">
            <ul className="link-list">
              <li>
                <Link to="/activity">
                  <ListChecks aria-hidden="true" />
                  Activity
                  <CaretRight aria-hidden="true" style={{ marginLeft: "auto" }} />
                </Link>
              </li>
              <li>
                <Link to="/projects/new">
                  <ChatCircleText aria-hidden="true" />
                  New request or question
                  <CaretRight aria-hidden="true" style={{ marginLeft: "auto" }} />
                </Link>
              </li>
              {me.role === "owner" && (
                <li>
                  <Link to="/costs">
                    <Receipt aria-hidden="true" />
                    Costs
                    <CaretRight aria-hidden="true" style={{ marginLeft: "auto" }} />
                  </Link>
                </li>
              )}
            </ul>
          </Plate>
        )}
        <Plate title="Coming next">
          <ul className="link-list">
            {COMING.map((c) => (
              <li key={c.slug}>
                <Link to={`/soon/${c.slug}`}>
                  <c.icon aria-hidden="true" />
                  {c.label}{" "}
                  <span className="step">Step {c.step}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Plate>
        <Plate title="Account">
          <ul className="link-list">
            <li>
              <Link to="/settings">
                <GearSix aria-hidden="true" />
                Settings
                <CaretRight aria-hidden="true" style={{ marginLeft: "auto" }} />
              </Link>
            </li>
            <li>
              <button type="button" onClick={() => supabase.auth.signOut()}>
                <SignOut aria-hidden="true" />
                Sign out
              </button>
            </li>
          </ul>
        </Plate>
      </div>
    </>
  );
}

/* ---------------- settings ---------------- */

export function Settings() {
  const me = useMe();
  const [theme, setTheme] = useState<ThemePref>(readThemePref());
  function choose(t: ThemePref) {
    setTheme(t);
    applyTheme(t);
  }
  return (
    <>
      <PageHead title="Settings" />
      <div className="stack">
        <Plate title="Your account">
          <div className="plate-body stack-tight">
            <dl className="kv" style={{ maxWidth: 520 }}>
              <div>
                <dt>Name</dt>
                <dd>{me.fullName ?? "Not given"}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{me.email}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>{me.role ?? "None"}</dd>
              </div>
            </dl>
            <div>
              <button className="btn" type="button" onClick={() => supabase.auth.signOut()}>
                <SignOut aria-hidden="true" />
                Sign out
              </button>
            </div>
          </div>
        </Plate>
        <Plate title="Appearance">
          <fieldset className="plate-body tracks" style={{ maxWidth: 520 }}>
            <legend>Theme</legend>
            {(["light", "dark", "system"] as ThemePref[]).map((t) => (
              <label key={t} className={`track${theme === t ? " is-chosen" : ""}`}>
                <input type="radio" name="theme" checked={theme === t} onChange={() => choose(t)} />
                <span>
                  <b>{t === "system" ? "Match my device" : t === "dark" ? "Dark" : "Light"}</b>
                  <span className="muted">{t === "system" ? "Light or dark, following the device setting." : t === "dark" ? "For dim rooms." : "The default."}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </Plate>
        <Plate title="Team">
          <div className="plate-body stack-tight">
            <p className="muted">
              Approve new accounts in <Link to="/decisions/accounts">Decisions, Accounts</Link>. Changing someone's role, removing access and assigning PMs to clients arrive with role-based views in Step 17; until then Huraira changes them directly in the database.
            </p>
          </div>
        </Plate>
        <Plate title="Alerts">
          <div className="plate-body">
            <p className="muted">Push and Telegram alerts by severity arrive in Step 17.</p>
          </div>
        </Plate>
      </div>
    </>
  );
}

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
