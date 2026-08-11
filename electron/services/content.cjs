const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const matter = require('gray-matter')
const TOML = require('@iarna/toml')
const YAML = require('yaml')
const { XMLParser } = require('fast-xml-parser')
const TurndownService = require('turndown')
const { run } = require('../core/runtime.cjs')
const { ensureContentLanguages } = require('./languages.cjs')
const { movePostToTrash } = require('./trash.cjs')

const IMAGE_EXTENSIONS = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp'])

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

function revisionFor(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

function parseTomlFrontMatter(raw) {
  const lines = String(raw).replace(/^\uFEFF/, '').split(/\r?\n/)
  if (lines[0]?.trim() !== '+++') return null
  const closing = lines.findIndex((line, index) => index > 0 && line.trim() === '+++')
  if (closing < 0) return null
  return {
    data: TOML.parse(lines.slice(1, closing).join('\n')),
    content: lines.slice(closing + 1).join('\n'),
    format: 'toml',
    hasMatter: true,
  }
}

function parsePostSource(raw) {
  const source = String(raw).replace(/^\uFEFF/, '')
  const toml = parseTomlFrontMatter(source)
  const outer = toml || (() => {
    const parsed = matter(source)
    return {
      data: parsed.data || {},
      content: parsed.content,
      format: 'yaml',
      hasMatter: /^---\s*\r?\n/.test(source),
    }
  })()
  const leading = outer.content.match(/^\s*/)?.[0] || ''
  const nested = parseTomlFrontMatter(outer.content.slice(leading.length))
  const looksLikeAccidentalArchetype = nested && ['title', 'date', 'draft'].some((key) => Object.hasOwn(nested.data, key))
  if (!looksLikeAccidentalArchetype) return outer
  return {
    ...outer,
    data: { ...nested.data, ...outer.data },
    content: nested.content,
    repairedNestedFrontMatter: true,
  }
}

async function readPost(root, id) {
  const absolute = contentPath(root, id)
  const raw = await fs.readFile(absolute, 'utf8')
  const parsed = parsePostSource(raw)
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
    expiryDate: normalizeDateTime(parsed.data.expiryDate),
    lastmod: normalizeDateTime(parsed.data.lastmod),
    draft: parsed.data.draft !== false,
    tags: Array.isArray(parsed.data.tags) ? parsed.data.tags : [],
    featuredImage: parsed.data.featuredImage || '',
    translationKey: parsed.data.translationKey || '',
    language: languageFromId(id),
    body: parsed.content.replace(/^\s+/, ''),
    assets,
    revision: revisionFor(raw),
    frontMatterFormat: parsed.format,
    repairedNestedFrontMatter: Boolean(parsed.repairedNestedFrontMatter),
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
        expiryDate: post.expiryDate,
        lastmod: post.lastmod,
        draft: post.draft,
        tags: post.tags,
        language: post.language,
        featuredImage: post.featuredImage,
        revision: post.revision,
      }
    } catch {
      return null
    }
  }))
  return posts.filter(Boolean).sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.title.localeCompare(b.title))
}

function serializePost(existingData, post, format = 'yaml') {
  const data = {
    ...existingData,
    title: post.title.trim(),
    description: post.description.trim(),
    date: post.date,
    publishDate: post.publishDate || undefined,
    expiryDate: post.expiryDate || undefined,
    lastmod: post.lastmod || undefined,
    draft: Boolean(post.draft),
    translationKey: String(post.translationKey || '').trim(),
    tags: Array.isArray(post.tags) ? post.tags.filter(Boolean) : [],
    featuredImage: post.featuredImage || '',
  }
  const compact = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined))
  const delimiter = format === 'toml' ? '+++' : '---'
  const frontMatter = format === 'toml'
    ? TOML.stringify(compact).trim()
    : YAML.stringify(compact, { lineWidth: 0 }).trim()
  return `${delimiter}\n${frontMatter}\n${delimiter}\n\n${String(post.body || '').replace(/^\s+/, '')}`
}

async function savePost(root, post) {
  if (!post.title?.trim()) throw new Error('Dê um título ao post antes de salvar.')
  const absolute = contentPath(root, post.id)
  const raw = await fs.readFile(absolute, 'utf8')
  if (post.revision && post.revision !== revisionFor(raw)) {
    const error = new Error('This post changed outside Plumbago. Reload it before saving so the newer version is not overwritten.')
    error.code = 'CONTENT_CHANGED'
    throw error
  }
  const parsed = parsePostSource(raw)
  await ensureContentLanguages(root, [languageFromId(post.id)])
  await fs.writeFile(absolute, serializePost(parsed.data, post, post.frontMatterFormat || parsed.format), 'utf8')
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
  await ensureContentLanguages(root, [language])
  await run(root, 'hugo', ['new', 'content', `posts/${slug}/index.${language}.md`])
  const post = await readPost(root, id)
  return savePost(root, {
    ...post,
    title: input.title,
    date: new Date().toISOString().slice(0, 10),
    publishDate: '',
    expiryDate: '',
    lastmod: '',
    draft: true,
    translationKey: input.translationKey || slug,
  })
}

async function deletePost(root, id) {
  return movePostToTrash(root, id)
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

async function importBloggerExport(root, filePath, options = {}, validateBlog = async () => {}) {
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

  await ensureContentLanguages(root, [language])

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

module.exports = {
  contentPath,
  createPost,
  deletePost,
  importBloggerExport,
  importImages,
  inspectBloggerExport,
  listPosts,
  parseBloggerExport,
  parsePostSource,
  readAsset,
  readAssetInfo,
  readPost,
  revisionFor,
  savePost,
  slugify,
}
