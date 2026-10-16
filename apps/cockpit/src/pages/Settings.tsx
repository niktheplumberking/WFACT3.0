/**
 * Settings (Cockpit v2 phase 17, brief §6.13): a searchable group nav (Appearance, Detail level, Home, Notifications,
 * Saved views, Keyboard, Budget, Language and region, Team defaults). Appearance edits a draft shown in a live preview,
 * with a sticky "N unsaved changes / Save / Discard" bar and Undo after saving. The brief wants these per person with
 * owner-set team defaults; the database has no place for either (profiles: id, role, full_name, created_at; checked
 * 2026-10-16), so every setting here is kept on this device and the page says so (BLOCKED-ON-NICK.md). Groups whose
 * design has nothing behind it (date formats, team defaults, notification channels) say what is fixed today.
 */
import { useMemo, useState, type CSSProperties } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowUp, Diamond, MagnifyingGlass, SignOut } from "@phosphor-icons/react";
import { supabase } from "../supabaseClient";
import { applyAppearance, readAppearance, saveAppearance, type Accent, type Appearance, type Density, type TextSize, type Theme } from "../lib/appearance";
import { defaultDetail, useDetail } from "../lib/detail";
import { CAPS, usd } from "../lib/costs";
import { canDecide, useMe, useToast } from "../lib/state";
import type { Role } from "../lib/model";
import {
  HOME_SECTION_NAME, LANDING_NAME, deleteSavedView, landingsFor, readHomeLayout, readLanding, savedViews, writeHomeLayout, writeLanding, type HomeLayout, type Landing,
} from "../lib/prefs";
import { SHORTCUTS } from "../shell/Shell";
import { Button } from "../components/kit";

type Group = "appearance" | "detail" | "home" | "notify" | "views" | "keys" | "budget" | "region" | "defaults";
const GROUPS: { id: Group; label: string; words: string; deciderOnly?: boolean }[] = [
  { id: "appearance", label: "Appearance", words: "theme dark light accent colour density text size motion movement" },
  { id: "detail", label: "Detail level", words: "simple detailed technical ids timings" },
  { id: "home", label: "Home", words: "sections order hide show landing open start" },
  { id: "notify", label: "Notifications", words: "email push phone quiet digest alerts" },
  { id: "views", label: "Saved views", words: "filters sorts grid list projects activity" },
  { id: "keys", label: "Keyboard", words: "shortcuts command palette keys" },
  { id: "budget", label: "Budget", words: "cap limit spend money cost", deciderOnly: true },
  { id: "region", label: "Language and region", words: "date time currency format" },
  { id: "defaults", label: "Team defaults", words: "roles defaults owner admin project manager" },
];
const ROLE_NAME: Record<Role, string> = { owner: "Owner", admin: "Admin", pm: "Project manager" };
const DEVICE_NOTE = "Kept on this device: another device or browser starts from the defaults.";

const THEMES: [Theme, string][] = [["light", "Light"], ["dark", "Dark"], ["system", "Match my device"]];
const ACCENTS: [Accent, string, string][] = [["ink", "Ink", "#1C1B18"], ["harbour", "Harbour", "#1F5D66"], ["clay", "Clay", "#8C4A2C"], ["moss", "Moss", "#3E5A2C"]];
const DENSITIES: [Density, string][] = [["comfortable", "Comfortable"], ["compact", "Compact"]];
const SIZES: [TextSize, string][] = [[100, "Default"], [112, "Larger"], [125, "Largest"]];
const FIELDS: (keyof Appearance)[] = ["theme", "accent", "density", "textSize", "reduceMotion"];

/** How many appearance fields the draft changes. */
export const changesIn = (draft: Appearance, saved: Appearance) => FIELDS.filter((k) => draft[k] !== saved[k]).length;

function Options<T extends string | number>({ label, value, options, onPick, swatches }: { label: string; value: T; options: [T, string, string?][]; onPick: (v: T) => void; swatches?: boolean }) {
  return (
    <div role="group" aria-label={label} className="set-options">
      {options.map(([v, text, hex]) => (
        <button key={String(v)} type="button" className="set-option" aria-pressed={value === v} onClick={() => onPick(v)}>
          {swatches && <span aria-hidden="true" className="set-swatch" style={{ background: hex }} />}
          {text}
        </button>
      ))}
    </div>
  );
}

function AppearanceGroup() {
  const toast = useToast();
  const [saved, setSaved] = useState<Appearance>(() => readAppearance());
  const [draft, setDraft] = useState<Appearance>(saved);
  const set = <K extends keyof Appearance>(k: K, v: Appearance[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const n = changesIn(draft, saved);

  function apply(a: Appearance) {
    saveAppearance(a);
    applyAppearance(a);
    setSaved(a);
    setDraft(a);
  }
  function save() {
    const before = saved;
    apply(draft);
    toast("Saved on this device.", { label: "Undo", run: () => apply(before) });
  }

  // The preview carries the draft's own theme, accent and density (tokens.css reads these attributes on any element).
  const previewDark = draft.theme === "dark" || (draft.theme === "system" && !!window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  const previewStyle = { zoom: draft.textSize / 100 } as CSSProperties;

  return (
    <section aria-labelledby="g-appearance" className="set-group">
      <h2 id="g-appearance" className="set-h2">Appearance</h2>
      <div className="set-field">
        <span className="set-label">Theme</span>
        <Options label="Theme" value={draft.theme} options={THEMES} onPick={(v) => set("theme", v)} />
      </div>
      <div className="set-field">
        <span className="set-label">
          Accent colour <span className="set-label-note">for buttons and focus</span>
        </span>
        <Options label="Accent colour" value={draft.accent} options={ACCENTS} onPick={(v) => set("accent", v)} swatches />
        <p className="set-note">Status colours never change: amber needs you, green is done, red is stopped.</p>
      </div>
      <div className="set-field">
        <span className="set-label">Density</span>
        <Options label="Density" value={draft.density} options={DENSITIES} onPick={(v) => set("density", v)} />
      </div>
      <div className="set-field">
        <span className="set-label">Text size</span>
        <Options label="Text size" value={draft.textSize} options={SIZES} onPick={(v) => set("textSize", v)} />
      </div>
      <label className="set-check">
        <input type="checkbox" checked={!draft.reduceMotion} onChange={(e) => set("reduceMotion", !e.target.checked)} />
        <span>
          <b>Movement</b> · {draft.reduceMotion ? "Off: movement is kept to a minimum" : "On: progress and changes move gently"}
        </span>
      </label>
      <div className="set-field">
        <span className="set-note">Preview</span>
        <div className="appearance-preview" data-theme={previewDark ? "dark" : "light"} data-accent={draft.accent === "ink" ? undefined : draft.accent} data-density={draft.density === "compact" ? "compact" : undefined} style={previewStyle}>
          <span className="appearance-preview-title">Approve the finished site</span>
          <span className="appearance-preview-line">Northlight Signs · every check passed.</span>
          <span className="appearance-preview-row">
            <span className="appearance-preview-btn">Review the site</span>
            <span className="chip chip-need">
              <Diamond weight="fill" aria-hidden="true" />
              Needs you
            </span>
          </span>
        </div>
        <p className="set-note">{DEVICE_NOTE}</p>
      </div>
      {n > 0 && (
        <div role="status" className="set-savebar">
          <span>
            {n} unsaved change{n === 1 ? "" : "s"}. The preview shows them; nothing changes until you save.
          </span>
          <button type="button" className="set-savebar-save" onClick={save}>
            Save
          </button>
          <button type="button" className="set-savebar-discard" onClick={() => setDraft(saved)}>
            Discard
          </button>
        </div>
      )}
    </section>
  );
}

function DetailGroup() {
  const { detail } = useDetail();
  return (
    <section aria-labelledby="g-detail" className="set-group">
      <h2 id="g-detail" className="set-h2">Detail level</h2>
      <p className="muted">Switch any time from the bottom of the menu, or press D. You are on {detail === "detailed" ? "Detailed" : "Simple"} now. {DEVICE_NOTE}</p>
      <div className="set-cards">
        <div className="set-card">
          <b>Simple</b>
          <p className="muted">Plain words. Technical details stay folded away. The default for owners.</p>
          <p className="set-sample">Checking the words · Done · 1 min</p>
        </div>
        <div className="set-card">
          <b>Detailed</b>
          <p className="muted">Technical details open, ids and exact timings visible, with copy buttons.</p>
          <p className="set-sample fig">Checking the words · Done · 58.2 s · claims.unsourced-fact passed · wf-1198</p>
        </div>
      </div>
    </section>
  );
}

function HomeGroup() {
  const me = useMe();
  const [layout, setLayout] = useState<HomeLayout>(() => readHomeLayout());
  const [landing, setLanding] = useState<Landing>(() => readLanding(me.role));
  const save = (l: HomeLayout) => {
    setLayout(l);
    writeHomeLayout(l);
  };
  const move = (i: number, by: -1 | 1) => {
    const order = [...layout.order];
    [order[i], order[i + by]] = [order[i + by]!, order[i]!];
    save({ ...layout, order });
  };
  return (
    <section aria-labelledby="g-home" className="set-group">
      <h2 id="g-home" className="set-h2">Home</h2>
      <span className="set-label" id="home-secs">
        Sections, in order
      </span>
      <ol className="set-sections" aria-labelledby="home-secs">
        {layout.order.map((k, i) => {
          const name = HOME_SECTION_NAME[k];
          return (
            <li key={k}>
              <label className="set-section-show">
                <input type="checkbox" checked={!layout.hidden.includes(k)} onChange={(e) => save({ ...layout, hidden: e.target.checked ? layout.hidden.filter((x) => x !== k) : [...layout.hidden, k] })} />
                <span>{name}</span>
              </label>
              <button type="button" className="set-icon-btn" aria-label={`Move ${name} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp aria-hidden="true" />
              </button>
              <button type="button" className="set-icon-btn" aria-label={`Move ${name} down`} disabled={i === layout.order.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ol>
      <label className="set-select">
        <span className="set-label">Open the Cockpit on</span>
        <select
          value={landing}
          onChange={(e) => {
            const l = e.target.value as Landing;
            setLanding(l);
            writeLanding(l);
          }}
        >
          {landingsFor(me.role).map((l) => (
            <option key={l} value={l}>
              {LANDING_NAME[l]}
            </option>
          ))}
        </select>
      </label>
      <p className="muted">Pinned clients show first on Projects. Pin one with the pin on its card.</p>
      <p className="set-note">Changes here are saved as you make them. {DEVICE_NOTE}</p>
    </section>
  );
}

function NotifyGroup() {
  return (
    <section aria-labelledby="g-notify" className="set-group">
      <h2 id="g-notify" className="set-h2">Notifications</h2>
      <p className="muted">Notifications reach you in the Cockpit only: the bell at the top and Home. Email and phone are not connected yet, so there is nothing to switch on or off for them, and quiet hours and a digest have nothing to hold back.</p>
      <p>
        <Link to="/notifications">Open your notifications</Link>
      </p>
    </section>
  );
}

function ViewsGroup() {
  const me = useMe();
  const toast = useToast();
  const [views, setViews] = useState(() => savedViews(me.userId));
  return (
    <section aria-labelledby="g-views" className="set-group">
      <h2 id="g-views" className="set-h2">Saved views</h2>
      {views.length === 0 ? (
        <p className="muted">No views are saved on this device. Use “Save this view” in Projects or Activity.</p>
      ) : (
        <ul className="set-views">
          {views.map((v) => (
            <li key={v.key}>
              <span className="set-view-what">
                <b>{v.room}</b>
                <span className="muted">{v.summary}</span>
              </span>
              <Button
                variant="quiet"
                aria-label={`Delete the saved ${v.room} view`}
                onClick={() => {
                  deleteSavedView(v.key);
                  setViews(savedViews(me.userId));
                  toast(`${v.room} opens with its usual view again.`);
                }}
              >
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="set-note">One saved view per room, kept on this device. Views have no names, so there is nothing to rename.</p>
    </section>
  );
}

function KeysGroup() {
  return (
    <section aria-labelledby="g-keys" className="set-group">
      <h2 id="g-keys" className="set-h2">Keyboard</h2>
      <dl className="set-keys">
        {SHORTCUTS.map(([k, d]) => (
          <div key={k}>
            <dt>{d}</dt>
            <dd>
              <kbd>{k}</kbd>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function BudgetGroup() {
  return (
    <section aria-labelledby="g-budget" className="set-group">
      <h2 id="g-budget" className="set-h2">Budget</h2>
      <dl className="set-figures">
        <div>
          <dt>Each build stops at</dt>
          <dd>{CAPS.perBuildUsd === null ? "No limit" : usd(CAPS.perBuildUsd)}</dd>
        </div>
        <div>
          <dt>All spending stops, over any 7 days, at</dt>
          <dd>{CAPS.weeklyUsd === null ? "No limit" : usd(CAPS.weeklyUsd)}</dd>
        </div>
      </dl>
      <p className="muted">Changing money is an owner decision. The caps are set in the factory’s own settings and change only on Nick’s say-so; the Cockpit can’t change them.</p>
    </section>
  );
}

function RegionGroup() {
  const now = new Date();
  const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(now);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(now);
  return (
    <section aria-labelledby="g-region" className="set-group">
      <h2 id="g-region" className="set-h2">Language and region</h2>
      <dl className="set-keys">
        <div>
          <dt>Dates</dt>
          <dd>{date}</dd>
        </div>
        <div>
          <dt>Times</dt>
          <dd>{time} (24-hour)</dd>
        </div>
        <div>
          <dt>Money</dt>
          <dd>US dollars ($0.68)</dd>
        </div>
      </dl>
      <p className="muted">These are fixed for now: the Cockpit cannot show other formats or currencies yet.</p>
    </section>
  );
}

function DefaultsGroup() {
  const rows: [Role, string][] = (["owner", "admin", "pm"] as Role[]).map((r) => [r, `${defaultDetail(r) === "detailed" ? "Detailed" : "Simple"} · opens on Home · notifications in the Cockpit`]);
  return (
    <section aria-labelledby="g-defaults" className="set-group">
      <h2 id="g-defaults" className="set-h2">Team defaults</h2>
      <p className="muted">What a new person starts with. Each person can change their own on their device. Owners can’t change these yet: there is nowhere to keep team settings.</p>
      <dl className="set-keys">
        {rows.map(([r, d]) => (
          <div key={r}>
            <dt>{ROLE_NAME[r]}s</dt>
            <dd>{d}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const BODY: Record<Group, () => JSX.Element> = {
  appearance: AppearanceGroup,
  detail: DetailGroup,
  home: HomeGroup,
  notify: NotifyGroup,
  views: ViewsGroup,
  keys: KeysGroup,
  budget: BudgetGroup,
  region: RegionGroup,
  defaults: DefaultsGroup,
};

export default function Settings() {
  const me = useMe();
  const decider = canDecide(me.role);
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const allowed = useMemo(() => GROUPS.filter((g) => !g.deciderOnly || decider), [decider]);
  const asked = allowed.find((g) => g.id === params.get("group"))?.id ?? "appearance";
  const shown = allowed.filter((g) => !q.trim() || `${g.label} ${g.words}`.toLowerCase().includes(q.trim().toLowerCase()));
  const Body = BODY[asked];

  return (
    <div className="settings">
      <header className="settings-head">
        <h1 className="t-title">Settings</h1>
        <p className="muted">Your own settings. They are kept on this device for now, so another device starts from the defaults.</p>
      </header>
      <div className="settings-account">
        <span>
          Signed in as <b>{me.fullName ?? me.email}</b>
          {me.fullName ? ` (${me.email})` : ""} · {me.role ? ROLE_NAME[me.role] : "No role yet"}
        </span>
        <Button icon={SignOut} onClick={() => void supabase.auth.signOut()}>
          Sign out
        </Button>
      </div>
      <div className="settings-body">
        <nav aria-label="Settings groups" className="settings-nav">
          <label className="search-field">
            <MagnifyingGlass aria-hidden="true" />
            <span className="sr-only">Search settings</span>
            <input value={q} placeholder="Search settings" onChange={(e) => setQ(e.target.value)} />
          </label>
          {shown.length === 0 && (
            <p role="status" className="muted">
              No setting matches “{q}”.
            </p>
          )}
          {shown.map((g) => (
            <button key={g.id} type="button" className="settings-nav-btn" aria-current={g.id === asked ? "page" : undefined} onClick={() => setParams({ group: g.id }, { replace: true })}>
              {g.label}
            </button>
          ))}
        </nav>
        <div className="settings-content">
          <Body key={asked} />
        </div>
      </div>
    </div>
  );
}
