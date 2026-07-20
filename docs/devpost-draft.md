# Devpost draft

This copy is ready to paste once the repository, deployment, demo URL, and `/feedback` session ID
have been verified. Do not submit placeholders.

## Name

Fewer

## Tagline

Fewer projects. More finished.

## Track

Work and productivity

## One-line summary

A local-first anti-backlog that helps solo builders choose one project to finish, maintain at most
one obligation, and park or close everything else honestly.

## What it does

AI made it cheap to start several credible projects at once. It did not multiply the attention
needed to judge, review, and finish them. Most project tools make the growing backlog easier to
store. Fewer makes it smaller.

The user puts active projects head to head using visible evidence: user signal, momentum, weekly
time, deadline, and the next observable proof. Fewer never invents a score or auto-selects the
winner. The user funds one active finish line, may keep one maintenance obligation, and gives every
other project a dated return trigger or a clean ending with one retained lesson.

Everything stays in the browser. A read-only local scanner can turn repository delivery signals
into editable project cards without exporting paths or Git remotes by default.

## How it was built

Fewer is a dependency-free static browser app using semantic HTML, CSS, and small JavaScript
modules. Its versioned import schema is bounded and normalized before persistence. User-authored
content is rendered as text. The local server exposes only a runtime allowlist with a strict Content
Security Policy and defensive headers; the static deployment build emits that same allowlist instead
of the repository root.

The optional Node scanner discovers Git repositories without fetching, installing, executing
project scripts, or modifying a worktree. Automated tests exercise the attention-slot invariants,
repeated cuts, proof history, clean closing, malformed imports, hostile-looking text, scanner
privacy and depth, and the server boundary. CI runs the same checks on Node 22 and 24.

Codex helped research the official constraints, narrow the product idea, implement and test the
complete loop, exercise it in a real browser, and prepare the delivery artifacts. GPT-5.6 Terra
performed an independent bounded product and engineering review; cite only the concrete accepted
changes recorded in `docs/build-log.md` after that review is complete.

## Challenges

The hardest product decision was refusing to turn judgment into a fake AI score. Signal and
momentum can inform a choice, but they cannot decide which promise the builder is willing to fund.
The implementation challenge was keeping a local repository scan useful without leaking workspace
paths, remotes, or executing untrusted project code.

## Accomplishments

- One opinionated loop from an overloaded portfolio to a single observable finish line.
- No account, API key, backend, package dependency, analytics, or runtime model dependency.
- Portable JSON export/import and a privacy-safe, read-only workspace scanner.
- Keyboard-friendly native dialogs, reduced-motion support, bounded storage, CSP, and focused tests.
- A fictional sample portfolio that lets judges test the full product immediately.

## What was learned

Agentic coding changes the cost of starting and parallel implementation much faster than it changes
the cost of human review. A useful productivity product for that world should protect attention,
not celebrate activity. It also needs an evidence trail: browser behavior, tests, explicit privacy
boundaries, and honest external gates are more valuable than a large feature count.

## Next steps

Keep the product narrow. The next useful improvements are installable offline support, an optional
encrypted backup chosen by the user, and clearer weekly review cues. Fewer should not become a
general task manager, an autonomous project selector, or another notification feed.

## Submission links

- Source: pending public repository verification
- Live project: pending clean-browser deployment verification
- Demo video: pending public or unlisted playback verification
- Codex `/feedback` session: pending; never substitute a local thread identifier
