const fs = require('node:fs/promises')
const path = require('node:path')
const YAML = require('yaml')
const { run, runtimeFor } = require('../core/runtime.cjs')
const { slugify } = require('./content.cjs')
const { ensureGitRepository, gitVersion } = require('./git.cjs')
const { compatibilityMessage, inspectThemeCompatibility } = require('./theme-compatibility.cjs')
const { resolveTheme } = require('./themes.cjs')

const CONFIG_FILES = ['hugo.toml', 'hugo.yaml', 'hugo.yml', 'hugo.json', 'config.toml', 'config.yaml', 'config.yml']

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

function readConfigValue(raw, config, key) {
  try {
    if (config.endsWith('.json')) return JSON.parse(raw)?.[key]
    if (config.endsWith('.yaml') || config.endsWith('.yml')) return YAML.parse(raw)?.[key]
  } catch {
    return undefined
  }
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = raw.match(new RegExp(`^\\s*${escapedKey}\\s*=\\s*["']([^"']*)["']`, 'm'))
  return match?.[1]
}

async function siteMetadata(root) {
  const entries = await fs.readdir(root)
  const config = CONFIG_FILES.find((candidate) => entries.includes(candidate))
  if (!config) return { title: '', baseURL: '' }
  const raw = await fs.readFile(path.join(root, config), 'utf8').catch(() => '')
  return {
    title: String(readConfigValue(raw, config, 'title') || ''),
    baseURL: String(readConfigValue(raw, config, 'baseURL') || ''),
    languageCode: String(readConfigValue(raw, config, 'languageCode') || ''),
    copyright: String(readConfigValue(raw, config, 'copyright') || ''),
  }
}

async function siteSettings(root) {
  const context = await validateBlog(root)
  return { ...(await siteMetadata(root)), theme: context.theme, config: context.config }
}

async function saveSiteSettings(root, input) {
  const title = String(input?.title || '').trim()
  let baseURL = String(input?.baseURL || '').trim()
  const languageCode = String(input?.languageCode || '').trim()
  const copyright = String(input?.copyright || '').trim()
  if (!title) throw new Error('Give your blog a title.')
  if (baseURL) {
    let parsed
    try { parsed = new URL(baseURL) } catch { throw new Error('Enter a valid website address.') }
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('The website address must use HTTP or HTTPS.')
    if (!parsed.pathname.endsWith('/')) parsed.pathname += '/'
    baseURL = parsed.href
  }
  await updateSiteConfig(root, { title, baseURL, languageCode, copyright })
  return siteSettings(root)
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

async function validateBlog(root) {
  const entries = await fs.readdir(root)
  const config = CONFIG_FILES.find((candidate) => entries.includes(candidate))
  if (!config) throw new Error('Esta pasta não parece ser um site Hugo: nenhum arquivo de configuração foi encontrado.')
  const stat = await fs.stat(path.join(root, 'content')).catch(() => null)
  if (!stat?.isDirectory()) throw new Error('A pasta content não foi encontrada neste site Hugo.')

  const runtime = runtimeFor(root)
  const [hugo, git] = await Promise.all([
    run(root, 'hugo', ['version']).then((value) => value.stdout).catch(() => null),
    gitVersion(root).then((value) => value.status === 'ready' ? value.version : null),
  ])
  const rawConfig = await fs.readFile(path.join(root, config), 'utf8').catch(() => '')
  const configuredTheme = readThemeValue(rawConfig, config)
  const theme = Array.isArray(configuredTheme) ? configuredTheme[0] || '' : configuredTheme
  return { root, config, runtime, hugo, git, theme }
}

async function installTheme(root, slug) {
  return installResolvedTheme(root, await resolveTheme(slug))
}

async function deactivateTheme(root) {
  await validateBlog(root)
  await updateSiteConfig(root, { theme: '' })
  return validateBlog(root)
}

async function installResolvedTheme(root, theme) {
  const originalContext = await validateBlog(root)
  await ensureGitRepository(root)
  const themeRoot = themeDirectoryPath(root, theme.folder)
  const existing = await fs.stat(themeRoot).catch(() => null)
  const configPath = path.join(root, originalContext.config)
  const originalConfig = await fs.readFile(configPath, 'utf8')
  let added = false
  if (!existing) {
    await fs.mkdir(path.dirname(themeRoot), { recursive: true })
    try {
      await run(root, 'git', ['submodule', 'add', '--depth', '1', theme.repository, `themes/${theme.folder}`])
      added = true
    } catch (error) {
      await rollbackAddedTheme(root, theme.folder)
      throw error
    }
  } else if (!existing.isDirectory()) {
    throw new Error(`Já existe um arquivo chamado themes/${theme.folder}.`)
  }

  const compatibility = await inspectThemeCompatibility(themeRoot, originalContext.hugo)
  if (!compatibility.compatible) {
    if (added) await rollbackAddedTheme(root, theme.folder)
    const deactivated = originalContext.theme === theme.folder
    if (deactivated) await updateSiteConfig(root, { theme: '' })
    return {
      ok: false,
      stage: 'compatibility',
      ...theme,
      compatibility,
      deactivated,
      message: compatibilityMessage(compatibility),
      context: deactivated ? await validateBlog(root) : originalContext,
    }
  }

  await updateSiteConfig(root, { theme: theme.folder })
  try {
    await run(root, 'hugo', ['--renderToMemory', '--minify'])
  } catch (error) {
    await fs.writeFile(configPath, originalConfig, 'utf8')
    if (added) await rollbackAddedTheme(root, theme.folder)
    return {
      ok: false,
      stage: 'build',
      ...theme,
      compatibility,
      message: 'The theme was not activated because the Hugo validation build failed.',
      details: error.message,
      context: await validateBlog(root),
    }
  }
  return { ok: true, ...theme, compatibility, context: await validateBlog(root) }
}

function themeDirectoryPath(root, folder) {
  if (!/^[a-z0-9][a-z0-9._-]{0,100}$/i.test(folder)) throw new Error('The theme repository has an invalid folder name.')
  const themesRoot = path.resolve(root, 'themes')
  const target = path.resolve(themesRoot, folder)
  if (!target.startsWith(`${themesRoot}${path.sep}`)) throw new Error('The theme path is outside the blog.')
  return target
}

async function rollbackAddedTheme(root, folder) {
  const relative = `themes/${folder}`
  const themeRoot = themeDirectoryPath(root, folder)
  const modulesRoot = path.resolve(root, '.git', 'modules', 'themes')
  const moduleRoot = path.resolve(modulesRoot, folder)
  if (!moduleRoot.startsWith(`${modulesRoot}${path.sep}`)) throw new Error('The Git submodule path is outside the blog repository.')
  await run(root, 'git', ['submodule', 'deinit', '-f', '--', relative]).catch(() => {})
  await run(root, 'git', ['rm', '-f', '--', relative]).catch(() => {})
  await fs.rm(themeRoot, { recursive: true, force: true })
  await fs.rm(moduleRoot, { recursive: true, force: true })
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
      const installed = await installTheme(target, input.theme)
      if (!installed.ok) themeWarning = installed.message
    } catch (error) {
      themeWarning = error.message
    }
  }
  return { ...(await validateBlog(target)), themeWarning }
}

module.exports = {
  createSite,
  deactivateTheme,
  installResolvedTheme,
  installTheme,
  saveSiteSettings,
  siteMetadata,
  siteSettings,
  updateSiteConfig,
  validateBlog,
}
