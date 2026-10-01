/**
 * Projects: where each client is, adding a client or project (Step 4C decision D5; owner/admin by RLS,
 * entity consistency enforced by trigger 0002), the project page with its stage move, and New request
 * (intake, ask, re-check a page). Every action only requests work; the worker does it.
 */
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Plus } from "@phosphor-icons/react";
import { supabase } from "../supabaseClient";
import { requestJob } from "../jobsClient";
import { dateTime, type RoundRow } from "../lib/model";
import { canDecide, useFactory, useLoad, useMe, useToast } from "../lib/state";
import { stageLabel } from "../stages";
import { Empty, LoadError, Loading, Notice, PageHead, Plate, RouteLine } from "../components/ui";
import { ClientLines, fetchProjects } from "./Home";
import { StageMove } from "./Decisions";

/* ---------------- add client / project ---------------- */

interface EntityRow {
  id: string;
  slug: string;
  name: string;
}
interface ClientRow {
  id: string;
  name: string;
  entity_id: string;
}

async function fetchEntitiesAndClients(): Promise<{ entities: EntityRow[]; clients: ClientRow[] }> {
  const [e, c] = await Promise.all([
    supabase.from("entities").select("id,slug,name").eq("status", "active").order("name"),
    supabase.from("clients").select("id,name,entity_id").order("name"),
  ]);
  if (e.error) throw new Error(e.error.message);
  if (c.error) throw new Error(c.error.message);
  return { entities: (e.data ?? []) as EntityRow[], clients: (c.data ?? []) as ClientRow[] };
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
    if (!entityId || clientName.trim().length < 2) return setError("Choose the entity and give the client a name of at least 2 characters.");
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
    toast(`${projectName.trim()} added at Onboarding.`);
    setProjectName("");
    onAdded();
  }

  return (
    <Plate title="Add a client or project" note="Each client belongs to exactly one entity. Projects start at Onboarding.">
      <div className="plate-body stack-tight">
        {lists.error && <LoadError what="entities and clients" error={lists.error} onRetry={lists.reload} />}
        <form className="form-grid three" onSubmit={addClient}>
          <div className="field">
            <label htmlFor="new-entity">Entity</label>
            <select id="new-entity" className="select" value={entityId} onChange={(e) => setEntityId(e.target.value)}>
              <option value="">Choose an entity</option>
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
    </Plate>
  );
}

/* ---------------- projects list ---------------- */

export default function Projects() {
  const me = useMe();
  const f = useFactory();
  const projects = useLoad(fetchProjects, []);
  const decider = canDecide(me.role);
  return (
    <>
      <PageHead
        title="Projects"
        lead="Every client and where it is on the 11 stages. Signals mark human gates; Launch only ever moves by hand."
        actions={
          decider && (
            <Link className="btn primary" to="/projects/new">
              <Plus aria-hidden="true" />
              New request
            </Link>
          )
        }
      />
      <div className="stack">
        <Plate title="Where every client is">
          <ClientLines projects={projects.data} plans={f.plans} error={projects.error} reload={projects.reload} />
        </Plate>
        {decider && <AddClientOrProject onAdded={projects.reload} />}
      </div>
    </>
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
              if (text.trim()) go("intake", { text }, "Reading the request. The plan will appear in Decisions.");
            }}
          >
            <div className="field">
              <label htmlFor="req">Paste it exactly as it came</label>
              <textarea id="req" className="textarea" rows={10} maxLength={20000} value={text} onChange={(e) => setText(e.target.value)} aria-describedby="req-hint" />
              <span id="req-hint" className="hint">
                The request is treated as information, never as instructions. <span className="fig">{text.length.toLocaleString()} / 20,000</span> characters.
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
