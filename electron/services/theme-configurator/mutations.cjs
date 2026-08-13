const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')
const { runHugo } = require('../hugo.cjs')
const { createRecoveryPoint, restoreRecoveryPoint } = require('../history.cjs')
const {
  atomicWrite,
  cloneValue,
  mutateConfigRecord,
  serializeConfigSource,
  setIn,
} = require('./config-files.cjs')
const { discoverThemeConfiguration } = require('./discovery.cjs')

const STATE_DIRECTORY = '.plumbago/theme-configurator'
const PRESET_DIRECTORY = `${STATE_DIRECTORY}/presets`
const PREVIEW_MANIFEST = `${STATE_DIRECTORY}/preview.json`
const MAX_PRESETS = 30
const MAX_PRESET_BYTES = 256 * 1024

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function safeIdentifier(value, label) {
  const id = String(value || '')
  if (!/^[a-f0-9]{16}$/.test(id)) throw new Error(`Choose a valid ${label}.`)
  return id
}

async function ensureState(root) {
  const plumbago = path.resolve(root, '.plumbago')
  const state = path.resolve(root, ...STATE_DIRECTORY.split('/'))
  if (!state.startsWith(`${plumbago}${path.sep}`)) throw new Error('Theme configuration state is outside this blog.')
  await fs.mkdir(state, { recursive: true })
  await fs.writeFile(path.join(plumbago, '.gitignore'), '*\n!.gitignore\n', { encoding: 'utf8', flag: 'wx' }).catch((error) => {
    if (error.code !== 'EEXIST') throw error
  })
  return state
}

function cleanString(value, max = 500) {
  const output = String(value ?? '').trim()
  const hasControlCharacter = [...output].some((character) => {
    const code = character.codePointAt(0)
    return code < 32 && ![9, 10, 13].includes(code)
  })
  if (output.length > max || hasControlCharacter) throw new Error('A theme value is too long or contains unsupported characters.')
  return output
}

function safeWebReference(value, { allowEmpty = true, social = false } = {}) {
  const output = cleanString(value, 800)
  if (!output && allowEmpty) return ''
  if (/^(?:\/|#|\.\.?\/)/.test(output) || (!output.includes(':') && !output.startsWith('\\'))) return output
  let parsed
  try { parsed = new URL(output) } catch { throw new Error('Enter a safe web address or a relative Hugo path.') }
  const protocols = social ? ['https:', 'http:', 'mailto:'] : ['https:', 'http:']
  if (!protocols.includes(parsed.protocol)) throw new Error('Theme links must use HTTP, HTTPS, mailto, or a relative Hugo path.')
  return output
}

function normalizeControlValue(control, value) {
  if (control.type === 'boolean') {
    if (typeof value !== 'boolean') throw new Error(`${control.label} must be on or off.`)
    return value
  }
  if (control.type === 'number') {
    const number = Number(value)
    if (!Number.isFinite(number) || Math.abs(number) > 1_000_000) throw new Error(`${control.label} must be a reasonable number.`)
    return number
  }
  if (control.type === 'color') {
    const color = cleanString(value, 20)
    if (!/^#[0-9a-f]{3,8}$/i.test(color)) throw new Error(`${control.label} must be a hexadecimal color.`)
    return color
  }
  if (control.type === 'url') return safeWebReference(value)
  const output = cleanString(value)
  if (control.type === 'select' && control.options.length && !control.options.includes(output)) throw new Error(`Choose a supported value for ${control.label}.`)
  return output
}

function normalizeMenu(items) {
  if (!Array.isArray(items) || items.length > 30) throw new Error('A navigation menu can contain up to 30 items.')
  return items.map((item, index) => {
    const name = cleanString(item?.name, 100)
    const pageRef = safeWebReference(item?.pageRef)
    const url = safeWebReference(item?.url)
    const identifier = cleanString(item?.identifier, 100)
    if (!name) throw new Error('Give every navigation item a label.')
    if (!pageRef && !url && !identifier) throw new Error(`Choose a page, URL, or group identifier for ${name}.`)
    const weight = Number(item?.weight)
    return {
      _id: /^[a-f0-9]{12}$/.test(String(item?._id || '')) ? item._id : '',
      name,
      pageRef,
      url,
      weight: Number.isFinite(weight) && Math.abs(weight) <= 1_000_000 ? weight : (index + 1) * 10,
      identifier,
      parent: cleanString(item?.parent, 100),
    }
  })
}

function normalizeSocial(items) {
  if (!Array.isArray(items) || items.length > 20) throw new Error('A social link list can contain up to 20 items.')
  return items.map((item) => {
    const network = cleanString(item?.network, 60).toLowerCase()
    if (!/^[a-z0-9][a-z0-9._-]{0,59}$/.test(network)) throw new Error('Choose a short social network name using letters, numbers, dots, dashes, or underscores.')
    return {
      _id: /^[a-f0-9]{12}$/.test(String(item?._id || '')) ? item._id : '',
      network,
      url: safeWebReference(item?.url, { allowEmpty: false, social: true }),
    }
  })
}

function publicMenuItem(item) {
  return { _id: item._id, name: item.name, pageRef: item.pageRef, url: item.url, weight: item.weight, identifier: item.identifier, parent: item.parent }
}

function publicSocialItem(item) {
  return { _id: item._id, network: item.network, url: item.url }
}

function normalizePayload(inventory, input) {
  if (String(input?.expectedRevision || '') !== inventory.revision) {
    const error = new Error('The Hugo configuration changed outside Plumbago. Refresh the theme configurator before continuing.')
    error.code = 'THEME_CONFIGURATION_STALE'
    throw error
  }
  const controls = new Map(inventory.controls.map((control) => [control.id, control]))
  const rawValues = input?.values && typeof input.values === 'object' && !Array.isArray(input.values) ? input.values : {}
  if (Object.keys(rawValues).length > 80) throw new Error('Too many theme options were submitted at once.')
  const values = {}
  for (const [id, value] of Object.entries(rawValues)) {
    const control = controls.get(id)
    if (!control) throw new Error('A submitted theme option is no longer supported by this theme.')
    const normalized = normalizeControlValue(control, value)
    if (!sameValue(normalized, control.value)) values[id] = normalized
  }
  let navigation
  if (Object.hasOwn(input || {}, 'navigation')) {
    if (inventory.navigation.support === 'unsupported') throw new Error('This theme does not expose a supported navigation structure.')
    const current = inventory.navigation.items.map(publicMenuItem)
    if (!sameValue(input.navigation, current)) navigation = normalizeMenu(input.navigation)
  }
  let social
  if (Object.hasOwn(input || {}, 'social')) {
    if (inventory.social.support === 'unsupported') throw new Error('This theme does not expose a supported social-link structure.')
    const current = inventory.social.items.map(publicSocialItem)
    if (!sameValue(input.social, current)) social = normalizeSocial(input.social)
  }
  if (!Object.keys(values).length && navigation === undefined && social === undefined) throw new Error('Change at least one supported theme option before creating a preview.')
  return { expectedRevision: inventory.revision, values, ...(navigation !== undefined ? { navigation } : {}), ...(social !== undefined ? { social } : {}) }
}

function normalizePresetPayload(inventory, input) {
  if (String(input?.expectedRevision || '') !== inventory.revision) {
    const error = new Error('The Hugo configuration changed outside Plumbago. Refresh the theme configurator before continuing.')
    error.code = 'THEME_CONFIGURATION_STALE'
    throw error
  }
  const controls = new Map(inventory.controls.map((control) => [control.id, control]))
  const rawValues = input?.values && typeof input.values === 'object' && !Array.isArray(input.values) ? input.values : {}
  if (Object.keys(rawValues).length > 80) throw new Error('Too many theme options were submitted at once.')
  const values = {}
  for (const [id, value] of Object.entries(rawValues)) {
    const control = controls.get(id)
    if (!control) throw new Error('A submitted theme option is no longer supported by this theme.')
    values[id] = normalizeControlValue(control, value)
  }
  if (Object.hasOwn(input || {}, 'navigation') && inventory.navigation.support === 'unsupported') throw new Error('This theme does not expose a supported navigation structure.')
  if (Object.hasOwn(input || {}, 'social') && inventory.social.support === 'unsupported') throw new Error('This theme does not expose a supported social-link structure.')
  const navigation = Object.hasOwn(input || {}, 'navigation')
    ? sameValue(input.navigation, inventory.navigation.items.map(publicMenuItem)) ? cloneValue(input.navigation) : normalizeMenu(input.navigation)
    : undefined
  const social = Object.hasOwn(input || {}, 'social')
    ? sameValue(input.social, inventory.social.items.map(publicSocialItem)) ? cloneValue(input.social) : normalizeSocial(input.social)
    : undefined
  if (!Object.keys(values).length && navigation === undefined && social === undefined) throw new Error('Choose at least one supported theme option for this preset.')
  return { expectedRevision: inventory.revision, values, ...(navigation !== undefined ? { navigation } : {}), ...(social !== undefined ? { social } : {}) }
}

function setCaseInsensitive(object, name, value) {
  const key = Object.keys(object).find((candidate) => candidate.toLowerCase() === name.toLowerCase()) || name
  if (value === '') delete object[key]
  else object[key] = value
}

function menuValue(inventory, items) {
  const originals = new Map(inventory.navigation.items.map((item) => [item._id, item._original]))
  return items.map((item) => {
    const output = cloneValue(originals.get(item._id) || {})
    setCaseInsensitive(output, 'name', item.name)
    setCaseInsensitive(output, 'pageRef', item.pageRef)
    setCaseInsensitive(output, 'url', item.url)
    setCaseInsensitive(output, 'weight', item.weight)
    setCaseInsensitive(output, 'identifier', item.identifier)
    setCaseInsensitive(output, 'parent', item.parent)
    return output
  })
}

function socialValue(inventory, items) {
  const originals = new Map(inventory.social.items.map((item) => [item._id, item._original]))
  if (inventory.social.shape === 'map') return Object.fromEntries(items.map((item) => [item.network, item.url]))
  if (inventory.social.shape === 'array-maps') return items.map((item) => ({ [item.network]: item.url }))
  return items.map((item) => {
    const output = cloneValue(originals.get(item._id) || {})
    setCaseInsensitive(output, 'name', item.network)
    setCaseInsensitive(output, 'url', item.url)
    return output
  })
}

function operationsForPayload(inventory, payload) {
  const controls = new Map(inventory.controls.map((control) => [control.id, control]))
  const operations = []
  const changes = []
  for (const [id, value] of Object.entries(payload.values)) {
    const control = controls.get(id)
    operations.push({ id, category: control.category, path: control.path, value, sourceRelative: control.sourceRelative })
    changes.push({ id, category: control.category, path: control.path.join('.'), before: control.value, after: value })
  }
  if (payload.navigation !== undefined) {
    const value = menuValue(inventory, payload.navigation)
    operations.push({ id: inventory.navigation.id, category: 'navigation', path: inventory.navigation.path, value, sourceRelative: inventory.navigation.sourceRelative })
    changes.push({ id: inventory.navigation.id, category: 'navigation', path: inventory.navigation.path.join('.'), before: `${inventory.navigation.items.length} items`, after: `${payload.navigation.length} items` })
  }
  if (payload.social !== undefined) {
    const value = socialValue(inventory, payload.social)
    operations.push({ id: inventory.social.id, category: 'social', path: inventory.social.path, value, sourceRelative: inventory.social.sourceRelative })
    changes.push({ id: inventory.social.id, category: 'social', path: inventory.social.path.join('.'), before: `${inventory.social.items.length} links`, after: `${payload.social.length} links` })
  }
  return { operations, changes }
}

function rootSource(inventory) {
  return inventory._project.sources.find((source) => source.relative === inventory._project.config)
}

function targetSource(inventory, relative) {
  return inventory._project.sources.find((source) => source.relative === relative) || rootSource(inventory)
}

function groupedOperations(inventory, operations) {
  const groups = new Map()
  for (const operation of operations) {
    const source = targetSource(inventory, operation.sourceRelative)
    if (!source) throw new Error('The Hugo configuration target could not be found.')
    groups.set(source.relative, { source, operations: [...(groups.get(source.relative)?.operations || []), operation] })
  }
  return [...groups.values()]
}

function previewExtension(config) {
  if (config.endsWith('.json')) return 'json'
  if (config.endsWith('.yaml')) return 'yaml'
  if (config.endsWith('.yml')) return 'yml'
  return 'toml'
}

function overlayForOperations(operations) {
  const overlay = {}
  for (const operation of operations) setIn(overlay, operation.path, operation.value)
  return overlay
}

async function cleanupPreview(root) {
  const state = await ensureState(root)
  const entries = await fs.readdir(state).catch(() => [])
  await Promise.all(entries.filter((entry) => entry === 'preview.json' || /^preview\.(?:toml|ya?ml|json)$/i.test(entry)).map((entry) => fs.rm(path.join(state, entry), { force: true })))
}

async function previewThemeConfiguration(root, input) {
  const inventory = await discoverThemeConfiguration(root)
  if (!inventory.theme.id) throw new Error('Install or activate a Hugo theme before customizing it.')
  const payload = normalizePayload(inventory, input)
  const { operations, changes } = operationsForPayload(inventory, payload)
  const extension = previewExtension(inventory._project.config)
  const overlayRelative = `${STATE_DIRECTORY}/preview.${extension}`
  const overlayAbsolute = path.resolve(root, ...overlayRelative.split('/'))
  const previewId = crypto.randomBytes(8).toString('hex')
  const configArgument = `${inventory._project.config},${overlayRelative}`
  const groups = groupedOperations(inventory, operations)
  const manifest = {
    id: previewId,
    theme: inventory.theme.id,
    revision: inventory.revision,
    createdAt: new Date().toISOString(),
    overlayRelative,
    configArgument,
    payload,
    changes,
    targets: groups.map((group) => group.source.relative),
  }
  await ensureState(root)
  await cleanupPreview(root)
  await atomicWrite(overlayAbsolute, serializeConfigSource(overlayForOperations(operations), overlayRelative))
  await atomicWrite(path.resolve(root, ...PREVIEW_MANIFEST.split('/')), `${JSON.stringify(manifest, null, 2)}\n`)
  try {
    await runHugo(root, ['--config', configArgument, '--renderToMemory', '--buildDrafts', '--minify'])
  } catch (error) {
    await cleanupPreview(root)
    const failure = new Error('Hugo could not build the theme preview. No blog configuration was changed.')
    failure.code = 'THEME_PREVIEW_BUILD_FAILED'
    failure.details = error.message
    throw failure
  }
  return {
    previewId,
    revision: inventory.revision,
    theme: inventory.theme,
    changes,
    impact: {
      settings: changes.length,
      files: groups.length,
      categories: [...new Set(changes.map((change) => change.category))],
      targets: groups.map((group) => group.source.relative),
      recoveryPoint: true,
    },
    build: { ok: true },
    launchAvailable: true,
  }
}

async function readPreviewManifest(root, previewId) {
  const id = safeIdentifier(previewId, 'theme preview')
  const manifest = JSON.parse(await fs.readFile(path.resolve(root, ...PREVIEW_MANIFEST.split('/')), 'utf8'))
  if (manifest.id !== id || !manifest.payload || !manifest.overlayRelative) throw new Error('This theme preview is no longer available. Build it again.')
  return manifest
}

async function themePreviewLaunch(root, previewId) {
  const manifest = await readPreviewManifest(root, previewId)
  const inventory = await discoverThemeConfiguration(root)
  if (manifest.revision !== inventory.revision || manifest.theme !== inventory.theme.id) throw new Error('The blog or active theme changed after this preview. Build it again.')
  const overlay = path.resolve(root, ...String(manifest.overlayRelative).split('/'))
  if (!await fs.lstat(overlay).then((stat) => stat.isFile()).catch(() => false)) throw new Error('This theme preview is no longer available. Build it again.')
  return {
    args: ['server', '--config', manifest.configArgument, '--buildDrafts', '--disableFastRender', '--port', '1313'],
    url: 'http://localhost:1313',
  }
}

async function applyThemeConfiguration(root, input) {
  const manifest = await readPreviewManifest(root, input?.previewId)
  const inventory = await discoverThemeConfiguration(root)
  if (String(input?.expectedRevision || '') !== manifest.revision || inventory.revision !== manifest.revision || inventory.theme.id !== manifest.theme) {
    const error = new Error('The Hugo configuration changed after this preview. Refresh and review the impact again.')
    error.code = 'THEME_CONFIGURATION_STALE'
    throw error
  }
  const payload = normalizePayload(inventory, manifest.payload)
  const { operations, changes } = operationsForPayload(inventory, payload)
  const groups = groupedOperations(inventory, operations)
  const recoveryPoint = await createRecoveryPoint(root, {
    reason: 'before-theme-configuration',
    label: `Before customizing ${inventory.theme.name}`,
    paths: groups.map((group) => group.source.relative),
  })
  try {
    for (const group of groups) {
      await atomicWrite(group.source.absolute, mutateConfigRecord(group.source, group.operations))
    }
    await runHugo(root, ['--renderToMemory', '--minify'])
  } catch (error) {
    await restoreRecoveryPoint(root, recoveryPoint.id, { createUndo: false }).catch(() => {})
    const failure = new Error('Hugo could not build the customized theme, so the previous configuration was restored.')
    failure.code = 'THEME_CONFIGURATION_BUILD_FAILED'
    failure.details = error.message
    failure.recoveryPoint = recoveryPoint
    throw failure
  } finally {
    await cleanupPreview(root)
  }
  return { inventory: await discoverThemeConfiguration(root), recoveryPoint, changes }
}

function publicPreset(preset) {
  return {
    id: preset.id,
    name: preset.name,
    theme: preset.theme,
    createdAt: preset.createdAt,
    updatedAt: preset.updatedAt,
    payload: preset.payload,
    summary: preset.summary,
  }
}

async function readThemePresets(root) {
  const directory = path.resolve(root, ...PRESET_DIRECTORY.split('/'))
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => [])
  const presets = await Promise.all(entries.filter((entry) => entry.isFile() && /^[a-f0-9]{16}\.json$/.test(entry.name)).map(async (entry) => {
    try {
      const file = path.join(directory, entry.name)
      const stat = await fs.stat(file)
      if (stat.size > MAX_PRESET_BYTES) return null
      const preset = JSON.parse(await fs.readFile(file, 'utf8'))
      return preset.id === entry.name.slice(0, -5) ? publicPreset(preset) : null
    } catch { return null }
  }))
  return presets.filter(Boolean).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

async function listThemePresets(root) {
  return (await readThemePresets(root)).slice(0, MAX_PRESETS)
}

async function saveThemePreset(root, input) {
  const inventory = await discoverThemeConfiguration(root)
  if (!inventory.theme.id) throw new Error('Install or activate a Hugo theme before saving a preset.')
  const name = cleanString(input?.name, 80)
  if (!name) throw new Error('Give this theme preset a name.')
  const payload = normalizePresetPayload(inventory, input)
  const existingId = input?.id ? safeIdentifier(input.id, 'theme preset') : ''
  const id = existingId || crypto.randomBytes(8).toString('hex')
  const directory = path.resolve(root, ...PRESET_DIRECTORY.split('/'))
  await ensureState(root)
  await fs.mkdir(directory, { recursive: true })
  const existing = existingId ? JSON.parse(await fs.readFile(path.join(directory, `${id}.json`), 'utf8')).catch(() => null) : null
  if (existing && existing.theme !== inventory.theme.id) throw new Error('A preset can only be updated while its original theme is active.')
  const now = new Date().toISOString()
  const preset = {
    id,
    name,
    theme: inventory.theme.id,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    payload,
    summary: {
      settings: Object.keys(payload.values).length,
      navigation: payload.navigation?.length || 0,
      social: payload.social?.length || 0,
    },
  }
  const source = `${JSON.stringify(preset, null, 2)}\n`
  if (Buffer.byteLength(source) > MAX_PRESET_BYTES) throw new Error('This preset contains too many theme values.')
  await atomicWrite(path.join(directory, `${id}.json`), source)
  const presets = await readThemePresets(root)
  for (const extra of presets.slice(MAX_PRESETS)) await fs.rm(path.join(directory, `${extra.id}.json`), { force: true })
  return publicPreset(preset)
}

async function deleteThemePreset(root, presetId) {
  const id = safeIdentifier(presetId, 'theme preset')
  const target = path.resolve(root, ...PRESET_DIRECTORY.split('/'), `${id}.json`)
  await fs.rm(target, { force: true })
  return { id }
}

module.exports = {
  applyThemeConfiguration,
  deleteThemePreset,
  listThemePresets,
  normalizePayload,
  previewThemeConfiguration,
  saveThemePreset,
  themePreviewLaunch,
}
