# Plumbago product roadmap

This roadmap keeps product work ordered around complete writer workflows instead of isolated controls. Versions are closed one major feature at a time so every milestone remains downloadable and recoverable.

## Release discipline

Every milestone must:

1. preserve ordinary Hugo, Markdown, image, and Git compatibility;
2. work in native Windows, Windows with WSL, Linux, and macOS where the provider supports it;
3. keep credentials out of the blog and store secrets through Electron `safeStorage`;
4. ship English and Brazilian Portuguese copy together;
5. add regression tests for service, IPC, and critical UI contracts;
6. pass `npm test`, `npm run check`, `npm audit --audit-level=high`, and a relevant package build;
7. move its notes from `Unreleased` into a dated changelog version;
8. finish with a release commit, tag, GitHub Release, green CI, and downloadable platform artifacts.

## Milestones

### 0.7.0 — GitHub Connect

Status: released on 2026-08-11 — [v0.7.1](https://github.com/gabuvns/plumbago/releases/tag/v0.7.1)

- [x] Make **Continue with GitHub** the primary authentication path without asking the writer to create a token.
- [x] Explain and recover from missing, expired, denied, or insufficient authorization.
- [x] Create a repository or choose an existing writable repository in the same guided flow.
- [x] Prefer HTTPS credentials for new writers while preserving SSH as an advanced option.
- [x] Push the first commit and show the connected account, repository, and next action.
- [x] Keep GitHub CLI and fine-grained tokens as explicit fallback methods.

Definition of done: a first-time user can authorize GitHub, connect a blog, and upload its source without copying a credential or opening a terminal.

### 0.8.0 — One-click deploy

Status: released on 2026-08-11 — [v0.8.0](https://github.com/gabuvns/plumbago/releases/tag/v0.8.0)

- [x] Add a provider-neutral deployment service and resumable provisioning state.
- [x] Provision GitHub Pages, install the Hugo workflow, deploy, and discover the live URL.
- [x] Provision Cloudflare Pages through Direct Upload, build locally, deploy, and discover the live URL.
- [x] Show progress, logs, retry, and actionable provider-specific errors.
- [x] Make repeated setup calls idempotent and never create duplicate projects silently.
- [x] Offer custom-domain setup after the first successful deployment.

Definition of done: after provider authorization and a few blog choices, one primary action takes a new Hugo blog from local folder to a verified public URL.

### 0.9.0 — History and recovery

Status: released on 2026-08-11 — [v0.9.0](https://github.com/gabuvns/plumbago/releases/tag/v0.9.0)

- [x] Browse post and site history without Git terminology.
- [x] Compare revisions and restore one post without reverting unrelated work.
- [x] Create automatic recovery points before imports, theme changes, and configuration changes.
- [x] Restore the last known-good site state after a failed operation.
- [x] Provide a recoverable trash flow for deleted posts and assets.

Definition of done: a writer can understand what changed and safely recover content without using the Git CLI.

### 0.10.0 — Media library

Status: released on 2026-08-11 — [v0.10.0](https://github.com/gabuvns/plumbago/releases/tag/v0.10.0)

- [x] Browse, search, preview, reuse, replace, and remove media across the blog.
- [x] Detect unused, missing, duplicate, and oversized assets.
- [x] Edit alternative text and captions where images are referenced.
- [x] Offer crop, resize, and optimized WebP/AVIF derivatives through Hugo image resources.
- [x] Preserve page-bundle ownership and multilingual image behavior.

Definition of done: images can be managed as a blog-wide library while their files remain portable Hugo resources.

### 0.11.0 — SEO and quality assistant

Status: released on 2026-08-11 — [v0.11.0](https://github.com/gabuvns/plumbago/releases/tag/v0.11.0)

- [x] Check title, description, slug, social image, canonical URL, and publish state.
- [x] Detect broken internal links, missing image alternatives, heading problems, and slug collisions.
- [x] Validate sitemap, RSS, robots directives, and the production Hugo build.
- [x] Separate errors from recommendations and explain every suggested fix.
- [x] Apply safe fixes individually; never rewrite prose without confirmation.

Definition of done: a deterministic pre-publish review catches common discoverability and accessibility mistakes with actionable fixes.

### 0.12.0 — Real editorial calendar

Status: released in [v0.12.0](https://github.com/gabuvns/plumbago/releases/tag/v0.12.0)

- [x] Display drafts, scheduled posts, and published posts on a timezone-aware calendar.
- [x] Schedule, reschedule, cancel, and immediately publish through direct manipulation.
- [x] Publish scheduled content even while Plumbago is closed.
- [x] Record scheduled run status and explain missed publications.
- [x] Prevent accidental early publication of future content.

Definition of done: scheduled publishing is reliable without requiring the desktop app to remain running.

### 0.12.1 — Editorial integrity hotfix

Status: released on 2026-08-13 — [v0.12.1](https://github.com/gabuvns/plumbago/releases/tag/v0.12.1)

- [x] Keep genuine external-edit protection without false conflicts caused by Plumbago's own saves or refresh loop.
- [x] Show scheduled content on the same blog-local calendar day selected in the editor.
- [x] Ensure schedule changes reach Git whenever background publication relies on the remote repository.
- [x] Explain and recover from a schedule that was saved locally but could not be pushed.

Definition of done: editing and scheduling cannot silently lose work, drift a calendar day, or leave background publication dependent on an unsynchronized local change.

### 0.12.2 — Editorial safeguards and accessibility

Status: released on 2026-08-13 — [v0.12.2](https://github.com/gabuvns/plumbago/releases/tag/v0.12.2)

- [x] Make published posts read-only by default and provide an explicit revise flow.
- [x] Match Markdown heading hierarchy in the live preview.
- [x] Add a persistent font-size slider with preview, keyboard operation, and screen-reader labels.

Definition of done: published content is protected from accidental edits and writers can comfortably read and operate the editor without losing Markdown semantics.

### 0.12.3 — Windows and WSL Hugo management

Status: active

- [ ] Detect native Windows and WSL Hugo versions separately.
- [ ] Let each blog choose its Hugo runtime and validate that choice.
- [ ] Update the selected installation in place through a guided, diagnosable flow.

Definition of done: a Windows writer can see, choose, test, and update the exact Hugo installation Plumbago will use.

### 0.13.0 — Taxonomy manager

Status: planned

- [ ] Browse tags, categories, and custom Hugo taxonomies with post counts.
- [ ] Rename or merge terms across posts with a preview of affected files.
- [ ] Find duplicates, spelling variants, empty terms, and unclassified posts.
- [ ] Filter the post list by one or more terms.
- [ ] Preserve unknown front matter and theme-specific taxonomy settings.

Definition of done: a writer can keep a large blog consistently organized without bulk-editing front matter.

### 0.14.0 — Route and page manager

Status: planned

- [ ] Browse and create standalone routes such as `/about` and `/gallery`.
- [ ] Detect collisions, aliases, menus, multilingual routes, and theme-dependent layouts.
- [ ] Rename or remove pages through an exact impact preview and recovery point.
- [ ] Preserve unknown front matter and ordinary Hugo content portability.

Definition of done: a writer can manage the blog's main pages and routes without manually reorganizing the content tree.

### 1.0.0 — Visual theme configurator

Status: planned

- [ ] Discover supported theme parameters without assuming one universal schema.
- [ ] Edit common branding, navigation, typography, social, and homepage options visually.
- [ ] Preview changes before writing them to the blog.
- [ ] Preserve unknown configuration and expose unsupported settings safely.
- [ ] Save presets and restore the configuration that existed before a change.

Definition of done: a writer can install and meaningfully customize a supported theme without editing configuration files, while unsupported themes remain fully usable through their original configuration.

## Current baseline

Version `0.12.2` provides GitHub connection, one-click deployment, external post refresh, guided Hugo management, human-readable history, local recovery points, recoverable deletion, a blog-wide media library, deterministic site review, a hardened editorial calendar, protected published posts, accurate Markdown heading hierarchy, and persistent editor reading preferences. Windows and WSL Hugo runtime management is the active next milestone.
