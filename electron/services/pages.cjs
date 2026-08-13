const fs = require('node:fs/promises')
const path = require('node:path')
const YAML = require('yaml')
const { contentPath, parsePostSource, revisionFor, serializePostSource, slugify } = require('./content.cjs')
const { createRecoveryPoint, restoreRecoveryPoint } = require('./history.cjs')
const { configuredTaxonomies } = require('./taxonomies.cjs')

const PAGE_FIELDS = new Set(['title', 'description', 'date', 'draft', 'url', 'slug', 'aliases', 'menu', 'menus', 'layout', 'type', 'translationKey', 'outputs', 'headless'])
const CONTENT_EXTENSIONS = new Set(['.adoc', '.asciidoc', '.html', '.md', '.org', '.pandoc', '.pdc', '.rst'])
const CONTENT_EXTENSION_PATTERN = '(?:adoc|asciidoc|html|md|org|pandoc|pdc|rst)'

function languageFromId(id) {
  return id.match(/\.([a-z]{2}(?:-[a-z0-9]{2,8})*)\.md$/i)?.[1]?.toLowerCase() || 'default'
}

function pageKind(id) {
  const name = path.posix.basename(id).toLowerCase()
  if (new RegExp(`^_index(?:\\.[^.]+)?\\.${CONTENT_EXTENSION_PATTERN}$`).test(name)) return 'branch'
  if (new RegExp(`^index(?:\\.[^.]+)?\\.${CONTENT_EXTENSION_PATTERN}$`).test(name)) return 'leaf'
  return 'standalone'
}

function cleanRoute(value, options = {}) {
  let route = String(value || '').trim().replaceAll('\\', '/')
  if ([...route].some((character) => character.charCodeAt(0) <= 31 || character.charCodeAt(0) === 127 || '<>"{}|^`'.includes(character))) throw new Error('Remove unsafe characters from this page route.')
  if (/^https?:\/\//i.test(route)) {
    try { route = new URL(route).pathname } catch { throw new Error('Enter a valid page route.') }
  }
  route = route.split(/[?#]/, 1)[0]
  if (!route.startsWith('/')) route = `/${route}`
  route = route.replace(/\/{2,}/g, '/')
  const segments = route.split('/').filter(Boolean)
  if (!segments.length) {
    if (options.allowRoot) return '/'
    throw new Error('Choose a page route below the site root, such as /about/.')
  }
  if (segments.some((segment) => segment === '.' || segment === '..')) throw new Error('Choose a page route without . or .. segments.')
  const suffix = /\.[a-z0-9]{1,12}$/i.test(segments.at(-1)) ? '' : '/'
  return `/${segments.join('/')}${suffix}`
}

function routeIdentity(value) {
  return cleanRoute(value, { allowRoot: true }).normalize('NFKC').toLocaleLowerCase('en-US')
}

function stripLanguage(name) {
  return name.replace(/\.([a-z]{2}(?:-[a-z0-9]{2,8})*)$/i, '')
}

function newPageRoute(value) {
  const route = cleanRoute(value)
  const segments = route.split('/').filter(Boolean).map((segment) => slugify(segment))
  if (segments.some((segment) => !segment)) throw new Error('Use letters or numbers in every route segment.')
  return `/${segments.join('/')}/`
}

function cleanLanguage(value) {
  const language = String(value || 'en-us').trim().toLowerCase()
  if (!/^[a-z]{2}(?:-[a-z0-9]{2,8})*$/.test(language)) throw new Error('Choose a valid Hugo content language.')
  return language
}

function inferredRoute(id, data = {}) {
  if (data.url) return cleanRoute(data.url, { allowRoot: true })
  const relative = id.replace(/^content\//, '').replace(/\.md$/i, '')
  const parts = relative.split('/')
  const kind = pageKind(id)
  if (kind !== 'standalone') parts.pop()
  else parts[parts.length - 1] = stripLanguage(parts.at(-1))
  if (data.slug && kind !== 'branch') {
    const slug = slugify(String(data.slug))
    if (slug && parts.length) parts[parts.length - 1] = slug
  }
  return cleanRoute(`/${parts.join('/')}/`, { allowRoot: true })
}

function aliasEntries(value, baseRoute = '/') {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? [value] : []
  const entries = values.flatMap((entry) => {
    try {
      const raw = String(entry || '').trim().replaceAll('\\', '/')
      if (!raw) return []
      if (/^https?:\/\//i.test(raw) || raw.startsWith('/')) return [{ route: cleanRoute(raw, { allowRoot: true }), routeScope: 'language' }]
      const resolved = path.posix.resolve(path.posix.dirname(baseRoute), raw)
      return [{ route: cleanRoute(resolved, { allowRoot: true }), routeScope: 'language' }]
    } catch { return [] }
  })
  return [...new Map(entries.map((entry) => [`${entry.routeScope}:${routeIdentity(entry.route)}`, entry])).values()]
}

function aliasRoutes(value, baseRoute = '/') {
  return aliasEntries(value, baseRoute).map((entry) => entry.route)
}

function menuNames(data = {}) {
  const value = data.menu ?? data.menus
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap((entry) => typeof entry === 'string' ? [entry] : entry && typeof entry === 'object' ? Object.keys(entry) : [])
  if (value && typeof value === 'object') return Object.keys(value)
  return []
}

async function walkContent(directory, root, output = []) {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) await walkContent(absolute, root, output)
    else if (entry.isFile() && CONTENT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) output.push(path.relative(root, absolute).replaceAll(path.sep, '/'))
  }
  return output
}

function pageSourceIds(ids) {
  const leafDirectories = new Set(ids.filter((id) => pageKind(id) === 'leaf').map((id) => path.posix.dirname(id)))
  return ids.filter((id) => {
    const directory = path.posix.dirname(id)
    if (pageKind(id) === 'leaf' && leafDirectories.has(directory)) return true
    for (const leaf of leafDirectories) {
      if (directory === leaf || directory.startsWith(`${leaf}/`)) return false
    }
    return true
  })
}

async function walkBundle(directory, root, output = []) {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) await walkBundle(absolute, root, output)
    else if (entry.isFile() || entry.isSymbolicLink()) output.push(path.relative(root, absolute).replaceAll(path.sep, '/'))
  }
  return output
}

async function bundleDetails(root, id) {
  const kind = pageKind(id)
  const absolute = contentPath(root, id)
  const directory = path.dirname(absolute)
  if (kind === 'standalone') {
    const basename = stripLanguage(path.basename(id, '.md'))
    const escaped = basename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const translationPattern = new RegExp(`^${escaped}(?:\\.[a-z]{2}(?:-[a-z0-9]{2,8})*)?\\.md$`, 'i')
    const translations = (await fs.readdir(directory, { withFileTypes: true }).catch(() => []))
      .filter((entry) => entry.isFile() && translationPattern.test(entry.name))
      .map((entry) => path.relative(root, path.join(directory, entry.name)).replaceAll(path.sep, '/'))
      .sort()
    return { resources: [], translations, shared: false, descendants: [], bundleFiles: [id], canRemoveBundle: false }
  }
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => [])
  const indexPattern = new RegExp(kind === 'branch' ? `^_index(?:\\.[^.]+)?\\.${CONTENT_EXTENSION_PATTERN}$` : `^index(?:\\.[^.]+)?\\.${CONTENT_EXTENSION_PATTERN}$`, 'i')
  const translations = entries.filter((entry) => entry.isFile() && indexPattern.test(entry.name)).map((entry) => path.relative(root, path.join(directory, entry.name)).replaceAll(path.sep, '/')).sort()
  const allFiles = await walkBundle(directory, root)
  const translationSet = new Set(translations)
  const relativeToBundle = (entry) => path.posix.relative(path.posix.dirname(id), entry)
  const descendants = kind === 'branch'
    ? pageSourceIds(await walkContent(directory, root)).filter((entry) => !translationSet.has(entry)).map(relativeToBundle).sort()
    : []
  const resources = allFiles.filter((entry) => {
    if (translationSet.has(entry)) return false
    if (kind === 'branch') return path.posix.dirname(entry) === path.posix.dirname(id) && !CONTENT_EXTENSIONS.has(path.extname(entry).toLowerCase())
    return true
  }).map(relativeToBundle).sort()
  return {
    resources,
    translations,
    shared: translations.length > 1,
    descendants,
    bundleFiles: allFiles,
    canRemoveBundle: kind === 'leaf' && translations.length === 1,
  }
}

function publicPage(page) {
  return {
    id: page.id,
    title: page.title,
    description: page.description,
    route: page.route,
    routeScope: page.routeScope,
    explicitUrl: page.explicitUrl,
    aliases: page.aliases,
    menus: page.menus,
    language: page.language,
    draft: page.draft,
    kind: page.kind,
    section: page.section,
    layout: page.layout,
    type: page.type,
    themeDependent: page.themeDependent,
    unknownFields: page.unknownFields,
    revision: page.revision,
    resources: page.resources,
    translations: page.translations,
    sharedBundle: page.sharedBundle,
    canRemoveBundle: page.canRemoveBundle,
    descendants: page.descendants,
    translationKey: page.translationKey,
    isHome: page.isHome,
    bodyExcerpt: page.bodyExcerpt,
  }
}

async function safeContentTarget(root, id) {
  const absolute = contentPath(root, id)
  const contentRoot = contentPath(root, 'content/.plumbago-boundary')
  const realContentRoot = await fs.realpath(path.dirname(contentRoot))
  let existing = absolute
  let stat = await fs.lstat(existing).catch(() => null)
  while (!stat && existing !== path.dirname(existing)) {
    existing = path.dirname(existing)
    stat = await fs.lstat(existing).catch(() => null)
  }
  const realExisting = await fs.realpath(existing)
  if (realExisting !== realContentRoot && !realExisting.startsWith(`${realContentRoot}${path.sep}`)) throw new Error('This page path leaves the blog content folder through a symbolic link.')
  const targetStat = await fs.lstat(absolute).catch(() => null)
  if (targetStat?.isSymbolicLink()) throw new Error('Symbolic-link pages must be managed outside Plumbago.')
  return absolute
}

async function readPageRecord(root, id) {
  if (!String(id).toLowerCase().endsWith('.md')) throw new Error('Choose a Markdown page in this blog.')
  const absolute = await safeContentTarget(root, id)
  const raw = await fs.readFile(absolute, 'utf8')
  const parsed = parsePostSource(raw)
  const bundle = await bundleDetails(root, id)
  const route = inferredRoute(id, parsed.data)
  const contentParts = id.replace(/^content\//, '').split('/')
  const section = contentParts.length > 1 ? contentParts[0] : ''
  return {
    id,
    title: String(parsed.data.title || stripLanguage(path.posix.basename(id, '.md'))),
    description: String(parsed.data.description || ''),
    route,
    explicitUrl: Boolean(parsed.data.url),
    routeScope: parsed.data.url && (/^https?:\/\//i.test(String(parsed.data.url).trim()) || String(parsed.data.url).trim().startsWith('/')) ? 'root' : 'language',
    aliases: aliasRoutes(parsed.data.aliases, route),
    aliasEntries: aliasEntries(parsed.data.aliases, route),
    aliasValues: Array.isArray(parsed.data.aliases) ? [...parsed.data.aliases] : typeof parsed.data.aliases === 'string' ? [parsed.data.aliases] : [],
    menus: menuNames(parsed.data),
    language: languageFromId(id),
    draft: parsed.data.draft !== false,
    kind: pageKind(id),
    section,
    layout: String(parsed.data.layout || ''),
    type: String(parsed.data.type || ''),
    themeDependent: Boolean(parsed.data.layout || parsed.data.type || parsed.data.outputs || parsed.data.headless),
    unknownFields: Object.keys(parsed.data).filter((key) => !PAGE_FIELDS.has(key)).sort(),
    revision: revisionFor(raw),
    resources: bundle.resources,
    translations: bundle.translations,
    sharedBundle: bundle.shared,
    canRemoveBundle: bundle.canRemoveBundle,
    descendants: bundle.descendants,
    bundleFiles: bundle.bundleFiles,
    translationKey: String(parsed.data.translationKey || ''),
    isHome: /^content\/_index(?:\.[^.]+)?\.md$/i.test(id),
    bodyExcerpt: String(parsed.content || '').trim().replace(/\s+/g, ' ').slice(0, 180),
    data: parsed.data,
    content: parsed.content,
    format: parsed.format,
  }
}

function languagesOverlap(left, right, leftScope = 'language', rightScope = 'language') {
  if (leftScope === 'root' || rightScope === 'root') return true
  return left === right || left === 'default' || right === 'default'
}

function collisionIndex(records) {
  const entries = records.flatMap((record) => [
    { id: record.id, title: record.title, language: record.language, route: record.route, routeScope: record.routeScope || 'language', kind: record.virtualKind || 'page', virtual: Boolean(record.virtual) },
    ...(record.aliasEntries || []).map((alias) => ({ id: record.id, title: record.title, language: record.language, route: alias.route, routeScope: alias.routeScope, kind: 'alias', virtual: false })),
  ])
  const collisions = []
  for (let leftIndex = 0; leftIndex < entries.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < entries.length; rightIndex += 1) {
      const left = entries[leftIndex]
      const right = entries[rightIndex]
      if (left.id === right.id || routeIdentity(left.route) !== routeIdentity(right.route) || !languagesOverlap(left.language, right.language, left.routeScope, right.routeScope)) continue
      const key = [left.id, right.id].sort().join('|')
      if (collisions.some((item) => item.key === key && routeIdentity(item.route) === routeIdentity(left.route))) continue
      collisions.push({ key, route: left.route, language: left.language === right.language ? left.language : 'shared', entries: [left, right] })
    }
  }
  return { entries, collisions }
}

async function virtualRouteRecords(root, records, discoveredIds = [], configuration = null) {
  const virtual = []
  const contentEntries = await fs.readdir(path.join(root, 'content'), { withFileTypes: true }).catch(() => [])
  if (!configuration?.disabledKinds.includes('section')) {
    for (const entry of contentEntries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue
      const prefix = `content/${entry.name}/`
      if (!records.some((record) => record.id.startsWith(prefix))) continue
      const backed = discoveredIds.some((id) => id.startsWith(prefix) && pageKind(id) !== 'standalone' && path.posix.dirname(id) === `content/${entry.name}`)
      if (backed) continue
      virtual.push({ id: `virtual:section:${entry.name}`, title: entry.name, language: 'default', route: cleanRoute(`/${entry.name}/`), routeScope: 'language', aliasEntries: [], virtual: true, virtualKind: 'section' })
    }
  }
  if (configuration?.routesEnabled) {
    for (const definition of configuration.definitions) {
      const prefix = `content/${definition.plural}/`
      const backed = discoveredIds.some((id) => id.startsWith(prefix) && pageKind(id) === 'branch' && path.posix.dirname(id) === `content/${definition.plural}`)
      if (!backed) virtual.push({ id: `virtual:taxonomy:${definition.id}`, title: definition.plural, language: 'default', route: cleanRoute(definition.route), routeScope: 'language', aliasEntries: [], virtual: true, virtualKind: 'taxonomy' })
    }
  }
  return virtual
}

async function pageInventory(root) {
  const configuration = await configuredTaxonomies(root).catch(() => null)
  const discoveredIds = pageSourceIds(await walkContent(path.join(root, 'content'), root))
  const ids = discoveredIds.filter((id) => id.toLowerCase().endsWith('.md'))
  const records = []
  const unsupported = discoveredIds.filter((id) => !id.toLowerCase().endsWith('.md')).map((id) => ({ id, kind: pageKind(id), details: 'This Hugo content format remains untouched. Edit it with its original tool.' }))
  for (const id of ids) {
    try { records.push(await readPageRecord(root, id)) } catch (error) { unsupported.push({ id, details: error.message }) }
  }
  const translationsByKey = new Map()
  for (const record of records) {
    if (!record.translationKey) continue
    const group = translationsByKey.get(record.translationKey) || []
    group.push(record.id)
    translationsByKey.set(record.translationKey, group)
  }
  for (const record of records) {
    const linked = record.translationKey ? translationsByKey.get(record.translationKey) || [] : []
    record.translations = [...new Set([...record.translations, ...linked])].sort()
    if (linked.some((id) => id !== record.id)) {
      record.sharedBundle = true
      record.canRemoveBundle = false
    }
  }
  const virtualRecords = await virtualRouteRecords(root, records, discoveredIds, configuration)
  const { entries, collisions: allCollisions } = collisionIndex([...records, ...virtualRecords])
  const managedPageIds = new Set(records.filter((record) => !record.id.startsWith('content/posts/')).map((record) => record.id))
  const collisions = allCollisions.filter((collision) => collision.entries.some((entry) => managedPageIds.has(entry.id)))
  const collisionIds = new Set(collisions.flatMap((collision) => collision.entries.map((entry) => entry.id)))
  const pages = records.filter((record) => !record.id.startsWith('content/posts/')).map((record) => ({ ...publicPage(record), collision: collisionIds.has(record.id) })).sort((left, right) => left.route.localeCompare(right.route) || left.language.localeCompare(right.language))
  return {
    pages,
    routes: entries,
    virtualRoutes: virtualRecords.map((record) => ({ id: record.id, title: record.title, route: record.route, kind: record.virtualKind })),
    languages: [...new Set([...(configuration?.languages || []), ...records.map((record) => record.language).filter((language) => language !== 'default'), 'en-us', 'pt-br'])],
    collisions,
    unsupported,
    summary: {
      pages: pages.length,
      published: pages.filter((page) => !page.draft).length,
      drafts: pages.filter((page) => page.draft).length,
      menuPages: pages.filter((page) => page.menus.length).length,
      collisions: collisions.length,
      themeDependent: pages.filter((page) => page.themeDependent).length,
    },
  }
}

function targetId(routeValue, kindValue, languageValue) {
  const route = newPageRoute(routeValue)
  const segments = route.split('/').filter(Boolean)
  const language = cleanLanguage(languageValue)
  const kind = ['branch', 'leaf', 'standalone'].includes(kindValue) ? kindValue : 'leaf'
  const base = `content/${segments.join('/')}`
  if (kind === 'branch') return `${base}/_index.${language}.md`
  if (kind === 'leaf') return `${base}/index.${language}.md`
  return `${base}.${language}.md`
}

function routeConflicts(inventory, route, language, excludedId = '', routeScope = 'language') {
  return inventory.routes.filter((entry) => entry.id !== excludedId && routeIdentity(entry.route) === routeIdentity(route) && languagesOverlap(entry.language, language, entry.routeScope, routeScope))
}

async function previewPageChange(root, input = {}) {
  const action = String(input.action || '')
  if (!['create', 'rename', 'delete'].includes(action)) throw new Error('Choose a supported page change.')
  const inventory = await pageInventory(root)
  if (action === 'create') {
    const title = String(input.title || '').trim()
    const route = newPageRoute(input.route)
    const language = cleanLanguage(input.language)
    const id = targetId(route, input.kind, language)
    if (!title) throw new Error('Give the new page a title.')
    const absolute = await safeContentTarget(root, id)
    if (await fs.lstat(absolute).catch(() => null)) throw new Error('A page file already exists at this location.')
    const conflicts = routeConflicts(inventory, route, language)
    if (conflicts.length) throw new Error(`${route} is already used by ${conflicts[0].title}. Choose another route.`)
    return {
      action,
      page: { id, title, language, kind: pageKind(id), route, draft: input.draft !== false },
      changes: [{ kind: 'create', path: id }],
      conflicts: [],
      revisions: { [id]: '' },
      impact: { files: 1, resources: 0, translations: 1, routeBefore: '', routeAfter: route, aliasesAdded: [], menus: input.menu ? [String(input.menu)] : [], published: input.draft === false ? 1 : 0, drafts: input.draft === false ? 0 : 1 },
    }
  }

  const id = String(input.id || '')
  if (id.startsWith('content/posts/')) throw new Error('Use the post editor for content inside content/posts/.')
  const record = await readPageRecord(root, id)
  if (action === 'rename') {
    if (record.isHome) throw new Error('The Hugo homepage always uses the site root and cannot be renamed here.')
    const route = cleanRoute(input.route)
    const conflicts = routeConflicts(inventory, route, record.language, record.id, 'language')
    if (conflicts.length) throw new Error(`${route} is already used by ${conflicts[0].title}. Choose another route.`)
    if (routeIdentity(route) === routeIdentity(record.route)) throw new Error('Choose a different public route for this page.')
    const aliasesAdded = input.preserveAlias === false || record.aliases.some((alias) => routeIdentity(alias) === routeIdentity(record.route)) ? [] : [record.route]
    return {
      action,
      page: publicPage(record),
      changes: [{ kind: 'update', path: record.id, field: 'url', before: record.route, after: route }],
      conflicts: [],
      revisions: { [record.id]: record.revision },
      impact: { files: 1, resources: record.resources.length, translations: record.translations.length, routeBefore: record.route, routeAfter: route, routeScopeAfter: 'language', urlValue: route.replace(/^\//, ''), aliasesAdded, menus: record.menus, published: record.draft ? 0 : 1, drafts: record.draft ? 1 : 0 },
    }
  }

  if (record.kind === 'branch') throw new Error('Remove section pages through their original Hugo files so descendant routes are not misrepresented.')
  const removeBundle = Boolean(input.includeResources && record.canRemoveBundle)
  const target = removeBundle ? path.posix.dirname(record.id) : record.id
  return {
    action,
    page: publicPage(record),
    changes: [{ kind: 'delete', path: target }],
    conflicts: [],
    revisions: { [record.id]: record.revision },
    impact: { files: removeBundle ? record.bundleFiles.length : 1, resources: record.resources.length, translations: record.translations.length, descendants: record.descendants.length, routeBefore: record.route, routeAfter: '', aliasesAdded: [], menus: record.menus, published: record.draft ? 0 : 1, drafts: record.draft ? 1 : 0, removeBundle, resourcesPreserved: !removeBundle && record.resources.length > 0, sharedBundle: record.sharedBundle, canRemoveBundle: record.canRemoveBundle },
  }
}

function createPageSource(input) {
  const data = {
    title: String(input.title || '').trim(),
    description: String(input.description || '').trim() || undefined,
    date: new Date().toISOString(),
    draft: input.draft !== false,
    layout: String(input.layout || '').trim() || undefined,
    type: String(input.type || '').trim() || undefined,
    menu: String(input.menu || '').trim() || undefined,
  }
  const compact = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined))
  return `---\n${YAML.stringify(compact, { lineWidth: 0 }).trim()}\n---\n\n${String(input.body || '').trim()}\n`
}

async function atomicWrite(absolute, source) {
  const temporary = `${absolute}.${process.pid}.${Date.now()}.tmp`
  try {
    await fs.mkdir(path.dirname(absolute), { recursive: true })
    await fs.writeFile(temporary, source, 'utf8')
    await fs.rename(temporary, absolute)
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => {})
  }
}

async function atomicCreate(absolute, source) {
  let handle
  try {
    await fs.mkdir(path.dirname(absolute), { recursive: true })
    handle = await fs.open(absolute, 'wx')
    await handle.writeFile(source, 'utf8')
    await handle.sync()
  } catch (error) {
    if (handle) {
      await handle.close().catch(() => {})
      handle = null
      await fs.rm(absolute, { force: true }).catch(() => {})
    }
    throw error
  } finally {
    await handle?.close().catch(() => {})
  }
}

async function applyPageChange(root, input = {}) {
  const preview = await previewPageChange(root, input)
  const expected = input.expectedRevisions && typeof input.expectedRevisions === 'object' ? input.expectedRevisions : null
  if (!expected) throw new Error('Review this page change again before applying it.')
  for (const [id, revision] of Object.entries(preview.revisions)) {
    if (expected[id] !== revision) throw new Error('This page changed after the preview. Review the page change again before applying it.')
    const absolute = await safeContentTarget(root, id)
    const raw = await fs.readFile(absolute, 'utf8').catch(() => '')
    if (revisionFor(raw) !== revision && !(revision === '' && raw === '')) throw new Error('This page changed after the preview. Review the page change again before applying it.')
  }
  const paths = preview.changes.map((change) => change.path)
  const recoveryPoint = await createRecoveryPoint(root, { reason: 'before-page-change', label: `${preview.action} ${preview.page.route}`, paths })
  let mutationStarted = false
  try {
    if (preview.action === 'create') {
      await atomicCreate(await safeContentTarget(root, preview.page.id), createPageSource(input))
      mutationStarted = true
    } else if (preview.action === 'rename') {
      const record = await readPageRecord(root, preview.page.id)
      if (record.revision !== preview.revisions[record.id]) throw new Error('This page changed while the route change was being applied.')
      const data = { ...record.data, url: preview.impact.urlValue }
      if (preview.impact.aliasesAdded.length) data.aliases = [...new Set([...record.aliasValues, ...preview.impact.aliasesAdded])]
      await atomicWrite(await safeContentTarget(root, record.id), serializePostSource(data, record.content, record.format))
      mutationStarted = true
    } else {
      const raw = await fs.readFile(await safeContentTarget(root, preview.page.id), 'utf8')
      if (revisionFor(raw) !== preview.revisions[preview.page.id]) throw new Error('This page changed while the removal was being applied.')
      mutationStarted = true
      await fs.rm(await safeContentTarget(root, preview.changes[0].path), { recursive: preview.impact.removeBundle, force: false })
    }
    return { preview, recoveryPoint, inventory: await pageInventory(root) }
  } catch (error) {
    if (mutationStarted) await restoreRecoveryPoint(root, recoveryPoint.id, { createUndo: false }).catch(() => {})
    throw error
  }
}

module.exports = {
  aliasRoutes,
  applyPageChange,
  cleanRoute,
  inferredRoute,
  menuNames,
  pageInventory,
  pageKind,
  previewPageChange,
  readPageRecord,
  routeIdentity,
  targetId,
}
