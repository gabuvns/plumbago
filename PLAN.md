# Plumbago delivery plan

This file tracks the active milestone. The longer product sequence and definitions of done live in [ROADMAP.md](ROADMAP.md).

## Active milestone: 0.7.0 — GitHub Connect

Goal: a first-time writer can authorize GitHub, create or select a safe repository, and upload the Hugo source without copying a credential or opening a terminal.

### Product work

- [x] Make GitHub Device Flow the primary sign-in path.
- [x] Encrypt the resulting token with Electron `safeStorage`.
- [x] Keep GitHub CLI and fine-grained token authentication as fallback paths.
- [x] Default new connections to HTTPS and preserve SSH as an advanced option.
- [x] Pass HTTPS authorization to native and WSL Git without writing it to the remote URL or blog.
- [x] Fill missing Git author details with the account name and GitHub noreply address.
- [x] Create a repository and upload the verified Hugo source from one primary action.
- [x] Connect only empty repositories from the setup wizard; direct writers with existing history to clone and open it.
- [x] Preserve partial progress and offer upload retry without recreating the repository.
- [x] Explain expired authorization, missing permission, and GitHub API limits.
- [x] Register the official Plumbago OAuth App and configure its public Client ID in GitHub Actions.
- [x] Verify the real Device Flow against the registered app.

### Release gate

- [x] EN-US and PT-BR keys remain in parity.
- [x] Service, runtime, packaging metadata, and product-contract tests added.
- [x] `npm test` passes.
- [x] `npm run check` passes.
- [x] `npm audit --audit-level=high` reports no vulnerabilities.
- [x] Browser demo covers sign-in, repository creation, initial upload, and retry state without console errors.
- [x] A packaged Electron app contains the injected OAuth Client ID metadata.
- [x] Validate a release package using the official Client ID.
- [x] Close `CHANGELOG.md` as 0.7.0 and bump package metadata.
- [x] Create the release commit.
- [ ] Create the `v0.7.0` tag.
- [ ] Publish the GitHub Release and wait for all platform assets.

## Next milestone

`0.8.0 — One-click deploy` starts only after 0.7.0 is downloadable. It will add provider-neutral provisioning, GitHub Pages deployment, and Cloudflare Pages Direct Upload. Deployment-specific work must not be folded into the authentication milestone merely because GitHub Pages already has partial support.
