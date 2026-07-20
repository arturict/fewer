# Build log

This document is evidence for the Build Week submission, not marketing copy.

## Product decisions

- Rejected a generic AI code reviewer, launch-readiness dashboard, agent receipt system, and
  project-status dashboard after competitor research showed those categories were crowded.
- Chose an anti-backlog because AI made starting and parallel execution cheap while human product
  judgment and attention remain scarce.
- Kept project selection human. Fewer exposes evidence but does not hide a subjective decision
  behind an invented score.
- Chose a dependency-free static app so judges can run it without credentials, installs, or a
  backend.

## Codex contribution

Codex was used to:

- research the official Build Week rules and adjacent products;
- define the one-active / one-maintenance / park-or-close product contract;
- implement the domain model, interface, local server, repo scanner, tests, CI, and documentation;
- run the complete decision flow in a real browser;
- test persistence, hostile-looking text, clean closing, and browser-console errors.

## GPT-5.6 contribution

### GPT-5.6 Terra review — 2026-07-20

Scope: an independent, bounded review of the Fewer worktree's product contract, accessibility,
domain and import bounds, scanner privacy, server/deployment exposure, responsive CSS, tests, and
submission artifacts. No dependencies, accounts, analytics, runtime AI, external repositories, or
external state were added.

Findings and accepted changes:

- A source-root static deployment could expose repository files even though the local development
  server has a runtime allowlist. Added `scripts/build.mjs`, which emits only the seven runtime
  files, and `vercel.json`, which deploys that `dist/` output and applies the defensive headers.
  Added a regression test proving the build excludes `.git`, `README.md`, `docs`, and `package.json`.
- The first allowlisted build helper still accepted a source root, ancestor, symlink, or non-empty
  custom directory as its cleanup target. The final review added a fail-closed output guard and a
  sentinel regression test so a bad build argument cannot recursively clear developer data.
- The narrow mobile header hid Import and Export, making portable local data inaccessible on small
  screens. Kept both actions visible and tightened their compact spacing instead.
- The browser import gate was smaller than the bounded storage budget, so a valid larger export
  could not be re-imported. The UI now enforces the storage module's 1.5 million-character bound
  after reading, with a 4.5 MB pre-read guard for resource safety.
- Repeated card actions had generic accessible names. Edit and Close now include the project name.

Validation completed by GPT-5.6 Terra:

- `npm run verify` on Node 22.13.0 (passed; lint plus 21 Node tests).
- `git diff --check` (passed; the initial project files are untracked, so this command had no
  tracked diff to inspect).

Final integration validation after the Terra review:

- Added a destructive-output regression for the allowlisted build helper.
- `npm run verify` passed with 22 tests on Node 22.13.0, 24.14.0, and 26.3.0.
- `npm run build` emitted exactly the seven allowlisted runtime files into `dist/`.
- The staged 24-file diff passed `git diff --cached --check` and a focused secret/path scan.

Final local browser validation:

- Completed the full cut with one active and one maintenance project, verified dated parking
  triggers, and confirmed the decision survived a reload.
- Triggered a portfolio export and imported a real privacy-safe workspace snapshot through the file
  chooser; the five local projects loaded without paths or remotes.
- At a 390 by 844 viewport, Import, Export, and Add remained visible with no horizontal overflow.
- Verified the app-owned reset dialog replaced the blocking JavaScript confirm, retained focus, and
  restored the fictional sample state. The automation backend did not inject Tab/Escape/Enter key
  events, so a physical-keyboard pass remains manual rather than being claimed.
- Browser console warnings/errors: none.

Remaining live gate: deploy only the configured `dist/` output, then verify anonymously that app
assets load and that repository files and response headers are not exposed.

## Submission session

Before submitting, run /feedback in the Codex session where the majority of the core project was
built and paste the returned session ID here. Do not guess it from a local thread identifier.
