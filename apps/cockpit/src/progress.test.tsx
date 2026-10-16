/**
 * Build progress UX on the run page: the live step timeline of a running build, and a stopped build's ways to carry on
 * placed at the step it stopped at. SYNTHETIC audit rows, shaped like the engine's (see src/lib/timeline.test.ts).
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { createFake, fixtures, JOB_FAILED, JOB_VERIFIED, OWNER_ID, PLAN_APPROVED, RUN_FAILED } from "./test/fake";

const h = vi.hoisted(() => ({ fake: null as unknown as ReturnType<typeof import("./test/fake").createFake> }));
vi.mock("./supabaseClient", () => ({
  get supabase() {
    return h.fake.client;
  },
}));

import { SignedIn } from "./App";

const T = { timeout: 3000 };
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const JOB_RUNNING = "88888888-8888-4888-8888-888888888888";
const RUN_LIVE = "99999999-9999-4999-8999-999999999999";

function audit(runId: string, min: number, action: string, payload: Record<string, unknown>, taskId: string | null = null) {
  return { run_id: runId, occurred_at: ago(min), action, task_id: taskId, payload };
}

function start(path: string, fx: ReturnType<typeof fixtures>) {
  h.fake = createFake(fx);
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={[path]}>
      <SignedIn me={{ userId: OWNER_ID, email: "owner@example.test", role: "owner", fullName: "Test Owner" }} />
    </MemoryRouter>,
  );
  return { user, calls: () => h.fake.calls };
}

describe("a running build shows where it is", () => {
  it("marks the running step with aria-current, says what it waits on, and is honest about the estimate", async () => {
    const fx = fixtures();
    fx.jobs = [
      ...fx.jobs.filter((j) => j.id !== JOB_FAILED),
      { id: JOB_RUNNING, created_at: ago(9), kind: "build_plan", params: { planId: PLAN_APPROVED }, status: "running", started_at: ago(8), finished_at: null, result: null, error: null, gh_run_url: null, archived_at: null },
    ];
    fx.audit_log = [
      audit(RUN_LIVE, 8, "job.run", { jobId: JOB_RUNNING, kind: "build_plan" }, JOB_RUNNING),
      audit(RUN_LIVE, 8, "workflow.start", { maxQaRevisions: 2, brief: { large: true } }),
      audit(RUN_LIVE, 7.9, "workflow.preflight", { ok: true, needs: [], checks: [] }),
      audit(RUN_LIVE, 7.8, "agent.spawn", { role: "front-end-builder" }),
      audit(RUN_LIVE, 3, "agent.complete", { role: "front-end-builder", attempts: 1, durationMs: 288_000 }),
      audit(RUN_LIVE, 3, "workflow.checkpoint", { stage: "build", cycle: 0 }),
      audit(RUN_LIVE, 2, "agent.spawn", { role: "qa-evaluator" }),
    ];
    start(`/activity/${JOB_RUNNING}`, fx);
    // Cockpit v2: the ten steps in the brief's order, mapped from the run's own rows.
    const steps = await screen.findByRole("list", { name: "Build steps" }, T);
    const current = await within(steps).findByText("Automatic checks in a real browser", {}, T);
    expect(current.closest("li")).toHaveAttribute("aria-current", "step");
    expect(within(current.closest("li")!).getByText("Running")).toBeInTheDocument();
    expect(within(steps).getByText("Writing the site's words and structure").closest("li")).not.toHaveAttribute("aria-current");
    expect(within(steps).getByText("Writing the site's words and structure").closest("li")).toHaveClass("steprow-done");
    expect(within(steps).getByText("Ready for your approval").closest("li")).toHaveClass("steprow-wait");
    // steps the run does not record separately are never shown as done
    expect(within(steps).getByText("Design review of the screenshots").closest("li")).toHaveClass("steprow-wait");
    expect(screen.getByRole("heading", { name: "Now: automatic checks in a real browser" })).toBeInTheDocument();
    expect(await screen.findByText("Not enough past builds to say", {}, T)).toBeInTheDocument();
    // No way to "continue" a build that is still running.
    expect(screen.queryByRole("button", { name: /continue|again/i })).toBeNull();
  });
});

describe("a stopped build offers the right ways on (Cockpit v2 stop view)", () => {
  function failedVerification() {
    const fx = fixtures();
    fx.jobs = fx.jobs
      .filter((j) => j.id !== JOB_VERIFIED)
      .map((j) => (j.id === JOB_FAILED ? { ...j, error: "QA still failing after 2 revision(s)", result: { status: "failed_verification", planId: PLAN_APPROVED, workflowRunId: RUN_FAILED, cycles: 3, qaIssues: [] } } : j));
    fx.audit_log = [
      audit(RUN_FAILED, 179, "workflow.start", { maxQaRevisions: 0 }),
      audit(RUN_FAILED, 178.9, "agent.spawn", { role: "front-end-builder" }),
      audit(RUN_FAILED, 178.5, "agent.complete", { role: "front-end-builder", durationMs: 24_000 }),
      audit(RUN_FAILED, 178.5, "workflow.checkpoint", { stage: "build", cycle: 0 }),
      audit(RUN_FAILED, 178.4, "agent.spawn", { role: "qa-evaluator" }),
      audit(RUN_FAILED, 177.2, "verification.decision", { status: "changes_requested", checks: [{ checkId: "render.perf", passed: false }] }),
      audit(RUN_FAILED, 177.2, "agent.complete", { role: "qa-evaluator", durationMs: 72_000 }),
      audit(RUN_FAILED, 177.1, "workflow.halt", { status: "failed_verification", stage: "qa", cycles: 1 }),
    ];
    return fx;
  }

  it("failed checks: the checks that still fail, Fix it and continue, or Check again without changes (confirmed)", async () => {
    const t = start(`/activity/${JOB_FAILED}`, failedVerification());
    expect(await screen.findByRole("heading", { level: 1, name: "The checks still failed after the last round of fixes" }, T)).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Checks that still fail" })).getByText("Page speed")).toBeInTheDocument();
    const fix = screen.getByRole("region", { name: "The fix" });
    expect(within(fix).getByText(/This saves a full rebuild/)).toBeInTheDocument();
    await t.user.click(within(fix).getByRole("button", { name: "Check again without changes" }));
    const dlg = await screen.findByRole("alertdialog", {}, T);
    expect(dlg).toHaveTextContent(/only the checks run/);
    await t.user.click(within(dlg).getByRole("button", { name: "Check again without changes" }));
    expect(t.calls()).toContainEqual(
      expect.objectContaining({ op: "insert", table: "jobs", values: expect.objectContaining({ kind: "resume", params: expect.objectContaining({ workflowRunId: RUN_FAILED, reopen: true, fromStep: "qa" }) }) }),
    );
  });

  it("Fix it and continue sends the saved site back to the builder (fromStep revise), after the money confirm", async () => {
    const t = start(`/activity/${JOB_FAILED}`, failedVerification());
    await t.user.click(await screen.findByRole("button", { name: "Fix it and continue" }, T));
    expect(t.calls().some((c) => c.op === "insert")).toBe(false);
    await t.user.click(within(await screen.findByRole("alertdialog", {}, T)).getByRole("button", { name: "Fix it and continue" }));
    expect(t.calls()).toContainEqual(expect.objectContaining({ op: "insert", table: "jobs", values: expect.objectContaining({ kind: "resume", params: expect.objectContaining({ fromStep: "revise" }) }) }));
  });

  it("a readiness stop (needs_input) asks for the missing details at the readiness step, the logo upload included", async () => {
    const fx = fixtures();
    fx.jobs = fx.jobs
      .filter((j) => j.id !== JOB_VERIFIED)
      .map((j) => (j.id === JOB_FAILED ? { ...j, error: "needs input: logo, phone", result: { status: "needs_input", planId: PLAN_APPROVED, workflowRunId: RUN_FAILED } } : j));
    fx.audit_log = [
      audit(RUN_FAILED, 179, "workflow.start", { maxQaRevisions: 2 }),
      audit(RUN_FAILED, 178.9, "workflow.preflight", {
        ok: false,
        needs: [
          { key: "asset.logo", label: "Logo file", reason: "The plan uses the client's logo." },
          { key: "phone", label: "Business phone number", reason: "Shown on every page." },
        ],
        checks: [],
      }),
      audit(RUN_FAILED, 178.9, "workflow.halt", { status: "needs_input", stage: "preflight", cycles: 0 }),
    ];
    start(`/activity/${JOB_FAILED}`, fx);
    expect(await screen.findByRole("heading", { level: 1, name: "The site needs details nobody gave us" }, T)).toBeInTheDocument();
    expect(screen.getByText("No money was spent")).toBeInTheDocument();
    const stoppedStep = screen.getByRole("region", { name: "The fix" });
    expect(await within(stoppedStep).findByLabelText("Business phone number", {}, T)).toBeInTheDocument();
    // The logo is uploaded right here (no trip to the plan page), or skipped.
    expect(within(stoppedStep).getByLabelText("Logo file")).toHaveAttribute("type", "file");
    expect(within(stoppedStep).getByLabelText(/build without the logo/)).toBeInTheDocument();
    expect(within(stoppedStep).getByRole("button", { name: "Save the details and continue" })).toBeInTheDocument();
  });
});
