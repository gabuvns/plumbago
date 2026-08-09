const { app } = require('electron')
const { autoUpdater } = require('electron-updater')
const { checkLatestRelease, RELEASES_URL } = require('../services/updates.cjs')

let configured = false
let status = null

function support() {
  if (!app.isPackaged) return { canAutoUpdate: false, reason: 'development' }
  if (process.platform === 'linux' && !process.env.APPIMAGE) return { canAutoUpdate: false, reason: 'linux-package' }
  if (process.platform === 'darwin') return { canAutoUpdate: false, reason: 'mac-signing' }
  return { canAutoUpdate: ['win32', 'linux'].includes(process.platform), reason: '' }
}

function baseStatus() {
  return {
    state: 'idle',
    currentVersion: app.getVersion(),
    version: '',
    name: '',
    notes: '',
    publishedAt: '',
    releaseUrl: RELEASES_URL,
    progress: 0,
    error: '',
    ...support(),
  }
}

function publicError(error) {
  return String(error?.message || error || 'The update could not be completed.').slice(0, 2_000)
}

function configure() {
  if (configured) return
  configured = true
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.allowPrerelease = false
  autoUpdater.allowDowngrade = false
  autoUpdater.on('download-progress', (progress) => {
    status = { ...(status || baseStatus()), state: 'downloading', progress: Math.round(progress.percent || 0) }
  })
  autoUpdater.on('update-downloaded', () => {
    status = { ...(status || baseStatus()), state: 'downloaded', progress: 100 }
  })
  autoUpdater.on('error', (error) => {
    status = { ...(status || baseStatus()), state: 'error', error: publicError(error), progress: 0 }
  })
}

function updateStatus() {
  return status || baseStatus()
}

async function checkForUpdates() {
  status = { ...baseStatus(), state: 'checking' }
  try {
    const latest = await checkLatestRelease(app.getVersion())
    status = { ...baseStatus(), ...latest }
    return status
  } catch (error) {
    status = { ...baseStatus(), state: 'error', error: publicError(error) }
    return status
  }
}

async function downloadUpdate() {
  if (status?.state !== 'available') await checkForUpdates()
  if (status?.state !== 'available' || !status.canAutoUpdate) return status
  configure()
  status = { ...status, state: 'downloading', progress: 0, error: '' }
  try {
    const result = await autoUpdater.checkForUpdates()
    if (!result?.updateInfo) throw new Error('The release was found, but its update metadata is unavailable.')
    await autoUpdater.downloadUpdate()
    status = { ...status, state: 'downloaded', progress: 100 }
    return status
  } catch (error) {
    status = { ...status, state: 'error', error: publicError(error), progress: 0 }
    return status
  }
}

function installUpdate() {
  if (status?.state !== 'downloaded') throw new Error('Download the Plumbago update before installing it.')
  setImmediate(() => autoUpdater.quitAndInstall(false, true))
  return true
}

module.exports = { checkForUpdates, downloadUpdate, installUpdate, updateStatus }
