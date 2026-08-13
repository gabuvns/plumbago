const { execFile, spawn } = require('node:child_process')
const { promisify } = require('node:util')

const execFileAsync = promisify(execFile)

function inferredRuntime(root) {
  const normalized = root.replaceAll('/', '\\')
  const match = normalized.match(/^\\\\(?:wsl\.localhost|wsl\$)\\([^\\]+)\\(.*)$/i)
  if (match) {
    return { kind: 'wsl', distro: match[1], workingDirectory: `/${match[2].replaceAll('\\', '/')}` }
  }
  return { kind: 'native', platform: process.platform, workingDirectory: root }
}

function wslWorkingDirectory(root, distro) {
  const safeDistro = String(distro || '').trim()
  if (!/^[\w .-]{1,100}$/.test(safeDistro)) throw new Error('Choose a valid WSL distribution.')
  const normalized = String(root || '').replaceAll('/', '\\')
  const unc = normalized.match(/^\\\\(?:wsl\.localhost|wsl\$)\\([^\\]+)\\(.*)$/i)
  if (unc) {
    const relative = unc[2].replaceAll('\\', '/')
    if (unc[1].toLowerCase() === safeDistro.toLowerCase() || /^mnt\/[a-z](?:\/|$)/i.test(relative)) return `/${relative}`
    const error = new Error(`This blog is stored inside ${unc[1]} and cannot be opened from ${safeDistro}.`)
    error.code = 'RUNTIME_PATH_UNAVAILABLE'
    throw error
  }
  const drive = normalized.match(/^([a-z]):\\?(.*)$/i)
  if (drive) return `/mnt/${drive[1].toLowerCase()}${drive[2] ? `/${drive[2].replaceAll('\\', '/')}` : ''}`
  if (String(root || '').startsWith('/')) return String(root)
  const error = new Error('This blog path cannot be translated for the selected WSL distribution.')
  error.code = 'RUNTIME_PATH_UNAVAILABLE'
  throw error
}

function nativeWorkingDirectory(root, platform) {
  if (platform !== 'win32') return root
  const normalized = String(root || '').replaceAll('/', '\\')
  const mountedDrive = normalized.match(/^\\\\(?:wsl\.localhost|wsl\$)\\[^\\]+\\mnt\\([a-z])(?:\\(.*))?$/i)
  if (!mountedDrive) return root
  return `${mountedDrive[1].toUpperCase()}:\\${mountedDrive[2] || ''}`
}

function runtimeFor(root, requestedRuntime = null) {
  if (!requestedRuntime?.kind) return inferredRuntime(root)
  if (requestedRuntime.kind === 'wsl') {
    return {
      kind: 'wsl',
      distro: String(requestedRuntime.distro || '').trim(),
      workingDirectory: requestedRuntime.workingDirectory || wslWorkingDirectory(root, requestedRuntime.distro),
    }
  }
  return {
    kind: 'native',
    platform: requestedRuntime.platform || process.platform,
    workingDirectory: requestedRuntime.workingDirectory || nativeWorkingDirectory(root, requestedRuntime.platform || process.platform),
  }
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'"'"'`)}'`
}

function wslCommandArgs(runtime, command, args = []) {
  const commandLine = `exec ${[command, ...args].map(shellQuote).join(' ')}`
  return ['-d', runtime.distro, '--cd', runtime.workingDirectory, '--', '/bin/bash', '-lc', commandLine]
}

function commandEnvironment(extraEnvironment = {}, forwardToWsl = false) {
  const environment = { ...process.env, ...extraEnvironment }
  if (!forwardToWsl || !Object.keys(extraEnvironment).length) return environment

  const existing = String(process.env.WSLENV || '').split(':').filter(Boolean)
  const forwarded = new Set(existing.map((entry) => entry.split('/')[0]))
  for (const key of Object.keys(extraEnvironment)) {
    if (!forwarded.has(key)) existing.push(key)
  }
  environment.WSLENV = existing.join(':')
  return environment
}

async function run(root, command, args = [], options = {}) {
  const { env: extraEnvironment, preserveOutput = false, runtime: requestedRuntime, executable, ...executionOptions } = options
  const runtime = runtimeFor(root, requestedRuntime)
  const program = executable || command
  const commandOptions = {
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
    ...executionOptions,
    ...(extraEnvironment ? { env: commandEnvironment(extraEnvironment, runtime.kind === 'wsl' && process.platform === 'win32') } : {}),
  }
  try {
    if (runtime.kind === 'wsl' && process.platform === 'win32') {
      const result = await execFileAsync(
        'wsl.exe',
        wslCommandArgs(runtime, program, args),
        commandOptions,
      )
      return { stdout: preserveOutput ? result.stdout : result.stdout.trim(), stderr: preserveOutput ? result.stderr : result.stderr.trim() }
    }
    const result = await execFileAsync(program, args, { ...commandOptions, cwd: runtime.workingDirectory })
    return { stdout: preserveOutput ? result.stdout : result.stdout.trim(), stderr: preserveOutput ? result.stderr : result.stderr.trim() }
  } catch (error) {
    const detail = [error.stderr, error.stdout, error.message].filter(Boolean).join('\n').trim()
    const wrapped = new Error(detail || `Não foi possível executar ${command}.`)
    wrapped.code = error.code === 'ENOENT' || error.code === 127 ? 'COMMAND_NOT_FOUND' : 'COMMAND_FAILED'
    wrapped.command = command
    wrapped.exitCode = typeof error.code === 'number' ? error.code : null
    throw wrapped
  }
}

async function executablePath(root, command, options = {}) {
  const runtime = runtimeFor(root, options.runtime)
  const locator = runtime.kind === 'wsl' || process.platform !== 'win32' ? 'which' : 'where.exe'
  return run(root, locator, [command], { runtime })
    .then((result) => result.stdout.split(/\r?\n/).find(Boolean) || '')
    .catch(() => '')
}

function spawnLongRunning(root, command, args = [], options = {}) {
  const runtime = runtimeFor(root, options.runtime)
  const program = options.executable || command
  if (runtime.kind === 'wsl' && process.platform === 'win32') {
    return spawn('wsl.exe', wslCommandArgs(runtime, program, args), {
      windowsHide: true,
      stdio: 'ignore',
    })
  }
  return spawn(program, args, { cwd: runtime.workingDirectory, stdio: 'ignore' })
}

module.exports = { commandEnvironment, executablePath, nativeWorkingDirectory, run, runtimeFor, spawnLongRunning, wslCommandArgs, wslWorkingDirectory }
