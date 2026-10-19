# npm workspaces: decision record (Step 21 B)

**Decision (2026-10-19, agent recommendation, Huraira to confirm)**: keep the current layout. Every package keeps its own
`package.json` and lockfile, linked with `file:` dependencies, and each CI job installs its own dependencies in a fixed order. No
root `package.json`, and no workspace file in a subfolder. Revisit only when the cost below actually shows up.

## What was checked (measured 2026-10-19)

- 12 folders under `packages/`: 11 npm packages, each with its own `package-lock.json` (11 lockfiles), plus `db` (SQL only). The Track B starter
  (`packages/frontend-loop/starters/track-b`) has a 12th; it is installed with `npm ci --offline` inside a network sandbox.
- `.github/workflows/ci.yml` runs `npm ci` 29 times. Jobs that need sibling packages install them first, in a loop such as
  `for p in audit hermes agent-runtime; do (cd ../$p && npm ci); done`.
- **The Cockpit depends on no `@wfact/*` package**: `apps/cockpit/package.json` has 0 `file:` entries, and no file in
  `apps/cockpit/src` imports `@wfact/`. Its only link into `packages/` is reading `packages/hermes/config` at build time
  (`apps/cockpit/vite.config.ts:13`).
- The incident this guards against (`PROGRESS.md`, 2026-09-22): a Git-triggered Vercel build deployed an empty app over the
  working Cockpit. Since then `apps/cockpit/vercel.json` disables Git deploys on `main`, and CI (`deploy-cockpit`) is the only
  deployer (`vercel pull`, `vercel build --prod`, `vercel deploy --prebuilt`).

## Options

| Option | What changes | Risk |
|---|---|---|
| Root `package.json` with `workspaces` | One lockfile at the root; `npm ci` once | Vercel and npm both treat a root `package.json` and lockfile as the project root. The Cockpit build would then resolve from the repo root, which is the same class of fault as the 2026-09-22 empty deploy. This is the arrangement the repo avoids on purpose. |
| `packages/package.json` with `workspaces: ["*"]` | One lockfile for the 11 packages; the Cockpit untouched | All 11 per-package lockfiles go. `npm ci` run inside one package then acts on the whole workspace, so every CI job installs every package (rendered-qa's browser dependencies included). All 29 install lines and the job runner's install (`cockpit-job.yml`) change at once. The Track B sandbox install must be proven unaffected. |
| Keep `file:` links (chosen) | Nothing | The hand-written install order can fall out of date when a package gains a sibling dependency. It fails loudly, as a CI install or import error, never silently. |

## Why not now

1. The gain is small. The Cockpit, the one thing that deploys, uses none of these packages, so workspaces would not touch the
   deploy path. They would only shorten CI install lines.
2. The step's own bar is proof: a fresh Git-shaped Vercel build of the Cockpit succeeds, and CI stays green. That needs a push
   and a Vercel build. Both are outward-facing, and a subfolder workspace changes every CI job in the same commit.
3. The failure mode of the current layout is loud (`npm ci` or an import fails in CI), so it meets the "nothing swallowed" bar.

## Revisit when

- a fourth job needs its own hand-ordered install loop, or an install-order mistake reaches `main`; or
- the Cockpit starts importing a `@wfact/*` package. Then the deploy path does change, and this record must be redone with a real
  Vercel build of the change.
