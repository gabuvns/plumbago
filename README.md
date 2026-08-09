# Plumbago

**A Hugo UI manager.** A desktop application for writing, organizing, and publishing Hugo blogs without relying on the command line for everyday work.

Website and downloads: [gabuvns.github.io/plumbago](https://gabuvns.github.io/plumbago/)

Source code and releases: [github.com/gabuvns/plumbago](https://github.com/gabuvns/plumbago)

Plumbago was designed first for Windows + WSL. It opens the blog folder through Windows file integration and runs Hugo and Git inside the corresponding WSL distribution. On Linux and macOS, it runs those tools natively.

## What Plumbago can do

- open an existing Hugo site without changing its structure;
- create a new Hugo site, initialize its Git repository, and configure its title and language;
- search the official Hugo theme gallery and install themes as Git submodules;
- find Markdown posts inside `content/posts`;
- create page bundles with the `hugo new content` command;
- edit the title, description, date, tags, draft state, and Markdown content;
- save automatically after typing while retaining a manual save button;
- switch between Markdown, visual editing, side-by-side writing, and a sanitized preview;
- schedule posts and filter the post list by published, scheduled, or draft status;
- open a library containing the images attached to a post;
- import images through the file picker or drag and drop, prevent filename collisions, and insert the corresponding Markdown with alternative text and captions;
- inspect image dimensions and size, reuse an existing image, or set it as the featured image;
- import posts, drafts, labels, dates, redirects, and remote images from a Blogger XML backup;
- start `hugo server` and open the real site preview;
- show the current branch, remote, and changed files;
- validate the Hugo build before publishing and show the live GitHub Actions deployment status;
- synchronize with any Git remote through commit, pull with rebase, and push;
- connect a GitHub account, create or select a repository, and configure GitHub Pages from a guided screen;
- reuse an authenticated GitHub CLI session when it is available in the blog environment;
- run a publishing health check for Hugo, Git, author identity, remote, GitHub, deployment workflow, and website build;
- configure the author, email address, and `origin` remote from the application menu;
- edit the public site title, URL, language, and copyright;
- provide an English interface by default, with Brazilian Portuguese also available;
- preserve front matter fields that Plumbago does not know yet.

## Development

Prerequisites:

- Node.js 20 or newer;
- Hugo Extended available in the same environment as the blog;
- Git configured, including remote authentication for synchronization.

```bash
npm install
npm run dev
```

To open only the demonstration interface in a browser:

```bash
npm run dev:web
```

## Checks

```bash
npm test
npm run check
```

The tests create temporary Hugo sites and Git repositories to exercise site creation, editing, images, themes, and synchronization. They also protect translation parity, Electron bridge channels, the Plumbago identity, the official color palette, and the CI configuration. No user blog is modified.

The CI workflow runs these tests and the production build on every push and every pull request.

## Local packages

Use the command for the platform where the package is being built:

```bash
npm run package:win
npm run package:linux
npm run package:mac
```

Generated files are placed in `release/`. Git operations reuse the authentication configured on the system or in WSL. For GitHub API features, Plumbago can reuse an authenticated GitHub CLI session, complete the browser device flow when a client ID is configured, or store a personal access token encrypted through Electron `safeStorage`. Tokens are never written to blog files.

## Automated releases

When a GitHub Release is published with a tag matching the `package.json` version prefixed with `v`—for example, `v0.5.0`—the workflow automatically creates:

- an NSIS installer for Windows x64;
- an AppImage for Linux x64;
- DMGs for Intel and Apple Silicon Macs.

All four packages are attached to the same release. To publish from the command line:

```bash
gh release create v0.5.0 --generate-notes
```

Before creating another release, update the version in `package.json` and `package-lock.json`.

## GitHub Pages

The contents of `site/` are automatically published by the GitHub Pages workflow after changes reach the `main` branch. The page fetches the latest release and directs each download button to the corresponding package.

## How WSL integration works

When the selected folder starts with `\\wsl.localhost\<distro>\...`, Plumbago extracts the distribution name and Linux path. Hugo and Git run through `wsl.exe -d <distro> --cd <folder> -- <program> <arguments>`. Arguments never pass through an intermediate shell.

## Roadmap

1. Custom domains and guided DNS checks.
2. Configurable content sections and front matter formats.
3. Version history and guided conflict resolution.
4. Signed installers, automatic updates, and Hugo/Git onboarding.
5. Optional analytics and newsletter integrations.

## License

GNU General Public License v3.0 (`GPL-3.0-only`).
