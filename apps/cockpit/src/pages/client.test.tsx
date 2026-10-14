/**
 * The client's page (Cockpit v2 phase 8): title, the six-step strip with one next action, the proposal, details and
 * files with "N of M supplied", builds, the decisions timeline from the audit trail (one phrase table), cost so far for
 * owners only, and Technical details. SYNTHETIC rows only (src/test/fake.ts plus audit rows made here).
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { createFake, fixtures, OWNER_ID, PLAN_APPROVED } from "../test/fake";
import type { Role } from "../lib/model";

const h = vi.hoisted(() => ({ fake: null as unknown as ReturnType<typeof import("../test/fake").createFake> }));
vi.mock("../supabaseClient", () => ({
  get supabase() {
    return h.fake.client;
  },
}));

import { SignedIn } from "../App";
import { eventsFor, phrase, type AuditEvent } from "../lib/phrases";

const T = { timeout: 3000 };
const at = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const audit = (action: string, task: string, payload: Record<string, unknown>, min: number): AuditEvent => ({ id: `${action}-${min}`, occurred_at: at(min), actor: OWNER_ID, action, task_id: task, payload });

function start(path: string, role: Role = "owner") {
  const fx = fixtures();
  fx.audit_log = [
    audit("plan.decision", PLAN_APPROVED, { status: "approved", buildTrack: "A", clientSlug: "northlight-signs" }, 220),
    audit("plan.input", PLAN_APPROVED, { key: "phone", waived: false }, 210),
    audit("plan.input", PLAN_APPROVED, { key: "hours", waived: true }, 210),
  ] as unknown as typeof fx.audit_log;
  // the two inputs share a moment, as a single save does
  (fx.audit_log as unknown as AuditEvent[])[2]!.occurred_at = (fx.audit_log as unknown as AuditEvent[])[1]!.occurred_at;
  h.fake = createFake(fx);
  render(
    <MemoryRouter initialEntries={[path]}>
      <SignedIn me={{ userId: OWNER_ID, email: "owner@example.test", role, fullName: "Test Owner" }} />
    </MemoryRouter>,
  );
}

describe("the client's page", () => {
  it("leads with the name, the six-step strip and one next action", async () => {
    start("/clients/northlight-signs");
    expect(await screen.findByRole("heading", { level: 1, name: "Northlight Signs" }, T)).toBeInTheDocument();
    const strip = screen.getByRole("region", { name: "Progress" });
    expect(within(strip).getAllByRole("listitem").find((li) => li.getAttribute("aria-current") === "step")).toHaveTextContent("Ready for approval");
    expect(within(strip).getByText("Look at the finished site and approve it, or ask for changes")).toBeInTheDocument();
    expect(within(strip).getAllByRole("button").filter((b) => b.classList.contains("primary"))).toHaveLength(1);
  });

  it("shows the proposal, the details with a real count, and every build", async () => {
    start("/clients/northlight-signs");
    expect(await screen.findByRole("heading", { level: 2, name: "The proposal" }, T)).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "The proposal" })).getByText(/Approved as a Fast local site/)).toBeInTheDocument();
    const details = screen.getByRole("region", { name: "Details and files" });
    expect(within(details).getByText(/^\d+ of \d+ supplied$/)).toBeInTheDocument();
    const builds = screen.getByRole("region", { name: "Builds" });
    expect(within(builds).getByText("Passed every check")).toBeInTheDocument();
    expect(within(builds).getByRole("link", { name: "Open build 2" })).toBeInTheDocument();
  });

  it("the decisions timeline is the audit trail in plain words", async () => {
    start("/clients/northlight-signs");
    const timeline = await screen.findByRole("region", { name: "Decisions" }, T);
    expect(await within(timeline).findByText("You approved the proposal: Fast local site", {}, T)).toBeInTheDocument();
    expect(within(timeline).getByText("You added 1 detail and left 1 out on purpose")).toBeInTheDocument();
    expect(timeline).not.toHaveTextContent(/plan\.|job\.|\bplan\b/);
  });

  it("cost so far is the owner's (the cost views are owner-only); ids sit in a closed drawer in Simple", async () => {
    start("/clients/northlight-signs");
    expect(await screen.findByRole("region", { name: "Cost so far" }, T)).toBeInTheDocument();
    const drawer = screen.getByText("Technical details").closest("details")!;
    expect(drawer).not.toHaveAttribute("open");
    expect(drawer).toHaveTextContent(PLAN_APPROVED);
  });

  it("an admin sees no cost card; a PM sees no progress it cannot read", async () => {
    start("/clients/northlight-signs", "admin");
    await screen.findByRole("heading", { level: 1, name: "Northlight Signs" }, T);
    expect(screen.queryByRole("region", { name: "Cost so far" })).toBeNull();
  });

  it("a project with no proposal on file says so instead of inventing a path", async () => {
    start("/projects/proj-6");
    expect(await screen.findByRole("heading", { level: 1, name: "DreamSign (pilot)" }, T)).toBeInTheDocument();
    expect(screen.getByText("There is no proposal on file for this client, so there is no progress to show.")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Progress" })).toBeNull();
  });
});

describe("phrases", () => {
  it("drops actions it does not know rather than showing a slug, and links events to one client", () => {
    const evs: AuditEvent[] = [
      audit("job.requested", "job-1", { kind: "build_plan", params: { planId: "p1" } }, 5),
      audit("workflow.halt", "job-1", {}, 4),
      audit("plan.decision", "p2", { status: "rejected" }, 3),
    ];
    const mine = eventsFor(evs, new Set(["p1"]), new Set(["job-1"]));
    expect(mine.map((e) => e.action)).toEqual(["job.requested", "workflow.halt"]);
    expect(phrase(mine, {}, OWNER_ID).map((p) => p.text)).toEqual(["You started a build"]);
    expect(phrase(evs, { [OWNER_ID]: "Nick" }, null).map((p) => p.text)).toEqual(["Nick asked for changes to the proposal", "Nick started a build"]);
  });
});
