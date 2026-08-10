# AGENTS.md

## Scope

These instructions apply to the entire Plumbago repository. A more specific `AGENTS.md` in a subdirectory may add or override rules for that subtree.

## Product contract

Plumbago is a desktop UI for people who want to write and publish a Hugo blog without managing routine Hugo, Git, GitHub, or WSL commands themselves.

Every change should preserve these promises:

- The user's Hugo site remains a normal Hugo project that works without Plumbago.
- Existing content and unknown front matter fields are preserved.
- Destructive or public actions are explicit and explained before they happen.
- Failures leave the blog in a recoverable state and provide a useful next step.
- Windows + WSL is a first-class environment, not a compatibility afterthought.
- English (`en-US`) is the default UI and Brazilian Portuguese (`pt-BR`) has equivalent coverage.
- Technical detail is available for diagnosis, but the primary UI uses plain language.

Do not add telemetry, remote content storage, automatic force pushes, or silent migrations without an explicit product decision.

## Start here

Before editing:

1. Read `README.md`, `package.json`, and the files nearest the requested behavior.
2. Run `git status --short` and preserve unrelated work.
3. Trace a feature across renderer, preload, main process, service, and tests before changing an IPC contract.
4. Prefer a focused change over a broad rewrite.

Do not edit generated or downloaded directories such as `node_modules/`, `dist/`, or `release/` by hand.

## Repository map

```text
src/
├── app/          renderer state, orchestration, and bridge selection
├── components/   reusable presentational UI
├── features/     editor, media, posts, publishing, settings, and onboarding
├── lib/          framework-independent renderer helpers
├── demo.js       browser-only implementation of the Electron bridge
└── i18n.jsx      locale dictionaries and translation helpers
electron/
├── core/         process execution, HTTP, updater, and WSL/native runtime logic
├── services/     content, GitHub, publishing, site, and theme domains
├── main.cjs      Electron lifecycle, dialogs, secure settings, and IPC handlers
├── preload.cjs   the only renderer-to-Electron API surface
└── plumbago-service.cjs  stable service facade
tests/            Node integration and product-regression tests
site/             static GitHub Pages website
build/            application icons and packaging inputs
```

Keep `src/App.jsx` as a tiny compatibility entry point and `electron/plumbago-service.cjs` as a small facade. Put behavior in the feature or service that owns it.

## Architectural boundaries

### Renderer

- Renderer code must not import Node.js or Electron internals.
- Native capabilities go through `window.plumbago`, exposed by `electron/preload.cjs`.
- Keep application-wide coordination in `src/app/`; keep feature state and UI inside `src/features/`.
- Reusable visual primitives belong in `src/components/`; pure helpers belong in `src/lib/`.
- The browser demo must stay useful. When the bridge changes, update `src/demo.js` with a safe in-memory equivalent.

### Electron and IPC

- Keep `contextIsolation` enabled and `nodeIntegration` disabled.
- Expose the smallest possible API from `preload.cjs`. Never expose `ipcRenderer`, arbitrary command execution, or unrestricted filesystem access.
- Validate all renderer-provided paths and values again in the main process or service layer.
- When adding an IPC operation, update the handler, preload bridge, demo bridge, and regression coverage together.

### Services and process execution

- Domain behavior belongs in `electron/services/`; low-level execution and transport belong in `electron/core/`.
- Execute programs with an executable plus an argument array. Do not construct shell command strings.
- Route Hugo and Git through `electron/core/runtime.cjs` so WSL UNC paths continue to run inside the correct distribution.
- Quote each WSL argument independently. Add tests for spaces, apostrophes, Unicode, and Windows/UNC paths when command construction changes.
- Apply timeouts and bounded buffers to external processes and network calls.
- Return actionable errors without leaking tokens or credentials.

## Content and publishing invariants

- Hugo content paths must remain inside the selected blog's `content/` directory.
- The canonical new-post shape is `content/posts/<slug>/index.<language>.md`.
- Preserve front matter keys Plumbago does not own.
- Keep images beside page-bundle Markdown, use collision-safe filenames, and never overwrite an unrelated image silently.
- Autosave must not lose newer edits when asynchronous saves finish out of order. Manual save remains available.
- Previewed Markdown must be sanitized before entering the DOM.
- A publish operation validates a real Hugo build before uploading.
- Git synchronization must not use force push, discard local changes, or hide rebase/conflict failures.
- Theme installation is transactional: check Hugo compatibility, test a real build, and restore the previous configuration after failure.
- Blogger import never changes the source export and never overwrites an existing post silently.

## Security and credentials

- GitHub tokens are secrets. Never log them, place them in renderer state longer than needed, write them into blog files, or include them in diagnostics.
- Persistent tokens must use Electron `safeStorage`; session-only credentials should remain in memory.
- Prefer the user's existing Git/SSH or authenticated GitHub CLI session when possible.
- Restrict URLs opened externally to expected protocols and hosts where practical.
- Treat selected blogs, XML exports, dropped images, theme metadata, and Git output as untrusted input.

## UI, copy, and localization

- Lead with the user's outcome: “Publish your blog,” not “Run Git push.”
- Put technical output behind details or diagnostic actions unless it is needed to resolve the problem.
- Show progress for slow Hugo, Git, GitHub, import, update, and theme operations.
- Disable duplicate submissions while an operation is running.
- Every failure state needs a recovery action when one is available.
- Keep keyboard navigation, visible focus, labels, and contrast intact.
- Use the Plumbago palette through existing CSS variables rather than scattering new hex values.
- Add or change user-facing copy through `src/i18n.jsx`. Add the same key to `en-US` and `pt-BR`; do not use an English string as a silent Portuguese fallback.

## Code style

- Match the existing style: two-space indentation, single quotes in JavaScript, and no semicolons.
- Renderer code is ESM/JSX; Electron and Node tests are CommonJS (`.cjs`). Do not mix module systems casually.
- Prefer small named functions and domain-shaped data over large conditional components.
- Keep comments for intent, invariants, and platform quirks—not line-by-line narration.
- Avoid new dependencies when a small, well-tested helper is enough. Explain any dependency that expands package size or native requirements.

## Tests and validation

Use the narrowest relevant test while developing, then run the full gate before handing off:

```bash
npm test
npm run check
```

`npm test` runs the Node integration and regression suite. `npm run check` runs ESLint and the production Vite build; it does not replace `npm test`.

Add regression coverage when changing:

- content parsing, serialization, paths, images, or Blogger import;
- WSL/native runtime selection or command arguments;
- Git, GitHub, Pages, publishing, themes, or updates;
- preload channels or the browser demo bridge;
- translation keys, product name, palette, architecture entry points, or workflows.

Tests must use temporary Hugo sites and Git repositories. Never point tests at a real user blog, home directory, credential store, or remote repository. If a test mutates external state, replace it with a local fixture or explicit mock.

For UI-only changes, also verify the browser demo with `npm run dev:web`. For Electron/WSL changes, exercise the packaged runtime or a representative Windows + WSL path when available.

## Releases and workflows

- The application version lives in both `package.json` and `package-lock.json`.
- Release tags use `v<version>`, for example `v0.5.0`, and must match the package version.
- `.github/workflows/release.yml` builds Windows x64, Linux x64, macOS Intel, and macOS Apple Silicon artifacts.
- Keep updater metadata (`latest.yml`, blockmaps, and `latest-linux.yml`) attached where the updater expects it.
- Do not claim automatic macOS updating until builds are signed and the updater path is verified.
- Changes to `site/` deploy through GitHub Pages from `main`; use the standard GitHub Pages URL, not the retired `gabu.dev.br` domain.

## Documentation

Update `README.md` when commands, supported platforms, install steps, or user-visible workflows change. Keep the README friendly and outcome-oriented; implementation rules belong here in `AGENTS.md`.

## Definition of done

A change is ready when:

- it respects the renderer/preload/main/service boundary;
- user files and unknown front matter remain safe;
- English and Portuguese copy stay in parity;
- relevant failure and rollback paths are covered;
- `npm test` and `npm run check` pass;
- generated files and unrelated changes are absent from the diff;
- the handoff explains user impact, validation performed, and any platform-specific limitation.
