const fs = require('node:fs/promises')
const path = require('node:path')
const YAML = require('yaml')

const CONFIG_FILES = ['hugo.toml', 'hugo.yaml', 'hugo.yml', 'hugo.json', 'config.toml', 'config.yaml', 'config.yml']
const LANGUAGE_FILE_PATTERN = /^index\.([a-z]{2}(?:-[a-z0-9]{2,8})*)\.md$/i

function normalizeLanguage(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9-]/g, '')
}

function languageCodeFor(language) {
  const parts = normalizeLanguage(language).split('-').filter(Boolean)
  if (!parts.length) return 'en-US'
  return parts.map((part, index) => index === 0 ? part.toLowerCase() : part.toUpperCase()).join('-')
}

async function findConfig(root) {
  const entries = await fs.readdir(root)
  const config = CONFIG_FILES.find((candidate) => entries.includes(candidate))
  if (!config) throw new Error('No Hugo configuration file was found.')
  return config
}

function tomlHasLanguage(source, language) {
  const escaped = language.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^\\s*\\[languages\\.(?:"${escaped}"|'${escaped}'|${escaped})\\]\\s*$`, 'mi').test(source)
}

function updateTomlLanguages(source, languages) {
  let next = source
  const configured = languages.filter((language) => tomlHasLanguage(next, language))
  const missing = languages.filter((language) => !configured.includes(language))
  if (!missing.length) return next

  const hasLanguageTable = /^\s*\[languages(?:\.[^\]]+)?\]\s*$/mi.test(next)
  const defaultMatch = next.match(/^\s*defaultContentLanguage\s*=\s*["']([^"']+)["']/mi)
  if (!defaultMatch && !hasLanguageTable) {
    const firstTable = next.search(/^\s*\[/m)
    const line = `defaultContentLanguage = ${JSON.stringify(languages[0])}\n`
    next = firstTable < 0
      ? `${next.trimEnd()}\n${line}`
      : `${next.slice(0, firstTable).trimEnd()}\n${line}\n${next.slice(firstTable)}`
  }

  let weight = configured.length + 1
  for (const language of missing) {
    const code = languageCodeFor(language)
    next = `${next.trimEnd()}\n\n[languages.${language}]\nlanguageCode = ${JSON.stringify(code)}\nlanguageName = ${JSON.stringify(code)}\nweight = ${weight++}\n`
  }
  return next
}

function updateStructuredLanguages(source, config, languages) {
  const data = config.endsWith('.json') ? JSON.parse(source) : YAML.parse(source) || {}
  const existing = data.languages && typeof data.languages === 'object' ? data.languages : {}
  if (!data.defaultContentLanguage && !Object.keys(existing).length) data.defaultContentLanguage = languages[0]
  data.languages = existing
  let weight = Object.keys(existing).length + 1
  for (const language of languages) {
    if (existing[language]) continue
    const code = languageCodeFor(language)
    existing[language] = { languageCode: code, languageName: code, weight: weight++ }
  }
  return config.endsWith('.json')
    ? `${JSON.stringify(data, null, 2)}\n`
    : YAML.stringify(data, { lineWidth: 0 })
}

async function ensureContentLanguages(root, values) {
  const languages = [...new Set(values.map(normalizeLanguage).filter(Boolean))]
  if (!languages.length) return { changed: false, languages: [] }
  const config = await findConfig(root)
  const absolute = path.join(root, config)
  const source = await fs.readFile(absolute, 'utf8')
  const next = config.endsWith('.toml')
    ? updateTomlLanguages(source, languages)
    : updateStructuredLanguages(source, config, languages)
  if (next === source) return { changed: false, languages, config }
  await fs.writeFile(absolute, next, 'utf8')
  return { changed: true, languages, config }
}

async function findBundleLanguages(directory, output = new Set()) {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) await findBundleLanguages(absolute, output)
    else if (entry.isFile()) {
      const language = entry.name.match(LANGUAGE_FILE_PATTERN)?.[1]
      if (language) output.add(normalizeLanguage(language))
    }
  }
  return output
}

async function ensureBundleLanguages(root) {
  const languages = [...await findBundleLanguages(path.join(root, 'content'))]
  return ensureContentLanguages(root, languages)
}

module.exports = {
  CONFIG_FILES,
  ensureBundleLanguages,
  ensureContentLanguages,
  languageCodeFor,
  normalizeLanguage,
  updateTomlLanguages,
}
