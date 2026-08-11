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

Status: release candidate

- [x] Browse post and site history without Git terminology.
- [x] Compare revisions and restore one post without reverting unrelated work.
- [x] Create automatic recovery points before imports, theme changes, and configuration changes.
- [x] Restore the last known-good site state after a failed operation.
- [x] Provide a recoverable trash flow for deleted posts and assets.

Definition of done: a writer can understand what changed and safely recover content without using the Git CLI.

### 0.10.0 — Media library

Status: planned

- [ ] Browse, search, preview, reuse, replace, and remove media across the blog.
- [ ] Detect unused, missing, duplicate, and oversized assets.
- [ ] Edit alternative text and captions where images are referenced.
- [ ] Offer crop, resize, and optimized WebP/AVIF derivatives through Hugo image resources.
- [ ] Preserve page-bundle ownership and multilingual image behavior.

Definition of done: images can be managed as a blog-wide library while their files remain portable Hugo resources.

### 0.11.0 — SEO and quality assistant

Status: planned

- [ ] Check title, description, slug, social image, canonical URL, and publish state.
- [ ] Detect broken internal links, missing image alternatives, heading problems, and slug collisions.
- [ ] Validate sitemap, RSS, robots directives, and the production Hugo build.
- [ ] Separate errors from recommendations and explain every suggested fix.
- [ ] Apply safe fixes individually; never rewrite prose without confirmation.

Definition of done: a deterministic pre-publish review catches common discoverability and accessibility mistakes with actionable fixes.

### 0.12.0 — Real editorial calendar

Status: planned

- [ ] Display drafts, scheduled posts, and published posts on a timezone-aware calendar.
- [ ] Schedule, reschedule, cancel, and immediately publish through direct manipulation.
- [ ] Publish scheduled content even while Plumbago is closed.
- [ ] Record scheduled run status and explain missed publications.
- [ ] Prevent accidental early publication of future content.

Definition of done: scheduled publishing is reliable without requiring the desktop app to remain running.

### 0.13.0 — Taxonomy manager

Status: planned

- [ ] Browse tags, categories, and custom Hugo taxonomies with post counts.
- [ ] Rename or merge terms across posts with a preview of affected files.
- [ ] Find duplicates, spelling variants, empty terms, and unclassified posts.
- [ ] Filter the post list by one or more terms.
- [ ] Preserve unknown front matter and theme-specific taxonomy settings.

Definition of done: a writer can keep a large blog consistently organized without bulk-editing front matter.

### 1.0.0 — Visual theme configurator

Status: planned

- [ ] Discover supported theme parameters without assuming one universal schema.
- [ ] Edit common branding, navigation, typography, social, and homepage options visually.
- [ ] Preview changes before writing them to the blog.
- [ ] Preserve unknown configuration and expose unsupported settings safely.
- [ ] Save presets and restore the configuration that existed before a change.

Definition of done: a writer can install and meaningfully customize a supported theme without editing configuration files, while unsupported themes remain fully usable through their original configuration.

## Current baseline

Version `0.6.0` provides external post refresh, safe deletion, local/public site shortcuts, multilingual page-bundle image publishing, TOML front matter repair, and guided Hugo environment management. It is the stable starting point for this roadmap.
