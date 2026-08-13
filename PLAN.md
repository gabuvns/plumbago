# Plumbago delivery plan

This file tracks the active milestone. The longer product sequence and definitions of done live in [ROADMAP.md](ROADMAP.md).

## Completed milestone: 0.7.1 — GitHub Connect

[v0.7.1](https://github.com/gabuvns/plumbago/releases/tag/v0.7.1) supersedes `v0.7.0` with the complete Device Flow IPC fix and Windows, Linux, macOS Intel, and macOS Apple Silicon downloads.

- [x] Register the official OAuth App and inject its public Client ID into official packages.
- [x] Verify the complete Device Flow against the real GitHub account and revoke the disposable test token.
- [x] Connect or safely create a repository and upload the first verified Hugo commit over HTTPS.
- [x] Pass 32 tests, the production build, dependency audit, release CI, and artifact verification.

## Completed milestone: 0.8.0 — One-click deploy

Goal: after connecting a repository, a writer can choose a provider and take a valid local Hugo blog to a verified public URL without editing workflows, installing deployment CLIs, or opening a provider dashboard.

### Product work

- [x] Add a provider-neutral deployment contract and resumable per-blog provisioning state.
- [x] Replace the GitHub-specific Pages step with a dedicated deploy assistant.
- [x] Make GitHub Pages setup idempotent, upload the workflow commit, trigger deployment, and discover the actual public URL.
- [x] Add guided Cloudflare authorization with encrypted local token storage and account selection.
- [x] Create or reuse a Cloudflare Pages Direct Upload project without duplicates.
- [x] Build Hugo locally with the production URL and upload the generated site without requiring Wrangler.
- [x] Show preflight, provisioning, upload, build, verification, logs, actionable errors, and safe retry.
- [x] Preserve manual hosting as an advanced option.
- [x] Offer custom-domain guidance only after the first successful deployment.

### Release gate

- [x] EN-US and PT-BR keys remain in parity.
- [x] Provider, IPC, security, idempotency, and product-contract regression tests pass.
- [x] `npm test`, `npm run check`, and `npm audit --audit-level=high` pass.
- [x] Browser demos cover GitHub Pages and Cloudflare flows without console errors.
- [x] A relevant Electron package is built and inspected.
- [x] Close `CHANGELOG.md` as 0.8.0 and bump package metadata.
- [x] Create the release commit and `v0.8.0` tag.
- [x] Publish the [GitHub Release](https://github.com/gabuvns/plumbago/releases/tag/v0.8.0) and verify every platform asset.

## Completed milestone: 0.9.0 — History and recovery

Goal: writers can understand what changed, recover one post or the whole site after a risky operation, and retrieve deleted work without learning Git terminology.

### Product work

- [x] Add a human-readable history service for posts and site-wide changes.
- [x] Compare two post revisions and restore one post without reverting unrelated work.
- [x] Create automatic recovery points before imports, theme changes, and configuration changes.
- [x] Restore the last known-good site state after a failed protected operation.
- [x] Move deleted posts and page-bundle assets to a recoverable local trash instead of leaving orphaned files.
- [x] Add a history and trash interface with clear impact summaries, confirmation, and undo feedback.

### Release gate

- [x] EN-US and PT-BR keys remain in parity.
- [x] History, comparison, checkpoint, restore, trash, IPC, and product-contract tests pass.
- [x] `npm test`, `npm run check`, and `npm audit --audit-level=high` pass.
- [x] Browser demos cover post restore, recovery points, and trash without console errors.
- [x] A relevant Electron package is built and inspected.
- [x] Close `CHANGELOG.md` as 0.9.0 and bump package metadata.
- [x] Create the release commit and `v0.9.0` tag.
- [x] Publish the [GitHub Release](https://github.com/gabuvns/plumbago/releases/tag/v0.9.0) and verify every platform asset.

## Completed milestone: 0.10.0 — Media library

Goal: writers can find, reuse, improve, replace, and safely remove images across the whole blog while every file remains a portable Hugo resource.

### Product work

- [x] Build a blog-wide media index for page bundles, `static`, and Hugo assets without moving existing files.
- [x] Add search, filters, previews, ownership, dimensions, size, usage count, and duplicate detection.
- [x] Reuse an existing image in a post while preserving page-bundle and multilingual behavior.
- [x] Replace an image with a preview of affected references and a recoverable operation.
- [x] Remove only unused media, with explicit impact summaries and recovery through the local trash.
- [x] Find missing references, unused images, oversized files, and missing alternative text.
- [x] Edit alternative text and captions at each Markdown reference without rewriting prose.
- [x] Offer safe crop, resize, and WebP/AVIF derivatives through Hugo image resources.
- [x] Add a responsive bilingual media workspace with useful empty, loading, progress, and error states.

### Release gate

- [x] EN-US and PT-BR keys remain in parity.
- [x] Indexing, reference, duplicate, optimization, recovery, IPC, and product-contract tests pass.
- [x] `npm test`, `npm run check`, and `npm audit --audit-level=high` pass.
- [x] Browser demos cover search, reuse, diagnostics, and a destructive flow without console errors.
- [x] A relevant Electron package is built and inspected.
- [x] Close `CHANGELOG.md` as 0.10.0 and bump package metadata.
- [x] Create the release commit and `v0.10.0` tag.
- [x] Publish the [GitHub Release](https://github.com/gabuvns/plumbago/releases/tag/v0.10.0) and verify every platform asset.

## Completed milestone: 0.11.0 — SEO and quality assistant

[v0.11.0](https://github.com/gabuvns/plumbago/releases/tag/v0.11.0) adds deterministic pre-publish review and verified Windows, Linux, macOS Intel, and macOS Apple Silicon downloads.

Goal: before publishing, a writer can run one deterministic review, understand every discoverability or accessibility issue, and apply only the safe fixes they choose.

### Product work

- [x] Build a provider-neutral review service for site settings, front matter, Markdown, generated output, and Hugo build health.
- [x] Check titles, descriptions, slugs, canonical addresses, publish state, dates, and social images without theme-specific assumptions.
- [x] Detect broken internal links, missing image alternatives, skipped heading levels, duplicate titles, and slug collisions.
- [x] Validate sitemap, RSS, robots directives, production base URL, and the production Hugo build.
- [x] Separate blocking errors from recommendations and explain why each finding matters in plain language.
- [x] Offer individual safe fixes with an exact impact preview; never rewrite prose or delete data automatically.
- [x] Add a pre-publish review step while keeping publishing available when only recommendations remain.
- [x] Add a responsive bilingual review workspace with filters, progress, empty states, and links to affected posts.

### Release gate

- [x] EN-US and PT-BR keys remain in parity.
- [x] Metadata, link, heading, output, safe-fix, IPC, and product-contract tests pass.
- [x] `npm test`, `npm run check`, and `npm audit --audit-level=high` pass.
- [x] Browser demos cover a clean site, blocking findings, recommendations, and one safe fix without console errors.
- [x] A relevant Electron package is built and inspected.
- [x] Close `CHANGELOG.md` as 0.11.0 and bump package metadata.
- [x] Create the release commit and `v0.11.0` tag.
- [x] Publish the [GitHub Release](https://github.com/gabuvns/plumbago/releases/tag/v0.11.0) and verify every platform asset.

## Completed milestone: 0.12.0 — Real editorial calendar

Goal: a writer can see the publication plan, move posts to meaningful dates, and rely on scheduled publishing even when the Plumbago desktop app is closed.

### Product work

- [x] Add a provider-neutral schedule service that reads Hugo dates, draft state, publication dates, expiry dates, and the blog timezone without losing unknown front matter.
- [x] Add month, week, agenda, and unscheduled views for drafts, scheduled posts, published posts, expired posts, and conflicts.
- [x] Schedule, reschedule, cancel, or publish now with an exact front-matter impact preview and automatic recovery point.
- [x] Prevent future posts from appearing early and explain Hugo's draft, future, and expired-content rules in plain language.
- [x] Install an idempotent GitHub Actions publication clock so due content is rebuilt while Plumbago is closed.
- [x] Support GitHub Pages directly and configure an explicit, consented Cloudflare Pages secret path for scheduled Direct Upload.
- [x] Record the last scheduled run, next due post, provider state, delayed runs, and actionable missed-publication diagnostics.
- [x] Add responsive keyboard-accessible calendar interactions and complete EN-US/PT-BR copy.

### Release gate

- [x] EN-US and PT-BR keys remain in parity.
- [x] Timezone, front matter, scheduling, GitHub workflow, Cloudflare secret, recovery, IPC, and product-contract tests pass.
- [x] `npm test`, `npm run check`, and `npm audit --audit-level=high` pass.
- [x] Browser demos cover unscheduled, scheduled, rescheduled, overdue, and publish-now flows without console errors.
- [x] A relevant Electron package is built and inspected.
- [x] Close `CHANGELOG.md` as 0.12.0 and bump package metadata.
- [x] Create the release commit and `v0.12.0` tag.
- [x] Publish the [GitHub Release](https://github.com/gabuvns/plumbago/releases/tag/v0.12.0) and verify every platform asset.

## Completed milestone: 0.12.1 — Editorial integrity hotfix

[v0.12.1](https://github.com/gabuvns/plumbago/releases/tag/v0.12.1) fixes autosave revision races, blog-local calendar drift, and unsynchronized background schedules with verified downloads for Windows, Linux, macOS Intel, and macOS Apple Silicon.

Goal: scheduling and autosave remain trustworthy when files change externally, dates cross timezone boundaries, and background publication depends on repository state.

### Product work

- [x] Prevent Plumbago's own autosave and refresh cycle from being reported as an external edit while preserving genuine conflict protection.
- [x] Keep editor, preview, and calendar dates on the same blog-local day across UTC offsets and daylight-saving transitions.
- [x] Synchronize schedule changes to the connected repository when background publication is enabled, with explicit status and a safe retry when Git cannot push.
- [x] Add focused regression coverage for stale revisions, saves completing out of order, local-midnight scheduling, and scheduled repository synchronization.

### Release gate

- [x] EN-US and PT-BR keys remain in parity.
- [x] `npm test`, `npm run check`, and `npm audit --audit-level=high` pass.
- [x] Browser QA covers a near-midnight schedule and a failed/retried schedule sync without console errors; focused state tests cover queued autosave.
- [x] A relevant Electron package is built and inspected.
- [x] Close `CHANGELOG.md` as 0.12.1 and bump package metadata.
- [x] Create the release commit and `v0.12.1` tag.
- [x] Publish the [GitHub Release](https://github.com/gabuvns/plumbago/releases/tag/v0.12.1) and verify every platform asset.

## Completed milestone: 0.12.2 — Editorial safeguards and accessibility

Released on 2026-08-13 — [v0.12.2](https://github.com/gabuvns/plumbago/releases/tag/v0.12.2)

Goal: published work is protected from accidental edits, while the writing surface remains readable and keeps Markdown semantics visually clear.

### Product work

- [x] Make published posts read-only by default with a deliberate revise/unlock action and plain-language publishing impact.
- [x] Block metadata, Markdown, visual editing, formatting, media insertion, drag-and-drop, and autosave until a revision is started.
- [x] Keep future scheduled posts editable until they actually become published.
- [x] Render Markdown `#`, `##`, and `###` with an accurate visual hierarchy in the live and visual previews.
- [x] Add an accessible font-size preference with a live H1/H2/H3 preview, keyboard-operable range input, and persistent local settings.
- [x] Apply the reading preference to Markdown writing, visual editing, and preview without changing the post or public website.

### Release gate

- [x] EN-US and PT-BR keys remain in parity.
- [x] Published-lock, future-schedule, preference normalization, persistence, and product-contract tests pass.
- [x] `npm test`, `npm run check`, and `npm audit --audit-level=high` pass.
- [x] Browser QA covers locked/unlocked editing, slider persistence, and real H1/H2/H3 rendering without console errors.
- [x] A relevant Electron package is built and inspected.
- [x] Close `CHANGELOG.md` as 0.12.2 and bump package metadata.
- [x] Create the release commit and `v0.12.2` tag.
- [x] Publish the [GitHub Release](https://github.com/gabuvns/plumbago/releases/tag/v0.12.2) and verify every platform asset.

## Completed milestone: 0.12.3 — Windows and WSL Hugo management

Released on 2026-08-13 — [v0.12.3](https://github.com/gabuvns/plumbago/releases/tag/v0.12.3)

Goal: a Windows writer can understand, choose, test, and safely update the exact Hugo installation Plumbago uses, whether it runs natively or inside WSL.

### Product work

- [x] Detect native Windows Hugo and each available WSL Hugo installation independently, including version, Extended edition, architecture, path, and availability.
- [x] Show both environments together with plain-language health and compatibility guidance instead of collapsing them into the currently selected blog runtime.
- [x] Let the writer choose a runtime per blog, test a candidate before saving it, and preserve the selection without adding Plumbago-only files to the Hugo project.
- [x] Route site creation, preview, builds, theme validation, and Hugo diagnostics through the selected runtime while preserving Windows, UNC, spaces, apostrophes, and Unicode paths.
- [x] Offer guided updates for the selected environment using the installed version and an exact method preview, explicit confirmation, progress, retry, and technical details.
- [x] Never invoke an installer silently; keep manual official-installation guidance available when an automatic method is unavailable or unsafe.
- [x] Keep the current runtime usable after a failed update and re-test it with a real site build before reporting success.
- [x] Add complete EN-US/PT-BR copy and keyboard/screen-reader accessible runtime controls.

### Release gate

- [x] Native Windows, WSL, multiple-distribution, missing-Hugo, unsupported-version, selection, update, rollback/failure, IPC, and product-contract tests pass.
- [x] `npm test`, `npm run check`, and `npm audit --audit-level=high` pass.
- [x] Browser demos cover dual installations, runtime choice, missing runtime, WSL filesystem access, incompatible builds, update confirmation, success, and recovery without console errors.
- [x] A Windows package is inspected and the representative Windows + WSL path flow is exercised where the available environment permits it.
- [x] Close `CHANGELOG.md` as 0.12.3 and bump package metadata.
- [x] Create the release commit and `v0.12.3` tag.
- [x] Publish the [GitHub Release](https://github.com/gabuvns/plumbago/releases/tag/v0.12.3) and verify every platform asset.

## Completed milestone: 0.13.0 — Taxonomy manager

Released on 2026-08-13 — [v0.13.0](https://github.com/gabuvns/plumbago/releases/tag/v0.13.0)

Goal: a writer can understand and reorganize tags, categories, and custom Hugo taxonomies across a large blog without bulk-editing front matter by hand.

### Product work

- [x] Discover Hugo's configured taxonomies and preserve theme-specific or multilingual front matter shapes.
- [x] Add a searchable taxonomy workspace with term counts, language, unpublished usage, spelling variants, empty terms, and unclassified posts.
- [x] Filter the main post list by one or more taxonomy terms and clear filters without losing the current post.
- [x] Rename or merge terms through an exact affected-post preview, conflict detection, and an automatic recovery point.
- [x] Add and remove terms from selected posts without rewriting unknown front matter or unrelated content.
- [x] Explain term aliases, URL changes, and multilingual implications before applying destructive organization changes.
- [x] Add responsive keyboard-accessible interactions and complete EN-US/PT-BR copy.

### Release gate

- [x] EN-US and PT-BR keys remain in parity.
- [x] TOML/YAML/JSON front matter, custom taxonomy, multilingual, merge, recovery, IPC, and product-contract tests pass.
- [x] `npm test`, `npm run check`, and `npm audit --audit-level=high` pass.
- [x] Browser demos cover browsing, filtering, adding, renaming, merging, variants, unclassified posts, and recovery without console errors.
- [x] A relevant Electron package is built and inspected.
- [x] Close `CHANGELOG.md` as 0.13.0 and bump package metadata.
- [x] Create the release commit and `v0.13.0` tag.
- [x] Publish the [GitHub Release](https://github.com/gabuvns/plumbago/releases/tag/v0.13.0) and verify every platform asset.

## Released milestone: 0.14.0 — Route and page manager

Goal: a writer can add and manage standalone Hugo pages such as `/about` and `/gallery` without learning the content tree or route configuration.

### Product work

- [x] Discover existing Markdown pages, branch bundles, leaf bundles, aliases, menus, translations, explicit URLs, and automatic Hugo routes without rewriting content.
- [x] Create portable leaf, branch, or standalone pages for routes such as `/about/` and `/gallery/`.
- [x] Detect collisions across pages, posts, aliases, sections, taxonomies, languages, and root-scoped URLs.
- [x] Change public routes through standard Hugo URL and alias front matter while preserving Markdown, unknown fields, and YAML, TOML, or JSON format.
- [x] Preview and safely remove standalone or leaf pages with recovery points, shared-resource protection, and exact file impact.
- [x] Explain theme-dependent layouts, protect homepage and section semantics, and keep unsupported Hugo formats editable through their ordinary files.
- [x] Add responsive keyboard-accessible interactions, a mutable browser demo, and complete EN-US/PT-BR copy.

### Release gate

- [x] EN-US and PT-BR keys remain in parity.
- [x] Bundle, route, language, collision, front matter, recovery, IPC, and product-contract tests pass.
- [x] `npm test`, `npm run check`, and `npm audit --audit-level=high` pass.
- [x] Browser demos cover browsing, filtering, creation, route changes, collision guidance, protected resources, deletion, recovery, and both languages without fresh console errors.
- [x] A relevant Electron package is built and inspected.
- [x] Close `CHANGELOG.md` as 0.14.0 and bump package metadata.
- [x] Create the release commit and `v0.14.0` tag.
- [x] Publish the [GitHub Release](https://github.com/gabuvns/plumbago/releases/tag/v0.14.0) and verify every platform asset.

## Completed milestone: 1.0.0 — Visual theme configurator

Goal: a writer can meaningfully personalize a supported Hugo theme without learning its configuration schema, while every theme and unknown setting remains portable and recoverable.

### Product work

- [x] Discover configuration capabilities from the active theme's own files and safe built-in adapters instead of assuming one universal schema.
- [x] Provide visual controls for supported identity, colors, typography, navigation, social links, and homepage options with plain-language support levels.
- [x] Preview pending changes through the real Hugo site before modifying the blog configuration.
- [x] Preserve unknown configuration, explain unsupported options, and keep ordinary theme files available for advanced editing.
- [x] Save reusable local presets and preview their exact impact before applying them.
- [x] Create a recovery point before every applied configuration or preset and restore the previous configuration after a failed Hugo build.
- [x] Add responsive keyboard-accessible interactions, a mutable browser demo, and complete EN-US/PT-BR copy.

### Release gate

- [x] EN-US and PT-BR keys remain in parity.
- [x] Discovery, adapters, preservation, preview, presets, recovery, build rollback, IPC, and product-contract tests pass.
- [x] `npm test`, `npm run check`, and `npm audit --audit-level=high` pass.
- [x] Browser demos cover supported and unsupported themes, preview, apply, preset, rollback, and both languages without fresh console errors.
- [x] A relevant Electron package is built and inspected.
- [x] Close `CHANGELOG.md` as 1.0.0 and bump package metadata.
- [x] Create the release commit and `v1.0.0` tag.
- [x] Publish the [GitHub Release](https://github.com/gabuvns/plumbago/releases/tag/v1.0.0) and verify every platform asset.
