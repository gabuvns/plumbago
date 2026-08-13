const fs = require('node:fs/promises')
const path = require('node:path')
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')
const { executablePath, run, runtimeFor, spawnLongRunning } = require('../core/runtime.cjs')
const { parseHugoVersion } = require('./theme-compatibility.cjs')

const execFileAsync = promisify(execFile)
const INSTALL_URLS = {
  darwin: 'https://gohugo.io/installation/macos/',
  linux: 'https://gohugo.io/installation/linux/',
  win32: 'https://gohugo.io/installation/windows/',
}
const runtimeSelections = new Map()
const runtimeExecutables = new Map()

function runtimePreferenceKey(root) {
  const value = String(root || '')
  return process.platform === 'win32' || /^[a-z]:[\\/]/i.test(value) || /^\\\\(?:wsl\.localhost|wsl\$)\\/i.test(value)
    ? value.replaceAll('/', '\\').toLowerCase()
    : value
}

function normalizeRuntimeSelection(input = {}) {
  if (input.kind === 'wsl') {
    const distro = String(input.distro || '').trim()
    if (!/^[\w .-]{1,100}$/.test(distro)) throw new Error('Choose a valid WSL distribution.')
    return { kind: 'wsl', distro }
  }
  const platform = ['darwin', 'linux', 'win32'].includes(input.platform) ? input.platform : process.platform
  return { kind: 'native', platform }
}

function runtimeId(runtime) {
  return runtime.kind === 'wsl' ? `wsl:${runtime.distro}` : `native:${runtime.platform || process.platform}`
}

function runtimeExecutableKey(root, runtime) {
  return `${runtimePreferenceKey(root)}::${runtimeId(runtime)}`
}

function setHugoRuntimeSelection(root, selection) {
  const normalized = normalizeRuntimeSelection(selection)
  runtimeSelections.set(runtimePreferenceKey(root), normalized)
  return normalized
}

function clearHugoRuntimeSelection(root) {
  runtimeSelections.delete(runtimePreferenceKey(root))
}

function hugoRuntimeSelection(root) {
  return runtimeSelections.get(runtimePreferenceKey(root)) || normalizeRuntimeSelection(runtimeFor(root))
}

function hugoRuntimeAccess(root, selection) {
  const runtime = normalizeRuntimeSelection(selection)
  const normalizedRoot = String(root || '').replaceAll('/', '\\')
  if (runtime.kind === 'native' && runtime.platform === 'win32') {
    const wslPath = normalizedRoot.match(/^\\\\(?:wsl\.localhost|wsl\$)\\([^\\]+)\\(.*)$/i)
    if (wslPath && !/^mnt\\[a-z](?:\\|$)/i.test(wslPath[2])) {
      return {
        blogAccessible: false,
        code: 'windows-wsl-filesystem',
        values: { distro: wslPath[1] },
        details: `Windows Hugo cannot build safely inside the Linux filesystem of ${wslPath[1]}. Choose Hugo from that WSL distribution, or move the blog to a Windows drive.`,
      }
    }
  }
  try {
    runtimeFor(root, runtime)
    return { blogAccessible: true, code: '', values: {}, details: '' }
  } catch (error) {
    return { blogAccessible: false, code: 'runtime-path-unavailable', values: {}, details: error.message }
  }
}

function selectedHugoRuntime(root) {
  const selection = hugoRuntimeSelection(root)
  const access = hugoRuntimeAccess(root, selection)
  if (!access.blogAccessible) {
    const error = new Error(access.details)
    error.code = 'RUNTIME_PATH_UNAVAILABLE'
    throw error
  }
  return runtimeFor(root, selection)
}

function environmentDetails(runtime) {
  if (runtime.kind === 'wsl') return { kind: 'wsl', distro: runtime.distro, label: `WSL · ${runtime.distro}` }
  const platform = runtime.platform || process.platform
  const labels = { darwin: 'macOS', linux: 'Linux', win32: 'Windows' }
  return { kind: 'native', platform, label: labels[platform] || platform }
}

function hugoInstallAssistance(runtime, installed = false, executable = '') {
  if (runtime.kind === 'wsl') {
    if (installed && String(executable).includes('/snap/')) {
      return { mode: 'command', command: 'sudo snap refresh hugo', url: INSTALL_URLS.linux, repositoryMayLag: false }
    }
    if (installed && /(?:linuxbrew|homebrew)/i.test(String(executable))) {
      return { mode: 'command', command: 'brew upgrade hugo', url: INSTALL_URLS.linux, repositoryMayLag: false }
    }
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
      command: `${installed ? 'winget upgrade' : 'winget install'} --id Hugo.Hugo.Extended -e --source winget --accept-package-agreements --accept-source-agreements`,
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
  if (installed && String(executable).includes('/snap/')) {
    return { mode: 'command', command: 'sudo snap refresh hugo', url: INSTALL_URLS.linux, repositoryMayLag: false }
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
      process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WindowsApps', 'hugo.exe'),
      process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Hugo', 'bin', 'hugo.exe'),
      process.env.USERPROFILE && path.join(process.env.USERPROFILE, 'scoop', 'shims', 'hugo.exe'),
      process.env.ChocolateyInstall && path.join(process.env.ChocolateyInstall, 'bin', 'hugo.exe'),
    ].filter(Boolean)
  }
  if (runtime.platform === 'darwin') return ['/opt/homebrew/bin/hugo', '/usr/local/bin/hugo', '/usr/bin/hugo']
  return ['/usr/local/bin/hugo', '/usr/bin/hugo', '/snap/bin/hugo']
}

function hugoDetails(output, executable) {
  const parsed = parseHugoVersion(output)
  const architecture = String(output || '').match(/(?:windows|linux|darwin)\/(amd64|arm64|386)/i)?.[1] || ''
  return {
    status: 'ready',
    version: String(output || '').trim(),
    versionNumber: parsed?.version || '',
    executable: executable || '',
    extended: Boolean(parsed?.extended),
    architecture,
    details: '',
  }
}

function isNoHugoUpgradeAvailable(message) {
  return /(?:no applicable upgrade|no available upgrade|no newer package)/i.test(String(message || ''))
}

async function detectHugoInRuntime(root, runtime) {
  try {
    const result = await run(root, 'hugo', ['version'], { runtime, timeout: 20_000 })
    const executable = await executablePath(root, 'hugo', { runtime })
    runtimeExecutables.set(runtimeExecutableKey(root, runtime), executable)
    return hugoDetails(result.stdout, executable)
  } catch (originalError) {
    if (runtime.kind === 'native') {
      for (const candidate of nativeHugoCandidates(runtime)) {
        const available = await fs.access(candidate).then(() => true).catch(() => false)
        if (!available) continue
        try {
          const result = await run(root, 'hugo', ['version'], { runtime, executable: candidate, timeout: 20_000 })
          runtimeExecutables.set(runtimeExecutableKey(root, runtime), candidate)
          return hugoDetails(result.stdout, candidate)
        } catch {
          // Try the next known installation before returning the original failure.
        }
      }
    }
    return {
      status: originalError.code === 'COMMAND_NOT_FOUND' ? 'missing' : 'error',
      version: '',
      versionNumber: '',
      executable: '',
      extended: false,
      architecture: '',
      details: originalError.code === 'COMMAND_NOT_FOUND' ? '' : originalError.message,
    }
  }
}

async function inspectHugoBuild(root, runtime, hugo) {
  if (hugo.status !== 'ready') return { status: 'not-tested', details: '' }
  try {
    await run(root, 'hugo', ['--renderToMemory', '--minify', '--noBuildLock'], {
      runtime,
      executable: hugo.executable || undefined,
      timeout: 2 * 60 * 1000,
    })
    return { status: 'ready', details: '' }
  } catch (error) {
    return { status: 'error', details: error.message }
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

function hugoRuntimeCandidates(root, options = {}) {
  const platform = options.platform || process.platform
  const inferred = normalizeRuntimeSelection(runtimeFor(root))
  const selected = options.selected ? normalizeRuntimeSelection(options.selected) : hugoRuntimeSelection(root)
  if (platform !== 'win32') return [selected]
  const distributions = new Set((options.wslDistributions || []).map((item) => String(item).trim()).filter(Boolean))
  if (inferred.kind === 'wsl') distributions.add(inferred.distro)
  if (selected.kind === 'wsl') distributions.add(selected.distro)
  return [
    { kind: 'native', platform: 'win32' },
    ...Array.from(distributions).map((distro) => ({ kind: 'wsl', distro })),
  ]
}

function runtimeForInventory(root, selection) {
  const access = hugoRuntimeAccess(root, selection)
  if (access.blogAccessible) {
    return { runtime: runtimeFor(root, selection), blogAccessible: true, accessCode: '', accessValues: {}, accessDetails: '' }
  }
  const workingDirectory = selection.kind === 'native' ? process.env.USERPROFILE || process.cwd() : '/'
  return {
    runtime: runtimeFor(workingDirectory, { ...selection, workingDirectory }),
    blogAccessible: false,
    accessCode: access.code,
    accessValues: access.values,
    accessDetails: access.details,
  }
}

async function hugoRuntimeInventory(root) {
  const wslDistributions = await listWslDistributions()
  const selected = hugoRuntimeSelection(root)
  const candidates = hugoRuntimeCandidates(root, { wslDistributions, selected })
  const runtimes = []
  // Hugo uses a build lock inside the project. Test environments one at a time so
  // two valid installations do not make each other look broken.
  for (const selection of candidates) {
    const resolved = runtimeForInventory(root, selection)
    const hugo = await detectHugoInRuntime(root, resolved.runtime)
    const build = resolved.blogAccessible
      ? await inspectHugoBuild(root, resolved.runtime, hugo)
      : { status: 'not-tested', details: '' }
    runtimes.push({
      id: runtimeId(selection),
      selected: runtimeId(selection) === runtimeId(selected),
      runtime: normalizeRuntimeSelection(selection),
      environment: environmentDetails(selection),
      blogAccessible: resolved.blogAccessible,
      accessCode: resolved.accessCode,
      accessValues: resolved.accessValues,
      accessDetails: resolved.accessDetails,
      ready: resolved.blogAccessible && hugo.status === 'ready' && build.status === 'ready',
      hugo,
      build,
      assistance: hugoInstallAssistance(selection, hugo.status === 'ready', hugo.executable),
    })
  }
  const current = runtimes.find((item) => item.selected) || runtimes[0]
  return {
    ready: Boolean(current?.ready),
    selectedId: current?.id || '',
    environment: current?.environment || environmentDetails(selected),
    hugo: current?.hugo || { status: 'missing', version: '', versionNumber: '', executable: '', extended: false, architecture: '', details: '' },
    assistance: current?.assistance || hugoInstallAssistance(selected),
    runtimes,
    wslDistributions,
  }
}

async function hugoVersion(root) {
  try {
    const runtime = selectedHugoRuntime(root)
    return detectHugoInRuntime(root, runtime)
  } catch (error) {
    return {
      status: 'error',
      version: '',
      versionNumber: '',
      executable: '',
      extended: false,
      architecture: '',
      details: error.message,
    }
  }
}

async function runHugo(root, args = [], options = {}) {
  const runtime = selectedHugoRuntime(root)
  let executable = runtimeExecutables.get(runtimeExecutableKey(root, runtime)) || ''
  try {
    return await run(root, 'hugo', args, { ...options, runtime, ...(executable ? { executable } : {}) })
  } catch (error) {
    if (error.code !== 'COMMAND_NOT_FOUND' || executable) throw error
    const detected = await detectHugoInRuntime(root, runtime)
    executable = detected.executable
    if (!executable) throw error
    return run(root, 'hugo', args, { ...options, runtime, executable })
  }
}

function spawnHugo(root, args = []) {
  const runtime = selectedHugoRuntime(root)
  const executable = runtimeExecutables.get(runtimeExecutableKey(root, runtime)) || ''
  return spawnLongRunning(root, 'hugo', args, { runtime, ...(executable ? { executable } : {}) })
}

async function testHugoRuntime(root, id) {
  const inventory = await hugoRuntimeInventory(root)
  const candidate = inventory.runtimes.find((item) => item.id === String(id || ''))
  if (!candidate) throw new Error('Choose an available Hugo environment.')
  if (!candidate.blogAccessible) throw new Error(candidate.accessDetails || 'This environment cannot access the selected blog folder.')
  if (candidate.hugo.status !== 'ready') throw new Error('Install Hugo in this environment before selecting it.')
  if (candidate.build.status !== 'ready') {
    const environment = candidate.environment.label
    const version = candidate.hugo.versionNumber || candidate.hugo.version
    const detail = candidate.build.details ? `\n\nTechnical details:\n${candidate.build.details}` : ''
    const error = new Error(`Hugo ${version} is installed in ${environment}, but it could not build this blog. The active theme may require a different Hugo version or the Extended edition.${detail}`)
    error.code = 'HUGO_RUNTIME_BUILD_FAILED'
    throw error
  }
  return candidate
}

async function selectHugoRuntime(root, id) {
  const candidate = await testHugoRuntime(root, id)
  setHugoRuntimeSelection(root, candidate.runtime)
  return { selection: candidate.runtime, readiness: await hugoRuntimeInventory(root) }
}

async function hugoReadiness(root) {
  return hugoRuntimeInventory(root)
}

async function installHugo(root, id) {
  const inventory = await hugoRuntimeInventory(root)
  const candidate = inventory.runtimes.find((item) => item.id === String(id || inventory.selectedId))
  if (!candidate) throw new Error('Choose an available Hugo environment.')
  const assistance = candidate.assistance
  if (assistance.mode !== 'automatic') {
    const error = new Error('This environment needs an interactive update. Copy the suggested command, run it in that environment, and test again.')
    error.code = 'INTERACTIVE_REQUIRED'
    throw error
  }
  const action = candidate.hugo.status === 'ready' ? 'upgrade' : 'install'
  const installerRuntime = { ...candidate.runtime, workingDirectory: process.env.USERPROFILE || process.cwd() }
  try {
    await run(root, 'winget.exe', [
      action,
      '--id',
      'Hugo.Hugo.Extended',
      '-e',
      '--source',
      'winget',
      '--accept-package-agreements',
      '--accept-source-agreements',
    ], { runtime: installerRuntime, timeout: 10 * 60 * 1000 })
  } catch (error) {
    if (action !== 'upgrade' || !isNoHugoUpgradeAvailable(error.message)) throw error
    return { ...(await hugoRuntimeInventory(root)), operation: { state: 'up-to-date', runtimeId: candidate.id } }
  }
  runtimeExecutables.delete(runtimeExecutableKey(root, candidate.runtime))
  const refreshed = await hugoRuntimeInventory(root)
  const refreshedCandidate = refreshed.runtimes.find((item) => item.id === candidate.id)
  if (refreshedCandidate?.hugo.status !== 'ready') {
    throw new Error('Windows Package Manager finished, but Plumbago could not start Hugo yet. Test again; if it is still missing, reopen Plumbago or use the official installation guide.')
  }
  if (refreshedCandidate.build.status !== 'ready') {
    const error = new Error(`Windows Package Manager updated Hugo, but this version could not build the blog. The active theme may require a different Hugo version.\n\nTechnical details:\n${refreshedCandidate.build.details}`)
    error.code = 'HUGO_RUNTIME_BUILD_FAILED'
    throw error
  }
  return { ...refreshed, operation: { state: action === 'install' ? 'installed' : 'updated', runtimeId: candidate.id } }
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
  clearHugoRuntimeSelection,
  environmentDetails,
  hugoInstallAssistance,
  hugoReadiness,
  hugoRuntimeAccess,
  hugoRuntimeCandidates,
  hugoRuntimeInventory,
  hugoRuntimeSelection,
  hugoVersion,
  installHugo,
  isNoHugoUpgradeAvailable,
  listWslDistributions,
  normalizeRuntimeSelection,
  runHugo,
  runtimeId,
  runtimePreferenceKey,
  selectHugoRuntime,
  selectedHugoRuntime,
  setHugoRuntimeSelection,
  spawnHugo,
  testHugoRuntime,
  useWslForBlog,
  wslBlogRoot,
}
