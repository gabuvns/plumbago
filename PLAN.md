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

## Active milestone: 0.9.0 — History and recovery

Goal: writers can understand what changed, recover one post or the whole site after a risky operation, and retrieve deleted work without learning Git terminology.

### Product work

- [ ] Add a human-readable history service for posts and site-wide changes.
- [ ] Compare two post revisions and restore one post without reverting unrelated work.
- [ ] Create automatic recovery points before imports, theme changes, and configuration changes.
- [ ] Restore the last known-good site state after a failed protected operation.
- [ ] Move deleted posts and page-bundle assets to a recoverable local trash instead of leaving orphaned files.
- [ ] Add a history and trash interface with clear impact summaries, confirmation, and undo feedback.

### Release gate

- [ ] EN-US and PT-BR keys remain in parity.
- [ ] History, comparison, checkpoint, restore, trash, IPC, and product-contract tests pass.
- [ ] `npm test`, `npm run check`, and `npm audit --audit-level=high` pass.
- [ ] Browser demos cover post restore, recovery points, and trash without console errors.
- [ ] A relevant Electron package is built and inspected.
- [ ] Close `CHANGELOG.md` as 0.9.0 and bump package metadata.
- [ ] Create the release commit and `v0.9.0` tag.
- [ ] Publish the GitHub Release and verify every platform asset.

## Following milestone

`0.10.0 — Media library` begins only after `v0.9.0` is downloadable.
