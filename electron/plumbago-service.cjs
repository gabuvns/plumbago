const fs = require('node:fs/promises')
const path = require('node:path')
const { execFile, spawn } = require('node:child_process')
const { promisify } = require('node:util')
const matter = require('gray-matter')
const YAML = require('yaml')

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
      headers: { 'User-Agent': 'Plumbago-Hugo-UI/0.4.0' },
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.text()
  } finally {
    clearTimeout(timeout)
  }
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
        draft: post.draft,
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

module.exports = {
  createSite,
  createPost,
  gitConfig,
  gitStatus,
  importImages,
  installTheme,
  listPosts,
  listThemes,
  parseThemeCatalog,
  parseThemeRepository,
  readAsset,
  readPost,
  runtimeFor,
  savePost,
  saveGitConfig,
  slugify,
  spawnLongRunning,
  syncGit,
  validateBlog,
}
