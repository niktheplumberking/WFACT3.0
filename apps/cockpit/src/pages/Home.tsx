/** Home: "is everything OK, and what needs me?" first (Blueprint §9, Step 4C IA). */
import { Link } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { recentlyFinished, runningJobs, statusLine } from "../lib/attention";
import { KIND_LABEL, jobState, planName, shortDate, type PlanRow, type ProjectRow } from "../lib/model";
import { canDecide, useFactory, useLoad, useMe } from "../lib/state";
import { Aspect, Empty, LoadError, Loading, PageHead, Plate, RouteLine } from "../components/ui";
import type { JobRow } from "../jobsClient";

export async function fetchProjects(): Promise<ProjectRow[]> {
  const res = await supabase.from("projects").select("id,name,stage,status,created_at,client_id,clients(name,entities(name))").order("created_at", { ascending: false });
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as unknown as ProjectRow[];
}

export function subjectOf(j: JobRow, plans: PlanRow[]): string {
  const planId = (j.params?.planId ?? j.result?.planId) as string | undefined;
  const p = planId ? plans.find((x) => x.id === planId) : undefined;
  if (p) return planName(p);
  if (j.kind === "ask") return String(j.params?.question ?? "");
  if (j.kind === "verify") return String(j.params?.path ?? "");
  return "";
}

export function JobLine({ j, plans }: { j: JobRow; plans: PlanRow[] }) {
  const s = jobState(j);
  const subject = subjectOf(j, plans);
  return (
    <li>
      <Aspect tone={s.tone}>{s.label}</Aspect>
      <Link to={`/activity/${j.id}`}>
        {KIND_LABEL[j.kind]}
        {subject ? `: ${subject}` : ""}
      </Link>
      <span className="fig quiet">{shortDate(j.finished_at ?? j.created_at)}</span>
    </li>
  );
}

/** Plans whose client has no project row yet still belong on the route map, at Intake. */
function planLines(plans: PlanRow[], projects: ProjectRow[]): PlanRow[] {
  const names = new Set(projects.map((p) => p.clients?.name?.toLowerCase()));
  const seen = new Set<string>();
  return plans.filter((p) => {
    if (p.status === "rejected" && p.revision >= 2) return false;
    const client = p.plan.plan.intake?.clientName?.toLowerCase();
    if (seen.has(p.client_slug) || (client && names.has(client))) return false;
    seen.add(p.client_slug);
    return true;
  });
}

export default function Home() {
  const me = useMe();
  const f = useFactory();
  const projects = useLoad(fetchProjects, []);
  const decider = canDecide(me.role);

  if (!decider) {
    return (
      <>
        <PageHead title="Your projects" lead="Decisions and factory actions are for owners and admins. You can follow the projects you're assigned to here." />
        <Plate title="Where your clients are">
          <ClientLines projects={projects.data} plans={[]} error={projects.error} reload={projects.reload} />
        </Plate>
      </>
    );
  }

  const items = f.attention;
  const running = f.jobs ? runningJobs(f.jobs) : [];
  const recent = f.jobs ? recentlyFinished(f.jobs) : [];
  const lastVerified = f.jobs?.find((j) => j.status === "succeeded" && j.result?.status === "awaiting_launch_approval");
  const sub = [
    running.length ? `${running.length} job${running.length === 1 ? " is" : "s are"} running.` : "No job is running.",
    lastVerified ? `The last build passed every check on ${shortDate(lastVerified.finished_at ?? lastVerified.created_at)}.` : null,
    "Full system health (queue, error rate, backups) arrives in Step 9.",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <PageHead big title={f.jobs ? statusLine(items) : "Checking the factory…"} lead={f.jobs ? sub : undefined} />
      {f.error && <LoadError what="the factory's status" error={f.error} onRetry={f.reload} />}
      <div className="home-grid">
        <Plate title="Waiting for you" note={items.length ? "Oldest first" : undefined}>
          {!f.jobs && !f.error && <Loading rows={3} label="Loading what needs you" />}
          {f.jobs && items.length === 0 && (
            <Empty title="Nothing is waiting for you.">
              New plans, account requests, finished builds and anything that fails show up here. <Link to="/projects/new">Start a new request</Link>
            </Empty>
          )}
          {items.length > 0 && (
            <ul className="queue">
              {items.map((i) => (
                <li key={i.key}>
                  <span className={`lamp ${i.tone}`} aria-hidden="true" />
                  <div>
                    <Link className="row-link what" to={i.href}>
                      {i.title}
                    </Link>
                    <p className="why">{i.why}</p>
                  </div>
                  <Aspect tone={i.tone}>{i.label}</Aspect>
                </li>
              ))}
            </ul>
          )}
        </Plate>
        <div className="stack">
          <Plate title="Running now">
            {running.length === 0 ? (
              <Empty title="Nothing is running.">Builds and plans you start appear here while they work, usually for 1 to 5 minutes.</Empty>
            ) : (
              <ul className="mini">
                {running.map((j) => (
                  <JobLine key={j.id} j={j} plans={f.plans ?? []} />
                ))}
              </ul>
            )}
          </Plate>
          <Plate title="Recently finished" note={<Link to="/activity">All activity</Link>}>
            {recent.length === 0 ? (
              <Empty title="Nothing has finished yet." />
            ) : (
              <ul className="mini">
                {recent.map((j) => (
                  <JobLine key={j.id} j={j} plans={f.plans ?? []} />
                ))}
              </ul>
            )}
          </Plate>
        </div>
      </div>
      <Plate title="Where every client is" note="Signals mark human gates. Launch only ever moves by hand.">
        <ClientLines projects={projects.data} plans={f.plans} error={projects.error} reload={projects.reload} />
      </Plate>
    </>
  );
}

export function ClientLines({ projects, plans, error, reload }: { projects: ProjectRow[] | null; plans: PlanRow[] | null; error: string | null; reload: () => void }) {
  if (error) return <div className="plate-body"><LoadError what="projects" error={error} onRetry={reload} /></div>;
  // Wait for both lists, so plan lines never pop in under the project lines and shift the page.
  if (!projects || !plans) return <Loading rows={3} label="Loading projects" />;
  const extra = planLines(plans, projects);
  if (projects.length === 0 && extra.length === 0) {
    return <Empty title="No clients yet.">A client appears here after its first request is planned.</Empty>;
  }
  return (
    <div className="lines">
      {projects.map((p) => (
        <div className="line" key={p.id}>
          <div className="line-name">
            <Link to={`/projects/${p.id}`}>{p.name}</Link>
            <span className="quiet">
              {p.clients?.entities?.name ?? "No entity"}. {p.status === "active" ? "Active" : p.status}.
            </span>
          </div>
          <RouteLine stage={p.stage} name={p.name} />
        </div>
      ))}
      {extra.map((p) => (
        <div className="line" key={p.id}>
          <div className="line-name">
            <Link to={`/decisions/plans/${p.id}`}>{p.plan.plan.intake?.clientName ?? planName(p)}</Link>
            <span className="quiet">
              {p.entity_slug}.{" "}
              {p.status === "pending" ? "Plan waits for you." : p.status === "approved" ? `Plan approved${p.build_track ? `, Track ${p.build_track}` : ""}.` : "Plan rejected."} No project yet.
            </span>
          </div>
          <RouteLine stage="1_intake" name={planName(p)} waitingAt={p.status === "pending" ? "1_intake" : undefined} />
        </div>
      ))}
    </div>
  );
}
