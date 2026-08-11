const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')
const { parsePostSource } = require('../content.cjs')
const { buildMediaLibrary } = require('../media.cjs')

async function walkMarkdown(directory, root, output = []) {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) await walkMarkdown(absolute, root, output)
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) output.push(path.relative(root, absolute).replaceAll(path.sep, '/'))
  }
  return output
}

function languageFromId(id) {
  return id.match(/\.([a-z]{2}(?:-[a-z]{2})?)\.md$/i)?.[1]?.toLowerCase() || 'default'
}

function routeFromId(id) {
  const relative = id.replace(/^content\//, '')
  const file = path.posix.basename(relative)
  const directory = path.posix.dirname(relative)
  const withoutLanguage = file.replace(/\.[a-z]{2}(?:-[a-z]{2})?\.md$/i, '.md')
  const route = /^index\.md$/i.test(withoutLanguage)
    ? directory === '.' ? '' : directory
    : path.posix.join(directory === '.' ? '' : directory, withoutLanguage.replace(/\.md$/i, ''))
  return `/${route.replace(/^\/+|\/+$/g, '')}${route ? '/' : ''}`
}

function routeFromPost(id, data = {}) {
  if (typeof data.url === 'string' && data.url.trim()) {
    try { return normalizeRoute(new URL(data.url.trim(), 'https://plumbago.invalid/').pathname) } catch { /* Fall back to the content path. */ }
  }
  const slug = typeof data.slug === 'string' ? data.slug.trim().replace(/^\/+|\/+$/g, '') : ''
  if (!slug) return routeFromId(id)
  const original = routeFromId(id)
  const parent = path.posix.dirname(original.replace(/\/$/, ''))
  return normalizeRoute(path.posix.join(parent, slug))
}

function finding(rule, severity, input = {}) {
  const target = input.target || input.postId || input.path || 'site'
  return {
    id: crypto.createHash('sha1').update(`${rule}:${target}`).digest('hex').slice(0, 20),
    rule,
    severity,
    scope: input.scope || (input.postId ? 'post' : 'site'),
    postId: input.postId || '',
    postTitle: input.postTitle || '',
    path: input.path || '',
    values: input.values || {},
    detail: String(input.detail || '').slice(0, 4000),
    fix: input.fix || null,
  }
}

function plainMarkdown(raw) {
  return String(raw).replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, '')
}

function headingInfo(raw) {
  const headings = []
  for (const match of plainMarkdown(raw).matchAll(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/gm)) {
    const text = match[2].replace(/[*_`~[\]]/g, '').trim()
    const anchor = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')
    headings.push({ level: match[1].length, text, anchor })
  }
  return headings
}

function markdownLinks(raw) {
  const links = []
  const source = plainMarkdown(raw)
  for (const match of source.matchAll(/(?<!!)\[[^\]]*\]\(\s*(<[^>\r\n]+>|[^\s)]+)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g)) {
    const destination = match[1].replace(/^<|>$/g, '')
    if (!destination.startsWith('{{')) links.push({ destination, offset: match.index })
  }
  for (const match of source.matchAll(/\{\{[%<]\s*(?:ref|relref)\s+["']([^"']+)["'][^>}]*[>%]\}\}/g)) links.push({ destination: match[1], offset: match.index })
  for (const match of source.matchAll(/<a\b[^>]*\bhref\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>/gi)) links.push({ destination: match[1] ?? match[2] ?? match[3] ?? '', offset: match.index })
  return links
}

function normalizeRoute(value) {
  let route = value.replaceAll('\\', '/').replace(/\/index\.html$/i, '/').replace(/\/+$/, '') || '/'
  if (!path.posix.extname(route) && route !== '/') route += '/'
  return route
}

function normalizeAnchor(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')
}

function normalizeAliases(values) {
  if (!Array.isArray(values)) return []
  return values.flatMap((value) => {
    if (typeof value !== 'string' || !value.trim()) return []
    try { return [normalizeRoute(new URL(value, 'https://plumbago.invalid/').pathname)] } catch { return [] }
  })
}

async function linkExists(root, post, destination, routeKeys, postIds, anchorMap, basePath = '/') {
  if (!destination || destination.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(destination)) return true
  let decoded = destination
  try { decoded = decodeURIComponent(destination) } catch { /* Keep the literal destination. */ }
  const [pathname, fragment = ''] = decoded.split('#', 2)
  if (!pathname) return !fragment || anchorMap.get(post.id)?.has(normalizeAnchor(fragment))

  if (/\.md$/i.test(pathname)) {
    const candidate = pathname.startsWith('/')
      ? `content/${pathname.replace(/^\/+/, '')}`
      : path.posix.normalize(path.posix.join(path.posix.dirname(post.id), pathname))
    return postIds.has(candidate)
  }

  const contentRoute = normalizeRoute(`/${pathname.replace(/^\/+/, '')}`)
  if (routeKeys.has(contentRoute)) return true

  let route
  try { route = normalizeRoute(new URL(pathname, `https://plumbago.invalid${post.route}`).pathname) } catch { return false }
  const withoutBase = basePath !== '/' && route.startsWith(basePath) ? normalizeRoute(`/${route.slice(basePath.length)}`) : route
  if (routeKeys.has(route) || routeKeys.has(withoutBase)) return true
  const staticPath = path.resolve(root, 'static', withoutBase.replace(/^\/+/, ''))
  const staticRoot = path.resolve(root, 'static')
  if (!staticPath.startsWith(`${staticRoot}${path.sep}`)) return false
  return Boolean(await fs.stat(staticPath).then((stat) => stat.isFile()).catch(() => false))
}

function postFinding(rule, severity, post, values = {}, extra = {}) {
  return finding(rule, severity, { postId: post.id, postTitle: post.title || post.id, values, ...extra })
}

async function inspectContent(root, options = {}) {
  const ids = await walkMarkdown(path.join(root, 'content'), root)
  const posts = []
  for (const id of ids) {
    const raw = await fs.readFile(path.join(root, ...id.split('/')), 'utf8')
    let parsed
    try { parsed = parsePostSource(raw) } catch { parsed = { data: {}, content: raw } }
    posts.push({
      id,
      raw,
      body: parsed.content || '',
      data: parsed.data || {},
      title: String(parsed.data?.title || '').trim(),
      description: String(parsed.data?.description || '').trim(),
      route: routeFromPost(id, parsed.data || {}),
      aliases: normalizeAliases(parsed.data?.aliases),
      language: languageFromId(id),
      headings: headingInfo(parsed.content || ''),
    })
  }

  const findings = []
  let basePath = '/'
  try { basePath = normalizeRoute(new URL(options.baseURL || 'https://plumbago.invalid/').pathname) } catch { /* Invalid base URLs are reported as site findings. */ }
  const routeKeys = new Set(posts.flatMap((post) => [post.route, ...post.aliases, ...(post.language === 'default' ? [] : [normalizeRoute(`/${post.language}${post.route}`), ...post.aliases.map((alias) => normalizeRoute(`/${post.language}${alias}`))])]))
  const postIds = new Set(posts.map((post) => post.id))
  const anchorMap = new Map(posts.map((post) => [post.id, new Set(post.headings.map((heading) => heading.anchor))]))
  const today = new Date().toISOString().slice(0, 10)

  for (const post of posts) {
    if (!post.title) findings.push(postFinding('post-title-missing', 'error', post))
    else if (post.title.length > 60) findings.push(postFinding('post-title-long', 'warning', post, { count: post.title.length }))
    else if (post.title.length < 15) findings.push(postFinding('post-title-short', 'recommendation', post, { count: post.title.length }))

    if (!post.description) {
      findings.push(postFinding('post-description-missing', 'warning', post, {}, { fix: { kind: 'text', field: 'description', before: '', placeholder: 'review.fix.descriptionPlaceholder' } }))
    } else if (post.description.length > 160) findings.push(postFinding('post-description-long', 'warning', post, { count: post.description.length }))
    else if (post.description.length < 50) findings.push(postFinding('post-description-short', 'recommendation', post, { count: post.description.length }))

    const socialImage = post.data.featuredImage || post.data.image || (Array.isArray(post.data.images) ? post.data.images.find(Boolean) : '') || post.data.cover?.image
    if (!String(socialImage || '').trim()) findings.push(postFinding('post-social-image-missing', 'recommendation', post))
    const dateValue = String(post.data.date || '').trim()
    if (!dateValue) findings.push(postFinding('post-date-missing', 'warning', post))
    else if (Number.isNaN(new Date(post.data.date).valueOf())) findings.push(postFinding('post-date-invalid', 'error', post, { date: dateValue }))
    const publishAt = post.data.publishDate ? new Date(post.data.publishDate) : null
    if (post.data.publishDate && Number.isNaN(publishAt.valueOf())) findings.push(postFinding('post-publish-date-invalid', 'error', post, { date: String(post.data.publishDate) }))
    if (post.data.draft === true && publishAt && !Number.isNaN(publishAt.valueOf()) && publishAt > new Date()) findings.push(postFinding('post-schedule-draft', 'warning', post))
    if (post.data.draft === false && !post.data.publishDate && String(post.data.date || '').slice(0, 10) > today) findings.push(postFinding('post-future-date', 'warning', post))
    const canonical = String(post.data.canonicalURL || post.data.canonical || '').trim()
    if (canonical) {
      let canonicalUrl = null
      try { canonicalUrl = new URL(canonical) } catch { /* Report below. */ }
      if (!canonicalUrl) findings.push(postFinding('post-canonical-invalid', 'error', post, { canonical }))
      else if (canonicalUrl.protocol !== 'https:') findings.push(postFinding('post-canonical-not-https', 'warning', post, { canonical }))
    }

    let previousLevel = 1
    for (const heading of post.headings) {
      if (heading.level > previousLevel + 1) {
        findings.push(postFinding('heading-level-skipped', 'warning', post, { from: previousLevel, to: heading.level, heading: heading.text }, { target: `${post.id}:${heading.anchor}` }))
      }
      previousLevel = heading.level
    }

    for (const link of markdownLinks(post.body)) {
      if (!await linkExists(root, post, link.destination, routeKeys, postIds, anchorMap, basePath)) {
        findings.push(postFinding('internal-link-broken', 'error', post, { destination: link.destination }, { target: `${post.id}:${link.offset}` }))
      }
    }
  }

  const titleGroups = new Map()
  const routeGroups = new Map()
  for (const post of posts) {
    if (post.title) {
      const key = `${post.language}:${post.title.toLocaleLowerCase()}`
      titleGroups.set(key, [...(titleGroups.get(key) || []), post])
    }
    const key = `${post.language}:${post.route}`
    routeGroups.set(key, [...(routeGroups.get(key) || []), post])
  }
  for (const group of titleGroups.values()) if (group.length > 1) {
    for (const post of group) findings.push(postFinding('post-title-duplicate', 'warning', post, { count: group.length, title: post.title }))
  }
  for (const group of routeGroups.values()) if (group.length > 1) {
    for (const post of group) findings.push(postFinding('post-slug-collision', 'error', post, { count: group.length, route: post.route }))
  }

  const media = await buildMediaLibrary(root)
  for (const reference of media.missingReferences) {
    const post = posts.find((item) => item.id === reference.postId)
    findings.push(finding('image-file-missing', 'error', { postId: reference.postId, postTitle: reference.postTitle, path: reference.expectedMediaId, values: { destination: reference.destination }, target: reference.id }))
    if (post && reference.kind !== 'frontmatter' && !reference.alt.trim()) findings.push(postFinding('image-alt-missing', 'warning', post, { destination: reference.destination }, { target: reference.id }))
  }
  for (const item of media.items) for (const reference of item.references.filter((entry) => entry.kind !== 'frontmatter' && !entry.alt.trim())) {
    findings.push(finding('image-alt-missing', 'warning', {
      postId: reference.postId,
      postTitle: reference.postTitle,
      path: item.id,
      values: { destination: reference.destination },
      target: reference.id,
      fix: reference.editable ? { kind: 'text', field: 'alt', before: '', placeholder: 'review.fix.altPlaceholder', mediaId: item.id, postId: reference.postId, referenceId: reference.id, caption: reference.caption } : null,
    }))
  }

  return { findings, posts }
}

module.exports = { finding, inspectContent, routeFromId, routeFromPost }
