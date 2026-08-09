const { app, BrowserWindow, clipboard, dialog, ipcMain, safeStorage, shell } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')
const service = require('./plumbago-service.cjs')

app.setName('Plumbago')

let mainWindow
let blogRoot = null
let previewProcess = null
let githubToken = ''
let githubTokenSource = ''
let encryptedGitHubToken = ''
let bloggerImportPath = ''
let ignoreGitHubCli = false

const GITHUB_CLIENT_ID = process.env.PLUMBAGO_GITHUB_CLIENT_ID || ''

const settingsPath = () => path.join(app.getPath('userData'), 'settings.json')
const legacySettingsPath = () => path.join(app.getPath('appData'), 'Plum', 'settings.json')

async function loadSettings() {
  try {
    const settings = JSON.parse(await fs.readFile(settingsPath(), 'utf8').catch(() => fs.readFile(legacySettingsPath(), 'utf8')))
    encryptedGitHubToken = String(settings.githubToken || '')
    if (encryptedGitHubToken && safeStorage.isEncryptionAvailable()) {
      githubToken = safeStorage.decryptString(Buffer.from(encryptedGitHubToken, 'base64'))
      githubTokenSource = 'plumbago'
    }
    if (settings.blogRoot) {
      await service.validateBlog(settings.blogRoot)
      blogRoot = settings.blogRoot
    }
  } catch {
    blogRoot = null
  }
}

async function persistSettings() {
  await fs.mkdir(path.dirname(settingsPath()), { recursive: true })
  await fs.writeFile(settingsPath(), JSON.stringify({ blogRoot, githubToken: encryptedGitHubToken }, null, 2), 'utf8')
}

async function setGitHubToken(token) {
  githubToken = String(token || '')
  githubTokenSource = githubToken ? 'plumbago' : ''
  encryptedGitHubToken = githubToken && safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(githubToken).toString('base64')
    : ''
  await persistSettings()
  return { persistent: Boolean(encryptedGitHubToken) }
}

async function ensureGitHubToken() {
  if (!githubToken && blogRoot && !ignoreGitHubCli) {
    githubToken = await service.githubCliToken(blogRoot).catch(() => '')
    if (githubToken) githubTokenSource = 'github-cli'
  }
  if (!githubToken) throw new Error('Connect a GitHub account first.')
  return githubToken
}

function requireBlog() {
  if (!blogRoot) throw new Error('Escolha a pasta de um blog Hugo primeiro.')
  return blogRoot
}

function registerIpc() {
  ipcMain.handle('plumbago:get-context', async () => blogRoot ? service.validateBlog(blogRoot) : null)
  ipcMain.handle('plumbago:choose-blog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'], title: 'Escolha a pasta do seu blog Hugo' })
    if (result.canceled) return null
    const context = await service.validateBlog(result.filePaths[0])
    blogRoot = result.filePaths[0]
    await persistSettings()
    return context
  })
  ipcMain.handle('plumbago:create-blog', async (_event, input) => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory', 'createDirectory'], title: 'Escolha onde o novo blog será criado' })
    if (result.canceled) return null
    const context = await service.createSite(result.filePaths[0], input)
    blogRoot = context.root
    await persistSettings()
    return context
  })
  ipcMain.handle('plumbago:list-themes', () => service.listThemes())
  ipcMain.handle('plumbago:install-theme', (_event, slug) => service.installTheme(requireBlog(), slug))
  ipcMain.handle('plumbago:site-settings', () => service.siteSettings(requireBlog()))
  ipcMain.handle('plumbago:save-site-settings', (_event, input) => service.saveSiteSettings(requireBlog(), input))
  ipcMain.handle('plumbago:open-theme', async (_event, slug) => {
    const safeSlug = String(slug || '').toLowerCase()
    if (!/^[a-z0-9][a-z0-9-]{0,100}$/.test(safeSlug)) throw new Error('Tema inválido.')
    await shell.openExternal(`https://themes.gohugo.io/themes/${safeSlug}/`)
    return true
  })
  ipcMain.handle('plumbago:list-posts', () => service.listPosts(requireBlog()))
  ipcMain.handle('plumbago:read-post', (_event, id) => service.readPost(requireBlog(), id))
  ipcMain.handle('plumbago:save-post', (_event, post) => service.savePost(requireBlog(), post))
  ipcMain.handle('plumbago:create-post', (_event, input) => service.createPost(requireBlog(), input))
  ipcMain.handle('plumbago:git-status', () => service.gitStatus(requireBlog()))
  ipcMain.handle('plumbago:git-config', () => service.gitConfig(requireBlog()))
  ipcMain.handle('plumbago:save-git-config', (_event, config) => service.saveGitConfig(requireBlog(), config))
  ipcMain.handle('plumbago:sync-git', (_event, message) => service.syncGit(requireBlog(), message))
  ipcMain.handle('plumbago:publishing-status', () => service.publishingStatus(requireBlog()))
  ipcMain.handle('plumbago:publish-blog', (_event, message) => service.publishBlog(requireBlog(), message))
  ipcMain.handle('plumbago:open-publishing-url', async (_event, value) => {
    let url
    try { url = new URL(String(value || '')) } catch { throw new Error('Invalid publishing URL.') }
    if (url.protocol !== 'https:') throw new Error('Publishing links must use HTTPS.')
    await shell.openExternal(url.href)
    return true
  })
  ipcMain.handle('plumbago:github-status', async () => {
    await ensureGitHubToken().catch(() => '')
    if (!githubToken) return { configured: Boolean(GITHUB_CLIENT_ID), connected: false, account: null, persistent: false }
    try {
      return { configured: true, connected: true, account: await service.githubAccount(githubToken), persistent: Boolean(encryptedGitHubToken) || githubTokenSource === 'github-cli', managedBy: githubTokenSource }
    } catch {
      await setGitHubToken('')
      return { configured: true, connected: false, account: null, persistent: false }
    }
  })
  ipcMain.handle('plumbago:github-begin-sign-in', async () => {
    ignoreGitHubCli = false
    const flow = await service.beginGitHubSignIn(GITHUB_CLIENT_ID)
    clipboard.writeText(flow.user_code)
    await shell.openExternal(flow.verification_uri)
    return {
      deviceCode: flow.device_code,
      userCode: flow.user_code,
      verificationUri: flow.verification_uri,
      expiresIn: flow.expires_in,
      interval: flow.interval,
    }
  })
  ipcMain.handle('plumbago:github-complete-sign-in', async (_event, deviceCode) => {
    void _event
    const result = await service.completeGitHubSignIn(GITHUB_CLIENT_ID, deviceCode)
    if (result.state !== 'complete') return result
    const storage = await setGitHubToken(result.token)
    return { state: 'complete', account: await service.githubAccount(githubToken), ...storage }
  })
  ipcMain.handle('plumbago:github-connect-token', async (_event, value) => {
    const token = String(value || '').trim()
    if (token.length < 20 || token.length > 512) throw new Error('Enter a valid GitHub access token.')
    const account = await service.githubAccount(token)
    ignoreGitHubCli = true
    const storage = await setGitHubToken(token)
    return { account, ...storage }
  })
  ipcMain.handle('plumbago:github-disconnect', async () => {
    ignoreGitHubCli = true
    await setGitHubToken('')
    return true
  })
  ipcMain.handle('plumbago:github-repositories', async () => service.listGitHubRepositories(await ensureGitHubToken()))
  ipcMain.handle('plumbago:github-create-repository', async (_event, input) => service.createGitHubRepository(requireBlog(), await ensureGitHubToken(), input))
  ipcMain.handle('plumbago:github-connect-repository', async (_event, fullName, protocol) => service.connectGitHubRepository(requireBlog(), await ensureGitHubToken(), fullName, protocol))
  ipcMain.handle('plumbago:github-configure-pages', async () => service.configureGitHubPages(requireBlog(), await ensureGitHubToken()))
  ipcMain.handle('plumbago:publishing-health', () => service.publishingHealth(requireBlog()))
  ipcMain.handle('plumbago:choose-blogger-export', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      title: 'Choose a Blogger export',
      filters: [{ name: 'Blogger XML export', extensions: ['xml'] }],
    })
    if (result.canceled) return null
    bloggerImportPath = result.filePaths[0]
    return service.inspectBloggerExport(bloggerImportPath)
  })
  ipcMain.handle('plumbago:import-blogger-export', (_event, options) => {
    if (!bloggerImportPath) throw new Error('Choose a Blogger export first.')
    return service.importBloggerExport(requireBlog(), bloggerImportPath, options)
  })
  ipcMain.handle('plumbago:read-asset', (_event, postId, name) => service.readAsset(requireBlog(), postId, name))
  ipcMain.handle('plumbago:read-asset-info', (_event, postId, name) => service.readAssetInfo(requireBlog(), postId, name))
  ipcMain.handle('plumbago:import-images', async (_event, postId) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      title: 'Adicionar imagens ao post',
      filters: [{ name: 'Imagens', extensions: ['avif', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp'] }],
    })
    return result.canceled ? [] : service.importImages(requireBlog(), postId, result.filePaths)
  })
  ipcMain.handle('plumbago:import-image-paths', (_event, postId, sourcePaths) => service.importImages(requireBlog(), postId, sourcePaths))
  ipcMain.handle('plumbago:open-preview', async () => {
    const root = requireBlog()
    if (!previewProcess || previewProcess.exitCode !== null) {
      previewProcess = service.spawnLongRunning(root, 'hugo', ['server', '--buildDrafts', '--disableFastRender', '--port', '1313'])
      await new Promise((resolve) => setTimeout(resolve, 900))
    }
    await shell.openExternal('http://localhost:1313')
    return true
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1040,
    minHeight: 680,
    backgroundColor: '#f7f6fb',
    title: 'Plumbago',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  if (process.env.VITE_DEV_SERVER_URL) mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  else if (process.argv.includes('--dev')) mainWindow.loadURL('http://localhost:5173')
  else mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

app.whenReady().then(async () => {
  if (process.platform === 'win32') app.setAppUserModelId('dev.gabu.plumbago')
  await loadSettings()
  registerIpc()
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => {
  previewProcess?.kill()
  if (process.platform !== 'darwin') app.quit()
})
