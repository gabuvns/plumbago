const { execFile, spawn } = require('node:child_process')
const { promisify } = require('node:util')

const execFileAsync = promisify(execFile)

function runtimeFor(root) {
  const normalized = root.replaceAll('/', '\\')
  const match = normalized.match(/^\\\\(?:wsl\.localhost|wsl\$)\\([^\\]+)\\(.*)$/i)
  if (match) {
    return { kind: 'wsl', distro: match[1], workingDirectory: `/${match[2].replaceAll('\\', '/')}` }
  }
  return { kind: 'native', platform: process.platform, workingDirectory: root }
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
  const runtime = runtimeFor(root)
  const { env: extraEnvironment, preserveOutput = false, ...executionOptions } = options
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
        wslCommandArgs(runtime, command, args),
        commandOptions,
      )
      return { stdout: preserveOutput ? result.stdout : result.stdout.trim(), stderr: preserveOutput ? result.stderr : result.stderr.trim() }
    }
    const result = await execFileAsync(command, args, { ...commandOptions, cwd: root })
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

async function executablePath(root, command) {
  const runtime = runtimeFor(root)
  const locator = runtime.kind === 'wsl' || process.platform !== 'win32' ? 'which' : 'where.exe'
  return run(root, locator, [command])
    .then((result) => result.stdout.split(/\r?\n/).find(Boolean) || '')
    .catch(() => '')
}

function spawnLongRunning(root, command, args = []) {
  const runtime = runtimeFor(root)
  if (runtime.kind === 'wsl' && process.platform === 'win32') {
    return spawn('wsl.exe', wslCommandArgs(runtime, command, args), {
      windowsHide: true,
      stdio: 'ignore',
    })
  }
  return spawn(command, args, { cwd: root, stdio: 'ignore' })
}

module.exports = { commandEnvironment, executablePath, run, runtimeFor, spawnLongRunning, wslCommandArgs }
