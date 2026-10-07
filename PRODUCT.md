# Product

<!-- impeccable:product-schema 1 -->

Scope: the WFACT Cockpit (`apps/cockpit`), the founders' control room. Written 2026-10-01 for Step 4C from
`CLAUDE.md`, the Blueprint (§9), the Factory Completion Plan and Huraira's answers in the Step 4C session.
Business-wide facts live in `memory/context.md`; this file only records what the Cockpit's design must respect.

## Platform

web (installable PWA; phone and laptop are both primary, per Huraira 2026-10-01)

## Users

- **Nick** (owner, non-technical): approves money, launch, clients and the final design call. Must be able to use
  the Cockpit without help. Asks first: "is everything OK, and what needs me?"
- **Huraira** (owner, technical cofounder): runs the factory day to day, starts intake and builds, reads failures,
  watches model cost.
- **Admins and PMs** (roles `admin`, `pm`): approved team accounts; admins see operational panels, PMs see only
  their assigned clients (RLS). Role-specific views are Step 17.

## Product Purpose

WFACT is an AI-run web agency factory. The Cockpit is the one place where every factory action is started,
every human gate is decided and every outcome is checked. It displays and gates; it never does pipeline work
itself (jobs run on GitHub Actions). Success: a founder can see the state of every client build, decide what is
waiting on them, and understand any failure, in plain language, in a few clicks, on either device.

## Positioning

Built around "never trust done, only verified": every result shown is backed by an independent check, every
failure names the specific check that failed, and Launch and Money are hard human gates that no screen may
bypass. The Cockpit is also meant to become a SaaS-sellable product for other AI web agencies (Blueprint), so it
is held to a commercial bar, not an internal-tool pass.

## Operating Context

- Pipeline: 11 stages, Onboarding → Intake → Research & direction → Assets → Homepage build → Direction lock →
  Full build + Owner's Key → QA & security → Launch → Content bank → Post-mortem.
- Flow in the Cockpit today: paste a client request → intake + planner write a plan → owner approves or rejects it
  and picks build track A or B → build + verify job runs → result is "awaiting launch approval" or a failure.
- Entities: one client per entity, N-capable (DreamSign and Bennett & Co active now). Never hardcode to two.
- Volume today: 1 project, 9 jobs, 5 plans, 2 correction rounds, ~50 model calls (live DB, 2026-10-01).

## Capabilities and Constraints

- Access control is RLS only; the browser holds the anon key, never a service key.
- No deploy button, ever. Launch and Money stay human-gated (CLAUDE.md §3).
- Future rooms (System, Agents, Memory, Human Control, Business, Alerts) appear as honest "Coming in Step N"
  entries until their step builds them (Huraira 2026-10-01). No fake data in any room.
- Track B builder exists (Step 4B M3-M4, live builds proven); Track A gets a motion budget in Step 27 (decision D1, 2026-10-07). The UI must still say plainly when a track's build is blocked or failed.

## Brand Commitments

- Name: "WFACT" / "Cockpit". No logo asset exists. The current dark-amber look is **not** binding: Huraira chose to
  replace it with a new visual world (2026-10-01). Final design call stays with Nick (CLAUDE.md §3).
- Design-quality rule (Part C): nothing may look AI-generated, basic, or like an unmodified template.

## Evidence on Hand

Real rows only: projects, plans (with direction summaries and quotes from the client's own words), jobs with
their results and errors, correction rounds, model traces and cost. Synthetic clients (Summit Line Roofing,
Northlight Signs, Harbor Street Bakery, DreamSign pilot) are test inputs and must stay labelled as such. There are
no customers, testimonials or metrics to show beyond these.

## Product Principles

1. What needs a human comes first; everything else is one click deeper.
2. Plain language for Nick: verbs on buttons, no internal IDs or stage slugs as the main label, every error says
   what happened and what to do.
3. Show the proof: a result links to its check, a failure names the failed check.
4. Human gates look and feel like gates: deliberate, confirmed, recorded.
5. Honest emptiness: an empty or future room says so; nothing is padded.

## Accessibility & Inclusion

WCAG 2.2 AA (contrast, keyboard, visible focus, labels, reduced motion), usable from 360 px wide, Lighthouse
accessibility ≥ 95 and zero axe violations per room (Step 4C acceptance).
