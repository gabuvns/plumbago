const fs = require('node:fs/promises')
const path = require('node:path')
const { run, runtimeFor } = require('../core/runtime.cjs')

const GIT_INSTALL_URLS = {
  darwin: 'https://git-scm.com/install/mac',
  linux: 'https://git-scm.com/install/linux',
  win32: 'https://git-scm.com/install/windows',
}

function environmentDetails(runtime) {
  if (runtime.kind === 'wsl') {
    return { kind: 'wsl', distro: runtime.distro, label: `WSL · ${runtime.distro}` }
  }
  const platform = runtime.platform || process.platform
  return { kind: 'native', platform, label: platform }
}

function gitInstallAssistance(runtime) {
  if (runtime.kind === 'wsl') {
    return {
      mode: 'command',
      command: 'sudo apt update && sudo apt install -y git',
      url: GIT_INSTALL_URLS.linux,
    }
  }
  if (runtime.platform === 'win32') {
    return {
      mode: 'automatic',
      command: 'winget install --id Git.Git -e --source winget',
      url: GIT_INSTALL_URLS.win32,
    }
  }
  if (runtime.platform === 'darwin') {
    return {
      mode: 'command',
      command: 'xcode-select --install',
      url: GIT_INSTALL_URLS.darwin,
    }
  }
  return {
    mode: 'command',
    command: 'sudo apt update && sudo apt install -y git',
    url: GIT_INSTALL_URLS.linux,
  }
}

function nativeGitCandidates(runtime) {
  if (runtime.kind !== 'native') return []
  if (runtime.platform === 'win32') {
    return [
      process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Git', 'cmd', 'git.exe'),
      process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'Git', 'cmd', 'git.exe'),
      process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Git', 'cmd', 'git.exe'),
    ].filter(Boolean)
  }
  if (runtime.platform === 'darwin') return ['/usr/bin/git', '/opt/homebrew/bin/git', '/usr/local/bin/git']
  return ['/usr/bin/git', '/usr/local/bin/git', '/snap/bin/git']
}

async function activateKnownGitPath(runtime) {
  for (const candidate of nativeGitCandidates(runtime)) {
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

async function gitVersion(root) {
  const runtime = runtimeFor(root)
  try {
    const result = await run(root, 'git', ['--version'])
    return { status: 'ready', version: result.stdout, executable: 'git', details: '' }
  } catch (error) {
    if (runtime.kind === 'native') {
      const executable = await activateKnownGitPath(runtime)
      if (executable) {
        try {
          const result = await run(root, 'git', ['--version'])
          return { status: 'ready', version: result.stdout, executable, details: '' }
        } catch {
          // Continue with the original, more useful classification below.
        }
      }
    }
    return {
      status: error.code === 'COMMAND_NOT_FOUND' ? 'missing' : 'error',
      version: '',
      executable: '',
      details: error.code === 'COMMAND_NOT_FOUND' ? '' : error.message,
    }
  }
}

function sameRepositoryRoot(root, topLevel, runtime) {
  if (!topLevel) return true
  if (runtime.kind === 'wsl') {
    const normalize = (value) => value.replaceAll('\\', '/').replace(/\/$/, '')
    return normalize(runtime.workingDirectory) === normalize(topLevel)
  }
  return path.resolve(root) === path.resolve(topLevel)
}

async function repositoryReadiness(root) {
  const runtime = runtimeFor(root)
  try {
    const inside = await run(root, 'git', ['rev-parse', '--is-inside-work-tree'])
    if (inside.stdout !== 'true') return { status: 'uninitialized', ready: false, topLevel: '', details: '' }
    const topLevel = await run(root, 'git', ['rev-parse', '--show-toplevel']).then((result) => result.stdout).catch(() => '')
    return {
      status: sameRepositoryRoot(root, topLevel, runtime) ? 'ready' : 'parent-repository',
      ready: true,
      topLevel,
      details: '',
    }
  } catch (error) {
    if (/not a git repository/i.test(error.message)) {
      return { status: 'uninitialized', ready: false, topLevel: '', details: '' }
    }
    return { status: 'error', ready: false, topLevel: '', details: error.message }
  }
}

async function gitReadiness(root) {
  const runtime = runtimeFor(root)
  const git = await gitVersion(root)
  const repository = git.status === 'ready'
    ? await repositoryReadiness(root)
    : { status: 'unknown', ready: false, topLevel: '', details: '' }
  return {
    ready: git.status === 'ready' && repository.ready,
    environment: environmentDetails(runtime),
    git,
    repository,
    assistance: gitInstallAssistance(runtime),
  }
}

async function ensureGitRepository(root) {
  const git = await gitVersion(root)
  if (git.status !== 'ready') throw new Error('Git must be installed before this blog can be initialized.')
  const repository = await repositoryReadiness(root)
  if (repository.ready) return gitReadiness(root)
  if (repository.status === 'error') throw new Error(repository.details || 'Plumbago could not inspect this Git repository.')
  try {
    await run(root, 'git', ['init', '-b', 'main'])
  } catch {
    await run(root, 'git', ['init'])
    await run(root, 'git', ['branch', '-M', 'main'])
  }
  return gitReadiness(root)
}

async function requireGitRepository(root) {
  const readiness = await gitReadiness(root)
  if (readiness.git.status === 'missing') {
    throw new Error(`Git was not found in ${readiness.environment.label}. Open Git setup to install it.`)
  }
  if (readiness.git.status === 'error') throw new Error(readiness.git.details || 'Plumbago could not run Git.')
  if (!readiness.repository.ready) {
    throw new Error('Git is installed, but this blog has not been initialized as a Git repository. Open Git setup to initialize it.')
  }
  return readiness
}

async function installGit(root) {
  const runtime = runtimeFor(root)
  const assistance = gitInstallAssistance(runtime)
  if (assistance.mode !== 'automatic') {
    throw new Error('This environment needs an interactive installation. Copy the suggested command and run it in a terminal.')
  }
  await run(root, 'winget.exe', [
    'install',
    '--id',
    'Git.Git',
    '-e',
    '--source',
    'winget',
    '--accept-package-agreements',
    '--accept-source-agreements',
  ], { timeout: 10 * 60 * 1000 })
  await activateKnownGitPath(runtime)
  return gitReadiness(root)
}

module.exports = {
  ensureGitRepository,
  gitInstallAssistance,
  gitReadiness,
  gitVersion,
  installGit,
  repositoryReadiness,
  requireGitRepository,
}
