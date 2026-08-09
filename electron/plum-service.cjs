const fs = require('node:fs/promises')
const path = require('node:path')
const { execFile, spawn } = require('node:child_process')
const { promisify } = require('node:util')
const matter = require('gray-matter')
const YAML = require('yaml')

const execFileAsync = promisify(execFile)
const IMAGE_EXTENSIONS = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp'])
const CONFIG_FILES = ['hugo.toml', 'hugo.yaml', 'hugo.yml', 'hugo.json', 'config.toml', 'config.yaml', 'config.yml']

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
  return { root, config, runtime, hugo, git }
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

async function syncGit(root, message) {
  const log = []
  await run(root, 'git', ['add', '--all'])
  const staged = await run(root, 'git', ['diff', '--cached', '--name-only'])
  if (staged.stdout) {
    await run(root, 'git', ['commit', '-m', message?.trim() || 'Atualiza conteúdo pelo Plum'])
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
  createPost,
  gitStatus,
  importImages,
  listPosts,
  readAsset,
  readPost,
  runtimeFor,
  savePost,
  slugify,
  spawnLongRunning,
  syncGit,
  validateBlog,
}
