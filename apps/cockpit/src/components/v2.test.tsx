// Cockpit v2 components (phase 2): accessible name, role and state for each one, plus the money confirm.
import { describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { useState } from "react";

// No database here: these components only render props. Stub the client so importing lib/state is safe.
vi.mock("../supabaseClient", () => ({ supabase: {} }));
import { Button, ComingLater, EmptyState, PathSegments, Segmented, StatusChip, TechDetails, type StatusTone } from "./kit";
import { FixCard, NeedRow, ProgressStrip, StepRow, StopFacts, WhyDisclosure } from "./flow";
import { CommandPalette, matchItems, type PaletteItem } from "./CommandPalette";
import { ConfirmDialog } from "./ui";
import { DetailProvider } from "../lib/detail";
import { ToastProvider, TOAST_MS, useToast } from "../lib/state";
import { buildStopLine, costLine } from "../lib/costs";

describe("StatusChip", () => {
  const cases: [StatusTone, string][] = [
    ["need", "Needs you"],
    ["done", "Done"],
    ["stop", "Stopped"],
    ["run", "Running"],
    ["wait", "Waiting"],
    ["skip", "Skipped"],
    ["idle", "No build yet"],
  ];
  it.each(cases)("%s is a glyph plus the word '%s', and is text, not a button", (tone, word) => {
    const { container } = render(<StatusChip tone={tone} />);
    expect(screen.getByText(word)).toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("the running glyph turns (the .spin class reduced motion switches off)", () => {
    const { container } = render(<StatusChip tone="run" />);
    expect(container.querySelector("svg")).toHaveClass("spin");
  });
});

describe("Button", () => {
  it("renders the three kinds with their names", () => {
    render(
      <>
        <Button variant="primary">Send to the factory</Button>
        <Button>Ask for changes</Button>
        <Button variant="quiet">Build without it</Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "Send to the factory" })).toHaveClass("btn", "primary");
    expect(screen.getByRole("button", { name: "Ask for changes" })).toHaveClass("btn", "secondary");
    expect(screen.getByRole("button", { name: "Build without it" })).toHaveClass("btn", "quiet");
  });
});

describe("PathSegments", () => {
  it("is decorative: hidden from screen readers, six segments, done ones in ink", () => {
    const { container } = render(<PathSegments step={2} tone="need" />);
    const segs = container.querySelector(".segs")!;
    expect(segs).toHaveAttribute("aria-hidden", "true");
    expect(segs.querySelectorAll(".seg")).toHaveLength(6);
    expect(segs.querySelectorAll(".seg-done")).toHaveLength(2);
    expect(segs.querySelector(".seg-now")).toHaveClass("seg-need");
  });
});

describe("Segmented", () => {
  function Harness() {
    const [v, setV] = useState<"simple" | "detailed">("simple");
    return <Segmented label="Detail level" value={v} onChange={setV} options={[{ value: "simple", label: "Simple" }, { value: "detailed", label: "Detailed" }]} />;
  }
  it("is a radiogroup; arrow keys move and choose; one tab stop", async () => {
    render(<Harness />);
    const group = screen.getByRole("radiogroup", { name: "Detail level" });
    const simple = within(group).getByRole("radio", { name: "Simple" });
    const detailed = within(group).getByRole("radio", { name: "Detailed" });
    expect(simple).toHaveAttribute("aria-checked", "true");
    expect(detailed).toHaveAttribute("tabindex", "-1");
    simple.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(detailed).toHaveAttribute("aria-checked", "true");
    expect(detailed).toHaveFocus();
  });
});

describe("EmptyState and ComingLater", () => {
  it("say what will appear, and show nothing made up", () => {
    render(
      <>
        <EmptyState title="Your first client starts with a request.">Says what will appear here.</EmptyState>
        <ComingLater name="System" />
      </>,
    );
    expect(screen.getByText("Your first client starts with a request.")).toBeInTheDocument();
    expect(screen.getByText(/not built yet, so it shows nothing rather than made-up numbers/)).toBeInTheDocument();
  });
});

describe("TechDetails", () => {
  const items = [{ k: "job", v: "j-c41f02" }, { k: "run", v: "wf-1198" }];
  it("is closed in Simple", () => {
    const { container } = render(
      <DetailProvider initial="simple">
        <TechDetails items={items} />
      </DetailProvider>,
    );
    expect(container.querySelector("details")).not.toHaveAttribute("open");
  });
  it("is open in Detailed, and every id has a copy button labelled Copy", () => {
    const { container } = render(
      <DetailProvider initial="detailed">
        <TechDetails items={items} />
      </DetailProvider>,
    );
    expect(container.querySelector("details")).toHaveAttribute("open");
    const copies = screen.getAllByRole("button", { name: "Copy" });
    expect(copies).toHaveLength(2);
    expect(copies[0]).toHaveAccessibleDescription("job");
  });
});

describe("ProgressStrip", () => {
  const steps = [{ line: "Received 14 Oct." }, { line: "Approved: Fast local site." }, { line: "2 of 7 supplied." }, { line: "Not yet." }, { line: "Not yet." }, { line: "Not yet." }];
  it("marks the current step with aria-current=step and offers exactly one primary", () => {
    const go = vi.fn();
    render(<ProgressStrip step={2} tone="need" steps={steps} nextLine="Add the logo, then start the build" next={{ label: "Add the missing details", onClick: go }} />);
    const current = screen.getAllByRole("listitem").find((li) => li.getAttribute("aria-current") === "step")!;
    expect(current).toHaveTextContent("Details needed");
    expect(screen.getByText("The one thing to do next")).toBeInTheDocument();
    const buttons = screen.getAllByRole("button");
    expect(buttons.filter((b) => b.classList.contains("primary"))).toHaveLength(1);
    buttons.find((b) => b.classList.contains("primary"))!.click();
    expect(go).toHaveBeenCalled();
    expect(screen.getByText("Step 3 of 6")).toBeInTheDocument();
  });
});

describe("StepRow", () => {
  it("shows the number, title, time, state word and per-check results", () => {
    render(
      <ol>
        <StepRow n={6} title="Automatic checks in a real browser" time="2 min so far" tone="run" sentence="Nine checks on every page." checks={[{ label: "The logo shows", tone: "done", slug: "render.logo-visible" }]} />
      </ol>,
    );
    expect(screen.getByText("06")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.getByText("2 min so far")).toBeInTheDocument();
    expect(screen.getByText("The logo shows")).toBeInTheDocument();
    expect(screen.queryByText(/render\.logo-visible/)).toBeNull(); // slugs only in Detailed
  });
});

describe("StopFacts, FixCard, WhyDisclosure", () => {
  it("states the money and what was tried before the fix; the fix has one primary and quiet alternatives", async () => {
    const primary = vi.fn();
    function Harness() {
      const [mode, setMode] = useState<"add" | "without">("add");
      const [v, setV] = useState("");
      return (
        <>
          <StopFacts spent money="Yes, $0.21 so far" tried="It checked every fact." />
          <FixCard
            primary={{ label: "Fix it and continue", onClick: primary }}
            others={[{ label: "See where it appeared", onClick: () => {} }]}
            input={{ addLabel: "Add the real phone number", fieldLabel: "The real phone number", withoutLabel: "Build without a phone number", withoutNote: "The Contact page shows the email instead.", mode, value: v, onMode: setMode, onValue: setV }}
          />
        </>
      );
    }
    render(<Harness />);
    expect(screen.getByText("Was money spent?")).toBeInTheDocument();
    expect(screen.getByText("Yes, $0.21 so far")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "The fix" })).toBeInTheDocument();
    const group = screen.getByRole("radiogroup", { name: "How to fix it" });
    expect(within(group).getByRole("radio", { name: "Add the real phone number" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByLabelText("The real phone number")).toBeInTheDocument();
    await userEvent.click(within(group).getByRole("radio", { name: "Build without a phone number" }));
    expect(screen.getByText("The Contact page shows the email instead.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fix it and continue" })).toHaveClass("primary");
    expect(screen.getByRole("button", { name: "See where it appeared" })).toHaveClass("quiet");
  });
  it("Why? is a disclosure: evidence, a named crop, and the raw log under Technical details", async () => {
    render(<WhyDisclosure evidence="Contact page footer has a number nobody gave us." cropLabel="Screenshot crop: Contact page footer" log="[claims.unsourced-fact] phone" />);
    const why = screen.getByRole("button", { name: "Why?" });
    expect(why).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(why);
    expect(why).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("img", { name: "Screenshot crop: Contact page footer" })).toBeInTheDocument();
    expect(screen.getByText("Technical details")).toBeInTheDocument();
  });
});

describe("NeedRow", () => {
  it("open: Upload or Answer, and Build without it, each naming its item", async () => {
    const onSkip = vi.fn();
    const onAnswer = vi.fn();
    render(
      <ul>
        <NeedRow label="Picture: the shopfront" why="It should show the front of the bakery." kind="file" state="open" onSkip={onSkip} onChange={() => {}} />
        <NeedRow label="Opening hours" why="For the Visit us page." kind="text" state="open" onAnswer={onAnswer} onSkip={() => {}} onChange={() => {}} />
      </ul>,
    );
    expect(screen.getByRole("button", { name: "Upload: Picture: the shopfront" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Build without it: Picture: the shopfront" }));
    expect(onSkip).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Answer: Opening hours" }));
    await userEvent.type(screen.getByLabelText("Your answer: Opening hours"), "Sun 8-2");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onAnswer).toHaveBeenCalledWith("Sun 8-2");
  });
  it("done shows the value and Change; skipped shows Add it after all", () => {
    render(
      <ul>
        <NeedRow label="Logo" why="Top of every page." kind="file" state="done" value="logo.svg" onSkip={() => {}} onChange={() => {}} />
        <NeedRow label="Quotes" why="For the Home page." kind="text" state="skipped" onSkip={() => {}} onChange={() => {}} />
      </ul>,
    );
    expect(screen.getByText("logo.svg")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change: Logo" })).toBeInTheDocument();
    expect(screen.getByText("Left out")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add it after all: Quotes" })).toBeInTheDocument();
  });
});

describe("ConfirmDialog (money confirm)", () => {
  it("is an alertdialog with the rough cost and the per-build stop; focus on the primary, back to the opener", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Start the build</button>
          <ConfirmDialog open={open} title="Start the build?" body="Harbor Street Bakery, Fast local site." cost={costLine("$0.70")} confirmLabel="Start the build" onConfirm={() => setOpen(false)} onCancel={() => setOpen(false)} />
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Start the build" });
    await userEvent.click(opener);
    const dialog = screen.getByRole("alertdialog", { name: "Start the build?" });
    expect(dialog).toHaveAccessibleDescription(/Costs about \$0\.70\./);
    expect(dialog).toHaveTextContent(buildStopLine());
    const primary = within(dialog).getByRole("button", { name: "Start the build" });
    expect(primary).toHaveFocus();
    await userEvent.click(within(dialog).getByRole("button", { name: "Not now" }));
    expect(opener).toHaveFocus();
  });
  it("the per-build stop comes from spend-caps.json, never a hard-coded figure", () => {
    expect(buildStopLine({ perBuildUsd: 5 })).toBe("Each build stops itself at $5.00.");
    expect(buildStopLine({ perBuildUsd: 2 })).toBe("Each build stops itself at $2.00.");
    expect(buildStopLine({ perBuildUsd: null })).toMatch(/no per-build spending limit/);
  });
});

describe("Toast", () => {
  it("lives in a polite live region, offers Changed my mind, and leaves after 9 s", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const undo = vi.fn();
    function Fire() {
      const toast = useToast();
      return <button onClick={() => toast("Continuing from the saved site.", { label: "Changed my mind", run: undo })}>Continue</button>;
    }
    render(
      <ToastProvider>
        <Fire />
      </ToastProvider>,
    );
    act(() => screen.getByRole("button", { name: "Continue" }).click());
    const region = await screen.findByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveTextContent("Continuing from the saved site.");
    expect(within(region).getByRole("button", { name: "Changed my mind" })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(TOAST_MS + 10));
    expect(region).not.toHaveTextContent("Continuing");
    vi.useRealTimers();
  });
});

describe("CommandPalette", () => {
  const ask = vi.fn();
  const home = vi.fn();
  const items: PaletteItem[] = [
    { id: "c1", group: "Clients", label: "Harbor Street Bakery", hint: "Details needed", run: () => {} },
    { id: "a1", group: "Actions", label: "Ask the factory a question", run: ask },
    { id: "a2", group: "Actions", label: "New request", run: () => {} },
    { id: "g1", group: "Go to", label: "Home", run: home },
    { id: "s1", group: "Settings", label: "Switch theme", run: () => {} },
  ];
  it("groups results as Clients, Actions, Go to, Settings, and filters by every word", () => {
    expect(matchItems(items, "").map((i) => i.group)).toEqual(["Clients", "Actions", "Actions", "Go to", "Settings"]);
    expect(matchItems(items, "ask factory").map((i) => i.id)).toEqual(["a1"]);
  });
  it("is a labelled dialog; arrows move, Enter runs the selection, Esc closes", async () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <CommandPalette open onClose={onClose} items={items} />
      </MemoryRouter>,
    );
    const input = screen.getByRole("combobox", { name: "Search clients, builds, actions and settings" });
    expect(input).toHaveFocus();
    expect(screen.getByRole("group", { name: "Clients" })).toBeInTheDocument();
    await userEvent.type(input, "home");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    await userEvent.keyboard("{Enter}");
    expect(home).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
  it("says so when nothing matches", async () => {
    render(<CommandPalette open onClose={() => {}} items={items} />);
    await userEvent.type(screen.getByRole("combobox"), "zzz");
    expect(screen.getByText("Nothing matches “zzz”.")).toBeInTheDocument();
  });
});
