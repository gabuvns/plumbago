const fs = require('node:fs/promises')
const path = require('node:path')
const { execFile, spawn } = require('node:child_process')
const { promisify } = require('node:util')
const matter = require('gray-matter')
const YAML = require('yaml')
const { XMLParser } = require('fast-xml-parser')
const TurndownService = require('turndown')

const execFileAsync = promisify(execFile)
const IMAGE_EXTENSIONS = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp'])
const CONFIG_FILES = ['hugo.toml', 'hugo.yaml', 'hugo.yml', 'hugo.json', 'config.toml', 'config.yaml', 'config.yml']
const THEME_CATALOG_URL = 'https://themes.gohugo.io/'
const THEME_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,100}$/
let themeCatalogCache = null
let themeCatalogCachedAt = 0

async function fetchText(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Plumbago-Hugo-UI/0.5.0' },
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.text()
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchJson(url) {
  return JSON.parse(await fetchText(url))
}

async function postForm(url, values) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Plumbago-Hugo-UI/0.5.0',
      },
      body: new URLSearchParams(values),
      signal: controller.signal,
    })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error_description || payload.message || `GitHub returned HTTP ${response.status}.`)
    return payload
  } finally {
    clearTimeout(timeout)
  }
}

async function githubRequest(token, route, options = {}) {
  if (!token) throw new Error('Connect a GitHub account first.')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20_000)
  try {
    const response = await fetch(`https://api.github.com${route}`, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Plumbago-Hugo-UI/0.5.0',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    })
    const payload = response.status === 204 ? null : await response.json().catch(() => null)
    if (!response.ok) {
      const detail = payload?.errors?.map((item) => item.message || item.code).filter(Boolean).join(', ')
      const error = new Error(detail || payload?.message || `GitHub returned HTTP ${response.status}.`)
      error.status = response.status
      throw error
    }
    return payload
  } finally {
    clearTimeout(timeout)
  }
}

async function beginGitHubSignIn(clientId) {
  if (!clientId) throw new Error('GitHub sign-in is not configured in this Plumbago build.')
  return postForm('https://github.com/login/device/code', { client_id: clientId, scope: 'repo read:user user:email' })
}

async function completeGitHubSignIn(clientId, deviceCode) {
  const payload = await postForm('https://github.com/login/oauth/access_token', {
    client_id: clientId,
    device_code: deviceCode,
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
  })
  if (payload.access_token) return { state: 'complete', token: payload.access_token, scope: payload.scope || '' }
  const states = {
    authorization_pending: 'pending',
    slow_down: 'slow-down',
    expired_token: 'expired',
    access_denied: 'denied',
  }
  return { state: states[payload.error] || 'error', description: payload.error_description || '' }
}

async function githubAccount(token) {
  const account = await githubRequest(token, '/user')
  return {
    login: account.login,
    name: account.name || account.login,
    avatarUrl: account.avatar_url,
    profileUrl: account.html_url,
  }
}

async function githubCliToken(root) {
  return run(root, 'gh', ['auth', 'token', '--hostname', 'github.com']).then((result) => result.stdout)
}

async function listGitHubRepositories(token) {
  const repositories = await githubRequest(token, '/user/repos?affiliation=owner%2Ccollaborator%2Corganization_member&sort=updated&per_page=100')
  return repositories.map((repository) => ({
    fullName: repository.full_name,
    name: repository.name,
    owner: repository.owner.login,
    private: repository.private,
    url: repository.html_url,
    sshUrl: repository.ssh_url,
    cloneUrl: repository.clone_url,
    permissions: repository.permissions || {},
  }))
}

async function createGitHubRepository(root, token, input) {
  const name = String(input?.name || '').trim()
  if (!/^[A-Za-z0-9_.-]{1,100}$/.test(name)) throw new Error('Choose a valid repository name.')
  const repository = await githubRequest(token, '/user/repos', {
    method: 'POST',
    body: {
      name,
      description: String(input?.description || '').trim(),
      private: Boolean(input?.private),
      has_issues: true,
      has_projects: false,
      has_wiki: false,
    },
  })
  const remote = input?.protocol === 'https' ? repository.clone_url : repository.ssh_url
  const config = await saveGitConfig(root, { remote })
  return {
    repository: {
      fullName: repository.full_name,
      name: repository.name,
      owner: repository.owner.login,
      private: repository.private,
      url: repository.html_url,
      sshUrl: repository.ssh_url,
      cloneUrl: repository.clone_url,
    },
    config,
  }
}

async function connectGitHubRepository(root, token, fullName, protocol = 'ssh') {
  if (!/^[\w.-]+\/[\w.-]+$/.test(String(fullName || ''))) throw new Error('Choose a valid GitHub repository.')
  const repository = await githubRequest(token, `/repos/${fullName}`)
  if (!repository.permissions?.push) throw new Error('Your GitHub account does not have permission to publish to this repository.')
  const remote = protocol === 'https' ? repository.clone_url : repository.ssh_url
  const config = await saveGitConfig(root, { remote })
  return { repository: { fullName: repository.full_name, url: repository.html_url }, config }
}

function decodeHtml(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
}

function parseThemeCatalog(html) {
  const themes = []
  const seen = new Set()
  const linkPattern = /<a\s+href=\/themes\/([^/\s]+)\/[^>]*>\s*<span[^>]*>View details for ([^<]+)<\/span>/gi
  for (const match of html.matchAll(linkPattern)) {
    const slug = match[1].toLowerCase()
    if (!THEME_SLUG_PATTERN.test(slug) || seen.has(slug)) continue
    const nearbyMarkup = html.slice(Math.max(0, match.index - 1_300), match.index)
    const images = [...nearbyMarkup.matchAll(/(?:src|srcset)=([^\s>]+)/gi)]
    const imagePath = images.at(-1)?.[1]?.replace(/^['"]|['"]$/g, '') || `/themes/${slug}/tn-featured.png`
    seen.add(slug)
    themes.push({
      slug,
      name: decodeHtml(match[2].trim()),
      image: new URL(imagePath, THEME_CATALOG_URL).href,
      details: `${THEME_CATALOG_URL}themes/${slug}/`,
    })
  }
  return themes
}

function parseThemeRepository(html) {
  for (const match of html.matchAll(/<a\b([^>]+)>/gi)) {
    const attributes = match[1]
    if (!/\brel=(?:"[^"]*nofollow[^"]*"|'[^']*nofollow[^']*'|nofollow)(?:\s|$)/i.test(attributes)) continue
    const href = attributes.match(/\bhref=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i)
    const candidate = href?.[1] || href?.[2] || href?.[3]
    if (!candidate) continue
    let url
    try { url = new URL(candidate) } catch { continue }
    if (!['github.com', 'gitlab.com', 'codeberg.org'].includes(url.hostname)) continue
    const segments = url.pathname.replace(/\.git\/?$/, '').split('/').filter(Boolean)
    if (segments.at(-1)?.match(/^v\d+$/i)) segments.pop()
    if (segments.length < 2) continue
    url.pathname = `/${segments.join('/')}.git`
    url.search = ''
    url.hash = ''
    return url.href
  }
  throw new Error('O repositório deste tema não foi encontrado no catálogo oficial do Hugo.')
}

async function listThemes() {
  if (themeCatalogCache && Date.now() - themeCatalogCachedAt < 15 * 60_000) return themeCatalogCache
  const themes = parseThemeCatalog(await fetchText(THEME_CATALOG_URL))
  if (!themes.length) throw new Error('O catálogo oficial de temas do Hugo não pôde ser lido.')
  themeCatalogCache = themes
  themeCatalogCachedAt = Date.now()
  return themes
}

async function resolveTheme(slug) {
  const safeSlug = String(slug || '').toLowerCase()
  if (!THEME_SLUG_PATTERN.test(safeSlug)) throw new Error('Tema inválido.')
  const details = `${THEME_CATALOG_URL}themes/${safeSlug}/`
  const repository = parseThemeRepository(await fetchText(details))
  const folder = path.basename(new URL(repository).pathname, '.git')
  return { slug: safeSlug, details, repository, folder }
}

function runtimeFor(root) {
  const normalized = root.replaceAll('/', '\\')
  const match = normalized.match(/^\\\\(?:wsl\.localhost|wsl\$)\\([^\\]+)\\(.*)$/i)
  if (match) {
    return { kind: 'wsl', distro: match[1], workingDirectory: `/${match[2].replaceAll('\\', '/')}` }
  }
  return { kind: 'native', workingDirectory: root }
}

async function run(root, command, args = [], options = {}) {
  const runtime = runtimeFor(root)
  const commandOptions = { maxBuffer: 8 * 1024 * 1024, windowsHide: true, ...options }
  try {
    if (runtime.kind === 'wsl' && process.platform === 'win32') {
      const result = await execFileAsync(
        'wsl.exe',
        ['-d', runtime.distro, '--cd', runtime.workingDirectory, '--', command, ...args],
        commandOptions,
      )
      return { stdout: result.stdout.trim(), stderr: result.stderr.trim() }
    }
    const result = await execFileAsync(command, args, { ...commandOptions, cwd: root })
    return { stdout: result.stdout.trim(), stderr: result.stderr.trim() }
  } catch (error) {
    const detail = [error.stderr, error.stdout, error.message].filter(Boolean).join('\n').trim()
    throw new Error(detail || `Não foi possível executar ${command}.`)
  }
}

function spawnLongRunning(root, command, args = []) {
  const runtime = runtimeFor(root)
  if (runtime.kind === 'wsl' && process.platform === 'win32') {
    return spawn('wsl.exe', ['-d', runtime.distro, '--cd', runtime.workingDirectory, '--', command, ...args], {
      windowsHide: true,
      stdio: 'ignore',
    })
  }
  return spawn(command, args, { cwd: root, stdio: 'ignore' })
}

function safeRelative(value) {
  const normalized = value.replaceAll('\\', '/')
  if (!normalized || normalized.startsWith('/') || normalized.includes('../')) throw new Error('Caminho de conteúdo inválido.')
  return normalized
}

function contentPath(root, id) {
  const relative = safeRelative(id)
  if (!relative.startsWith('content/')) throw new Error('O arquivo precisa estar na pasta content.')
  const resolved = path.resolve(root, ...relative.split('/'))
  const contentRoot = path.resolve(root, 'content')
  if (!resolved.startsWith(`${contentRoot}${path.sep}`)) throw new Error('Caminho fora do blog.')
  return resolved
}

function readThemeValue(raw, config) {
  try {
    if (config.endsWith('.json')) return JSON.parse(raw).theme || ''
    if (config.endsWith('.yaml') || config.endsWith('.yml')) return YAML.parse(raw).theme || ''
  } catch {
    return ''
  }
  const match = raw.match(/^\s*theme\s*=\s*["']([^"']+)["']/m)
  return match?.[1] || ''
}

function readConfigValue(raw, config, key) {
  try {
    if (config.endsWith('.json')) return JSON.parse(raw)?.[key]
    if (config.endsWith('.yaml') || config.endsWith('.yml')) return YAML.parse(raw)?.[key]
  } catch {
    return undefined
  }
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = raw.match(new RegExp(`^\\s*${escapedKey}\\s*=\\s*["']([^"']*)["']`, 'm'))
  return match?.[1]
}

function parseGitHubRemote(remote) {
  const value = String(remote || '').trim()
  let match = value.match(/^git@github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?$/i)
  if (!match) match = value.match(/^(?:ssh|https?):\/\/(?:git@)?github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i)
  if (!match) return null
  const owner = match[1]
  const repository = match[2].replace(/\.git$/i, '')
  if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repository)) return null
  return {
    owner,
    repository,
    fullName: `${owner}/${repository}`,
    url: `https://github.com/${owner}/${repository}`,
  }
}

function defaultGitHubPagesUrl(repository) {
  if (!repository) return ''
  return repository.repository.toLowerCase() === `${repository.owner.toLowerCase()}.github.io`
    ? `https://${repository.owner}.github.io/`
    : `https://${repository.owner}.github.io/${repository.repository}/`
}

function githubPagesWorkflow(branch, hugoVersion) {
  return `# Generated by Plumbago. You can customize this workflow at any time.
name: Deploy Hugo site to Pages

on:
  push:
    branches: [${JSON.stringify(branch)}]
  schedule:
    - cron: "17 * * * *"
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

defaults:
  run:
    shell: bash

jobs:
  build:
    runs-on: ubuntu-latest
    env:
      DART_SASS_VERSION: 1.101.0
      HUGO_VERSION: ${hugoVersion}
      NODE_VERSION: 24
    steps:
      - name: Check out blog
        uses: actions/checkout@v7
        with:
          submodules: recursive
          fetch-depth: 0
      - name: Set up Pages
        id: pages
        uses: actions/configure-pages@v6
      - name: Install Node.js when needed
        if: hashFiles('package-lock.json') != ''
        uses: actions/setup-node@v6
        with:
          node-version: \${{ env.NODE_VERSION }}
      - name: Install Dart Sass
        run: |
          mkdir -p "\${HOME}/.local"
          curl -sfL -o \${{ runner.temp }}/dart-sass.tar.gz https://github.com/sass/dart-sass/releases/download/\${DART_SASS_VERSION}/dart-sass-\${DART_SASS_VERSION}-linux-x64.tar.gz
          tar -C "\${HOME}/.local" -xf \${{ runner.temp }}/dart-sass.tar.gz
          echo "\${HOME}/.local/dart-sass" >> "\${GITHUB_PATH}"
      - name: Install Hugo Extended
        run: |
          curl -sfL -o \${{ runner.temp }}/hugo.deb https://github.com/gohugoio/hugo/releases/download/v\${HUGO_VERSION}/hugo_extended_\${HUGO_VERSION}_linux-amd64.deb
          sudo dpkg -i \${{ runner.temp }}/hugo.deb
      - name: Install Node.js dependencies when present
        if: hashFiles('package-lock.json') != ''
        run: npm ci
      - name: Build with Hugo
        env:
          HUGO_CACHEDIR: \${{ runner.temp }}/hugo_cache
          HUGO_ENVIRONMENT: production
        run: hugo --gc --minify --baseURL "\${{ steps.pages.outputs.base_url }}/"
      - name: Upload website
        uses: actions/upload-pages-artifact@v5
        with:
          path: ./public

  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Publish website
        id: deployment
        uses: actions/deploy-pages@v5
`
}

async function siteMetadata(root) {
  const entries = await fs.readdir(root)
  const config = CONFIG_FILES.find((candidate) => entries.includes(candidate))
  if (!config) return { title: '', baseURL: '' }
  const raw = await fs.readFile(path.join(root, config), 'utf8').catch(() => '')
  return {
    title: String(readConfigValue(raw, config, 'title') || ''),
    baseURL: String(readConfigValue(raw, config, 'baseURL') || ''),
    languageCode: String(readConfigValue(raw, config, 'languageCode') || ''),
    copyright: String(readConfigValue(raw, config, 'copyright') || ''),
  }
}

async function siteSettings(root) {
  const context = await validateBlog(root)
  return { ...(await siteMetadata(root)), theme: context.theme, config: context.config }
}

async function saveSiteSettings(root, input) {
  const title = String(input?.title || '').trim()
  let baseURL = String(input?.baseURL || '').trim()
  const languageCode = String(input?.languageCode || '').trim()
  const copyright = String(input?.copyright || '').trim()
  if (!title) throw new Error('Give your blog a title.')
  if (baseURL) {
    let parsed
    try { parsed = new URL(baseURL) } catch { throw new Error('Enter a valid website address.') }
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('The website address must use HTTP or HTTPS.')
    if (!parsed.pathname.endsWith('/')) parsed.pathname += '/'
    baseURL = parsed.href
  }
  await updateSiteConfig(root, { title, baseURL, languageCode, copyright })
  return siteSettings(root)
}

async function configureGitHubPages(root, token) {
  const context = await validateBlog(root)
  const status = await gitStatus(root)
  const repository = parseGitHubRemote(status.remote)
  if (!repository) throw new Error('Connect this blog to a GitHub repository first.')
  await githubRequest(token, `/repos/${repository.fullName}`)

  const branch = status.branch || 'main'
  const hugoVersion = context.hugo?.match(/hugo v(\d+\.\d+\.\d+)/i)?.[1] || '0.128.0'
  const workflowDirectory = path.join(root, '.github', 'workflows')
  const workflowPath = path.join(workflowDirectory, 'plumbago-pages.yml')
  await fs.mkdir(workflowDirectory, { recursive: true })
  await fs.writeFile(workflowPath, githubPagesWorkflow(branch, hugoVersion), 'utf8')
  const liveUrl = defaultGitHubPagesUrl(repository)
  await updateSiteConfig(root, { baseURL: liveUrl })

  let warning = ''
  try {
    try {
      await githubRequest(token, `/repos/${repository.fullName}/pages`)
      await githubRequest(token, `/repos/${repository.fullName}/pages`, { method: 'PUT', body: { build_type: 'workflow' } })
    } catch (error) {
      if (error.status !== 404) throw error
      await githubRequest(token, `/repos/${repository.fullName}/pages`, { method: 'POST', body: { build_type: 'workflow' } })
    }
  } catch (error) {
    warning = error.message
  }

  return {
    branch,
    hugoVersion,
    liveUrl,
    repository,
    warning,
    workflow: '.github/workflows/plumbago-pages.yml',
  }
}

async function updateSiteConfig(root, updates) {
  const entries = await fs.readdir(root)
  const config = CONFIG_FILES.find((candidate) => entries.includes(candidate))
  if (!config) throw new Error('Nenhum arquivo de configuração do Hugo foi encontrado.')
  const absolute = path.join(root, config)
  const raw = await fs.readFile(absolute, 'utf8')
  let next
  if (config.endsWith('.json')) {
    next = `${JSON.stringify({ ...JSON.parse(raw), ...updates }, null, 2)}\n`
  } else if (config.endsWith('.yaml') || config.endsWith('.yml')) {
    next = YAML.stringify({ ...YAML.parse(raw), ...updates }, { lineWidth: 0 })
  } else {
    next = raw
    for (const [key, value] of Object.entries(updates)) {
      const line = `${key} = ${JSON.stringify(value)}`
      const pattern = new RegExp(`^\\s*${key}\\s*=.*$`, 'm')
      next = pattern.test(next) ? next.replace(pattern, line) : `${next.trimEnd()}\n${line}\n`
    }
  }
  await fs.writeFile(absolute, next, 'utf8')
  return config
}

async function ensureGitRepository(root) {
  const gitEntry = await fs.stat(path.join(root, '.git')).catch(() => null)
  if (gitEntry) return
  try {
    await run(root, 'git', ['init', '-b', 'main'])
  } catch {
    await run(root, 'git', ['init'])
    await run(root, 'git', ['branch', '-M', 'main'])
  }
}

async function validateBlog(root) {
  const entries = await fs.readdir(root)
  const config = CONFIG_FILES.find((candidate) => entries.includes(candidate))
  if (!config) throw new Error('Esta pasta não parece ser um site Hugo: nenhum arquivo de configuração foi encontrado.')
  const stat = await fs.stat(path.join(root, 'content')).catch(() => null)
  if (!stat?.isDirectory()) throw new Error('A pasta content não foi encontrada neste site Hugo.')

  const runtime = runtimeFor(root)
  const [hugo, git] = await Promise.all([
    run(root, 'hugo', ['version']).then((value) => value.stdout).catch(() => null),
    run(root, 'git', ['--version']).then((value) => value.stdout).catch(() => null),
  ])
  const rawConfig = await fs.readFile(path.join(root, config), 'utf8').catch(() => '')
  const configuredTheme = readThemeValue(rawConfig, config)
  const theme = Array.isArray(configuredTheme) ? configuredTheme[0] || '' : configuredTheme
  return { root, config, runtime, hugo, git, theme }
}

async function installTheme(root, slug) {
  await validateBlog(root)
  const theme = await resolveTheme(slug)
  await ensureGitRepository(root)
  const themeRoot = path.join(root, 'themes', theme.folder)
  const existing = await fs.stat(themeRoot).catch(() => null)
  if (!existing) {
    await fs.mkdir(path.dirname(themeRoot), { recursive: true })
    await run(root, 'git', ['submodule', 'add', '--depth', '1', theme.repository, `themes/${theme.folder}`])
  } else if (!existing.isDirectory()) {
    throw new Error(`Já existe um arquivo chamado themes/${theme.folder}.`)
  }
  await updateSiteConfig(root, { theme: theme.folder })
  return { ...theme, context: await validateBlog(root) }
}

async function createSite(parentRoot, input) {
  const title = String(input?.title || '').trim()
  const folder = slugify(input?.folder || title)
  const languageCode = String(input?.languageCode || 'en-US').replace(/[^a-z-]/gi, '') || 'en-US'
  if (!title) throw new Error('Informe o título do novo blog.')
  if (!folder) throw new Error('Informe um nome de pasta válido para o novo blog.')
  const parent = path.resolve(parentRoot)
  const target = path.resolve(parent, folder)
  if (target === parent || !target.startsWith(`${parent}${path.sep}`)) throw new Error('A pasta do novo blog é inválida.')
  const parentStat = await fs.stat(parent)
  if (!parentStat.isDirectory()) throw new Error('Escolha uma pasta onde o novo blog será criado.')
  if (await fs.stat(target).catch(() => null)) throw new Error(`A pasta ${folder} já existe.`)

  await run(parent, 'hugo', ['new', 'site', folder, '--format', 'toml'])
  await updateSiteConfig(target, { title, languageCode })
  await ensureGitRepository(target)

  let themeWarning = ''
  if (input?.theme) {
    try {
      await installTheme(target, input.theme)
    } catch (error) {
      themeWarning = error.message
    }
  }
  return { ...(await validateBlog(target)), themeWarning }
}

async function walkMarkdown(directory, root, output = []) {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) await walkMarkdown(absolute, root, output)
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      output.push(path.relative(root, absolute).replaceAll(path.sep, '/'))
    }
  }
  return output
}

function languageFromId(id) {
  const match = id.match(/\.([a-z]{2}(?:-[a-z]{2})?)\.md$/i)
  return match?.[1]?.toLowerCase() || 'default'
}

function normalizeDate(value) {
  if (!value) return ''
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0, 10)
  const match = String(value).match(/^\d{4}-\d{2}-\d{2}/)
  return match ? match[0] : ''
}

function normalizeDateTime(value) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.valueOf())) return ''
  return date.toISOString()
}

async function readPost(root, id) {
  const absolute = contentPath(root, id)
  const raw = await fs.readFile(absolute, 'utf8')
  const parsed = matter(raw)
  const directory = path.dirname(absolute)
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const assets = entries
    .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))
  return {
    id,
    title: parsed.data.title || path.basename(path.dirname(absolute)),
    description: parsed.data.description || '',
    date: normalizeDate(parsed.data.date),
    publishDate: normalizeDateTime(parsed.data.publishDate),
    draft: parsed.data.draft !== false,
    tags: Array.isArray(parsed.data.tags) ? parsed.data.tags : [],
    featuredImage: parsed.data.featuredImage || '',
    translationKey: parsed.data.translationKey || '',
    language: languageFromId(id),
    body: parsed.content.replace(/^\s+/, ''),
    assets,
  }
}

async function listPosts(root) {
  const ids = await walkMarkdown(path.join(root, 'content', 'posts'), root)
  const posts = await Promise.all(ids.map(async (id) => {
    try {
      const post = await readPost(root, id)
      return {
        id: post.id,
        title: post.title,
        description: post.description,
        date: post.date,
        publishDate: post.publishDate,
        draft: post.draft,
        tags: post.tags,
        language: post.language,
        featuredImage: post.featuredImage,
      }
    } catch {
      return null
    }
  }))
  return posts.filter(Boolean).sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.title.localeCompare(b.title))
}

function serializePost(existingData, post) {
  const data = {
    ...existingData,
    title: post.title.trim(),
    description: post.description.trim(),
    date: post.date,
    publishDate: post.publishDate || undefined,
    draft: Boolean(post.draft),
    translationKey: post.translationKey.trim(),
    tags: post.tags.filter(Boolean),
    featuredImage: post.featuredImage || '',
  }
  return `---\n${YAML.stringify(data, { lineWidth: 0 }).trim()}\n---\n\n${post.body.replace(/^\s+/, '')}`
}

async function savePost(root, post) {
  if (!post.title?.trim()) throw new Error('Dê um título ao post antes de salvar.')
  const absolute = contentPath(root, post.id)
  const parsed = matter(await fs.readFile(absolute, 'utf8'))
  await fs.writeFile(absolute, serializePost(parsed.data, post), 'utf8')
  return readPost(root, post.id)
}

function slugify(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function createPost(root, input) {
  const slug = slugify(input.slug || input.title)
  const language = String(input.language || 'pt-br').toLowerCase().replace(/[^a-z-]/g, '')
  if (!slug) throw new Error('Informe um título ou slug válido.')
  const id = `content/posts/${slug}/index.${language}.md`
  const absolute = contentPath(root, id)
  await fs.access(absolute).then(() => { throw new Error('Já existe um post com este slug e idioma.') }).catch((error) => {
    if (error.message.includes('Já existe')) throw error
  })
  await run(root, 'hugo', ['new', 'content', `posts/${slug}/index.${language}.md`])
  const post = await readPost(root, id)
  return savePost(root, {
    ...post,
    title: input.title,
    date: new Date().toISOString().slice(0, 10),
    publishDate: '',
    draft: true,
    translationKey: input.translationKey || slug,
  })
}

function uniqueAssetName(name, usedNames) {
  const extension = path.extname(name).toLowerCase()
  const base = slugify(path.basename(name, path.extname(name))) || 'imagem'
  let candidate = `${base}${extension}`
  let counter = 2
  while (usedNames.has(candidate.toLowerCase())) candidate = `${base}-${counter++}${extension}`
  usedNames.add(candidate.toLowerCase())
  return candidate
}

async function importImages(root, postId, sourcePaths) {
  if (!Array.isArray(sourcePaths)) throw new Error('Lista de imagens inválida.')
  const postAbsolute = contentPath(root, postId)
  const directory = path.dirname(postAbsolute)
  const existing = new Set((await fs.readdir(directory)).map((name) => name.toLowerCase()))
  const imported = []
  for (const source of sourcePaths) {
    const extension = path.extname(source).toLowerCase()
    if (!IMAGE_EXTENSIONS.has(extension)) continue
    const name = uniqueAssetName(path.basename(source), existing)
    await fs.copyFile(source, path.join(directory, name))
    imported.push({ name, markdown: `![Descrição da imagem](${name})` })
  }
  return imported
}

async function readAsset(root, postId, name) {
  const extension = path.extname(name).toLowerCase()
  if (!IMAGE_EXTENSIONS.has(extension) || path.basename(name) !== name) throw new Error('Imagem inválida.')
  const directory = path.dirname(contentPath(root, postId))
  const buffer = await fs.readFile(path.join(directory, name))
  const mime = extension === '.svg' ? 'image/svg+xml' : extension === '.jpg' || extension === '.jpeg' ? 'image/jpeg' : `image/${extension.slice(1)}`
  return `data:${mime};base64,${buffer.toString('base64')}`
}

async function readAssetInfo(root, postId, name) {
  const dataUrl = await readAsset(root, postId, name)
  const directory = path.dirname(contentPath(root, postId))
  const stat = await fs.stat(path.join(directory, name))
  return { name, size: stat.size, dataUrl }
}

function arrayOf(value) {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

function xmlText(value) {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return String(value?.['#text'] || '')
}

function parseBloggerExport(xml) {
  const source = String(xml || '')
  if (source.length > 100 * 1024 * 1024) throw new Error('The Blogger backup is larger than 100 MB.')
  if (/<!DOCTYPE\b/i.test(source)) throw new Error('Blogger backups containing a DOCTYPE are not supported.')
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    parseTagValue: false,
    trimValues: false,
  })
  const feed = parser.parse(source)?.feed || {}
  return arrayOf(feed.entry).flatMap((entry, index) => {
    const categories = arrayOf(entry.category)
    const isPost = categories.some((category) => String(category?.['@_term'] || '').endsWith('#post'))
    if (!isPost) return []
    const alternate = arrayOf(entry.link).find((link) => link?.['@_rel'] === 'alternate')?.['@_href'] || ''
    const labels = categories
      .filter((category) => String(category?.['@_scheme'] || '').includes('blogger.com/atom/ns'))
      .map((category) => String(category?.['@_term'] || '').trim())
      .filter(Boolean)
    let pathname = ''
    try { pathname = new URL(alternate).pathname } catch { pathname = '' }
    const pathnameSlug = path.basename(pathname, path.extname(pathname))
    const title = xmlText(entry.title).trim() || `Imported post ${index + 1}`
    const content = xmlText(entry.content)
    return [{
      id: xmlText(entry.id).trim() || `blogger-post-${index + 1}`,
      title,
      slug: slugify(pathnameSlug || title) || `blogger-post-${index + 1}`,
      date: normalizeDate(xmlText(entry.published) || xmlText(entry.updated)),
      draft: ['yes', 'true'].includes(xmlText(entry.control?.draft).trim().toLowerCase()),
      labels,
      content,
      originalUrl: alternate,
      originalPath: pathname,
      imageCount: [...content.matchAll(/<img\b[^>]*\bsrc=["']https?:\/\//gi)].length,
    }]
  })
}

async function inspectBloggerExport(filePath) {
  const posts = parseBloggerExport(await fs.readFile(filePath, 'utf8'))
  const labels = [...new Set(posts.flatMap((post) => post.labels))].sort((a, b) => a.localeCompare(b))
  return {
    posts: posts.map(({ content, ...post }) => ({ ...post, selected: true, contentLength: content.length })),
    labels,
    imageCount: posts.reduce((total, post) => total + post.imageCount, 0),
  }
}

async function localizeBloggerImages(directory, html) {
  const existing = new Set((await fs.readdir(directory).catch(() => [])).map((name) => name.toLowerCase()))
  const sources = [...new Set([...html.matchAll(/<img\b[^>]*\bsrc=(["'])(https?:\/\/[^"']+)\1/gi)].map((match) => match[2].replaceAll('&amp;', '&')))]
  let localized = html
  let imported = 0
  for (const source of sources) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 20_000)
      let response
      let buffer
      try {
        response = await fetch(source, { headers: { 'User-Agent': 'Plumbago-Hugo-UI/0.5.0' }, signal: controller.signal })
        if (!response.ok) continue
        const contentLength = Number(response.headers.get('content-length') || 0)
        if (contentLength > 15 * 1024 * 1024) continue
        buffer = Buffer.from(await response.arrayBuffer())
      } finally {
        clearTimeout(timeout)
      }
      if (!buffer.length || buffer.length > 15 * 1024 * 1024) continue
      const mime = response.headers.get('content-type')?.split(';')[0]
      const mimeExtension = { 'image/avif': '.avif', 'image/gif': '.gif', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/svg+xml': '.svg', 'image/webp': '.webp' }[mime]
      const urlName = path.basename(new URL(source).pathname)
      const extension = IMAGE_EXTENSIONS.has(path.extname(urlName).toLowerCase()) ? path.extname(urlName).toLowerCase() : mimeExtension
      if (!extension) continue
      const name = uniqueAssetName(`${path.basename(urlName, path.extname(urlName)) || 'blogger-image'}${extension}`, existing)
      await fs.writeFile(path.join(directory, name), buffer)
      localized = localized.replaceAll(source, name).replaceAll(source.replaceAll('&', '&amp;'), name)
      imported += 1
    } catch {
      // Keep the original remote image when Blogger or the image host cannot be reached.
    }
  }
  return { html: localized, imported }
}

async function importBloggerExport(root, filePath, options = {}) {
  await validateBlog(root)
  const selected = new Set(arrayOf(options.selectedIds).map(String))
  const language = String(options.language || 'en-us').toLowerCase().replace(/[^a-z-]/g, '') || 'en-us'
  const posts = parseBloggerExport(await fs.readFile(filePath, 'utf8'))
    .filter((post) => !selected.size || selected.has(post.id))
  const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', codeBlockStyle: 'fenced' })
  turndown.remove(['script', 'style'])
  const importedPosts = []
  const failures = []
  let importedImages = 0

  for (const source of posts) {
    try {
      let slug = source.slug
      let counter = 2
      let id = `content/posts/${slug}/index.${language}.md`
      while (await fs.stat(contentPath(root, id)).catch(() => null)) {
        slug = `${source.slug}-${counter++}`
        id = `content/posts/${slug}/index.${language}.md`
      }
      await run(root, 'hugo', ['new', 'content', `posts/${slug}/index.${language}.md`])
      const absolute = contentPath(root, id)
      const localized = await localizeBloggerImages(path.dirname(absolute), source.content)
      importedImages += localized.imported
      const aliases = source.originalPath && source.originalPath !== '/' ? [source.originalPath] : []
      const data = {
        title: source.title,
        date: source.date || new Date().toISOString().slice(0, 10),
        draft: source.draft,
        tags: source.labels,
        translationKey: slug,
        featuredImage: '',
        aliases,
        originalUrl: source.originalUrl || undefined,
      }
      const body = turndown.turndown(localized.html).trim()
      await fs.writeFile(absolute, `---\n${YAML.stringify(data, { lineWidth: 0 }).trim()}\n---\n\n${body}\n`, 'utf8')
      importedPosts.push(await readPost(root, id))
    } catch (error) {
      failures.push({ id: source.id, title: source.title, error: error.message })
    }
  }
  return { posts: importedPosts, importedImages, failures }
}

async function gitStatus(root) {
  const branch = await run(root, 'git', ['branch', '--show-current']).then((result) => result.stdout).catch(() => '')
  const remote = await run(root, 'git', ['remote', 'get-url', 'origin']).then((result) => result.stdout).catch(() => '')
  const changes = await run(root, 'git', ['status', '--porcelain=v1']).then((result) => result.stdout.split('\n').filter(Boolean)).catch(() => [])
  return { branch, remote, changes }
}

async function gitConfig(root) {
  const status = await gitStatus(root)
  const [name, email] = await Promise.all([
    run(root, 'git', ['config', '--local', '--get', 'user.name']).then((result) => result.stdout).catch(() => ''),
    run(root, 'git', ['config', '--local', '--get', 'user.email']).then((result) => result.stdout).catch(() => ''),
  ])
  return { ...status, name, email }
}

async function saveGitConfig(root, config) {
  const name = String(config.name || '').trim()
  const email = String(config.email || '').trim()
  const remote = String(config.remote || '').trim()

  if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new Error('Informe um e-mail Git válido.')
  if (name) await run(root, 'git', ['config', '--local', 'user.name', name])
  if (email) await run(root, 'git', ['config', '--local', 'user.email', email])

  if (remote) {
    const hasOrigin = await run(root, 'git', ['remote']).then((result) => result.stdout.split('\n').includes('origin'))
    await run(root, 'git', hasOrigin ? ['remote', 'set-url', 'origin', remote] : ['remote', 'add', 'origin', remote])
  }
  return gitConfig(root)
}

async function syncGit(root, message) {
  const log = []
  await run(root, 'git', ['add', '--all'])
  const staged = await run(root, 'git', ['diff', '--cached', '--name-only'])
  if (staged.stdout) {
    await run(root, 'git', ['commit', '-m', message?.trim() || 'Atualiza conteúdo pelo Plumbago'])
    log.push('Alterações salvas em um commit.')
  } else {
    log.push('Nenhuma alteração local para salvar.')
  }

  const remotes = await run(root, 'git', ['remote']).then((result) => result.stdout.split('\n').filter(Boolean))
  if (!remotes.includes('origin')) throw new Error('Configure um remoto Git chamado origin antes de sincronizar.')

  const hasUpstream = await run(root, 'git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'])
    .then(() => true)
    .catch(() => false)
  if (hasUpstream) {
    try {
      await run(root, 'git', ['pull', '--rebase'])
    } catch (error) {
      await run(root, 'git', ['rebase', '--abort']).catch(() => {})
      throw new Error(`O Git encontrou um conflito ao trazer as novidades remotas e desfez o rebase com segurança.\n${error.message}`)
    }
    log.push('Novidades remotas aplicadas.')
    await run(root, 'git', ['push'])
  } else {
    await run(root, 'git', ['push', '--set-upstream', 'origin', 'HEAD'])
  }
  log.push('Conteúdo enviado ao repositório remoto.')
  return { log, status: await gitStatus(root) }
}

async function githubWorkflowStatus(repository, branch) {
  if (!repository) return { state: 'unavailable', conclusion: '', runUrl: '', updatedAt: '' }
  try {
    const query = new URLSearchParams({ per_page: '30' })
    if (branch) query.set('branch', branch)
    const response = await fetchJson(`https://api.github.com/repos/${repository.owner}/${repository.repository}/actions/runs?${query}`)
    const candidates = response.workflow_runs || []
    const run = candidates.find((item) => /pages|deploy|hugo|publish/i.test(`${item.name} ${item.path}`))
    if (!run) return { state: 'not-configured', conclusion: '', runUrl: '', updatedAt: '' }
    const active = ['queued', 'in_progress', 'requested', 'waiting', 'pending'].includes(run.status)
    const state = active ? 'deploying' : run.conclusion === 'success' ? 'live' : 'failed'
    return {
      state,
      conclusion: run.conclusion || '',
      runUrl: run.html_url || '',
      updatedAt: run.updated_at || run.created_at || '',
      name: run.name || '',
    }
  } catch {
    return { state: 'unknown', conclusion: '', runUrl: '', updatedAt: '' }
  }
}

async function publishingStatus(root) {
  const status = await gitStatus(root)
  const repository = parseGitHubRemote(status.remote)
  const metadata = await siteMetadata(root)
  let liveUrl = metadata.baseURL
  try {
    if (liveUrl) liveUrl = new URL(liveUrl).href
  } catch {
    liveUrl = ''
  }
  if (!liveUrl) liveUrl = defaultGitHubPagesUrl(repository)
  const deployment = await githubWorkflowStatus(repository, status.branch)
  return { ...status, repository, site: metadata, liveUrl, deployment }
}

async function publishBlog(root, message) {
  await validateBlog(root)
  await run(root, 'hugo', ['--renderToMemory', '--minify'])
  const synced = await syncGit(root, message)
  return {
    log: ['Hugo build completed successfully.', ...synced.log],
    status: await publishingStatus(root),
  }
}

async function publishingHealth(root) {
  const checks = []
  let context
  try {
    context = await validateBlog(root)
    checks.push({ id: 'hugo', state: context.hugo ? 'ok' : 'error', detail: context.hugo || 'Hugo was not found.', action: 'settings' })
    checks.push({ id: 'git', state: context.git ? 'ok' : 'error', detail: context.git || 'Git was not found.', action: 'settings' })
  } catch (error) {
    return { checks: [{ id: 'blog', state: 'error', detail: error.message, action: 'settings' }], ready: false }
  }

  const config = await gitConfig(root)
  checks.push({
    id: 'identity',
    state: config.name && config.email ? 'ok' : 'warning',
    detail: config.name && config.email ? `${config.name} · ${config.email}` : 'Add an author name and email for version history.',
    action: 'settings',
  })
  checks.push({
    id: 'remote',
    state: config.remote ? 'ok' : 'error',
    detail: config.remote || 'Connect a remote repository before publishing.',
    action: 'github',
  })
  const repository = parseGitHubRemote(config.remote)
  checks.push({
    id: 'github',
    state: repository ? 'ok' : config.remote ? 'warning' : 'error',
    detail: repository?.fullName || (config.remote ? 'This repository is not hosted on GitHub.' : 'No GitHub repository is connected.'),
    action: 'github',
  })
  const workflowExists = Boolean(await fs.stat(path.join(root, '.github', 'workflows', 'plumbago-pages.yml')).catch(() => null))
  checks.push({
    id: 'workflow',
    state: workflowExists ? 'ok' : 'warning',
    detail: workflowExists ? 'The GitHub Pages workflow is ready.' : 'Automatic website deployment is not configured yet.',
    action: 'github',
  })
  try {
    await run(root, 'hugo', ['--renderToMemory', '--minify'])
    checks.push({ id: 'build', state: 'ok', detail: 'Hugo built the website successfully.', action: 'preview' })
  } catch (error) {
    checks.push({ id: 'build', state: 'error', detail: error.message, action: 'preview' })
  }
  const publishing = await publishingStatus(root)
  const deploymentState = publishing.deployment.state
  checks.push({
    id: 'deployment',
    state: deploymentState === 'live' ? 'ok' : deploymentState === 'failed' ? 'error' : 'warning',
    detail: deploymentState === 'live'
      ? 'The latest GitHub Pages deployment is live.'
      : deploymentState === 'deploying'
        ? 'GitHub is currently building the website.'
        : deploymentState === 'failed'
          ? 'The latest website deployment failed.'
          : 'Publish once to verify the live website.',
    action: 'publish',
  })
  return {
    checks,
    ready: checks.every((check) => check.state !== 'error'),
    score: checks.filter((check) => check.state === 'ok').length,
    total: checks.length,
    publishing,
  }
}

module.exports = {
  beginGitHubSignIn,
  completeGitHubSignIn,
  configureGitHubPages,
  connectGitHubRepository,
  createGitHubRepository,
  createSite,
  createPost,
  githubAccount,
  githubCliToken,
  githubPagesWorkflow,
  gitConfig,
  gitStatus,
  importImages,
  importBloggerExport,
  inspectBloggerExport,
  installTheme,
  listPosts,
  listGitHubRepositories,
  listThemes,
  defaultGitHubPagesUrl,
  parseThemeCatalog,
  parseThemeRepository,
  parseBloggerExport,
  parseGitHubRemote,
  publishBlog,
  publishingHealth,
  publishingStatus,
  readAsset,
  readAssetInfo,
  readPost,
  runtimeFor,
  savePost,
  saveGitConfig,
  saveSiteSettings,
  siteSettings,
  slugify,
  spawnLongRunning,
  syncGit,
  validateBlog,
}
