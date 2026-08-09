const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')
const service = require('./plum-service.cjs')

let mainWindow
let blogRoot = null
let previewProcess = null

const settingsPath = () => path.join(app.getPath('userData'), 'settings.json')

async function loadSettings() {
  try {
    const settings = JSON.parse(await fs.readFile(settingsPath(), 'utf8'))
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
  await fs.writeFile(settingsPath(), JSON.stringify({ blogRoot }, null, 2), 'utf8')
}

function requireBlog() {
  if (!blogRoot) throw new Error('Escolha a pasta de um blog Hugo primeiro.')
  return blogRoot
}

function registerIpc() {
  ipcMain.handle('plum:get-context', async () => blogRoot ? service.validateBlog(blogRoot) : null)
  ipcMain.handle('plum:choose-blog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'], title: 'Escolha a pasta do seu blog Hugo' })
    if (result.canceled) return null
    const context = await service.validateBlog(result.filePaths[0])
    blogRoot = result.filePaths[0]
    await persistSettings()
    return context
  })
  ipcMain.handle('plum:list-posts', () => service.listPosts(requireBlog()))
  ipcMain.handle('plum:read-post', (_event, id) => service.readPost(requireBlog(), id))
  ipcMain.handle('plum:save-post', (_event, post) => service.savePost(requireBlog(), post))
  ipcMain.handle('plum:create-post', (_event, input) => service.createPost(requireBlog(), input))
  ipcMain.handle('plum:git-status', () => service.gitStatus(requireBlog()))
  ipcMain.handle('plum:git-config', () => service.gitConfig(requireBlog()))
  ipcMain.handle('plum:save-git-config', (_event, config) => service.saveGitConfig(requireBlog(), config))
  ipcMain.handle('plum:sync-git', (_event, message) => service.syncGit(requireBlog(), message))
  ipcMain.handle('plum:read-asset', (_event, postId, name) => service.readAsset(requireBlog(), postId, name))
  ipcMain.handle('plum:import-images', async (_event, postId) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      title: 'Adicionar imagens ao post',
      filters: [{ name: 'Imagens', extensions: ['avif', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp'] }],
    })
    return result.canceled ? [] : service.importImages(requireBlog(), postId, result.filePaths)
  })
  ipcMain.handle('plum:import-image-paths', (_event, postId, sourcePaths) => service.importImages(requireBlog(), postId, sourcePaths))
  ipcMain.handle('plum:open-preview', async () => {
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
    backgroundColor: '#f4f1eb',
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
  await loadSettings()
  registerIpc()
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => {
  previewProcess?.kill()
  if (process.platform !== 'darwin') app.quit()
})
