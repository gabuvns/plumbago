const fs = require('node:fs/promises')
const path = require('node:path')
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')
const { executablePath, run, runtimeFor } = require('../core/runtime.cjs')
const { parseHugoVersion } = require('./theme-compatibility.cjs')

const execFileAsync = promisify(execFile)
const INSTALL_URLS = {
  darwin: 'https://gohugo.io/installation/macos/',
  linux: 'https://gohugo.io/installation/linux/',
  win32: 'https://gohugo.io/installation/windows/',
}

function environmentDetails(runtime) {
  if (runtime.kind === 'wsl') return { kind: 'wsl', distro: runtime.distro, label: `WSL · ${runtime.distro}` }
  const platform = runtime.platform || process.platform
  return { kind: 'native', platform, label: platform }
}

function hugoInstallAssistance(runtime, installed = false) {
  if (runtime.kind === 'wsl') {
    return {
      mode: 'command',
      command: 'sudo apt update && sudo apt install -y hugo',
      url: INSTALL_URLS.linux,
      repositoryMayLag: true,
    }
  }
  if (runtime.platform === 'win32') {
    return {
      mode: 'automatic',
      command: `${installed ? 'winget upgrade' : 'winget install'} --id Hugo.Hugo.Extended -e --source winget`,
      url: INSTALL_URLS.win32,
      repositoryMayLag: false,
    }
  }
  if (runtime.platform === 'darwin') {
    return {
      mode: 'command',
      command: installed ? 'brew upgrade hugo' : 'brew install hugo',
      url: INSTALL_URLS.darwin,
      repositoryMayLag: false,
    }
  }
  return {
    mode: 'command',
    command: 'sudo apt update && sudo apt install -y hugo',
    url: INSTALL_URLS.linux,
    repositoryMayLag: true,
  }
}

function nativeHugoCandidates(runtime) {
  if (runtime.kind !== 'native') return []
  if (runtime.platform === 'win32') {
    return [
      process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Links', 'hugo.exe'),
      process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Hugo', 'bin', 'hugo.exe'),
      process.env.USERPROFILE && path.join(process.env.USERPROFILE, 'scoop', 'shims', 'hugo.exe'),
      process.env.ChocolateyInstall && path.join(process.env.ChocolateyInstall, 'bin', 'hugo.exe'),
    ].filter(Boolean)
  }
  if (runtime.platform === 'darwin') return ['/opt/homebrew/bin/hugo', '/usr/local/bin/hugo', '/usr/bin/hugo']
  return ['/usr/local/bin/hugo', '/usr/bin/hugo', '/snap/bin/hugo']
}

async function activateKnownHugoPath(runtime) {
  for (const candidate of nativeHugoCandidates(runtime)) {
    const available = await fs.access(candidate).then(() => true).catch(() => false)
    if (!available) continue
    const directory = path.dirname(candidate)
    const entries = String(process.env.PATH || '').split(path.delimiter)
    if (!entries.some((entry) => entry.toLowerCase() === directory.toLowerCase())) {
      process.env.PATH = [directory, process.env.PATH].filter(Boolean).join(path.delimiter)
    }
    return candidate
  }
  return ''
}

async function hugoVersion(root) {
  const runtime = runtimeFor(root)
  try {
    const result = await run(root, 'hugo', ['version'])
    const parsed = parseHugoVersion(result.stdout)
    return { status: 'ready', version: result.stdout, executable: await executablePath(root, 'hugo'), extended: Boolean(parsed?.extended), details: '' }
  } catch (error) {
    if (runtime.kind === 'native') {
      const executable = await activateKnownHugoPath(runtime)
      if (executable) {
        try {
          const result = await run(root, 'hugo', ['version'])
          const parsed = parseHugoVersion(result.stdout)
          return { status: 'ready', version: result.stdout, executable, extended: Boolean(parsed?.extended), details: '' }
        } catch {
          // Keep the original error classification below.
        }
      }
    }
    return {
      status: error.code === 'COMMAND_NOT_FOUND' ? 'missing' : 'error',
      version: '',
      executable: '',
      extended: false,
      details: error.code === 'COMMAND_NOT_FOUND' ? '' : error.message,
    }
  }
}

async function listWslDistributions() {
  if (process.platform !== 'win32') return []
  try {
    const result = await execFileAsync('wsl.exe', ['--list', '--quiet'], { windowsHide: true, timeout: 15_000 })
    return String(result.stdout || '').replaceAll('\u0000', '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
  } catch {
    return []
  }
}

async function hugoReadiness(root) {
  const runtime = runtimeFor(root)
  const hugo = await hugoVersion(root)
  return {
    ready: hugo.status === 'ready',
    environment: environmentDetails(runtime),
    hugo,
    assistance: hugoInstallAssistance(runtime, hugo.status === 'ready'),
    wslDistributions: runtime.kind === 'native' && runtime.platform === 'win32' ? await listWslDistributions() : [],
  }
}

async function installHugo(root) {
  const runtime = runtimeFor(root)
  const current = await hugoVersion(root)
  const assistance = hugoInstallAssistance(runtime, current.status === 'ready')
  if (assistance.mode !== 'automatic') {
    throw new Error('This environment needs an interactive installation. Copy the suggested command and run it in a terminal.')
  }
  const action = current.status === 'ready' ? 'upgrade' : 'install'
  await run(root, 'winget.exe', [
    action,
    '--id',
    'Hugo.Hugo.Extended',
    '-e',
    '--source',
    'winget',
    '--accept-package-agreements',
    '--accept-source-agreements',
  ], { timeout: 10 * 60 * 1000 })
  await activateKnownHugoPath(runtime)
  return hugoReadiness(root)
}

function wslBlogRoot(root, distro) {
  const safeDistro = String(distro || '').trim()
  if (!/^[\w .-]{1,100}$/.test(safeDistro)) throw new Error('Choose a valid WSL distribution.')
  const match = String(root || '').match(/^([a-z]):\\(.*)$/i)
  if (!match) throw new Error('Only blogs stored on a Windows drive can be reopened through WSL automatically.')
  const relative = match[2].split('\\').filter(Boolean).join('\\')
  return `\\\\wsl.localhost\\${safeDistro}\\mnt\\${match[1].toLowerCase()}${relative ? `\\${relative}` : ''}`
}

async function useWslForBlog(root, distro) {
  const target = wslBlogRoot(root, distro)
  const stat = await fs.stat(target).catch(() => null)
  if (!stat?.isDirectory()) throw new Error('WSL could not access this blog through the selected distribution.')
  return target
}

module.exports = {
  hugoInstallAssistance,
  hugoReadiness,
  hugoVersion,
  installHugo,
  listWslDistributions,
  useWslForBlog,
  wslBlogRoot,
}
