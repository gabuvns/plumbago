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

## Active milestone: 0.11.0 — SEO and quality assistant

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
- [ ] Create the release commit and `v0.11.0` tag.
- [ ] Publish the GitHub Release and verify every platform asset.
