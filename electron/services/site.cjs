const fs = require('node:fs/promises')
const path = require('node:path')
const YAML = require('yaml')
const { executablePath, run, runtimeFor } = require('../core/runtime.cjs')
const { slugify } = require('./content.cjs')
const { ensureGitRepository, gitVersion } = require('./git.cjs')
const { createRecoveryPoint, restoreRecoveryPoint, siteConfigurationPaths } = require('./history.cjs')
const { CONFIG_FILES } = require('./languages.cjs')
const { compatibilityMessage, inspectThemeCompatibility } = require('./theme-compatibility.cjs')
const { resolveTheme } = require('./themes.cjs')

const PLUMBAGO_SETTINGS_FILE = '.plumbago.json'
const PLUMBAGO_STATE_DIRECTORY = '.plumbago'
const PLUMBAGO_DEPLOYMENT_FILE = 'deployment.json'
const HOSTING_PROVIDERS = new Set(['none', 'github-pages', 'cloudflare-pages', 'other'])

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

function inferHostingProvider(baseURL) {
  try {
    const hostname = new URL(baseURL).hostname.toLowerCase()
    if (hostname.endsWith('.github.io')) return 'github-pages'
    if (hostname.endsWith('.pages.dev')) return 'cloudflare-pages'
  } catch {
    // An empty or invalid Hugo baseURL is handled by the site settings validator.
  }
  return 'none'
}

async function readPlumbagoSettings(root) {
  try {
    const parsed = JSON.parse(await fs.readFile(path.join(root, PLUMBAGO_SETTINGS_FILE), 'utf8'))
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

async function writePlumbagoSettings(root, settings) {
  const target = path.join(root, PLUMBAGO_SETTINGS_FILE)
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(temporary, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
  await fs.rename(temporary, target)
  return settings
}

function safeDeploymentState(input = {}) {
  const provider = ['github-pages', 'cloudflare-pages'].includes(input.provider) ? input.provider : ''
  const state = ['idle', 'preflight', 'provisioning', 'uploading', 'deploying', 'live', 'failed'].includes(input.state) ? input.state : 'idle'
  return {
    provider,
    state,
    step: String(input.step || ''),
    progress: Math.max(0, Math.min(100, Number(input.progress || 0))),
    log: Array.isArray(input.log) ? input.log.map((entry) => String(entry)).slice(-60) : [],
    error: String(input.error || ''),
    warning: String(input.warning || ''),
    liveUrl: String(input.liveUrl || ''),
    accountId: String(input.accountId || ''),
    projectName: String(input.projectName || ''),
    repository: String(input.repository || ''),
    deploymentId: String(input.deploymentId || ''),
    dashboardUrl: String(input.dashboardUrl || ''),
    customDomainUrl: String(input.customDomainUrl || ''),
    attempt: Math.max(0, Number(input.attempt || 0)),
    startedAt: String(input.startedAt || ''),
    updatedAt: String(input.updatedAt || ''),
  }
}

async function deploymentSettings(root) {
  try {
    const stored = JSON.parse(await fs.readFile(path.join(root, PLUMBAGO_STATE_DIRECTORY, PLUMBAGO_DEPLOYMENT_FILE), 'utf8'))
    return safeDeploymentState(stored)
  } catch {
    return safeDeploymentState()
  }
}

async function saveDeploymentSettings(root, patch) {
  const current = await deploymentSettings(root)
  const deployment = safeDeploymentState({ ...current, ...(patch || {}), updatedAt: new Date().toISOString() })
  const stateDirectory = path.join(root, PLUMBAGO_STATE_DIRECTORY)
  const target = path.join(stateDirectory, PLUMBAGO_DEPLOYMENT_FILE)
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`
  await fs.mkdir(stateDirectory, { recursive: true })
  await fs.writeFile(path.join(stateDirectory, '.gitignore'), '*\n!.gitignore\n', { encoding: 'utf8', flag: 'wx' }).catch((error) => {
    if (error.code !== 'EEXIST') throw error
  })
  await fs.writeFile(temporary, `${JSON.stringify(deployment, null, 2)}\n`, 'utf8')
  await fs.rename(temporary, target)
  return deployment
}

async function hostingSettings(root, baseURL = '') {
  const stored = await readPlumbagoSettings(root)
  const hasStoredProvider = HOSTING_PROVIDERS.has(stored.hostingProvider)
  const hostingProvider = hasStoredProvider ? stored.hostingProvider : inferHostingProvider(baseURL)
  const publicUrl = hostingProvider === 'none' ? '' : String(stored.publicUrl || baseURL || '')
  return { hostingProvider, publicUrl, hostingConfigured: Boolean(publicUrl) }
}

async function saveHostingSettings(root, input) {
  const current = await readPlumbagoSettings(root)
  const hostingProvider = String(input?.hostingProvider || 'none')
  if (!HOSTING_PROVIDERS.has(hostingProvider)) throw new Error('Choose a supported hosting provider.')
  let publicUrl = hostingProvider === 'none' ? '' : String(input?.publicUrl || '').trim()
  if (publicUrl) {
    let parsed
    try { parsed = new URL(publicUrl) } catch { throw new Error('Enter a valid public website address.') }
    if (parsed.protocol !== 'https:') throw new Error('The public website address must use HTTPS.')
    if (!parsed.pathname.endsWith('/')) parsed.pathname += '/'
    publicUrl = parsed.href
  }
  if (hostingProvider !== 'none' && !publicUrl) throw new Error('Enter the public address provided by your hosting service.')
  const next = { ...current, hostingProvider, publicUrl }
  await writePlumbagoSettings(root, next)
  return { hostingProvider, publicUrl, hostingConfigured: Boolean(publicUrl) }
}

async function siteSettings(root) {
  const context = await validateBlog(root)
  const metadata = await siteMetadata(root)
  return { ...metadata, ...(await hostingSettings(root, metadata.baseURL)), theme: context.theme, config: context.config }
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
  const recoveryPoint = await createRecoveryPoint(root, { reason: 'before-settings-change', label: 'Before changing blog settings', paths: await siteConfigurationPaths(root) })
  try {
    await updateSiteConfig(root, { title, baseURL, languageCode, copyright })
    const currentHosting = await hostingSettings(root, baseURL)
    const hostingProvider = Object.hasOwn(input || {}, 'hostingProvider') ? input.hostingProvider : currentHosting.hostingProvider
    const publicUrl = Object.hasOwn(input || {}, 'publicUrl') ? input.publicUrl : (currentHosting.publicUrl || baseURL)
    await saveHostingSettings(root, { hostingProvider, publicUrl })
    return siteSettings(root)
  } catch (error) {
    await restoreRecoveryPoint(root, recoveryPoint.id, { createUndo: false }).catch(() => {})
    throw error
  }
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
  const [hugo, hugoExecutable, git] = await Promise.all([
    run(root, 'hugo', ['version']).then((value) => value.stdout).catch(() => null),
    executablePath(root, 'hugo'),
    gitVersion(root).then((value) => value.status === 'ready' ? value.version : null),
  ])
  const rawConfig = await fs.readFile(path.join(root, config), 'utf8').catch(() => '')
  const configuredTheme = readThemeValue(rawConfig, config)
  const theme = Array.isArray(configuredTheme) ? configuredTheme[0] || '' : configuredTheme
  return { root, config, runtime, hugo, hugoExecutable, git, theme }
}

async function installTheme(root, slug) {
  return installResolvedTheme(root, await resolveTheme(slug))
}

async function deactivateTheme(root) {
  const context = await validateBlog(root)
  const recoveryPoint = await createRecoveryPoint(root, { reason: 'before-theme-change', label: 'Before deactivating the theme', paths: [context.config] })
  try {
    await updateSiteConfig(root, { theme: '' })
    return validateBlog(root)
  } catch (error) {
    await restoreRecoveryPoint(root, recoveryPoint.id, { createUndo: false }).catch(() => {})
    throw error
  }
}

async function installResolvedTheme(root, theme) {
  const originalContext = await validateBlog(root)
  await ensureGitRepository(root)
  const themeRoot = themeDirectoryPath(root, theme.folder)
  const existing = await fs.stat(themeRoot).catch(() => null)
  const configPath = path.join(root, originalContext.config)
  const originalConfig = await fs.readFile(configPath, 'utf8')
  const recoveryPaths = [originalContext.config, '.gitmodules', ...(!existing ? [`themes/${theme.folder}`] : [])]
  const recoveryPoint = await createRecoveryPoint(root, { reason: 'before-theme-change', label: `Before applying ${theme.name || theme.folder}`, paths: recoveryPaths })
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
      recoveryPoint,
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
      recoveryPoint,
      message: 'The theme was not activated because the Hugo validation build failed.',
      details: error.message,
      context: await validateBlog(root),
    }
  }
  return { ok: true, ...theme, compatibility, recoveryPoint, context: await validateBlog(root) }
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
  deploymentSettings,
  installResolvedTheme,
  installTheme,
  hostingSettings,
  inferHostingProvider,
  saveHostingSettings,
  saveDeploymentSettings,
  saveSiteSettings,
  siteMetadata,
  siteSettings,
  updateSiteConfig,
  validateBlog,
}
