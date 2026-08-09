const fs = require('node:fs/promises')
const path = require('node:path')

const COMPATIBILITY_FILES = [
  'theme.toml',
  'hugo.toml',
  'config.toml',
  path.join('config', '_default', 'hugo.toml'),
  path.join('config', '_default', 'module.toml'),
]

function normalizeVersion(value) {
  const match = String(value || '').match(/(?:^|[^\d])(\d+)\.(\d+)(?:\.(\d+))?/)
  if (!match) return ''
  return `${Number(match[1])}.${Number(match[2])}.${Number(match[3] || 0)}`
}

function compareVersions(left, right) {
  const leftParts = normalizeVersion(left).split('.').map(Number)
  const rightParts = normalizeVersion(right).split('.').map(Number)
  if (leftParts.length !== 3 || rightParts.length !== 3) return 0
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] < rightParts[index] ? -1 : 1
  }
  return 0
}

function parseHugoVersion(output) {
  const raw = String(output || '').trim()
  const version = normalizeVersion(raw)
  if (!version) return null
  return {
    version,
    extended: /\+extended(?:\+|\s|$)/i.test(raw),
    raw,
  }
}

function stringValue(source, key) {
  const match = source.match(new RegExp(`^\\s*${key}\\s*=\\s*["']([^"']+)["']`, 'mi'))
  return normalizeVersion(match?.[1])
}

function booleanValue(source, key) {
  const match = source.match(new RegExp(`^\\s*${key}\\s*=\\s*(true|false)`, 'mi'))
  return match ? match[1].toLowerCase() === 'true' : false
}

function moduleVersionSection(source) {
  return source.match(/(?:^|\n)\s*\[module\.hugoVersion\]\s*\n([\s\S]*?)(?=\n\s*\[[^\]]+\]|$)/i)?.[1] || ''
}

function highestVersion(values) {
  return values.filter(Boolean).sort(compareVersions).at(-1) || ''
}

function lowestVersion(values) {
  return values.filter(Boolean).sort(compareVersions).at(0) || ''
}

async function readThemeRequirements(themeRoot) {
  const minimums = []
  const maximums = []
  let extended = false
  const sources = []

  for (const relative of COMPATIBILITY_FILES) {
    const absolute = path.join(themeRoot, relative)
    const raw = await fs.readFile(absolute, 'utf8').catch(() => '')
    if (!raw) continue
    let found = false
    if (relative === 'theme.toml') {
      const minimum = stringValue(raw, 'min_version')
      if (minimum) { minimums.push(minimum); found = true }
    }
    const section = moduleVersionSection(raw)
    if (section) {
      const minimum = stringValue(section, 'min')
      const maximum = stringValue(section, 'max')
      if (minimum) minimums.push(minimum)
      if (maximum) maximums.push(maximum)
      extended = extended || booleanValue(section, 'extended')
      found = true
    }
    if (found) sources.push(relative.replaceAll(path.sep, '/'))
  }

  return {
    min: highestVersion(minimums),
    max: lowestVersion(maximums),
    extended,
    sources,
  }
}

function evaluateThemeCompatibility(current, requirements) {
  const issues = []
  if (!current) issues.push({ code: 'unknown-version' })
  if (current && requirements.min && compareVersions(current.version, requirements.min) < 0) {
    issues.push({ code: 'minimum', required: requirements.min, current: current.version })
  }
  if (current && requirements.max && compareVersions(current.version, requirements.max) > 0) {
    issues.push({ code: 'maximum', required: requirements.max, current: current.version })
  }
  if (current && requirements.extended && !current.extended) {
    issues.push({ code: 'extended', current: current.version })
  }
  return { current, requirements, compatible: issues.length === 0, issues }
}

async function inspectThemeCompatibility(themeRoot, hugoOutput) {
  return evaluateThemeCompatibility(parseHugoVersion(hugoOutput), await readThemeRequirements(themeRoot))
}

function compatibilityMessage(report) {
  const issue = report.issues[0]
  if (!issue) return ''
  if (issue.code === 'minimum') return `This theme requires Hugo ${issue.required} or newer, but ${issue.current} is installed.`
  if (issue.code === 'maximum') return `This theme supports Hugo up to ${issue.required}, but ${issue.current} is installed.`
  if (issue.code === 'extended') return `This theme requires Hugo Extended, but the installed Hugo ${issue.current} is the standard edition.`
  return 'Plumbago could not determine the installed Hugo version.'
}

module.exports = {
  compareVersions,
  compatibilityMessage,
  evaluateThemeCompatibility,
  inspectThemeCompatibility,
  parseHugoVersion,
  readThemeRequirements,
}
