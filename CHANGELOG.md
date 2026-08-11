# Changelog

## Unreleased

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
