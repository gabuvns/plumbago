const INSTALL_URLS = {
  linux: 'https://gohugo.io/installation/linux/',
  macOS: 'https://gohugo.io/installation/macos/',
  windows: 'https://gohugo.io/installation/windows/',
}

export function hugoEnvironment(runtime = {}) {
  if (runtime.kind === 'wsl') return `WSL${runtime.distro ? ` (${runtime.distro})` : ''}`
  if (runtime.platform === 'darwin') return 'macOS'
  if (runtime.platform === 'linux') return 'Linux'
  if (runtime.platform === 'win32') return 'Windows'
  return 'Windows'
}

export function hugoInstallUrl(runtime = {}) {
  if (runtime.kind === 'wsl' || runtime.platform === 'linux') return INSTALL_URLS.linux
  if (runtime.platform === 'darwin') return INSTALL_URLS.macOS
  return INSTALL_URLS.windows
}

export function hugoDiagnostics(context = {}) {
  return [
    'Plumbago diagnostics',
    `Blog: ${context.root || 'Not selected'}`,
    `Environment: ${hugoEnvironment(context.runtime)}`,
    `Hugo: ${context.hugo || 'Not found'}`,
    `Hugo executable: ${context.hugoExecutable || 'Not found'}`,
    `Git: ${context.git || 'Not found'}`,
  ].join('\n')
}
