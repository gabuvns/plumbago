const fs = require('node:fs/promises')
const path = require('node:path')
const { githubRequest } = require('../core/http.cjs')
const { run } = require('../core/runtime.cjs')
const {
  defaultGitHubPagesUrl,
  githubAccount,
  githubPagesWorkflow,
  githubWorkflowStatus,
  parseGitHubRemote,
} = require('./github.cjs')
const { gitReadiness, requireGitRepository } = require('./git.cjs')
const { ensureBundleLanguages } = require('./languages.cjs')
const { siteReview } = require('./review.cjs')
const { hostingSettings, saveHostingSettings, siteMetadata, updateSiteConfig, validateBlog } = require('./site.cjs')

async function createGitHubRepository(root, token, input) {
  await requireGitRepository(root)
  const name = String(input?.name || '').trim()
  if (!/^[A-Za-z0-9_.-]{1,100}$/.test(name)) throw new Error('Choose a valid repository name.')
  await ensureGitHubIdentity(root, token)
  const repository = await githubRequest(token, '/user/repos', {
    method: 'POST',
    body: {
      name,
      description: String(input?.description || '').trim(),
      private: Boolean(input?.private),
      has_issues: true,
      has_projects: false,
      has_wiki: false,
    },
  })
  const remote = input?.protocol === 'https' ? repository.clone_url : repository.ssh_url
  const config = await saveGitConfig(root, { remote })
  return {
    repository: {
      fullName: repository.full_name,
      name: repository.name,
      owner: repository.owner.login,
      private: repository.private,
      empty: true,
      defaultBranch: repository.default_branch || '',
      url: repository.html_url,
      sshUrl: repository.ssh_url,
      cloneUrl: repository.clone_url,
    },
    config,
  }
}

async function connectGitHubRepository(root, token, fullName, protocol = 'https') {
  await requireGitRepository(root)
  if (!/^[\w.-]+\/[\w.-]+$/.test(String(fullName || ''))) throw new Error('Choose a valid GitHub repository.')
  const repository = await githubRequest(token, `/repos/${fullName}`)
  if (!repository.permissions?.push) throw new Error('Your GitHub account does not have permission to publish to this repository.')
  const currentRemote = await run(root, 'git', ['remote', 'get-url', 'origin']).then((result) => result.stdout).catch(() => '')
  const currentRepository = parseGitHubRemote(currentRemote)
  if (Number(repository.size || 0) > 0 && currentRepository?.fullName.toLowerCase() !== repository.full_name.toLowerCase()) {
    throw new Error('This repository already contains files. Clone or open that repository first so Plumbago never overwrites unrelated history.')
  }
  await ensureGitHubIdentity(root, token)
  const remote = protocol === 'https' ? repository.clone_url : repository.ssh_url
  const config = await saveGitConfig(root, { remote })
  return {
    repository: {
      fullName: repository.full_name,
      name: repository.name,
      owner: repository.owner.login,
      private: repository.private,
      empty: Number(repository.size || 0) === 0,
      defaultBranch: repository.default_branch || '',
      url: repository.html_url,
    },
    config,
  }
}

function githubGitEnvironment(token) {
  const value = String(token || '').trim()
  if (!value) return {}
  const authorization = Buffer.from(`x-access-token:${value}`).toString('base64')
  return {
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
    GIT_CONFIG_VALUE_0: `Authorization: Basic ${authorization}`,
    GIT_TERMINAL_PROMPT: '0',
  }
}

async function ensureGitHubIdentity(root, token) {
  const config = await gitConfig(root)
  if (config.name && config.email) return config
  const account = await githubAccount(token)
  return saveGitConfig(root, {
    name: config.name || account.name,
    email: config.email || account.commitEmail,
  })
}

async function configureGitHubPages(root, token) {
  const context = await validateBlog(root)
  const status = await gitStatus(root)
  const repository = parseGitHubRemote(status.remote)
  if (!repository) throw new Error('Connect this blog to a GitHub repository first.')
  await githubRequest(token, `/repos/${repository.fullName}`)

  const branch = status.branch || 'main'
  const hugoVersion = context.hugo?.match(/hugo v(\d+\.\d+\.\d+)/i)?.[1] || '0.128.0'
  const workflowDirectory = path.join(root, '.github', 'workflows')
  const workflowPath = path.join(workflowDirectory, 'plumbago-pages.yml')
  const workflowContents = githubPagesWorkflow(branch, hugoVersion)
  const previousWorkflow = await fs.readFile(workflowPath, 'utf8').catch(() => '')
  const workflowChanged = previousWorkflow !== workflowContents
  await fs.mkdir(workflowDirectory, { recursive: true })
  if (workflowChanged) await fs.writeFile(workflowPath, workflowContents, 'utf8')
  const liveUrl = defaultGitHubPagesUrl(repository)
  await updateSiteConfig(root, { baseURL: liveUrl })
  await saveHostingSettings(root, { hostingProvider: 'github-pages', publicUrl: liveUrl })

  let warning = ''
  try {
    try {
      await githubRequest(token, `/repos/${repository.fullName}/pages`)
      await githubRequest(token, `/repos/${repository.fullName}/pages`, { method: 'PUT', body: { build_type: 'workflow' } })
    } catch (error) {
      if (error.status !== 404) throw error
      await githubRequest(token, `/repos/${repository.fullName}/pages`, { method: 'POST', body: { build_type: 'workflow' } })
    }
  } catch (error) {
    warning = error.message
  }

  return {
    branch,
    hugoVersion,
    liveUrl,
    repository,
    warning,
    workflowChanged,
    workflow: '.github/workflows/plumbago-pages.yml',
  }
}

async function gitStatus(root) {
  await requireGitRepository(root)
  const branch = await run(root, 'git', ['branch', '--show-current']).then((result) => result.stdout).catch(() => '')
  const remote = await run(root, 'git', ['remote', 'get-url', 'origin']).then((result) => result.stdout).catch(() => '')
  const changes = await run(root, 'git', ['status', '--porcelain=v1']).then((result) => result.stdout.split('\n').filter(Boolean)).catch(() => [])
  return { branch, remote, changes }
}

async function gitConfig(root) {
  await requireGitRepository(root)
  const status = await gitStatus(root)
  const [name, email] = await Promise.all([
    run(root, 'git', ['config', '--local', '--get', 'user.name']).then((result) => result.stdout).catch(() => ''),
    run(root, 'git', ['config', '--local', '--get', 'user.email']).then((result) => result.stdout).catch(() => ''),
  ])
  return { ...status, name, email }
}

async function saveGitConfig(root, config) {
  await requireGitRepository(root)
  const name = String(config.name || '').trim()
  const email = String(config.email || '').trim()
  const remote = String(config.remote || '').trim()

  if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new Error('Informe um e-mail Git válido.')
  if (name) await run(root, 'git', ['config', '--local', 'user.name', name])
  if (email) await run(root, 'git', ['config', '--local', 'user.email', email])

  if (remote) {
    const hasOrigin = await run(root, 'git', ['remote']).then((result) => result.stdout.split('\n').includes('origin'))
    await run(root, 'git', hasOrigin ? ['remote', 'set-url', 'origin', remote] : ['remote', 'add', 'origin', remote])
  }
  return gitConfig(root)
}

async function syncGit(root, message, options = {}) {
  await requireGitRepository(root)
  const log = []
  await run(root, 'git', ['add', '--all'])
  const staged = await run(root, 'git', ['diff', '--cached', '--name-only'])
  if (staged.stdout) {
    await run(root, 'git', ['commit', '-m', message?.trim() || 'Atualiza conteúdo pelo Plumbago'])
    log.push('Alterações salvas em um commit.')
  } else {
    log.push('Nenhuma alteração local para salvar.')
  }

  const remotes = await run(root, 'git', ['remote']).then((result) => result.stdout.split('\n').filter(Boolean))
  if (!remotes.includes('origin')) throw new Error('Configure um remoto Git chamado origin antes de sincronizar.')
  const remote = await run(root, 'git', ['remote', 'get-url', 'origin']).then((result) => result.stdout)
  const authenticatedGit = /^https:\/\/github\.com\//i.test(remote) && options.githubToken
    ? { env: githubGitEnvironment(options.githubToken) }
    : {}

  const hasUpstream = await run(root, 'git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'])
    .then(() => true)
    .catch(() => false)
  if (hasUpstream) {
    try {
      await run(root, 'git', ['pull', '--rebase'], authenticatedGit)
    } catch (error) {
      await run(root, 'git', ['rebase', '--abort']).catch(() => {})
      throw new Error(`O Git encontrou um conflito ao trazer as novidades remotas e desfez o rebase com segurança.\n${error.message}`)
    }
    log.push('Novidades remotas aplicadas.')
    await run(root, 'git', ['push'], authenticatedGit)
  } else {
    await run(root, 'git', ['push', '--set-upstream', 'origin', 'HEAD'], authenticatedGit)
  }
  log.push('Conteúdo enviado ao repositório remoto.')
  return { log, status: await gitStatus(root) }
}

async function publishingStatus(root) {
  const status = await gitStatus(root)
  const repository = parseGitHubRemote(status.remote)
  const metadata = await siteMetadata(root)
  const hosting = await hostingSettings(root, metadata.baseURL)
  const deployment = hosting.hostingProvider === 'github-pages'
    ? await githubWorkflowStatus(repository, status.branch)
    : { state: 'unavailable', conclusion: '', runUrl: '', updatedAt: '' }
  return { ...status, repository, site: { ...metadata, ...hosting }, liveUrl: hosting.publicUrl, deployment }
}

async function publishBlog(root, message, options = {}) {
  const languages = await ensureBundleLanguages(root)
  await validateBlog(root)
  const review = await siteReview(root)
  if (review.summary.errors > 0) {
    const error = new Error(`Resolve ${review.summary.errors} blocking site review finding${review.summary.errors === 1 ? '' : 's'} before publishing.`)
    error.code = 'REVIEW_BLOCKED'
    error.review = review
    throw error
  }
  await run(root, 'hugo', ['--renderToMemory', '--minify'])
  const synced = await syncGit(root, message, options)
  return {
    log: [
      ...(languages.changed ? ['Hugo language settings updated so page-bundle images publish correctly.'] : []),
      'Hugo build completed successfully.',
      ...synced.log,
    ],
    status: await publishingStatus(root),
  }
}

async function publishingHealth(root) {
  const checks = []
  const result = (publishing = null) => ({
    checks,
    ready: checks.every((check) => check.state !== 'error'),
    score: checks.filter((check) => check.state === 'ok').length,
    total: checks.length,
    publishing,
  })
  let context
  try {
    context = await validateBlog(root)
    checks.push({ id: 'hugo', state: context.hugo ? 'ok' : 'error', detail: context.hugo || 'Hugo was not found.', action: 'hugo' })
  } catch (error) {
    return { checks: [{ id: 'blog', state: 'error', detail: error.message, action: 'settings' }], ready: false }
  }

  const readiness = await gitReadiness(root)
  checks.push({
    id: 'git',
    state: readiness.git.status === 'ready' ? 'ok' : 'error',
    detail: readiness.git.version || readiness.git.details || `Git was not found in ${readiness.environment.label}.`,
    action: 'git',
  })
  if (readiness.git.status !== 'ready') return result()

  checks.push({
    id: 'repository',
    state: readiness.repository.status === 'ready' ? 'ok' : readiness.repository.ready ? 'warning' : 'error',
    detail: readiness.repository.status === 'ready'
      ? 'This blog has its own Git repository.'
      : readiness.repository.status === 'parent-repository'
        ? `This blog is part of the repository at ${readiness.repository.topLevel}.`
        : readiness.repository.details || 'Initialize version history before publishing.',
    action: readiness.repository.ready ? 'settings' : 'git',
  })
  if (!readiness.repository.ready) return result()

  const config = await gitConfig(root)
  checks.push({
    id: 'identity',
    state: config.name && config.email ? 'ok' : 'warning',
    detail: config.name && config.email ? `${config.name} · ${config.email}` : 'Add an author name and email for version history.',
    action: 'settings',
  })
  checks.push({
    id: 'remote',
    state: config.remote ? 'ok' : 'error',
    detail: config.remote || 'Connect a remote repository before publishing.',
    action: 'github',
  })
  const repository = parseGitHubRemote(config.remote)
  checks.push({
    id: 'github',
    state: repository ? 'ok' : config.remote ? 'warning' : 'error',
    detail: repository?.fullName || (config.remote ? 'This repository is not hosted on GitHub.' : 'No GitHub repository is connected.'),
    action: 'github',
  })
  const metadata = await siteMetadata(root)
  const hosting = await hostingSettings(root, metadata.baseURL)
  const workflowExists = Boolean(await fs.stat(path.join(root, '.github', 'workflows', 'plumbago-pages.yml')).catch(() => null))
  const externalHosting = ['cloudflare-pages', 'other'].includes(hosting.hostingProvider)
  checks.push({
    id: 'workflow',
    state: workflowExists || externalHosting ? 'ok' : 'warning',
    detail: externalHosting
      ? `The public address is managed by ${hosting.hostingProvider === 'cloudflare-pages' ? 'Cloudflare Pages' : 'an external hosting service'}.`
      : workflowExists ? 'The GitHub Pages workflow is ready.' : 'Automatic website deployment is not configured yet.',
    action: 'github',
  })
  try {
    await run(root, 'hugo', ['--renderToMemory', '--minify'])
    checks.push({ id: 'build', state: 'ok', detail: 'Hugo built the website successfully.', action: 'preview' })
  } catch (error) {
    checks.push({ id: 'build', state: 'error', detail: error.message, action: 'preview' })
  }
  const publishing = await publishingStatus(root)
  const deploymentState = publishing.deployment.state
  checks.push({
    id: 'deployment',
    state: deploymentState === 'live' ? 'ok' : deploymentState === 'failed' ? 'error' : 'warning',
    detail: deploymentState === 'live'
      ? 'The latest GitHub Pages deployment is live.'
      : deploymentState === 'deploying'
        ? 'GitHub is currently building the website.'
        : deploymentState === 'failed'
          ? 'The latest website deployment failed.'
          : 'Publish once to verify the live website.',
    action: 'publish',
  })
  return result(publishing)
}

module.exports = {
  configureGitHubPages,
  connectGitHubRepository,
  createGitHubRepository,
  gitConfig,
  gitStatus,
  ensureGitHubIdentity,
  githubGitEnvironment,
  publishBlog,
  publishingHealth,
  publishingStatus,
  saveGitConfig,
  syncGit,
}
