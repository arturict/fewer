# Working on Fewer

Fewer is an opinionated decision tool, not a general project manager. Preserve the narrow product
contract:

- one active project;
- at most one maintenance project;
- parked projects have a date and a return trigger;
- closed projects retain one useful lesson;
- product selection remains a human decision.

## Engineering constraints

- Keep the browser app dependency-free unless a dependency removes more complexity than it adds.
- Keep data local. Do not add accounts, analytics, remote sync, or runtime AI calls.
- Never render imported or user-authored strings with innerHTML.
- Do not export absolute paths or Git remotes unless the user explicitly asks for paths.
- Keep the scanner read-only; invoke Git with argument arrays, not a shell.
- Prefer one clear interaction over new settings, scores, dashboards, or generated advice.
- Preserve keyboard access, visible focus, native dialog semantics, and reduced-motion behavior.

## Definition of done

Run:

~~~sh
npm run verify
~~~

For visible changes, also run the app in a clean browser, complete the cut, reload to check
persistence, and inspect the console. A passing unit suite is not a substitute for the real flow.
