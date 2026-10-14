// The six-step path (Cockpit v2 phase 4). Every case uses SYNTHETIC rows shaped like the real tables.
import { describe, expect, it, vi } from "vitest";

// The path is pure; jobsClient only needs a client object to import.
vi.mock("../supabaseClient", () => ({ supabase: {} }));
import type { JobRow } from "../jobsClient";
import type { PlanInputRow } from "./inputs";
import type { PlanRow, Role } from "./model";
import { derivePath, latestBuild, missingWords, stripSteps, type PathInput } from "./path";

const NOW = Date.parse("2026-10-14T12:00:00Z");
const ago = (min: number) => new Date(NOW - min * 60_000).toISOString();
const PLAN = "11111111-1111-4111-8111-111111111111";
const RUN = "77777777-7777-4777-8777-777777777777";

function plan(status: PlanRow["status"], o: { questions?: string[]; briefLogo?: boolean; track?: "A" | "B" | null } = {}): PlanRow {
  return {
    id: PLAN,
    created_at: ago(300),
    client_slug: "harbor-street-bakery",
    entity_slug: "bennett-co",
    status,
    revision: 1,
    decision_note: null,
    decided_at: status === "approved" ? ago(200) : null,
    build_track: o.track === undefined ? (status === "approved" ? "A" : null) : o.track,
    track_overridden: false,
    plan: {
      plan: { brief: { projectName: "Harbor Street Bakery", ...(o.briefLogo ? { logo: { path: "x/logo.svg" } } : {}) }, openQuestions: o.questions ?? [], intake: { entitySlug: "bennett-co", leadType: "new_website", clientName: "Harbor Street Bakery" } },
    } as unknown as PlanRow["plan"],
  };
}

function job(kind: JobRow["kind"], status: JobRow["status"], o: { min?: number; result?: Record<string, unknown> | null; params?: Record<string, unknown>; error?: string | null; id?: string } = {}): JobRow {
  return { id: o.id ?? `${kind}-${status}-${o.min ?? 10}`, created_at: ago(o.min ?? 10), kind, params: o.params ?? (kind === "build_plan" ? { planId: PLAN } : {}), status, started_at: null, finished_at: null, result: o.result ?? null, error: o.error ?? null, gh_run_url: null, archived_at: null };
}

const input = (key: string, value: string | null, waived = false): PlanInputRow => ({ id: key, created_at: ago(1), plan_id: PLAN, kind: key.startsWith("q") ? "answer" : "fact", key, label: key, value, waived });

const run = (o: Partial<PathInput> & { role?: Role }) =>
  derivePath({ plan: null, jobs: [], viewer: { role: o.role ?? "owner", name: "Test Owner" }, decider: "Nick", now: NOW, ...o });

describe("0 Request", () => {
  it("no request yet: paste it, then send it", () => {
    const p = run({});
    expect(p).toMatchObject({ step: 0, state: "request", tone: "need", waitingOn: "you", sentence: "Paste what the client asked for.", nextLine: "Send the request to the factory", nextAction: { label: "Open the request", href: "/projects/new" } });
  });
  it("the factory is reading it", () => {
    const p = run({ intake: job("intake", "running", { min: 2 }) });
    expect(p).toMatchObject({ step: 0, tone: "run", waitingOn: "the factory", chipWord: "Running" });
  });
  it("the request stopped", () => {
    const p = run({ intake: job("intake", "failed", { error: "Something odd." }) });
    expect(p).toMatchObject({ step: 0, tone: "stop", chipWord: "Stopped" });
    expect(p.sentence.startsWith("Stopped: ")).toBe(true);
  });
});

describe("1 Proposal", () => {
  it("waits for the owner: 'you' to an owner, the owner's name to anyone else", () => {
    expect(run({ plan: plan("pending") })).toMatchObject({ step: 1, tone: "need", waitingOn: "you", chipWord: "Waiting on Test Owner", nextAction: { label: "Review the proposal", href: `/decisions/plans/${PLAN}` } });
    expect(run({ plan: plan("pending"), role: "admin" })).toMatchObject({ waitingOn: "Nick", chipWord: "Waiting on Nick" });
    expect(run({ plan: plan("pending"), role: "pm" })).toMatchObject({ waitingOn: "Nick" });
  });
  it("a new proposal is being written", () => {
    const p = run({ plan: plan("pending"), jobs: [job("replan", "running", { min: 1, params: { planId: PLAN } })] });
    expect(p).toMatchObject({ step: 1, tone: "run", waitingOn: "the factory", sentence: "The factory is writing a new proposal." });
  });
});

describe("2 Details needed", () => {
  it("approved, never built: lists what is missing by name, with the real count", () => {
    const p = run({ plan: plan("approved", { questions: ["Do you deliver?", "Parking?"] }) });
    expect(p).toMatchObject({ step: 2, tone: "need", waitingOn: "you" });
    expect(p.sentence).toBe("0 of 3 supplied. Waiting for the logo and the answers to 2 questions.");
    expect(p.nextLine).toBe("Add the logo and the answers to 2 questions, then start the build");
    expect(p.nextAction.label).toBe("Add the missing details");
  });
  it("counts what was given and what was knowingly left out; nothing missing means start the build", () => {
    const p = run({ plan: plan("approved", { questions: ["Do you deliver?"], briefLogo: true }), inputs: [input("q1", "Yes, within 5 km")] });
    expect(p).toMatchObject({ step: 2, sentence: "Everything the proposal asked for is in.", nextLine: "Start the build", nextAction: { label: "Start the build" }, supplied: 1, skipped: 0 });
    const s = run({ plan: plan("approved", { questions: ["Do you deliver?"] }), inputs: [input("q1", null, true), input("asset.logo", "x/logo.svg")] });
    expect(s).toMatchObject({ supplied: 1, skipped: 1, missing: [] });
  });
  it("a PM cannot supply details (RLS): it waits on the owner", () => {
    expect(run({ plan: plan("approved"), role: "pm" })).toMatchObject({ step: 2, waitingOn: "Nick" });
  });
  it("the readiness check stopped for a detail nobody gave: back to Details needed", () => {
    const b = job("build_plan", "failed", { result: { status: "needs_input", planId: PLAN, preflight: { ok: false, needs: [{ key: "phone", label: "Business phone number", reason: "The Contact page needs it." }] } } });
    const p = run({ plan: plan("approved", { briefLogo: true }), jobs: [b] });
    expect(p).toMatchObject({ step: 2, state: "needs" });
    expect(p.sentence).toBe("0 of 1 supplied. Waiting for the business phone number.");
    // once it is given, the stop is a stop again (carry on), not a missing detail
    const q = run({ plan: plan("approved", { briefLogo: true }), jobs: [b], inputs: [input("phone", "(03) 9000 0000")] });
    expect(q).toMatchObject({ step: 3, state: "stopped", tone: "stop" });
  });
});

describe("3 Building", () => {
  it("queued or running is Building, waiting on the factory", () => {
    for (const status of ["queued", "dispatched", "running"] as const) {
      expect(run({ plan: plan("approved", { briefLogo: true }), jobs: [job("build_plan", status, { min: 1 })] })).toMatchObject({ step: 3, state: "building", tone: "run", waitingOn: "the factory", nextAction: { label: "Watch the build" } });
    }
  });
  it("a cancelled build never counts", () => {
    expect(run({ plan: plan("approved", { briefLogo: true }), jobs: [job("build_plan", "cancelled")] })).toMatchObject({ step: 2 });
  });
  it("checks still failing after the last round: stopped, the owner acts", () => {
    const b = job("build_plan", "failed", { result: { status: "failed_verification", planId: PLAN, cycles: 3, qaIssues: ["[render.perf] LCP 4.1s"] } });
    const p = run({ plan: plan("approved", { briefLogo: true }), jobs: [b] });
    expect(p).toMatchObject({ step: 3, state: "stopped", tone: "stop", nextAction: { label: "See the fix", href: `/activity/${b.id}` } });
    expect(p.diagnosis?.cause).toBe("fixable");
  });
  it("an AI service out of credit: waits on Huraira", () => {
    const b = job("build_plan", "failed", { error: "builder HTTP 402 insufficient_quota", result: { status: "build_failed", planId: PLAN } });
    expect(run({ plan: plan("approved", { briefLogo: true }), jobs: [b] })).toMatchObject({ step: 3, tone: "stop", waitingOn: "Huraira" });
  });
  it("the spending limit is the owner's call: an owner raises it, anyone else asks the owner", () => {
    const b = job("build_plan", "failed", { error: "spend:$5.00 ceiling of $5.00 reached before render.design-review", result: { status: "build_failed", planId: PLAN } });
    const owner = run({ plan: plan("approved", { briefLogo: true }), jobs: [b] });
    expect(owner).toMatchObject({ step: 3, tone: "stop", waitingOn: "you", nextLine: "Raise the limit for this build" });
    const admin = run({ plan: plan("approved", { briefLogo: true }), jobs: [b], role: "admin" });
    expect(admin).toMatchObject({ waitingOn: "Nick", nextLine: "Ask Nick to raise the limit for this build" });
  });
  it("a build that never reported (stale) is stopped, not running", () => {
    const b = job("build_plan", "running", { min: 600 });
    expect(run({ plan: plan("approved", { briefLogo: true }), jobs: [b] })).toMatchObject({ step: 3, tone: "stop" });
  });
  it("a resume of this plan's run is its newest build", () => {
    const first = job("build_plan", "failed", { min: 30, id: "first", result: { status: "failed_verification", planId: PLAN, workflowRunId: RUN } });
    const resume = job("resume", "running", { min: 2, id: "resume", params: { workflowRunId: RUN } });
    expect(latestBuild(PLAN, [first, resume])?.id).toBe("resume");
    expect(run({ plan: plan("approved", { briefLogo: true }), jobs: [first, resume] })).toMatchObject({ step: 3, tone: "run" });
  });
});

describe("4 Ready for approval, 5 Live", () => {
  const passed = job("build_plan", "succeeded", { result: { status: "awaiting_launch_approval", planId: PLAN, cycles: 2 } });
  it("every check passed: the owner decides", () => {
    expect(run({ plan: plan("approved", { briefLogo: true }), jobs: [passed] })).toMatchObject({ step: 4, state: "ready", tone: "need", waitingOn: "you", sentence: "Every check passed. Your call.", nextAction: { label: "Review the finished site" } });
    expect(run({ plan: plan("approved", { briefLogo: true }), jobs: [passed], role: "admin" })).toMatchObject({ waitingOn: "Nick" });
  });
  it("approved (only once a recorded approval exists): record that it is live, which never publishes", () => {
    const p = run({ plan: plan("approved", { briefLogo: true }), jobs: [passed], siteApprovedAt: ago(5) });
    expect(p).toMatchObject({ step: 4, state: "approved", tone: "done", waitingOn: "a person launching it", nextAction: { label: "Record that it is live", action: "record-live" } });
  });
  it("Live only when the project reached the launch stage", () => {
    expect(run({ plan: plan("approved", { briefLogo: true }), jobs: [passed], project: { stage: "7_qa_security" } })).toMatchObject({ step: 4 });
    expect(run({ plan: plan("approved", { briefLogo: true }), jobs: [passed], project: { stage: "8_launch" } })).toMatchObject({ step: 5, state: "live", tone: "done", waitingOn: "nobody", sentence: "Launched by a person, outside the Cockpit." });
  });
});

describe("strip and words", () => {
  it("done cells say what happened, the current cell where it stands, later cells 'Not yet.'", () => {
    const b = job("build_plan", "succeeded", { result: { status: "awaiting_launch_approval", planId: PLAN, cycles: 3 } });
    const pl = plan("approved", { briefLogo: true });
    const p = run({ plan: pl, jobs: [b], inputs: [input("phone", "1"), input("quotes", null, true)] });
    const s = stripSteps(p, pl, { receivedAt: "2026-10-14T05:00:00Z" });
    expect(s.map((c) => c.line)).toEqual(["Received 14 Oct.", "Approved as a Fast local site.", "0 supplied, 0 left out on purpose.", "Every check passed after 2 rounds of fixes.", "Every check passed. Your call.", "Not yet."]);
    expect(s[2]!.usual).toBe("Depends on the client");
    expect(s[3]!.usual).toBe(""); // minutes only from past runs
  });
  it("names missing details in plain words", () => {
    expect(missingWords([])).toBe("");
    expect(missingWords([{ key: "asset.logo", label: "Logo", hint: "", multiline: false, why: "", kind: "file" }])).toBe("the logo");
  });
  it("never puts engineering words on screen", () => {
    const b = (status: JobRow["status"], result: Record<string, unknown>) => job("build_plan", status, { result: { planId: PLAN, ...result } });
    const cases = [
      run({}),
      run({ plan: plan("pending") }),
      run({ plan: plan("approved", { questions: ["Q"] }) }),
      run({ plan: plan("approved", { briefLogo: true }), jobs: [b("running", {})] }),
      run({ plan: plan("approved", { briefLogo: true }), jobs: [b("failed", { status: "failed_verification", cycles: 3 })] }),
      run({ plan: plan("approved", { briefLogo: true }), jobs: [b("succeeded", { status: "awaiting_launch_approval" })] }),
    ];
    for (const p of cases) for (const t of [p.sentence, p.nextLine, p.nextAction.label, p.clientNext, p.chipWord]) expect(t).not.toMatch(/\bplan\b|\bjob\b|run id|track [AB]|entity|needs_input|token|\bsha\b|claude-|gpt-|gemini|hermes/i);
  });
});
