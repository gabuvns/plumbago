const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')
const TOML = require('@iarna/toml')
const {
  CONFIG_EXTENSION,
  MAX_CONFIG_BYTES,
  configRecord,
  deepMerge,
  discoverProjectConfig,
  getIn,
  isPlainObject,
  resolvePath,
  revisionForSources,
  sourceForPath,
} = require('./config-files.cjs')

const MAX_THEME_CONFIG_FILES = 100
const MAX_CONTROLS = 48
const SECRET_PATTERN = /(?:^|[-_.])(api|client|private)?(?:key|token|secret|password|credential|analytics)(?:$|[-_.])/i

const DESCRIPTORS = [
  { category: 'identity', candidates: [['title']], labelKey: 'themeConfig.controls.title', type: 'text', standard: true, fallback: '' },
  { category: 'identity', candidates: [['copyright']], labelKey: 'themeConfig.controls.copyright', type: 'text', standard: true, fallback: '' },
  { category: 'identity', candidates: [['params', 'description'], ['params', 'subtitle']], labelKey: 'themeConfig.controls.description', type: 'text' },
  { category: 'identity', candidates: [['params', 'logo'], ['params', 'navbar', 'logo'], ['params', 'header', 'logo']], labelKey: 'themeConfig.controls.logo', type: 'path' },
  { category: 'identity', candidates: [['params', 'favicon'], ['params', 'assets', 'favicon']], labelKey: 'themeConfig.controls.favicon', type: 'path' },
  { category: 'colors', candidates: [['params', 'primaryColor'], ['params', 'accentColor'], ['params', 'themeColor']], labelKey: 'themeConfig.controls.accentColor', type: 'color' },
  { category: 'colors', candidates: [['params', 'colorScheme']], labelKey: 'themeConfig.controls.colorScheme', type: 'text' },
  { category: 'typography', candidates: [['params', 'fontFamily'], ['params', 'bodyFont']], labelKey: 'themeConfig.controls.bodyFont', type: 'text' },
  { category: 'typography', candidates: [['params', 'headingFont'], ['params', 'titleFont']], labelKey: 'themeConfig.controls.headingFont', type: 'text' },
  { category: 'homepage', candidates: [['params', 'homepage', 'layout']], labelKey: 'themeConfig.controls.homeLayout', type: 'text' },
  { category: 'homepage', candidates: [['params', 'homepage', 'showRecent']], labelKey: 'themeConfig.controls.showRecent', type: 'boolean' },
  { category: 'homepage', candidates: [['params', 'profileMode', 'enabled']], labelKey: 'themeConfig.controls.profileEnabled', type: 'boolean', adapters: ['hugo-papermod'] },
  { category: 'homepage', candidates: [['params', 'profileMode', 'title']], labelKey: 'themeConfig.controls.profileTitle', type: 'text', adapters: ['hugo-papermod'] },
  { category: 'homepage', candidates: [['params', 'profileMode', 'subtitle']], labelKey: 'themeConfig.controls.profileSubtitle', type: 'text', adapters: ['hugo-papermod'] },
  { category: 'homepage', candidates: [['params', 'homeInfoParams', 'Title']], labelKey: 'themeConfig.controls.homeTitle', type: 'text', adapters: ['hugo-papermod'] },
  { category: 'homepage', candidates: [['params', 'homeInfoParams', 'Content']], labelKey: 'themeConfig.controls.homeCopy', type: 'text', adapters: ['hugo-papermod'] },
  { category: 'colors', candidates: [['params', 'defaultTheme']], labelKey: 'themeConfig.controls.appearance', type: 'select', options: ['auto', 'light', 'dark'], adapters: ['hugo-papermod'] },
  { category: 'colors', candidates: [['params', 'defaultAppearance']], labelKey: 'themeConfig.controls.appearance', type: 'select', options: ['light', 'dark'], adapters: ['blowfish'] },
  { category: 'colors', candidates: [['params', 'BookTheme']], labelKey: 'themeConfig.controls.appearance', type: 'select', options: ['light', 'dark', 'auto'], adapters: ['hugo-book'] },
  { category: 'identity', candidates: [['params', 'BookLogo']], labelKey: 'themeConfig.controls.logo', type: 'path', adapters: ['hugo-book'] },
  { category: 'navigation', candidates: [['params', 'BookSection']], labelKey: 'themeConfig.controls.bookSection', type: 'text', adapters: ['hugo-book'] },
  { category: 'navigation', candidates: [['params', 'BookSearch']], labelKey: 'themeConfig.controls.search', type: 'boolean', adapters: ['hugo-book'] },
  { category: 'navigation', candidates: [['params', 'BookToC']], labelKey: 'themeConfig.controls.tableOfContents', type: 'boolean', adapters: ['hugo-book'] },
  { category: 'homepage', candidates: [['params', 'BookComments']], labelKey: 'themeConfig.controls.comments', type: 'boolean', adapters: ['hugo-book'] },
]

function safeThemeFolder(value) {
  const folder = String(Array.isArray(value) ? value[0] : value || '')
  return /^[a-z0-9][a-z0-9._-]{0,100}$/i.test(folder) ? folder : ''
}

async function themeDirectory(root, folder) {
  if (!folder) return null
  const themesRoot = path.resolve(root, 'themes')
  const target = path.resolve(themesRoot, folder)
  if (!target.startsWith(`${themesRoot}${path.sep}`)) return null
  const [realThemes, realTarget] = await Promise.all([fs.realpath(themesRoot).catch(() => themesRoot), fs.realpath(target).catch(() => '')])
  if (!realTarget || (realTarget !== realThemes && !realTarget.startsWith(`${realThemes}${path.sep}`))) return null
  const stat = await fs.lstat(realTarget).catch(() => null)
  return stat?.isDirectory() && !stat.isSymbolicLink() ? realTarget : null
}

async function collectConfigFiles(base, relative, output) {
  if (output.length >= MAX_THEME_CONFIG_FILES) return
  const absolute = path.join(base, ...relative.split('/'))
  const entries = await fs.readdir(absolute, { withFileTypes: true }).catch(() => [])
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (output.length >= MAX_THEME_CONFIG_FILES || entry.isSymbolicLink()) continue
    const child = relative ? `${relative}/${entry.name}` : entry.name
    if (entry.isDirectory()) await collectConfigFiles(base, child, output)
    else if (entry.isFile() && CONFIG_EXTENSION.test(entry.name)) output.push(child)
  }
}

async function themeConfigSources(root, folder) {
  const directory = await themeDirectory(root, folder)
  if (!directory) return { directory: '', sources: [], merged: {}, errors: [], name: folder }
  const candidates = []
  for (const prefix of ['', 'exampleSite']) {
    for (const name of ['hugo.toml', 'hugo.yaml', 'hugo.yml', 'hugo.json', 'config.toml', 'config.yaml', 'config.yml']) {
      const relative = prefix ? `${prefix}/${name}` : name
      if (await fs.lstat(path.join(directory, ...relative.split('/'))).then((stat) => stat.isFile() && !stat.isSymbolicLink()).catch(() => false)) candidates.push(relative)
    }
    await collectConfigFiles(directory, prefix ? `${prefix}/config/_default` : 'config/_default', candidates)
  }
  const sources = []
  const errors = []
  for (const relative of [...new Set(candidates)]) {
    try {
      const absolute = path.join(directory, ...relative.split('/'))
      const stat = await fs.lstat(absolute)
      if (!stat.isFile() || stat.size > MAX_CONFIG_BYTES) throw new Error('The theme sample is too large to inspect safely.')
      const source = await fs.readFile(absolute, 'utf8')
      sources.push({ ...configRecord(`themes/${folder}/${relative}`, source), absolute })
    } catch (error) {
      errors.push({ file: `themes/${folder}/${relative}`, message: error.message })
    }
  }
  const metadata = await fs.readFile(path.join(directory, 'theme.toml'), 'utf8').then((source) => TOML.parse(source)).catch(() => ({}))
  return {
    directory,
    sources,
    merged: sources.reduce((current, source) => deepMerge(current, source.globalData), {}),
    errors,
    name: String(metadata.name || folder),
  }
}

function adapterFor(folder) {
  const value = folder.toLowerCase()
  if (/papermod/.test(value)) return 'hugo-papermod'
  if (/blowfish/.test(value)) return 'blowfish'
  if (/hugo-book|^book$/.test(value)) return 'hugo-book'
  if (/ananke/.test(value)) return 'ananke'
  return 'generic'
}

function humanizePath(segments) {
  const value = String(segments.at(-1) || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_.]+/g, ' ')
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function defaultLanguage(configuration) {
  const configured = String(getIn(configuration.merged, ['defaultContentLanguage']) || '').trim()
  if (configured) return configured
  const languages = getIn(configuration.merged, ['languages'])
  if (!isPlainObject(languages)) return ''
  return Object.keys(languages).find((key) => key !== '_merge' && isPlainObject(languages[key])) || ''
}

function localizedCandidates(candidates, language) {
  if (!language) return candidates
  const localized = candidates.flatMap((candidate) => {
    const first = String(candidate[0] || '').toLowerCase()
    if (first === 'params' || (candidate.length === 1 && ['title', 'copyright'].includes(first))) {
      return [['languages', language, ...candidate]]
    }
    return []
  })
  return [...localized, ...candidates]
}

function firstResolvedPath(configuration, candidates) {
  return candidates.map((candidate) => resolvePath(configuration.merged, candidate)).find(Boolean) || null
}

function classifyPath(segments) {
  const value = segments.join('.').toLowerCase()
  if (/(logo|favicon|avatar|description|subtitle|author|identity|brand)/.test(value)) return 'identity'
  if (/(color|colour|appearance|dark|light|scheme|palette)/.test(value)) return 'colors'
  if (/(font|typeface|typography|serif|monospace)/.test(value)) return 'typography'
  if (/(social|github|twitter|mastodon|instagram|youtube|linkedin|facebook)/.test(value)) return 'social'
  if (/(menu|nav|breadcrumb|toc|header|footer|search)/.test(value)) return 'navigation'
  if (/(home|landing|profile|recent|featured|mainsections|showposts|hero)/.test(value)) return 'homepage'
  return ''
}

function inferredType(pathSegments, value) {
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  const pathValue = pathSegments.join('.').toLowerCase()
  if (typeof value === 'string' && /^#[0-9a-f]{3,8}$/i.test(value) && /(color|colour|accent|background)/.test(pathValue)) return 'color'
  if (/(url|link|href)$/.test(pathValue)) return 'url'
  if (/(logo|favicon|avatar|image)$/.test(pathValue)) return 'path'
  return 'text'
}

function scalarEntries(value, segments = ['params'], output = [], depth = 0) {
  if (output.length >= 180 || depth > 5 || !isPlainObject(value)) return output
  for (const [key, child] of Object.entries(value)) {
    const next = [...segments, key]
    if (SECRET_PATTERN.test(next.join('.'))) continue
    if (['string', 'number', 'boolean'].includes(typeof child)) output.push({ path: next, value: child })
    else if (isPlainObject(child)) scalarEntries(child, next, output, depth + 1)
  }
  return output
}

function stableControlId(pathSegments) {
  return `setting:${pathSegments.map((segment) => String(segment).toLowerCase()).join('.')}`
}

function descriptorControl(descriptor, project, sample, adapter) {
  const projectPath = firstResolvedPath(project, localizedCandidates(descriptor.candidates, defaultLanguage(project)))
  const samplePath = firstResolvedPath(sample, localizedCandidates(descriptor.candidates, defaultLanguage(sample)))
  const fallbackPath = descriptor.standard || descriptor.adapters?.includes(adapter) ? descriptor.candidates[0] : null
  const actualPath = projectPath || samplePath || fallbackPath
  if (!actualPath) return null
  const hasCurrent = Boolean(projectPath)
  const currentValue = projectPath ? getIn(project.merged, projectPath) : undefined
  const defaultValue = samplePath ? getIn(sample.merged, samplePath) : descriptor.fallback
  const value = hasCurrent ? currentValue : defaultValue
  if (!['string', 'number', 'boolean'].includes(typeof value)) return null
  const source = projectPath ? sourceForPath(project.sources, projectPath) : null
  const type = descriptor.type === 'color' && !(typeof value === 'string' && /^#[0-9a-f]{3,8}$/i.test(value)) ? 'text' : descriptor.type
  return {
    id: stableControlId(actualPath),
    category: descriptor.category,
    path: actualPath,
    label: humanizePath(actualPath),
    labelKey: descriptor.labelKey,
    type,
    value,
    defaultValue,
    isSet: hasCurrent,
    options: descriptor.options || [],
    origin: projectPath ? 'project' : samplePath ? 'theme-example' : descriptor.standard ? 'hugo' : 'adapter',
    sourceRelative: source?.relative || '',
  }
}

function discoveredControls(project, sample, adapter) {
  const controls = []
  const used = new Set()
  for (const descriptor of DESCRIPTORS) {
    const control = descriptorControl(descriptor, project, sample, adapter)
    if (!control || used.has(control.id)) continue
    controls.push(control)
    used.add(control.id)
  }
  const projectLanguage = defaultLanguage(project)
  const sampleLanguage = defaultLanguage(sample)
  const inferredLanguage = projectLanguage || sampleLanguage
  const projectParams = isPlainObject(getIn(project.merged, ['params'])) ? getIn(project.merged, ['params']) : {}
  const sampleParams = isPlainObject(getIn(sample.merged, ['params'])) ? getIn(sample.merged, ['params']) : {}
  const localizedProjectParams = inferredLanguage && isPlainObject(getIn(project.merged, ['languages', inferredLanguage, 'params'])) ? getIn(project.merged, ['languages', inferredLanguage, 'params']) : {}
  const localizedSampleParams = inferredLanguage && isPlainObject(getIn(sample.merged, ['languages', inferredLanguage, 'params'])) ? getIn(sample.merged, ['languages', inferredLanguage, 'params']) : {}
  const entries = []
  if (inferredLanguage) {
    entries.push(...scalarEntries(deepMerge(localizedSampleParams, localizedProjectParams), ['languages', inferredLanguage, 'params']))
  }
  entries.push(...scalarEntries(deepMerge(sampleParams, projectParams)))
  const semanticUsed = new Set(controls.map((control) => {
    const lower = control.path.map((segment) => String(segment).toLowerCase())
    return lower[0] === 'languages' && lower.length > 2 ? lower.slice(2).join('.') : lower.join('.')
  }))
  for (const entry of entries) {
    if (controls.length >= MAX_CONTROLS) break
    const projectPath = resolvePath(project.merged, entry.path)
    const samplePath = resolvePath(sample.merged, entry.path)
    const actualPath = projectPath || samplePath || entry.path
    const id = stableControlId(actualPath)
    const category = classifyPath(actualPath)
    const lower = actualPath.map((segment) => String(segment).toLowerCase())
    const semanticId = lower[0] === 'languages' && lower.length > 2 ? lower.slice(2).join('.') : lower.join('.')
    if (!category || used.has(id) || semanticUsed.has(semanticId)) continue
    const hasCurrent = Boolean(projectPath)
    const source = projectPath ? sourceForPath(project.sources, projectPath) : null
    controls.push({
      id,
      category,
      path: actualPath,
      label: humanizePath(actualPath),
      labelKey: '',
      type: inferredType(actualPath, entry.value),
      value: hasCurrent ? getIn(project.merged, projectPath) : getIn(sample.merged, samplePath),
      defaultValue: samplePath ? getIn(sample.merged, samplePath) : undefined,
      isSet: hasCurrent,
      options: [],
      origin: hasCurrent ? 'project' : 'theme-example',
      sourceRelative: source?.relative || '',
    })
    used.add(id)
    semanticUsed.add(semanticId)
  }
  return controls
}

function itemId(prefix, item, index) {
  const identity = `${prefix}\0${item.identifier || item.name || item.network || item.url || ''}\0${index}`
  return crypto.createHash('sha256').update(identity).digest('hex').slice(0, 12)
}

function normalizeMenuItems(value) {
  if (!Array.isArray(value)) return null
  return value.filter(isPlainObject).map((item, index) => ({
    _id: itemId('menu', item, index),
    name: String(item.name || item.identifier || ''),
    pageRef: String(item.pageRef || item.pageref || ''),
    url: String(item.url || ''),
    weight: Number.isFinite(Number(item.weight)) ? Number(item.weight) : (index + 1) * 10,
    identifier: String(item.identifier || ''),
    parent: String(item.parent || ''),
    _original: item,
  }))
}

function navigationConfiguration(project, sample) {
  const candidates = [['menus', 'main'], ['menu', 'main']]
  const localizedMenus = (language) => language
    ? [['languages', language, 'menus', 'main'], ['languages', language, 'menu', 'main'], ...candidates]
    : candidates
  const projectPath = firstResolvedPath(project, localizedMenus(defaultLanguage(project)))
  const samplePath = firstResolvedPath(sample, localizedMenus(defaultLanguage(sample)))
  const projectItems = projectPath ? normalizeMenuItems(getIn(project.merged, projectPath)) : null
  const sampleItems = samplePath ? normalizeMenuItems(getIn(sample.merged, samplePath)) : null
  const pathSegments = projectPath || samplePath || ['menus', 'main']
  const source = projectPath ? sourceForPath(project.sources, projectPath) : null
  return {
    id: 'navigation:main',
    path: pathSegments,
    support: projectItems ? 'configured' : sampleItems ? 'discovered' : 'portable',
    items: projectItems || [],
    suggestedCount: sampleItems?.length || 0,
    sourceRelative: source?.relative || '',
  }
}

function socialShape(value) {
  if (Array.isArray(value) && value.every((item) => isPlainObject(item) && ('name' in item || 'url' in item))) return 'array-pairs'
  if (isPlainObject(value) && Object.values(value).every((item) => typeof item === 'string')) return 'map'
  if (Array.isArray(value) && value.every((item) => isPlainObject(item) && Object.keys(item).length === 1 && typeof Object.values(item)[0] === 'string')) return 'array-maps'
  return ''
}

function normalizeSocialItems(value, shape) {
  if (shape === 'map') return Object.entries(value).map(([network, url], index) => ({ _id: itemId('social', { network, url }, index), network, url: String(url), _original: { [network]: url } }))
  if (shape === 'array-maps') return value.map((item, index) => { const [network, url] = Object.entries(item)[0]; return { _id: itemId('social', { network, url }, index), network, url: String(url), _original: item } })
  if (shape === 'array-pairs') return value.map((item, index) => ({ _id: itemId('social', item, index), network: String(item.name || ''), url: String(item.url || ''), _original: item }))
  return []
}

function socialConfiguration(project, sample) {
  const candidates = [['params', 'socialIcons'], ['params', 'social'], ['params', 'author', 'links']]
  const projectCandidates = localizedCandidates(candidates, defaultLanguage(project))
  const sampleCandidates = localizedCandidates(candidates, defaultLanguage(sample))
  let projectPath = null
  let projectShape = ''
  for (const candidate of projectCandidates) {
    const resolved = resolvePath(project.merged, candidate)
    const shape = resolved ? socialShape(getIn(project.merged, resolved)) : ''
    if (shape) { projectPath = resolved; projectShape = shape; break }
  }
  let samplePath = null
  let sampleShape = ''
  for (const candidate of sampleCandidates) {
    const resolved = resolvePath(sample.merged, candidate)
    const shape = resolved ? socialShape(getIn(sample.merged, resolved)) : ''
    if (shape) { samplePath = resolved; sampleShape = shape; break }
  }
  const pathSegments = projectPath || samplePath
  if (!pathSegments) return { id: 'social:links', support: 'unsupported', path: [], shape: '', items: [], sourceRelative: '' }
  const shape = projectShape || sampleShape
  const source = projectPath ? sourceForPath(project.sources, projectPath) : null
  return {
    id: 'social:links',
    path: pathSegments,
    shape,
    support: projectPath ? 'configured' : 'discovered',
    items: projectPath ? normalizeSocialItems(getIn(project.merged, projectPath), shape) : [],
    suggestedCount: samplePath ? normalizeSocialItems(getIn(sample.merged, samplePath), sampleShape).length : 0,
    sourceRelative: source?.relative || '',
  }
}

function publicControl(control) {
  return {
    id: control.id,
    category: control.category,
    path: control.path.join('.'),
    label: control.label,
    labelKey: control.labelKey,
    type: control.type,
    value: control.value,
    defaultValue: control.defaultValue,
    isSet: control.isSet,
    options: control.options,
    origin: control.origin,
    sourceFile: control.sourceRelative,
  }
}

function publicMenuItem(item) {
  return { _id: item._id, name: item.name, pageRef: item.pageRef, url: item.url, weight: item.weight, identifier: item.identifier, parent: item.parent }
}

function publicSocialItem(item) {
  return { _id: item._id, network: item.network, url: item.url }
}

function unsupportedSettings(project, sample, controls, navigation, social) {
  const used = new Set(controls.map((control) => control.path.map((segment) => segment.toLowerCase()).join('.')))
  if (navigation.path.length) used.add(navigation.path.map((segment) => segment.toLowerCase()).join('.'))
  if (social.path.length) used.add(social.path.map((segment) => segment.toLowerCase()).join('.'))
  const output = []
  function visit(value, segments = ['params'], depth = 0) {
    if (output.length >= 80 || depth > 5) return
    for (const [key, child] of Object.entries(value || {})) {
      const next = [...segments, key]
      const identity = next.map((segment) => segment.toLowerCase()).join('.')
      if (SECRET_PATTERN.test(identity) || used.has(identity) || [...used].some((candidate) => candidate.startsWith(`${identity}.`))) continue
      if (Array.isArray(child)) output.push({ path: next.join('.'), kind: 'list' })
      else if (isPlainObject(child)) visit(child, next, depth + 1)
      else output.push({ path: next.join('.'), kind: typeof child })
    }
  }
  const mergedParams = deepMerge(isPlainObject(getIn(sample.merged, ['params'])) ? getIn(sample.merged, ['params']) : {}, isPlainObject(getIn(project.merged, ['params'])) ? getIn(project.merged, ['params']) : {})
  const language = defaultLanguage(project) || defaultLanguage(sample)
  if (language) {
    const localizedParams = deepMerge(
      isPlainObject(getIn(sample.merged, ['languages', language, 'params'])) ? getIn(sample.merged, ['languages', language, 'params']) : {},
      isPlainObject(getIn(project.merged, ['languages', language, 'params'])) ? getIn(project.merged, ['languages', language, 'params']) : {},
    )
    visit(localizedParams, ['languages', language, 'params'])
  }
  visit(mergedParams)
  return output
}

async function discoverThemeConfiguration(root) {
  const project = await discoverProjectConfig(root)
  const configuredTheme = getIn(project.merged, ['theme'])
  const folder = safeThemeFolder(configuredTheme)
  const sample = await themeConfigSources(root, folder)
  const adapter = adapterFor(folder)
  const controls = folder ? discoveredControls(project, sample, adapter) : []
  const navigation = folder ? navigationConfiguration(project, sample) : { id: 'navigation:main', path: [], support: 'unsupported', items: [], suggestedCount: 0, sourceRelative: '' }
  const social = folder ? socialConfiguration(project, sample) : { id: 'social:links', path: [], support: 'unsupported', shape: '', items: [], suggestedCount: 0, sourceRelative: '' }
  const themeControlCategories = new Set(controls.filter((control) => !['title', 'copyright'].includes(control.path.join('.').toLowerCase())).map((control) => control.category))
  const supportLevel = !folder ? 'none' : themeControlCategories.size >= 3 ? 'supported' : controls.length > 2 ? 'partial' : 'unsupported'
  const allRevisionSources = [...project.sources, ...sample.sources]
  return {
    revision: revisionForSources(allRevisionSources),
    theme: {
      id: folder,
      name: sample.name || folder,
      adapter,
      supportLevel,
      installed: Boolean(sample.directory),
      multiple: Array.isArray(configuredTheme) && configuredTheme.length > 1,
    },
    controls,
    navigation,
    social,
    unsupported: folder ? unsupportedSettings(project, sample, controls, navigation, social) : [],
    configFiles: project.sources.map((source) => source.relative),
    warnings: [...project.errors, ...sample.errors],
    _project: project,
    _sample: sample,
  }
}

function publicThemeConfiguration(inventory, presets = []) {
  const categories = ['identity', 'colors', 'typography', 'navigation', 'social', 'homepage'].map((id) => ({
    id,
    controls: inventory.controls.filter((control) => control.category === id).map(publicControl),
  }))
  return {
    revision: inventory.revision,
    theme: inventory.theme,
    categories,
    navigation: { ...inventory.navigation, path: inventory.navigation.path.join('.'), items: inventory.navigation.items.map(publicMenuItem) },
    social: { ...inventory.social, path: inventory.social.path.join('.'), items: inventory.social.items.map(publicSocialItem) },
    unsupported: inventory.unsupported,
    configFiles: inventory.configFiles,
    warnings: inventory.warnings,
    presets,
    summary: {
      controls: inventory.controls.length,
      categories: categories.filter((category) => category.controls.length || (category.id === 'navigation' && inventory.navigation.support !== 'unsupported') || (category.id === 'social' && inventory.social.support !== 'unsupported')).length,
      unsupported: inventory.unsupported.length,
      presets: presets.length,
    },
  }
}

module.exports = {
  discoverThemeConfiguration,
  normalizeMenuItems,
  normalizeSocialItems,
  publicThemeConfiguration,
  safeThemeFolder,
  socialShape,
}
