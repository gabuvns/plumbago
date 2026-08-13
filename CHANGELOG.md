# Changelog

## Unreleased

## 0.12.1 — 2026-08-13

- Keep edits made while autosave is finishing on top of Plumbago's own new file revision, preventing false external-change conflicts without weakening protection for genuine Obsidian or filesystem edits.
- Make an explicit Hugo `publishDate` the calendar authority so a late-night schedule stays on the blog-local day the writer selected, even when its UTC timestamp falls on the following day.
- Commit and push schedule changes immediately when background publishing is enabled, allowing the remote publication clock to see due content while Plumbago is closed.
- Detect local or unpushed calendar changes, explain when a schedule is safe locally but unavailable to GitHub, and provide a persistent retry action without rolling back the writer's work.
- Add regression coverage for queued autosaves, genuine external conflicts, near-midnight timezone conversion, Git divergence, schedule synchronization, and failed-push recovery.

## 0.12.0 — 2026-08-11

- Add a timezone-aware editorial calendar with month, week, agenda, and unscheduled views for published, scheduled, draft, conflicting, and expired Hugo content.
- Schedule, reschedule, return to draft, or publish immediately through drag and drop, accessible day targets, and an exact front-matter preview protected by a local recovery point.
- Keep schedules portable in standard Hugo `draft`, `date`, `publishDate`, and `expiryDate` fields while preserving unknown front matter and the blog's IANA timezone.
- Add a twice-hourly GitHub Actions publication clock so GitHub Pages or Cloudflare Pages rebuilds content that becomes due while Plumbago is closed, without building future posts early.
- Encrypt Cloudflare credentials as GitHub Actions secrets, require explicit consent before creating the workflow, and remove the secrets when background publishing is disabled.
- Show the next due post, provider state, last workflow run, delayed or failed publication diagnostics, and safe run-now controls in a responsive bilingual workspace.

## 0.11.0 — 2026-08-11

- Add a deterministic SEO and quality review for Hugo settings, front matter, Markdown, media references, generated output, and the production build.
- Find blocking broken links, missing media, invalid dates and canonical addresses, slug collisions, and failed or invalid Hugo output before publication.
- Explain non-blocking metadata, social image, alternative text, heading, sitemap, RSS, robots, base URL, and canonical recommendations in plain language.
- Apply only explicit, previewable safe fixes for descriptions, alternative text, the site title, and the production base URL, protected by recovery points.
- Run the review again immediately before publishing, block only errors, and keep publishing available when warnings or recommendations remain.
- Add a responsive bilingual review workspace with severity filters, affected-post shortcuts, clean states, and accessible compact navigation.

## 0.10.0 — 2026-08-11

- Add a blog-wide media library for page bundles, `content`, `static`, and Hugo assets without moving existing files.
- Search and filter images with previews, ownership, dimensions, file size, reference counts, duplicate detection, and usage diagnostics.
- Reuse an image in any post while preserving page-bundle ownership, multilingual bundles, and stable public paths.
- Edit alternative text and captions at the exact Markdown reference without rewriting surrounding prose.
- Create non-destructive resized, cropped, WebP, AVIF, JPEG, and PNG derivatives while keeping the source image intact.
- Replace media at the same Hugo path behind an automatic recovery point, and move only unreferenced images to a recoverable local media trash.
- Find missing files, missing alternative text, exact duplicates, oversized files, and unused media in a responsive bilingual workspace.

## 0.9.0 — 2026-08-11

- Add human-readable post and site history with saved-version dates, authors, change categories, and unpublished-change indicators.
- Compare a saved post with the current Markdown and restore only that post while preserving unrelated work and an automatic undo point.
- Create local recovery points before Blogger imports, theme changes, settings changes, and restore operations, with automatic rollback after protected failures.
- Move deleted posts and their page-bundle assets to a recoverable local trash while preserving assets shared by translations.
- Add a bilingual history and recovery workspace for post versions, whole-site activity, manual recovery points, trash restoration, and confirmed permanent deletion.
- Keep recovery and trash data outside normal publishing through an isolated `.plumbago` state directory.

## 0.8.0 — 2026-08-11

- Add a dedicated one-click deployment assistant for GitHub Pages and Cloudflare Pages with preflight, progress, logs, safe retry, redeploy, and provider switching.
- Make GitHub Pages provisioning idempotent, install and push the official Hugo workflow, trigger the build, and verify the actual public address.
- Add guided Cloudflare API-token connection with operating-system encryption, account and project selection, and no credentials stored in the blog.
- Create or reuse Cloudflare Pages projects safely, build Hugo locally with the final URL, and perform Direct Upload without requiring Wrangler.
- Keep resumable deployment state local and ignored by Git while recovering cleanly from an interrupted local operation.
- Offer provider details, the verified public-site shortcut, and custom-domain guidance only after a successful deployment.

## 0.7.1 — 2026-08-11

- Complete the Device Flow response normalization at the Electron IPC boundary so the authorization code is copied, opened, displayed, and polled correctly in official builds.

## 0.7.0 — 2026-08-10

- Add a versioned product roadmap with a tested GitHub Release after each major milestone.
- Make browser-based GitHub Device Flow the primary connection path, keep token and GitHub CLI fallbacks, and package the public OAuth client identity into official builds.
- Default new GitHub remotes to HTTPS and pass authorization to native or WSL Git only through transient environment variables.
- Create or connect a safe repository and upload the verified Hugo source from one primary action, with recoverable retry after partial failures.

## 0.6.0 — 2026-08-10

- Refresh the post list every few seconds so content created or changed in Obsidian and other editors appears automatically.
- Add safe post removal with explicit confirmation and preservation of attached image files.
- Separate local preview from the public-site shortcut and support GitHub Pages, Cloudflare Pages, and manually configured hosts.
- Support TOML front matter, repair duplicated Hugo archetype metadata, and protect newer external edits from being overwritten.
- Configure multilingual page bundles so adjacent images are included in published Hugo sites.
- Add a guided Hugo setup that shows the exact executable and environment, installs or updates Hugo Extended on Windows, and can reopen Windows-hosted blogs through a selected WSL distribution.

## 0.5.1 — 2026-08-10

- Add guided Git detection and setup for native Windows, Windows with WSL, Linux, and macOS environments.
- Help users install Git, test it again, initialize version history, and resume the interrupted publishing task.
- Fix the generated GitHub Pages workflow so deployments work with repositories using either `main` or `master`.
- Update the Electron runtime and packaging toolchain to versions containing current security fixes.
- Improve Linux desktop association for the AppImage window and launcher.
- Expand contributor guidance and make the README easier for writers and new contributors to follow.
