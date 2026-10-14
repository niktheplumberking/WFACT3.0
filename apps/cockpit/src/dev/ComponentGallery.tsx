/**
 * DEV ONLY: the Cockpit v2 components on one page, for screenshots against the Design System page and for axe
 * (`npm run dev`, then open /dev-components.html; ?theme=dark&detail=detailed&axe=1). Not part of the production
 * build: vite builds index.html only, and nothing in src imports this. Every value here is SYNTHETIC, taken from
 * the design's own examples.
 */
import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import "@fontsource-variable/newsreader/opsz.css";
import "@fontsource-variable/newsreader/opsz-italic.css";
import "@fontsource/atkinson-hyperlegible-next/latin-400.css";
import "@fontsource/atkinson-hyperlegible-next/latin-600.css";
import "@fontsource/atkinson-hyperlegible-next/latin-700.css";
import "@fontsource/overpass-mono/latin-500.css";
import "@fontsource/overpass-mono/latin-600.css";
import "../styles/tokens.css";
import "../styles/app.css";
import { ArrowRight, House, Plus, Question, SquaresFour, Rows, SunDim } from "@phosphor-icons/react";
import { Button, ComingLater, EmptyState, PathSegments, Segmented, StatusChip, TechDetails, TONE_WORD, type StatusTone } from "../components/kit";
import { FixCard, NeedRow, ProgressStrip, StepRow, StopFacts, WhyDisclosure, type NeedState } from "../components/flow";
import { CommandPalette, type PaletteItem } from "../components/CommandPalette";
import { ConfirmDialog } from "../components/ui";
import { DetailProvider, useDetail, type Detail } from "../lib/detail";
import { ToastProvider, useToast } from "../lib/state";
import { costLine } from "../lib/costs";
import { DEFAULT_APPEARANCE, applyAppearance, normalise } from "../lib/appearance";

const q = new URLSearchParams(location.search);
applyAppearance(normalise({ ...DEFAULT_APPEARANCE, ...Object.fromEntries(q), textSize: Number(q.get("textSize") ?? 100), reduceMotion: q.get("reduceMotion") === "true" }));

const TONES: StatusTone[] = ["need", "done", "stop", "run", "wait", "skip", "idle"];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="gallery-section" aria-label={title}>
      <h2 className="t-label">{title}</h2>
      {children}
    </section>
  );
}

function Gallery() {
  const toast = useToast();
  const { detail, setDetail, detailed } = useDetail();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [confirm, setConfirm] = useState(false);
  const [palette, setPalette] = useState(false);
  const [mode, setMode] = useState<"add" | "without">("add");
  const [phone, setPhone] = useState("");
  const [needs, setNeeds] = useState<Record<string, NeedState>>({ shop: "open", hours: "open", logo: "done", quotes: "skipped" });
  const setNeed = (k: string, s: NeedState) => setNeeds((n) => ({ ...n, [k]: s }));
  const items: PaletteItem[] = [
    { id: "c1", group: "Clients", label: "Harbor Street Bakery", hint: "Details needed", run: () => {} },
    { id: "a1", group: "Actions", label: "New request", icon: Plus, hint: "N", run: () => {} },
    { id: "a2", group: "Actions", label: "Ask the factory a question", icon: Question, run: () => toast("Asked the factory. The answer arrives in Activity.") },
    { id: "g1", group: "Go to", label: "Home", icon: House, hint: "G H", run: () => {} },
    { id: "s1", group: "Settings", label: "Switch theme", icon: SunDim, run: () => {} },
  ];
  return (
    <main className="gallery">
      <header>
        <p className="t-eyebrow">Dev only · synthetic content</p>
        <h1 className="t-title">Cockpit v2 components</h1>
      </header>

      <Section title="Buttons">
        <div className="row-actions">
          <Button variant="primary" size="page" iconAfter={ArrowRight}>
            Primary · one per view
          </Button>
          <Button size="page">Secondary</Button>
          <Button variant="quiet">Quiet alternative</Button>
          <Button size="page" disabled>
            Disabled, with a reason nearby
          </Button>
        </div>
      </Section>

      <Section title="Status chips">
        <div className="row-actions">
          {TONES.map((t) => (
            <StatusChip key={t} tone={t} />
          ))}
        </div>
        <p className="muted">Words: {TONES.map((t) => TONE_WORD[t]).join(", ")}.</p>
      </Section>

      <Section title="Path segments">
        <div className="gallery-segs">
          <PathSegments step={2} tone="need" />
          <PathSegments step={3} tone="run" />
          <PathSegments step={3} tone="stop" />
        </div>
      </Section>

      <Section title="Segmented">
        <div className="row-actions">
          <Segmented label="Detail level" value={detail} onChange={(d: Detail) => setDetail(d)} options={[{ value: "simple", label: "Simple" }, { value: "detailed", label: "Detailed" }]} />
          <Segmented label="View" value={view} onChange={setView} options={[{ value: "grid", label: "Grid", icon: SquaresFour }, { value: "list", label: "List", icon: Rows }]} />
        </div>
      </Section>

      <Section title="Progress strip">
        <ProgressStrip
          step={2}
          tone="need"
          stepWord="Needs you"
          steps={[
            { line: "Received 14 Oct, from your notes.", usual: "" },
            { line: "Approved as a Fast local site.", usual: "Writing takes 2 to 4 min" },
            { line: "4 of 7 supplied. Waiting for the logo.", usual: "Depends on the client" },
            { line: "Not yet.", usual: "Usually 15 to 25 min" },
            { line: "Not yet.", usual: "As long as you need" },
            { line: "Not yet.", usual: "Recorded here" },
          ]}
          nextLine="Add the logo and 2 pictures, then start the build"
          next={{ label: "Add the missing details", onClick: () => {} }}
        />
      </Section>

      <Section title="Step rows (live build)">
        <ol className="steps-v2">
          <StepRow n={4} title="An independent reviewer reads the content" time="1 min 20 s" tone="done" />
          <StepRow n={5} title="Building the site" time="2 min so far" tone="run" sentence="Turning the approved words into real pages." />
          <StepRow
            n={6}
            title="Automatic checks in a real browser"
            time="Usually about 2 min"
            tone="wait"
            showSlugs={detailed}
            checks={[
              { label: "Loads on every page", tone: "wait", slug: "render.loads" },
              { label: "The logo shows", tone: "wait", slug: "render.logo-visible" },
            ]}
          />
          <StepRow n={9} title="Rounds of fixes" time="4 min" tone="stop" sentence="Round 3 of 3: two checks still fail." />
        </ol>
      </Section>

      <Section title="Stop facts, fix card, Why?">
        <StopFacts spent money="Yes, $0.21 so far" tried="It wrote the site, then checked every fact against the request, the proposal and your details. The phone number on the Contact page has no source, so it stopped instead of guessing." />
        <FixCard
          primary={{ label: "Fix it and continue", onClick: () => toast("Continuing from the saved site.", { label: "Changed my mind", run: () => {} }) }}
          others={[
            { label: "See where it appeared", onClick: () => {} },
            { label: "Write the site again from the proposal", onClick: () => setConfirm(true) },
          ]}
          input={{ addLabel: "Add the real phone number", fieldLabel: "The real phone number", withoutLabel: "Build without a phone number", withoutNote: "The Contact page will show the email and the request form instead.", mode, value: phone, inputMode: "tel", onMode: setMode, onValue: setPhone }}
        />
        <WhyDisclosure evidence="Contact page, footer: “Call us on (555) 014-2290”. This number is not in the request, the proposal or the details you gave." cropLabel="Screenshot crop: Contact page footer" log={'[claims.unsourced-fact] phone "(555) 014-2290" not in brief · page=/contact'} />
      </Section>

      <Section title="Need / upload rows">
        <ul className="needs-v2">
          <NeedRow label="Picture: the shopfront" why="For the Visit us page. It should show the front of the bakery from the street." kind="file" state={needs.shop} value="shopfront.jpg" onFile={() => setNeed("shop", "done")} onSkip={() => setNeed("shop", "skipped")} onChange={() => setNeed("shop", "open")} />
          <NeedRow label="Opening hours" why="For the Visit us page and the footer." kind="text" state={needs.hours} value="Tue–Sun 7am–3pm" onAnswer={() => setNeed("hours", "done")} onSkip={() => setNeed("hours", "skipped")} onChange={() => setNeed("hours", "open")} />
          <NeedRow label="Logo" why="Top of every page." kind="file" state={needs.logo} value="harbor-street-logo.svg" onSkip={() => setNeed("logo", "skipped")} onChange={() => setNeed("logo", "open")} />
          <NeedRow label="2 real customer quotes" why="For the Home page. Left out rather than made up." kind="text" state={needs.quotes} onSkip={() => setNeed("quotes", "skipped")} onChange={() => setNeed("quotes", "open")} />
        </ul>
      </Section>

      <Section title="Technical details, toast, confirm, palette">
        <TechDetails items={[{ k: "job", v: "j-c41f02" }, { k: "run", v: "wf-1198" }, { k: "commit", v: "9f3c1ae" }]} />
        <div className="row-actions">
          <Button onClick={() => toast("Continuing from the saved site.", { label: "Changed my mind", run: () => {} })}>Show a toast</Button>
          <Button onClick={() => setConfirm(true)}>Open the money confirm</Button>
          <Button onClick={() => setPalette(true)}>Open the palette</Button>
        </div>
      </Section>

      <Section title="Empty state and Coming later">
        <EmptyState title="Your first client starts with a request.">Says what will appear here and offers the one way to start.</EmptyState>
        <ComingLater name="System" />
      </Section>

      <ConfirmDialog open={confirm} title="Write the site again from the proposal?" body="This starts a new build from the approved proposal. The stopped build stays in the history." cost={costLine("one build, about $0.70")} confirmLabel="Write it again" onConfirm={() => setConfirm(false)} onCancel={() => setConfirm(false)} />
      <CommandPalette open={palette} onClose={() => setPalette(false)} items={items} />
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MemoryRouter>
      <DetailProvider initial={q.get("detail") === "detailed" ? "detailed" : "simple"}>
        <ToastProvider>
          <Gallery />
        </ToastProvider>
      </DetailProvider>
    </MemoryRouter>
  </React.StrictMode>,
);

// ?axe=1: run axe-core (WCAG 2.2 AA tags) once the page has settled, expose the result for the checker, and keep
// window.__runAxe() for re-checking an open dialog or palette.
if (q.get("axe") === "1") {
  const w = window as unknown as { __axe: unknown; __runAxe: () => Promise<unknown> };
  w.__runAxe = async () => {
    const { default: axe } = await import("axe-core");
    const res = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] } });
    w.__axe = res.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map((n) => n.target.join(" ")).slice(0, 5) }));
    return w.__axe;
  };
  setTimeout(() => void w.__runAxe(), 800);
}
