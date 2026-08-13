# Plumbago

**Write your Hugo blog without living in the terminal.**

Plumbago is a desktop app for creating, editing, and publishing Hugo sites. You keep the speed and portability of plain Markdown, Hugo, and Git, but everyday work happens through a friendly interface.

[Visit the website](https://gabuvns.github.io/plumbago/) · [Download the latest release](https://github.com/gabuvns/plumbago/releases/latest)

Development follows a milestone-based [product roadmap](ROADMAP.md) and an actively maintained [delivery plan](PLAN.md), with a tested downloadable release after every major feature.

## Why Plumbago exists

Hugo is wonderfully fast, but publishing a simple post can ask a writer to remember folders, front matter, terminal commands, image paths, Git commits, and deployment details. Plumbago handles that routine while leaving the site itself completely standard.

Your posts are still Markdown. Your images still live beside them. Your repository still works with Hugo and Git when Plumbago is closed.

## What a normal day looks like

Open your blog, choose a post, and start writing. Plumbago saves as you type, while a visible **Save now** button is always available. You can write in Markdown, use the visual editor, work side by side with a preview, or inspect the final rendered article. Posts that are already live open read-only; **Start a revision** deliberately unlocks one before you change it or publish the next version.

When the post needs an image, drag it into the app. Plumbago copies it into the page bundle, avoids filename collisions, and helps add alternative text or a caption. When the article is ready, open the local Hugo preview or, once hosting is configured, jump directly to the public site. Plumbago checks that Hugo can build the website before it creates a Git version and uploads anything.

Behind the scenes, a post remains pleasantly ordinary:

```text
content/posts/my-post/
├── index.en-us.md
├── index.pt-br.md
└── cover.jpg
```

Plumbago checks the content folder every few seconds. Posts created or changed by Obsidian and other tools appear without reopening the blog, while revision checks prevent an older editor tab from overwriting newer Markdown. Posts can also be removed from the list with an explicit confirmation; attached images are preserved rather than deleted silently.

## Start in a few minutes

1. [Download Plumbago](https://github.com/gabuvns/plumbago/releases/latest) for Windows, Linux, or macOS.
2. Open an existing Hugo site or let Plumbago create a new one.
3. If Hugo or Git is missing, use the guided setup for the exact environment where the blog lives.
4. Create a draft and write your first post.
5. Connect a Git repository when you are ready to publish.

Plumbago can connect an existing GitHub repository or create one for you. The guided publishing setup can also add the Hugo deployment workflow and configure GitHub Pages, so a first-time blogger does not need to assemble the hosting pieces by hand.

Official builds offer **Continue with GitHub** through a one-time browser code. After authorization, Plumbago can create an empty repository and upload the verified Hugo source from the same action. HTTPS is the default so new writers do not need to prepare SSH keys; the credential is supplied to Git only for the network operation and is never stored in the remote URL or blog files. If Git author details are missing, Plumbago uses the account name and GitHub's private `users.noreply.github.com` address instead of exposing the writer's personal email. GitHub CLI, SSH, and fine-grained tokens remain available as explicit fallbacks.

## Made for Windows + WSL

Windows users can keep their Hugo project inside WSL and select it through `\\wsl.localhost`. Plumbago detects both the native Windows installation and every available WSL installation instead of assuming that one Hugo fits every blog.

The **Manage Hugo** screen shows each environment's version, edition, architecture, executable, and whether it can build the current theme. Choose one runtime per blog and Plumbago uses it for site creation, preview, themes, reviews, deployments, and publishing without moving the blog folder. A Windows-drive blog can use either native Hugo or Hugo through WSL. A blog stored inside WSL's Linux filesystem uses Hugo from that distribution because native Windows Hugo cannot safely acquire Hugo's build lock there.

Plumbago can install or update Hugo Extended with Winget on Windows after showing the exact command and asking for confirmation. On WSL, Linux, and macOS it provides the appropriate copyable update command and official guide. A candidate is selected only after its installed Hugo performs a real in-memory build of the current blog, so an incompatible theme or Hugo edition is explained before it disrupts preview or publishing.

Git is checked separately in the environment implied by the blog path, so choosing a WSL Hugo for a Windows-drive blog does not silently move Git credentials or repository behavior. Plumbago explains whether Git is missing from Windows or a specific WSL distribution and provides the appropriate installation command. After installing, **Check again** continues the interrupted publishing task. Existing Hugo folders without version history can be initialized safely from the same screen; initialization remains local until you explicitly connect and publish to a remote repository.

On Linux and macOS, those tools run natively. The same blog stays portable across all three platforms.

## More than an editor

Plumbago can also help you:

- create a Hugo site and initialize Git;
- browse the official Hugo theme gallery;
- check a theme's Hugo requirements and roll back a failed installation;
- organize drafts, scheduled posts, published posts, tags, and featured images;
- create About, Gallery, and other Hugo pages without arranging content folders by hand;
- notice posts written by Obsidian or another external editor;
- remove Markdown posts without silently deleting their attached images;
- import posts and images from a Blogger XML backup;
- configure site title, language, URL, and copyright;
- choose GitHub Pages, Cloudflare Pages, or another public host and save its public address;
- inspect Git, GitHub Pages, deployment, and Hugo health in one place;
- synchronize with any Git remote;
- check for and install new Plumbago releases.

The **Tags & categories** workspace reads Hugo's configured taxonomies across the whole blog. It highlights spelling variants, empty term pages, draft-only usage, and posts that still need classification. You can filter the post list, edit several posts, or rename and merge terms only after reviewing the exact files, languages, publication states, and public routes affected. Every bulk change creates a local recovery point first.

The **Pages & routes** workspace maps Markdown pages, leaf and branch bundles, translations, aliases, Hugo menus, automatic section and taxonomy routes, and theme-specific layouts. Create an `/about/` or `/gallery/` page from a short form, or change a public route while keeping the old address as a Hugo redirect. Before removing anything, Plumbago shows the exact source and bundled resources involved and creates a recovery point. Shared translation resources and section descendants are protected; non-Markdown Hugo content stays untouched and usable through its original files.

The interface is available in English by default and Brazilian Portuguese. Accessibility settings include a persistent writing and preview font-size control with a live H1/H2/H3 sample; it changes only the local Plumbago reading surface, never your Markdown or public theme.

## Your files stay yours

Plumbago does not replace Hugo or hide your blog in a proprietary format. It preserves front matter fields it does not understand, does not upload content merely because you saved it, and validates a build before publishing.

YAML (`---`), TOML (`+++`), and Hugo's JSON front matter are supported. Plumbago also repairs the duplicated archetype metadata produced by older versions of the editor. Language-aware page bundles are configured before preview and publishing so images stored beside `index.<language>.md` are copied to the final Hugo site.

Git authentication stays with the operating system, WSL, SSH, or the GitHub CLI whenever possible. If you connect GitHub with a token, Plumbago stores it with Electron's encrypted `safeStorage`; it is never written into the blog.

Theme changes are tested before activation. Failed theme installations restore the previous configuration. Blogger imports preserve the original export and do not silently overwrite existing posts.

## Prefer writing in Obsidian?

[Publish to Plumbago](https://github.com/gabuvns/plumbago-obsidian-plugin) is the companion Obsidian plugin. It lets Obsidian remain your writing home while it validates and copies posts and images into Plumbago's Hugo structure.

## Contributing

Plumbago uses React and Vite for the renderer and Electron for desktop integration. You will need Node.js 22.12 or newer, plus Hugo Extended and Git in the environment where the test blog runs.

```bash
npm install
npm run dev
```

To work on the renderer without starting Electron:

```bash
npm run dev:web
```

Before opening a pull request, run both gates:

```bash
npm test
npm run check
```

The test suite creates disposable Hugo sites and Git repositories. It covers content, images, themes, WSL command handling, synchronization, localization, Electron bridge contracts, product identity, and release workflows without changing a real blog.

For detailed architecture, safety, testing, and contribution rules, read [AGENTS.md](AGENTS.md).

## Architecture at a glance

```text
src/
├── app/          application orchestration
├── components/   shared UI
├── features/     editor and product workflows
└── lib/          framework-independent helpers
electron/
├── core/         HTTP, updates, and native/WSL execution
├── services/     content, GitHub, publishing, site, and themes
└── plumbago-service.cjs  stable service facade
```

The renderer has no direct filesystem or process access. A narrow preload bridge sends validated work to the Electron service layer. This keeps platform details out of the UI and makes browser-only development possible through the demo bridge.

## Building an installer

Use the command for the target platform:

```bash
npm run package:win
npm run package:linux
npm run package:mac
```

Packages are written to `release/`. Building Windows packages from Linux may require Wine; building on the target operating system is usually the least surprising route.

## Releases and website

A published GitHub release tagged `v<package-version>` starts the cross-platform workflow. It builds a Windows x64 installer, a Linux x64 AppImage, and DMGs for Intel and Apple Silicon Macs, then attaches them to the same release.

The macOS packages are currently unsigned, so macOS updates remain a manual download. Windows and Linux releases include the metadata used by the in-app updater.

The project website lives in `site/` and deploys to the standard GitHub Pages address after changes reach `main`.

## License

Plumbago is licensed under the GNU General Public License v3.0 (`GPL-3.0-only`).
