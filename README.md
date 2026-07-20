# Fewer

**Fewer projects. More finished.**

Fewer is a local-first anti-backlog for solo builders. It does one uncomfortable job: makes every
open project earn a place in a finite attention budget.

Most project tools help you store more work. Fewer asks for a decision:

- one project gets the active slot;
- at most one obligation gets maintenance;
- every parked project gets a dated return trigger;
- every closed project keeps the lesson worth carrying forward.

The app never auto-picks the winner. It shows signal, momentum, time cost, deadline, and the next
observable proof side by side. The user makes the trade-off.

## Run it

Requirements: Node.js 22 or newer. There are no package dependencies.

~~~sh
npm run dev
~~~

Open <http://127.0.0.1:4173>. The first visit contains a clearly fictional sample portfolio, so the
full product loop is testable without an account or setup data.

## Build for a static host

~~~sh
npm run build
~~~

This writes an allowlisted `dist/` directory containing only the browser runtime files. The included
`vercel.json` uses that directory as Vercel's output and applies the same browser security headers
as the local server. Do not deploy the repository root as a static directory: it contains source,
tests, and submission notes that are not part of the app.

## Import local repository signals

The optional scanner finds Git repositories and records only lightweight delivery signals:

~~~sh
npm run scan -- C:\path\to\projects --max-depth 2 --output snapshot.json
~~~

Import snapshot.json from the app. By default the snapshot excludes absolute paths and Git remotes.
Paths are available only through the explicit --include-paths flag. The scanner does not modify
repositories, fetch remotes, install packages, or run project code.

## Verify it

~~~sh
npm run verify
~~~

This runs syntax checks and Node's built-in test runner. Tests cover the one-active invariant,
maintenance limits, parking triggers, clean closing, proof history, malformed and oversized
imports, hostile-looking user text, privacy-safe scanning, and scan-depth boundaries.

CI repeats the same gate on Node 22 and 24, then smoke-tests the scanner against the repository.

## Product and security choices

- Static browser app, small ES modules, no framework; deployment output is an explicit runtime
  allowlist rather than the repository root.
- Browser-local persistence with a bounded, versioned JSON schema.
- No account, analytics, cookies, network sync, or runtime model dependency.
- Content Security Policy in both HTML and the local server.
- User and imported content reaches the DOM through textContent, never innerHTML.
- Read-only Git inspection uses execFileSync with argument arrays and a timeout.
- The local server rejects traversal, non-GET methods, embedding, MIME sniffing, and unneeded
  browser capabilities; the static deployment copies only the same runtime allowlist.

## Build Week

Fewer was started for OpenAI Build Week 2026 in the **Work and productivity** track. The build
artifacts live in [docs](./docs/):

- [build-log.md](./docs/build-log.md) records what Codex and GPT-5.6 contributed;
- [devpost-draft.md](./docs/devpost-draft.md) keeps the submission copy aligned with the product;
- [demo-script.md](./docs/demo-script.md) keeps the public demo under three minutes;
- [submission-checklist.md](./docs/submission-checklist.md) separates finished work from
  submission-only gates.

The repository is MIT licensed.
