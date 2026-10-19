/**
 * Every other work page (Cockpit v2, Package 4 R1): a request that never started, a cancelled one, running work that is
 * not a build (a proposal being written, a question), an older passing build, an archived one, and a stopped build that a
 * later build already fixed. Each shows a chip, a
 * title and at most one primary; "Start again", "Close it", "Archive" and "Unarchive" stay as quiet buttons calling the same
 * database functions; Technical details is a <details>, closed in Simple and open in Detailed; no engineering words
 * outside it. SYNTHETIC rows only (src/test/fake.ts plus jobs made here).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { createFake, fixtures, JOB_FAILED, JOB_STUCK, JOB_VERIFIED, OWNER_ID, PLAN_APPROVED } from "../test/fake";
import type { Role } from "../lib/model";

const h = vi.hoisted(() => ({ fake: null as unknown as ReturnType<typeof import("../test/fake").createFake> }));
vi.mock("../supabaseClient", () => ({
  get supabase() {
    return h.fake.client;
  },
}));

import { SignedIn } from "../App";

const T = { timeout: 3000 };
const WORK = "88888888-8888-4888-8888-888888888888";
const NEWER = "99999999-9999-4999-8999-999999999999";
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
// Words that must never be on screen outside Technical details (brief §8).
const BANNED = /\b(plan|plans|job|jobs|run|runs|track [AB]|entity|needs_input|tokens?|sha|github|workflow|claude-\S*|gpt-\S*|gemini|hermes|agent \d+)\b/i;

type Rows = ReturnType<typeof fixtures>;
const running = (kind: string, params: Record<string, unknown>) => ({ id: WORK, created_at: ago(2), kind, params, status: "running", started_at: ago(1), finished_at: null, result: null, error: null, gh_run_url: null, archived_at: null });

const STATES = {
  stuck: () => {},
  cancelled: (f: Rows) => {
    f.jobs = f.jobs.map((j) => (j.id === JOB_STUCK ? { ...j, status: "cancelled", finished_at: ago(2900), error: "Started a new one instead" } : j));
  },
  intake: (f: Rows) => {
    f.jobs = [...f.jobs, running("intake", { clientSlug: "summit-line-roofing" })];
  },
  ask: (f: Rows) => {
    f.jobs = [...f.jobs, running("ask", { planId: PLAN_APPROVED, question: "Can the contact page show opening hours?" })];
  },
  older: (f: Rows) => {
    const first = f.jobs.find((j) => j.id === JOB_VERIFIED)!;
    f.jobs = [...f.jobs, { ...first, id: NEWER, created_at: ago(20), started_at: ago(19), finished_at: ago(15) }];
  },
  superseded: () => {},
  archived: (f: Rows) => {
    f.jobs = f.jobs.map((j) => (j.id === JOB_VERIFIED ? { ...j, archived_at: ago(30) } : j));
  },
};
type State = keyof typeof STATES;
const PAGE: Record<State, string> = { stuck: JOB_STUCK, cancelled: JOB_STUCK, intake: WORK, ask: WORK, older: JOB_VERIFIED, archived: JOB_VERIFIED, superseded: JOB_FAILED };

function start(state: State, role: Role = "owner") {
  const f = fixtures();
  STATES[state](f);
  h.fake = createFake(f);
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={[`/activity/${PAGE[state]}`]}>
      <SignedIn me={{ userId: OWNER_ID, email: "owner@example.test", role, fullName: "Test Owner" }} />
    </MemoryRouter>,
  );
  return { user, calls: () => h.fake.calls };
}

const page = () => screen.getByRole("article");
const primaries = () => [...page().querySelectorAll("button, a")].filter((b) => b.classList.contains("primary"));
/** The page's words, with every <details> (Technical details) taken out. */
function wordsOutsideDetails(): string {
  const copy = page().cloneNode(true) as HTMLElement;
  copy.querySelectorAll("details").forEach((d) => d.remove());
  return copy.textContent ?? "";
}

afterEach(() => {
  localStorage.clear();
});

describe("the other work pages: chip, title, at most one primary, plain words", () => {
  const cases: [State, RegExp | string, string, string | null][] = [
    ["stuck", "This request never started", "Never started", null],
    ["cancelled", "This request was cancelled", "Cancelled", null],
    ["intake", "Working on it", "Running", null],
    ["ask", "Finding the answer", "Running", null],
    ["older", /build passed every check$/, "Every check passed", "Open the newest build"],
    ["archived", /build passed every check$/, "Every check passed", null],
    ["superseded", "Build stopped: the site builder is out of credits", "Build stopped", "Open the later build"],
  ];
  for (const [state, title, chip, primary] of cases) {
    it(`${state}: "${chip}", its title, ${primary ? `one primary ("${primary}")` : "no primary"}, no banned words outside Technical details`, async () => {
      start(state);
      expect(await screen.findByRole("heading", { level: 1, name: title }, T)).toBeInTheDocument();
      expect(within(page().querySelector("header")!).getByText(chip)).toBeInTheDocument();
      const p = primaries();
      expect(p.length).toBeLessThanOrEqual(1);
      if (primary) expect(p.map((b) => b.textContent)).toEqual([primary]);
      else expect(p).toHaveLength(0);
      expect(wordsOutsideDetails()).not.toMatch(BANNED);
      expect(screen.queryByRole("button", { name: /publish|deploy|launch the site/i })).toBeNull();
    });
  }

  it("a request that never started lists only what its record holds, in v2 step rows", async () => {
    start("stuck");
    const steps = await screen.findByRole("list", { name: "What the factory did" }, T);
    const rows = [...steps.querySelectorAll(":scope > li")];
    expect(rows.map((r) => r.querySelector(".steprow-title")?.textContent)).toEqual(["Requested", "Never reached the factory worker"]);
    expect(rows[1]).toHaveClass("steprow-stop");
  });

  it("running work that is not a build says it is working, and the question asked is quoted", async () => {
    start("ask");
    expect(await screen.findByText(/You asked: “Can the contact page show opening hours\?”/, {}, T)).toBeInTheDocument();
    expect(screen.getByText("Working")).toBeInTheDocument();
  });

  it("an older passing build points to the newest one", async () => {
    start("older");
    expect(await screen.findByText(/A newer build of this site passed every check/, {}, T)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the newest build" })).toHaveAttribute("href", `/activity/${NEWER}`);
  });
});

describe("the quiet actions call the same database functions as before", () => {
  it("Start again asks the dispatcher to start the request", async () => {
    const t = start("stuck");
    const again = await screen.findByRole("button", { name: "Start again" }, T);
    expect(again).toHaveClass("quiet");
    await t.user.click(again);
    expect(t.calls()).toContainEqual({ op: "invoke", name: "dispatch-job", args: { body: { jobId: JOB_STUCK } } });
  });

  it("Close it confirms with a reason, then calls cancel_job", async () => {
    const t = start("stuck");
    const close = await screen.findByRole("button", { name: "Close it" }, T);
    expect(close).toHaveClass("quiet");
    await t.user.click(close);
    expect(t.calls().some((c) => c.name === "cancel_job")).toBe(false);
    const dialog = await screen.findByRole("alertdialog", {}, T);
    await t.user.type(within(dialog).getByLabelText("Reason"), "Not needed any more");
    await t.user.click(within(dialog).getByRole("button", { name: "Close request" }));
    expect(t.calls()).toContainEqual({ op: "rpc", name: "cancel_job", args: { p_job_id: JOB_STUCK, p_reason: "Not needed any more" } });
  });

  it("Archive puts an older passing build away (archive_job, true); nothing is deleted", async () => {
    const t = start("older");
    const archive = await screen.findByRole("button", { name: "Archive" }, T);
    expect(archive).toHaveClass("quiet");
    await t.user.click(archive);
    expect(t.calls()).toContainEqual({ op: "rpc", name: "archive_job", args: { p_job_id: JOB_VERIFIED, p_archived: true } });
    expect(t.calls().some((c) => c.op === "update" && c.table === "jobs")).toBe(false);
  });

  it("Unarchive brings an archived build back (archive_job, false)", async () => {
    const t = start("archived");
    expect(await screen.findByText(/Hidden from Activity and Home since/, {}, T)).toBeInTheDocument();
    await t.user.click(screen.getByRole("button", { name: "Unarchive" }));
    expect(t.calls()).toContainEqual({ op: "rpc", name: "archive_job", args: { p_job_id: JOB_VERIFIED, p_archived: false } });
  });
});

describe("Technical details", () => {
  it("is a <details>, closed in Simple, holding the ids with copy buttons and the raw reason", async () => {
    start("cancelled");
    await screen.findByRole("heading", { level: 1, name: "This request was cancelled" }, T);
    const tech = page().querySelector("details.tech") as HTMLDetailsElement;
    expect(tech).not.toBeNull();
    expect(tech.open).toBe(false);
    expect(within(tech).getByText(JOB_STUCK)).toBeInTheDocument();
    expect(within(tech).getByText(PLAN_APPROVED)).toBeInTheDocument();
    expect(within(tech).getAllByRole("button", { name: "Copy", hidden: true }).length).toBeGreaterThanOrEqual(2);
    expect(within(tech).getByText("Started a new one instead", { selector: "pre" })).toBeInTheDocument();
  });

  it("is open in Detailed", async () => {
    localStorage.setItem("cockpit-detail", "detailed");
    start("cancelled");
    await screen.findByRole("heading", { level: 1, name: "This request was cancelled" }, T);
    expect((page().querySelector("details.tech") as HTMLDetailsElement).open).toBe(true);
  });
});
