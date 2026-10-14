/**
 * The stopped build (Cockpit v2 phase 12): the eight cases mapped from diagnoseJob(), the facts, the fix with its money
 * confirm, and the writes (still requestJob and savePlanInputs). SYNTHETIC rows only (src/test/fake.ts plus jobs made here).
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { createFake, fixtures, JOB_FAILED, JOB_VERIFIED, OWNER_ID, PLAN_APPROVED, RUN_FAILED } from "../test/fake";
import type { JobRow } from "../jobsClient";
import type { Role } from "../lib/model";

const h = vi.hoisted(() => ({ fake: null as unknown as ReturnType<typeof import("../test/fake").createFake> }));
vi.mock("../supabaseClient", () => ({
  get supabase() {
    return h.fake.client;
  },
}));

import { SignedIn } from "../App";
import { diagnoseJob } from "../lib/recovery";
import { stopCaseOf } from "../lib/stopCases";

const T = { timeout: 3000 };
const CP = { lastCheckpoint: { path: "clients/x/sites/track-a/site.manifest.json", stage: "build", cycle: 1 } };

function failedJob(result: Record<string, unknown>, error: string | null): JobRow {
  const base = fixtures().jobs.find((j) => j.id === JOB_FAILED)!;
  return { ...base, result: { planId: PLAN_APPROVED, workflowRunId: RUN_FAILED, ...result }, error } as unknown as JobRow;
}

const CASES: { n: number | "factory"; job: JobRow; halt: string | null; fix: string }[] = [
  { n: 1, job: failedJob({ status: "needs_input", preflight: { ok: false, needs: [{ key: "hours", label: "Opening hours", reason: "Shown on Visit us." }] } }, "needs input: hours"), halt: "needs_input", fix: "Save the details and continue" },
  { n: 2, job: failedJob({ status: "failed_verification", qaIssues: ["[claims.unsourced-fact] The phone number 0400 111 222 on contact.html has no source in the brief."], ...CP }, "QA still failing after 2 revision(s)"), halt: "failed_verification", fix: "Fix it and continue" },
  { n: 3, job: failedJob({ status: "qa_failed", ...CP }, "a required review could not run: qa-evaluator no response after 4 attempts"), halt: "qa_failed", fix: "Check again without changes" },
  { n: 4, job: failedJob({ status: "build_failed" }, 'builder escalated: Agent 37 reported failure: HTTP 402: {"error":"AI credits exhausted."}'), halt: "build_failed", fix: "Try again once it is set up" },
  { n: 5, job: failedJob({ status: "failed_verification", cycles: 3, qaIssues: ["[render.perf] LCP 4.1s on /", "[seo.single-h1] /services has two page headings"], ...CP }, "QA still failing after 2 revision(s)"), halt: "failed_verification", fix: "Fix it and continue" },
  { n: 6, job: failedJob({ status: "build_failed", ...CP }, "spend:$5.00 ceiling of $5.00 reached before render.design-review"), halt: "build_failed", fix: "Ask Nick to raise the limit for this build" },
  { n: 7, job: failedJob({ status: "build_failed" }, "runner crashed before recording a result"), halt: "build_failed", fix: "Write the site again from the proposal" },
  { n: 8, job: failedJob({ status: "build_failed", ...CP }, "runner crashed before recording a result"), halt: "build_failed", fix: "Continue from where it stopped" },
  { n: "factory", job: failedJob({ status: "build_failed" }, 'builder escalated: permission denied for role "front-end-builder"'), halt: "build_failed", fix: "Copy a note for Huraira" },
];

describe("the eight stop cases", () => {
  for (const c of CASES) {
    it(`case ${c.n}: ${c.fix}`, () => {
      const sc = stopCaseOf(c.job, diagnoseJob(c.job, [], { planId: PLAN_APPROVED }), c.halt);
      expect(sc.id).toBe(c.n);
      expect(sc.fix).toBe(c.fix);
      expect(sc.title).not.toMatch(/plan|job|run\b|track|needs_input|\$/i);
    });
  }
});

function start(job: JobRow, role: Role = "owner") {
  const fx = fixtures();
  fx.jobs = fx.jobs.filter((j) => j.id !== JOB_VERIFIED).map((j) => (j.id === JOB_FAILED ? (job as unknown as typeof j) : j));
  h.fake = createFake(fx);
  const user = userEvent.setup();
  Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true });
  render(
    <MemoryRouter initialEntries={[`/activity/${JOB_FAILED}`]}>
      <SignedIn me={{ userId: OWNER_ID, email: "owner@example.test", role, fullName: "Test Owner" }} />
    </MemoryRouter>,
  );
  return { user, calls: () => h.fake.calls };
}
const job = (n: number | "factory") => CASES.find((c) => c.n === n)!.job;

describe("the stopped build view", () => {
  it("chip, headline, facts, the checks that still fail, then one primary in The fix", async () => {
    start(job(5));
    expect(await screen.findByRole("heading", { level: 1, name: "The checks still failed after the last round of fixes" }, T)).toBeInTheDocument();
    expect(screen.getByText("Build stopped")).toBeInTheDocument();
    expect(screen.getByText("Northlight Signs · Build 2")).toBeInTheDocument();
    const failed = screen.getByRole("region", { name: "Checks that still fail" });
    expect(within(failed).getByText("Page speed")).toBeInTheDocument();
    expect(within(failed).getByText("Page heading count")).toBeInTheDocument();
    const fix = screen.getByRole("region", { name: "The fix" });
    expect(within(fix).getAllByRole("button").filter((b) => b.classList.contains("primary"))).toHaveLength(1);
    expect(within(fix).getByRole("button", { name: "Check again without changes" })).toBeInTheDocument();
  });

  it("Fix it and continue confirms the cost and the per-build stop first, then reopens the saved build", async () => {
    const t = start(job(5));
    await screen.findByRole("heading", { level: 1 }, T);
    await t.user.click(await screen.findByRole("button", { name: "Fix it and continue" }, T));
    const dlg = await screen.findByRole("alertdialog", {}, T);
    expect(dlg).toHaveTextContent(/Costs less than a new build\. Each build stops itself at \$\d+\.\d\d\./);
    expect(t.calls().some((c) => c.op === "insert")).toBe(false);
    await t.user.click(within(dlg).getByRole("button", { name: "Fix it and continue" }));
    expect(t.calls()).toContainEqual(expect.objectContaining({ op: "insert", table: "jobs", values: expect.objectContaining({ kind: "resume", params: expect.objectContaining({ workflowRunId: RUN_FAILED, reopen: true, fromStep: "revise" }) }) }));
  });

  it("an unsourced phone number: add the real one inline, saved to the plan, then the build continues", async () => {
    const t = start(job(2));
    expect(await screen.findByRole("heading", { level: 1, name: "The checks found a business phone number on the site that nobody gave us" }, T)).toBeInTheDocument();
    const fix = screen.getByRole("region", { name: "The fix" });
    expect(await within(fix).findByRole("radio", { name: "Add the real business phone number" }, T)).toHaveAttribute("aria-checked", "true");
    await t.user.click(within(fix).getByRole("button", { name: "Fix it and continue" }));
    expect(screen.getByText(/Type the real business phone number first/)).toBeInTheDocument();
    await t.user.type(within(fix).getByLabelText("The real business phone number"), "0400 111 222");
    await t.user.click(within(fix).getByRole("button", { name: "Fix it and continue" }));
    await t.user.click(within(await screen.findByRole("alertdialog", {}, T)).getByRole("button", { name: "Fix it and continue" }));
    const inserts = t.calls().filter((c) => c.op === "insert");
    expect(inserts[0]).toEqual(expect.objectContaining({ table: "plan_inputs", values: [expect.objectContaining({ key: "phone", value: "0400 111 222", waived: false })] }));
    expect(inserts[1]).toEqual(expect.objectContaining({ table: "jobs", values: expect.objectContaining({ kind: "resume" }) }));
  });

  it("a spending limit: nothing starts; the primary copies a note for Nick", async () => {
    const t = start(job(6));
    await t.user.click(await screen.findByRole("button", { name: "Ask Nick to raise the limit for this build" }, T));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringMatching(/^Please raise the spending limit/));
    expect(t.calls().some((c) => c.op === "insert")).toBe(false);
  });

  it("out of credit: who acts, and the note for Huraira beside the retry", async () => {
    start(job(4));
    expect(await screen.findByText("Huraira adds credit to the site builder account.", {}, T)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy a note for Huraira" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again once it is set up" })).toBeInTheDocument();
  });

  it("stopped before saving: writing it again is confirmed as about one build", async () => {
    const t = start(job(7));
    await t.user.click(await screen.findByRole("button", { name: "Write the site again from the proposal" }, T));
    expect(await screen.findByRole("alertdialog", {}, T)).toHaveTextContent(/Costs about one build\./);
  });

  it("an admin is told cost is for owners, never a guessed figure; ids stay in Technical details", async () => {
    start(job(8), "admin");
    expect(await screen.findByText("Only owners see what a build cost.", {}, T)).toBeInTheDocument();
    const article = screen.getByRole("article");
    const drawer = within(article).getAllByText("Technical details").at(-1)!.closest("details")!;
    expect(drawer).toHaveTextContent(RUN_FAILED);
    expect(within(article).getByRole("heading", { level: 1 })).not.toHaveTextContent(/build_failed|run|job/);
  });
});
