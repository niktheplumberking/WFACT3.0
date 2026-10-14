/**
 * Projects: where each client is, adding a client or project (Step 4C decision D5; owner/admin by RLS,
 * entity consistency enforced by trigger 0002), the project page with its stage move, and New request
 * (intake, ask, re-check a page). Every action only requests work; the worker does it.
 */
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, BookmarkSimple, MagnifyingGlass, Plus, PushPin, Rows, SquaresFour } from "@phosphor-icons/react";
import { supabase } from "../supabaseClient";
import { requestJob } from "../jobsClient";
import { dateTime, type RoundRow } from "../lib/model";
import { canDecide, useFactory, useLoad, useMe, useToast } from "../lib/state";
import { stageLabel } from "../stages";
import { Empty, LoadError, Loading, Notice, PageHead, Plate, RouteLine } from "../components/ui";
import { fetchProjects } from "./Home";
import { Button, ButtonLink, EmptyState, PathSegments, Segmented, StatusChip, TechDetails, type StatusTone } from "../components/kit";
import { STEP_NAMES } from "../lib/path";
import type { ClientRow } from "../lib/clients";
import { StageMove } from "./Decisions";
import { LogoUpload } from "../components/LogoUpload";
import { checkSiteUrl, isTestAddress, type LogoRecord } from "../lib/brandUpload";

/* ---------------- add client / project ---------------- */

interface EntityRow {
  id: string;
  slug: string;
  name: string;
}
interface ClientRecord {
  id: string;
  name: string;
  entity_id: string;
}

async function fetchEntitiesAndClients(): Promise<{ entities: EntityRow[]; clients: ClientRecord[] }> {
  const [e, c] = await Promise.all([
    supabase.from("entities").select("id,slug,name").eq("status", "active").order("name"),
    supabase.from("clients").select("id,name,entity_id").order("name"),
  ]);
  if (e.error) throw new Error(e.error.message);
  if (c.error) throw new Error(c.error.message);
  return { entities: (e.data ?? []) as EntityRow[], clients: (c.data ?? []) as ClientRecord[] };
}

function AddClientOrProject({ onAdded }: { onAdded: () => void }) {
  const lists = useLoad(fetchEntitiesAndClients, []);
  const toast = useToast();
  const [entityId, setEntityId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientId, setClientId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const entities = lists.data?.entities ?? [];
  const clients = lists.data?.clients ?? [];

  async function addClient(e: React.FormEvent) {
    e.preventDefault();
    if (!entityId || clientName.trim().length < 2) return setError("Choose the business and give the client a name of at least 2 characters.");
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from("clients").insert({ entity_id: entityId, name: clientName.trim() });
    setBusy(false);
    if (err) return setError(`The client wasn't added: ${err.message}. Nothing changed.`);
    toast(`${clientName.trim()} added.`);
    setClientName("");
    await lists.reload();
  }

  async function addProject(e: React.FormEvent) {
    e.preventDefault();
    const client = clients.find((c) => c.id === clientId);
    if (!client || projectName.trim().length < 2) return setError("Choose the client and give the project a name of at least 2 characters.");
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from("projects").insert({ client_id: client.id, entity_id: client.entity_id, name: projectName.trim() });
    setBusy(false);
    if (err) return setError(`The project wasn't added: ${err.message}. Nothing changed.`);
    toast(`${projectName.trim()} added.`);
    setProjectName("");
    onAdded();
  }

  return (
    // Cockpit v2: not in the design, kept because a client needs a project before "Record that it is live" can work.
    <details className="hand-add">
      <summary>Add a client or project by hand</summary>
      <div className="stack-tight">
        <p className="t-small muted">Most clients arrive with a request. Use this only for a client the factory has not seen. Each client belongs to one business.</p>
        {lists.error && <LoadError what="businesses and clients" error={lists.error} onRetry={lists.reload} />}
        <form className="form-grid three" onSubmit={addClient}>
          <div className="field">
            <label htmlFor="new-entity">Business</label>
            <select id="new-entity" className="select" value={entityId} onChange={(e) => setEntityId(e.target.value)}>
              <option value="">Choose a business</option>
              {entities.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="new-client">Client name</label>
            <input id="new-client" className="input" value={clientName} maxLength={120} onChange={(e) => setClientName(e.target.value)} />
          </div>
          <div>
            <button className="btn" type="submit" disabled={busy}>
              <Plus aria-hidden="true" />
              Add client
            </button>
          </div>
        </form>
        <form className="form-grid three" onSubmit={addProject}>
          <div className="field">
            <label htmlFor="new-project-client">Client</label>
            <select id="new-project-client" className="select" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Choose a client</option>
              {clients.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="new-project">Project name</label>
            <input id="new-project" className="input" value={projectName} maxLength={160} onChange={(e) => setProjectName(e.target.value)} />
          </div>
          <div>
            <button className="btn" type="submit" disabled={busy}>
              <Plus aria-hidden="true" />
              Add project
            </button>
          </div>
        </form>
        {error && <Notice tone="stop">{error}</Notice>}
      </div>
    </details>
  );
}

/* ---------------- projects list (Cockpit v2) ---------------- */

type Filter = "all" | "need" | "run" | "stop" | "ready";
type Sort = "need" | "newest" | "name" | "build";
type Group = "none" | "step" | "waiting" | "kind";
interface ProjectsView {
  query: string;
  filter: Filter;
  sort: Sort;
  group: Group;
  view: "grid" | "list";
}
const VIEW_KEY = "cockpit-projects-view";
const PIN_KEY = "cockpit-pins";
const DEFAULT_VIEW: ProjectsView = { query: "", filter: "all", sort: "need", group: "none", view: "grid" };

function readJson<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? { ...fallback, ...(JSON.parse(v) as T) } : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* private mode: lasts for this visit */
  }
}

const FILTERS: [Filter, string][] = [
  ["all", "All"],
  ["need", "Needs someone"],
  ["run", "Running"],
  ["stop", "Stopped"],
  ["ready", "Ready for approval"],
];
const matchesFilter = (c: ClientRow, f: Filter) => f === "all" || (f === "ready" ? c.path?.state === "ready" : c.path?.tone === f);
const toneOf = (t: string | undefined): StatusTone => (t === "need" || t === "run" || t === "stop" || t === "done" ? t : "wait");
const whereOf = (c: ClientRow) => (!c.path ? "" : c.path.state === "stopped" ? "Building, stopped" : c.path.state === "approved" ? "Approved, waiting for launch" : STEP_NAMES[c.path.step]);
const waitingOf = (c: ClientRow, me: string) => (!c.path ? "" : c.path.waitingOn === "you" ? me : c.path.waitingOn.charAt(0).toUpperCase() + c.path.waitingOn.slice(1));

/** The last build, as a chip: none yet, running, passed every check, or stopped. Straight from the newest build. */
function lastBuild(c: ClientRow): { tone: StatusTone; word: string } {
  const b = c.path?.build;
  if (!b) return { tone: "idle", word: "No build yet" };
  if (c.path!.state === "building") return { tone: "run", word: "Running" };
  if (b.status === "succeeded" && b.result?.status === "awaiting_launch_approval") return { tone: "done", word: "Passed every check" };
  return { tone: "stop", word: "Stopped" };
}

export default function Projects() {
  const me = useMe();
  const f = useFactory();
  const toast = useToast();
  const decider = canDecide(me.role);
  const [v, setV] = useState<ProjectsView>(() => readJson(VIEW_KEY, DEFAULT_VIEW));
  const [pins, setPins] = useState<Record<string, boolean>>(() => readJson<Record<string, boolean>>(PIN_KEY, {}));
  const set = (patch: Partial<ProjectsView>) => setV((x) => ({ ...x, ...patch }));
  const myName = me.fullName ?? "you";

  const all = f.clients ?? [];
  const q = v.query.trim().toLowerCase();
  const shown = useMemo(() => {
    const hit = (c: ClientRow) => !q || `${c.name} ${c.kind ?? ""} ${waitingOf(c, myName)}`.toLowerCase().includes(q);
    const rank = (c: ClientRow) => (c.path?.tone === "stop" ? 0 : c.path?.tone === "need" ? 1 : c.path?.tone === "run" ? 2 : 3);
    const list = all.filter((c) => matchesFilter(c, v.filter) && hit(c));
    const by: Record<Sort, (a: ClientRow, b: ClientRow) => number> = {
      need: (a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name),
      newest: (a, b) => b.since.localeCompare(a.since),
      name: (a, b) => a.name.localeCompare(b.name),
      build: (a, b) => (b.path?.build?.created_at ?? "").localeCompare(a.path?.build?.created_at ?? ""),
    };
    return [...list].sort((a, b) => Number(!!pins[b.key]) - Number(!!pins[a.key]) || by[v.sort](a, b));
  }, [all, q, v.filter, v.sort, pins, myName]);

  const groups: [string, ClientRow[]][] = useMemo(() => {
    if (v.group === "none") return [["", shown]];
    const key = (c: ClientRow) => (v.group === "step" ? (c.path ? whereOf(c) : "Progress not shared") : v.group === "waiting" ? waitingOf(c, myName) || "Nobody" : c.kind ?? "Kind not chosen yet");
    const m = new Map<string, ClientRow[]>();
    for (const c of shown) m.set(key(c), [...(m.get(key(c)) ?? []), c]);
    return [...m.entries()];
  }, [shown, v.group, myName]);

  const waiting = all.filter((c) => c.path?.tone === "need" || c.path?.tone === "stop").length;
  const summary = `${all.length} ${all.length === 1 ? "client" : "clients"}. ${waiting === 1 ? "1 is" : `${waiting} are`} waiting on someone.`;

  function pin(c: ClientRow) {
    const next = { ...pins, [c.key]: !pins[c.key] };
    if (!next[c.key]) delete next[c.key];
    setPins(next);
    writeJson(PIN_KEY, next);
  }

  return (
    <div className="projects">
      <header className="projects-head">
        <div>
          <h1 className="t-title">Projects</h1>
          <p className="muted">{f.clients ? summary : "Loading every client."}</p>
        </div>
        <Segmented label="View" value={v.view} onChange={(view) => set({ view })} options={[{ value: "grid", label: "Grid", icon: SquaresFour }, { value: "list", label: "List", icon: Rows }]} />
      </header>
      <div className="projects-tools">
        <label className="search-field">
          <MagnifyingGlass aria-hidden="true" />
          <span className="sr-only">Search clients</span>
          <input value={v.query} placeholder="Search clients" onChange={(e) => set({ query: e.target.value })} />
        </label>
        <label className="select-field">
          <span>Sort</span>
          <select value={v.sort} onChange={(e) => set({ sort: e.target.value as Sort })}>
            <option value="need">Needs someone first</option>
            <option value="newest">Newest first</option>
            <option value="name">Name</option>
            <option value="build">Last build</option>
          </select>
        </label>
        <label className="select-field">
          <span>Group</span>
          <select value={v.group} onChange={(e) => set({ group: e.target.value as Group })}>
            <option value="none">None</option>
            <option value="step">Step on the path</option>
            <option value="waiting">Waiting on</option>
            <option value="kind">Kind of site</option>
          </select>
        </label>
      </div>
      <div role="group" aria-label="Filter" className="filters">
        {FILTERS.map(([k, label]) => (
          <button key={k} type="button" className="pill" aria-pressed={v.filter === k} onClick={() => set({ filter: k })}>
            {label}
            <span className="pill-n">{all.filter((c) => matchesFilter(c, k)).length}</span>
          </button>
        ))}
        <span className="spacer" />
        <button
          type="button"
          className="btn quiet"
          onClick={() => {
            writeJson(VIEW_KEY, v);
            toast("Saved. Projects opens like this next time.", { label: "Undo", run: () => writeJson(VIEW_KEY, DEFAULT_VIEW) });
          }}
        >
          <BookmarkSimple aria-hidden="true" />
          Save this view
        </button>
      </div>

      {f.error && <LoadError what="the clients" error={f.error} onRetry={f.reload} />}
      {!f.clients && !f.error && <Loading rows={3} label="Loading every client" />}
      {f.clients && all.length === 0 && (
        <EmptyState title="Your first client starts with a request." action={decider ? <ButtonLink to="/projects/new" variant="primary" icon={Plus}>Start a new request</ButtonLink> : undefined}>
          {decider ? "Every client appears here once the factory has read its request." : "Clients appear here once an owner assigns them to you."}
        </EmptyState>
      )}
      {f.clients && all.length > 0 && shown.length === 0 && (
        <div role="status" className="no-match">
          <p className="t-item">{q ? `No client matches “${v.query}”.` : "No client matches this filter."}</p>
          <p className="muted">Search looks at client names, kinds of site and who a client is waiting on.</p>
          <Button onClick={() => set({ query: "", filter: "all" })}>{q ? "Clear the search" : "Show all clients"}</Button>
        </div>
      )}

      {shown.length > 0 &&
        groups.map(([g, list]) => (
          <section key={g || "all"} aria-label={g || undefined} className="project-group">
            {g && <h2 className="t-label project-group-h">{g}</h2>}
            {v.view === "grid" ? (
              <ul className="project-grid">
                {list.map((c) => (
                  <li key={c.key} className="project-card">
                    <div className="project-card-head">
                      <div>
                        <Link className="project-name" to={c.href}>
                          {c.name}
                        </Link>
                        {c.plan && <span className="t-small quiet">{c.kind ?? "Kind of site not chosen yet"}</span>}
                      </div>
                      <PinButton c={c} on={!!pins[c.key]} onToggle={() => pin(c)} />
                    </div>
                    {c.path ? (
                      <>
                        <div className="client-step">
                          <PathSegments step={c.path.step} tone={toneOf(c.path.tone)} />
                          <span className="t-small muted">
                            Step {c.path.step + 1} of 6 · {whereOf(c)}
                          </span>
                        </div>
                        <dl className="project-facts">
                          <div>
                            <dt>Next step</dt>
                            <dd className="t-label">{c.path.clientNext}</dd>
                          </div>
                          <div>
                            <dt>Waiting on</dt>
                            <dd>{waitingOf(c, myName)}</dd>
                          </div>
                          <div>
                            <dt>Last build</dt>
                            <dd>
                              <StatusChip tone={lastBuild(c).tone}>{lastBuild(c).word}</StatusChip>
                            </dd>
                          </div>
                        </dl>
                      </>
                    ) : (
                      <p className="t-small muted">{decider ? "No proposal on file, so there is no progress to show." : "Its progress isn't shared with project managers yet."}</p>
                    )}
                    {c.plan && <TechDetails items={[{ k: "proposal", v: c.plan.id }, ...(c.path?.build ? [{ k: "build", v: c.path.build.id }] : [])]} />}
                  </li>
                ))}
              </ul>
            ) : (
              <div role="table" aria-label={g ? `Projects: ${g}` : "Projects"} className="project-table">
                <div role="row" className="project-tr project-th">
                  <span role="columnheader">
                    <span className="sr-only">Pin</span>
                  </span>
                  <span role="columnheader">Client</span>
                  <span role="columnheader">On the path</span>
                  <span role="columnheader">Next step</span>
                  <span role="columnheader">Waiting on</span>
                  <span role="columnheader">Last build</span>
                </div>
                {list.map((c) => (
                  <div role="row" key={c.key} className="project-tr">
                    <span role="cell">
                      <PinButton c={c} on={!!pins[c.key]} onToggle={() => pin(c)} />
                    </span>
                    <div role="cell" className="project-td-name">
                      <Link to={c.href}>{c.name}</Link>
                      {c.plan && <p className="t-small quiet">{c.kind ?? "Kind of site not chosen yet"}</p>}
                    </div>
                    <div role="cell" className="client-step">
                      {c.path ? (
                        <>
                          <PathSegments step={c.path.step} tone={toneOf(c.path.tone)} height={5} />
                          <span className="t-small muted">{whereOf(c)}</span>
                        </>
                      ) : (
                        <span className="t-small muted">{decider ? "No proposal on file" : "Not shared"}</span>
                      )}
                    </div>
                    <span role="cell">{c.path?.clientNext ?? ""}</span>
                    <span role="cell" className="muted">
                      {waitingOf(c, myName)}
                    </span>
                    <span role="cell">{c.path && <StatusChip tone={lastBuild(c).tone}>{lastBuild(c).word}</StatusChip>}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}

      {decider && <AddClientOrProject onAdded={f.reload} />}
    </div>
  );
}

function PinButton({ c, on, onToggle }: { c: ClientRow; on: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="icon-btn pin" aria-pressed={on} aria-label={`${on ? "Unpin" : "Pin"} ${c.name}`} onClick={onToggle}>
      <PushPin aria-hidden="true" weight={on ? "fill" : "regular"} />
    </button>
  );
}

/* ---------------- project page ---------------- */

async function fetchProjectRounds(id: string): Promise<RoundRow[]> {
  const res = await supabase.from("correction_rounds").select("id,round_number,stage,flagged_by,issue,fixed_by,created_at,projects(name)").eq("project_id", id).order("round_number");
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as unknown as RoundRow[];
}

export function ProjectPage() {
  const { id = "" } = useParams();
  const me = useMe();
  const projects = useLoad(fetchProjects, []);
  const rounds = useLoad(() => fetchProjectRounds(id), [id]);
  const p = projects.data?.find((x) => x.id === id);
  if (projects.error) return <LoadError what="this project" error={projects.error} onRetry={projects.reload} />;
  if (!projects.data) return <Loading rows={3} label="Loading the project" />;
  if (!p) return <Empty title="This project doesn't exist, or your role can't see it.">PMs see only the clients they're assigned to. <Link to="/projects">Back to Projects</Link></Empty>;
  return (
    <>
      <PageHead
        kicker={`${p.clients?.name ?? "No client"}, ${p.clients?.entities?.name ?? "no entity"}`}
        title={p.name}
        lead={`At ${stageLabel(p.stage)}. ${p.status === "active" ? "Active" : `Status: ${p.status}`}. Created ${dateTime(p.created_at)}.`}
      />
      <div className="stack">
        <Plate title="Where it is">
          <div className="plate-body stack-tight">
            <RouteLine stage={p.stage} name={p.name} />
            {canDecide(me.role) && (
              <div className="actions">
                <StageMove project={p} onMoved={projects.reload} />
              </div>
            )}
          </div>
        </Plate>
        <Plate title="Fix rounds" note="Each time a check or a person sent work back.">
          {rounds.error && <div className="plate-body"><LoadError what="fix rounds" error={rounds.error} onRetry={rounds.reload} /></div>}
          {!rounds.data && !rounds.error && <Loading rows={2} label="Loading fix rounds" />}
          {rounds.data && rounds.data.length === 0 && <Empty title="No fix rounds logged for this project." />}
          {rounds.data && rounds.data.length > 0 && (
            <ul className="rows">
              {rounds.data.map((r) => (
                <li key={r.id}>
                  <span className="aspect idle">Round {r.round_number}</span>
                  <div>
                    <p className="why" style={{ color: "var(--ink)" }}>{r.issue}</p>
                    <p className="why">
                      {stageLabel(r.stage)}. Flagged by {r.flagged_by}
                      {r.fixed_by ? `, fixed by ${r.fixed_by}` : ""}.
                    </p>
                  </div>
                  <span className="when fig">{dateTime(r.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Plate>
        <Notice tone="info">Builds are linked to plans, not yet to projects, so they're listed on each plan and in Activity.</Notice>
      </div>
    </>
  );
}

/* ---------------- new request ---------------- */

const PAGE_PATH = /^clients\/[a-z][a-z0-9-]*\/pages\/[a-z0-9-]+\.html$/;
const KNOWN_PAGE = "clients/dreamsign-pilot/pages/clean-agency.html";

export function NewRequest() {
  const nav = useNavigate();
  const toast = useToast();
  const f = useFactory();
  const [text, setText] = useState("");
  // What the request text cannot carry: the logo file and the live address (set on the brief by code, never by a model).
  const [logo, setLogo] = useState<LogoRecord | null>(null);
  const [siteUrl, setSiteUrl] = useState("");
  const [siteUrlTouched, setSiteUrlTouched] = useState(false);
  const [question, setQuestion] = useState("");
  const [goal, setGoal] = useState("");
  const [goalTouched, setGoalTouched] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pages the factory has built (single-page builds), plus the DreamSign pilot page in the repo.
  const pages = useMemo(() => {
    const found = (f.jobs ?? [])
      .map((j) => (j.result?.lastCheckpoint as { path?: string } | null | undefined)?.path)
      .filter((p): p is string => !!p && PAGE_PATH.test(p));
    return [...new Set([KNOWN_PAGE, ...found])];
  }, [f.jobs]);
  const [page, setPage] = useState(KNOWN_PAGE);

  async function go(kind: "intake" | "ask" | "verify", params: Record<string, unknown>, ok: string) {
    setBusy(kind);
    setError(null);
    const { jobId, error: e } = await requestJob(kind, params);
    setBusy(null);
    if (!jobId) return setError(`It didn't start: ${e}. Nothing changed; try again.`);
    toast(e ?? ok);
    await f.reload();
    nav(`/activity/${jobId}`);
  }

  const goalError = goalTouched && !goal.trim() ? "Say what the page is for, so the checks know what to judge." : null;
  const site = siteUrl.trim() ? checkSiteUrl(siteUrl) : null;
  const siteUrlError = siteUrlTouched && site && !site.ok ? site.reason : null;
  const siteUrlNote = site?.ok && isTestAddress(site.value) ? "That is a test address, so the site is built without search and share tags until the real address is added." : null;

  return (
    <>
      <PageHead title="Start work from a client request" lead="Paste the client's email or form. The factory reads it, writes a plan and puts it in Decisions for you, usually within a minute." />
      {error && (
        <div style={{ marginBottom: 24 }}>
          <Notice tone="stop">{error}</Notice>
        </div>
      )}
      <div className="split">
        <Plate title="Client request">
          <form
            className="plate-body stack-tight"
            onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim()) return;
              if (site && !site.ok) {
                setSiteUrlTouched(true);
                return;
              }
              go(
                "intake",
                { text, ...(site?.ok ? { siteUrl: site.value } : {}), ...(logo ? { logo } : {}) },
                "Reading the request. The plan will appear in Decisions.",
              );
            }}
          >
            <div className="field">
              <label htmlFor="req">Paste it exactly as it came</label>
              <textarea id="req" className="textarea" rows={10} maxLength={20000} value={text} onChange={(e) => setText(e.target.value)} aria-describedby="req-hint" />
              <span id="req-hint" className="hint">
                The request is treated as information, never as instructions. <span className="fig">{text.length.toLocaleString()} / 20,000</span> characters.
              </span>
            </div>
            <LogoUpload value={logo} onChange={setLogo} disabled={!!busy} />
            <div className="field">
              <label htmlFor="req-site">Live site address (optional)</label>
              <input
                id="req-site"
                className="input"
                inputMode="url"
                autoComplete="url"
                placeholder="https://bennettandco.com"
                maxLength={200}
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
                onBlur={() => setSiteUrlTouched(true)}
                aria-invalid={!!siteUrlError}
                aria-describedby="req-site-h"
              />
              <span id="req-site-h" className="hint" role={siteUrlError ? "alert" : undefined} style={siteUrlError ? { color: "var(--stop)" } : undefined}>
                {siteUrlError ?? siteUrlNote ?? "Where the finished site will live. Search engines and share cards need it; you can add it later from the plan."}
              </span>
            </div>
            <div className="actions">
              <button className="btn primary" type="submit" disabled={!!busy || !text.trim()}>
                <ArrowRight aria-hidden="true" />
                {busy === "intake" ? "Starting…" : "Read request and plan"}
              </button>
            </div>
            <ol className="after quiet">
              <li>Read and sorted</li>
              <li>Plan written</li>
              <li>Your decision</li>
              <li>You start the build</li>
            </ol>
          </form>
        </Plate>
        <div className="stack">
          <Plate title="Ask the factory">
            <form
              className="plate-body stack-tight"
              onSubmit={(e) => {
                e.preventDefault();
                if (question.trim()) go("ask", { question: question.trim() }, "Question sent. The answer appears on the next page.");
              }}
            >
              <div className="field">
                <label htmlFor="ask-page-q">Question</label>
                <input id="ask-page-q" className="input" maxLength={500} placeholder="What stage is DreamSign in?" value={question} onChange={(e) => setQuestion(e.target.value)} />
              </div>
              <div>
                <button className="btn" type="submit" disabled={!!busy || !question.trim()}>
                  {busy === "ask" ? "Sending…" : "Ask"}
                </button>
              </div>
            </form>
          </Plate>
          <Plate title="Re-check a built page">
            <form
              className="plate-body stack-tight"
              onSubmit={(e) => {
                e.preventDefault();
                setGoalTouched(true);
                if (goal.trim()) go("verify", { path: page, goal: goal.trim() }, "Checks started.");
              }}
            >
              <div className="field">
                <label htmlFor="pg">Page</label>
                <select id="pg" className="select" value={page} onChange={(e) => setPage(e.target.value)}>
                  {pages.map((p) => (
                    <option key={p} value={p}>
                      {p.split("/")[1]}: {p.split("/").pop()}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="goal">What the page must achieve</label>
                <input
                  id="goal"
                  className="input"
                  maxLength={1000}
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  onBlur={() => setGoalTouched(true)}
                  aria-invalid={!!goalError}
                  aria-describedby={goalError ? "goal-err" : "goal-hint"}
                />
                {goalError ? (
                  <span id="goal-err" className="error" role="alert">
                    {goalError}
                  </span>
                ) : (
                  <span id="goal-hint" className="hint">
                    Single pages only. Multi-page Track A sites are checked during their build; a separate re-check arrives with Step 7.
                  </span>
                )}
              </div>
              <div>
                <button className="btn" type="submit" disabled={!!busy}>
                  {busy === "verify" ? "Starting…" : "Run the checks"}
                </button>
              </div>
            </form>
          </Plate>
        </div>
      </div>
    </>
  );
}
