const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')
const TOML = require('@iarna/toml')
const YAML = require('yaml')
const { CONFIG_FILES } = require('../languages.cjs')

const CONFIG_EXTENSION = /\.(?:toml|ya?ml|json)$/i
const MAX_CONFIG_FILES = 80
const MAX_CONFIG_BYTES = 512 * 1024

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)
}

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue)
  if (value instanceof Date) return new Date(value)
  if (!isPlainObject(value)) return value
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneValue(child)]))
}

function deepMerge(left, right) {
  if (!isPlainObject(left) || !isPlainObject(right)) return cloneValue(right)
  const output = cloneValue(left)
  for (const [key, value] of Object.entries(right)) {
    const existingKey = Object.keys(output).find((candidate) => candidate.toLowerCase() === key.toLowerCase()) || key
    output[existingKey] = isPlainObject(output[existingKey]) && isPlainObject(value)
      ? deepMerge(output[existingKey], value)
      : cloneValue(value)
  }
  return output
}

function parseConfigSource(source, file) {
  if (file.endsWith('.json')) return JSON.parse(source)
  if (file.endsWith('.yaml') || file.endsWith('.yml')) return YAML.parse(source) || {}
  if (file.endsWith('.toml')) return TOML.parse(source)
  throw new Error(`Unsupported Hugo configuration format: ${file}`)
}

function serializeConfigSource(data, file) {
  if (file.endsWith('.json')) return `${JSON.stringify(data, null, 2)}\n`
  if (file.endsWith('.yaml') || file.endsWith('.yml')) return YAML.stringify(data, { lineWidth: 0 })
  if (file.endsWith('.toml')) return TOML.stringify(data)
  throw new Error(`Unsupported Hugo configuration format: ${file}`)
}

function componentLocation(relative) {
  const normalized = String(relative || '').replaceAll('\\', '/')
  if (!/(^|\/)config\/_default\//i.test(normalized)) return null
  const segments = path.posix.basename(normalized).split('.')
  const base = segments[0].toLowerCase()
  const rootKey = base === 'menu' || base === 'menus'
    ? 'menus'
    : ['params', 'languages'].includes(base) ? base : ''
  if (!rootKey) return null
  const language = ['params', 'menus'].includes(rootKey) && segments.length > 2
    ? String(segments[1] || '').trim()
    : ''
  if (language && !/^[a-z0-9][a-z0-9_-]{0,30}$/i.test(language)) return null
  return {
    rootKey,
    language,
    rootPath: language ? ['languages', language, rootKey] : [rootKey],
  }
}

function configRecord(relative, source) {
  const parsed = parseConfigSource(source, relative)
  if (!isPlainObject(parsed)) throw new Error('The Hugo configuration file must contain an object.')
  const component = componentLocation(relative)
  const matchingKey = component && Object.keys(parsed).find((key) => key.toLowerCase() === component.rootKey)
  const wrapped = Boolean(component && matchingKey && Object.keys(parsed).length === 1)
  const payload = wrapped ? parsed[matchingKey] : parsed
  const globalData = component
    ? setIn({}, component.rootPath, payload)
    : cloneValue(parsed)
  return {
    relative: String(relative).replaceAll('\\', '/'),
    source,
    data: parsed,
    globalData,
    rootKey: component?.rootKey || '',
    rootPath: component?.rootPath || [],
    localPrefix: wrapped ? [matchingKey] : [],
    language: component?.language || '',
    unwrapped: Boolean(component && !wrapped),
  }
}

async function walkConfigDirectory(root, relative, output) {
  if (output.length >= MAX_CONFIG_FILES) return
  const absolute = path.join(root, ...relative.split('/'))
  const entries = await fs.readdir(absolute, { withFileTypes: true }).catch(() => [])
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (output.length >= MAX_CONFIG_FILES || entry.isSymbolicLink()) continue
    const child = `${relative}/${entry.name}`
    if (entry.isDirectory()) await walkConfigDirectory(root, child, output)
    else if (entry.isFile() && CONFIG_EXTENSION.test(entry.name)) output.push(child)
  }
}

async function discoverProjectConfig(root) {
  const entries = await fs.readdir(root)
  const rootConfig = CONFIG_FILES.find((candidate) => entries.includes(candidate)) || ''
  const relatives = rootConfig ? [rootConfig] : []
  await walkConfigDirectory(root, 'config/_default', relatives)
  const config = rootConfig || relatives.find((relative) => CONFIG_FILES.includes(path.posix.basename(relative))) || ''
  if (!config) throw new Error('No Hugo configuration file was found.')
  const sources = []
  const errors = []
  for (const relative of [...new Set(relatives)]) {
    try {
      const absolute = path.resolve(root, ...relative.split('/'))
      const stat = await fs.lstat(absolute)
      if (!stat.isFile() || stat.size > MAX_CONFIG_BYTES) throw new Error('The file is too large to configure safely.')
      const source = await fs.readFile(absolute, 'utf8')
      sources.push({ ...configRecord(relative, source), absolute })
    } catch (error) {
      errors.push({ file: relative, message: error.message })
    }
  }
  if (!sources.some((source) => source.relative === config)) throw new Error(`The Hugo configuration file ${config} could not be read.`)
  const merged = sources.reduce((current, source) => deepMerge(current, source.globalData), {})
  return { config, sources, merged, errors, revision: revisionForSources(sources) }
}

function actualKey(object, key) {
  if (!isPlainObject(object)) return ''
  return Object.keys(object).find((candidate) => candidate.toLowerCase() === String(key).toLowerCase()) || ''
}

function resolvePath(object, requested) {
  const resolved = []
  let current = object
  for (const segment of requested) {
    const key = actualKey(current, segment)
    if (!key) return null
    resolved.push(key)
    current = current[key]
  }
  return resolved
}

function getIn(object, segments) {
  let current = object
  for (const segment of segments || []) {
    const key = actualKey(current, segment)
    if (!key) return undefined
    current = current[key]
  }
  return current
}

function setIn(object, segments, value) {
  if (!segments.length) throw new Error('A configuration path is required.')
  let current = object
  segments.slice(0, -1).forEach((segment) => {
    const key = actualKey(current, segment) || segment
    if (!isPlainObject(current[key])) current[key] = {}
    current = current[key]
  })
  const finalKey = actualKey(current, segments.at(-1)) || segments.at(-1)
  current[finalKey] = cloneValue(value)
  return object
}

function deleteIn(object, segments) {
  if (!segments.length) return object
  let current = object
  for (const segment of segments.slice(0, -1)) {
    const key = actualKey(current, segment)
    if (!key || !isPlainObject(current[key])) return object
    current = current[key]
  }
  const finalKey = actualKey(current, segments.at(-1))
  if (finalKey) delete current[finalKey]
  return object
}

function sourceForPath(sources, segments) {
  return [...sources].reverse().find((source) => resolvePath(source.globalData, segments)) || null
}

function localPathForSource(source, globalPath) {
  if (source.rootPath?.length) {
    const matches = source.rootPath.every((segment, index) => String(globalPath[index] || '').toLowerCase() === String(segment).toLowerCase())
    if (matches) return [...(source.localPrefix || []), ...globalPath.slice(source.rootPath.length)]
  }
  return globalPath
}

function mutateConfigRecord(source, operations) {
  const next = cloneValue(source.data)
  for (const operation of operations) {
    const localPath = localPathForSource(source, operation.path)
    if (operation.unset) deleteIn(next, localPath)
    else setIn(next, localPath, operation.value)
  }
  return serializeConfigSource(next, source.relative)
}

async function atomicWrite(file, source) {
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(temporary, source, 'utf8')
  await fs.rename(temporary, file)
}

function revisionForSources(sources) {
  const hash = crypto.createHash('sha256')
  for (const source of [...sources].sort((left, right) => left.relative.localeCompare(right.relative))) {
    hash.update(source.relative)
    hash.update('\0')
    hash.update(source.source)
    hash.update('\0')
  }
  return hash.digest('hex')
}

module.exports = {
  CONFIG_EXTENSION,
  MAX_CONFIG_BYTES,
  atomicWrite,
  cloneValue,
  componentLocation,
  configRecord,
  deepMerge,
  deleteIn,
  discoverProjectConfig,
  getIn,
  isPlainObject,
  localPathForSource,
  mutateConfigRecord,
  parseConfigSource,
  resolvePath,
  revisionForSources,
  serializeConfigSource,
  setIn,
  sourceForPath,
}
