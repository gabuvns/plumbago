const fs = require('node:fs/promises')
const path = require('node:path')
const { run } = require('../core/runtime.cjs')
const {
  cloudflareDeploymentStatus,
  cloudflareTokenStatus,
  createCloudflareDeployment,
  ensureCloudflareProject,
  getCloudflareDeployment,
} = require('./cloudflare.cjs')
const {
  githubPagesDetails,
  githubAuthorizationStatus,
  githubWorkflowStatus,
  parseGitHubRemote,
  triggerGitHubPages,
} = require('./github.cjs')
const { configureGitHubPages, gitStatus, syncGit } = require('./publishing.cjs')
const {
  deploymentSettings,
  hostingSettings,
  saveDeploymentSettings,
  saveHostingSettings,
  siteMetadata,
  updateSiteConfig,
  validateBlog,
} = require('./site.cjs')

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
const activeDeployments = new Set()

async function transition(root, patch, logEntry = '') {
  const current = await deploymentSettings(root)
  const log = logEntry ? [...current.log, logEntry] : current.log
  return saveDeploymentSettings(root, { ...patch, log })
}

async function beginDeployment(root, provider, context = {}) {
  const current = await deploymentSettings(root)
  return saveDeploymentSettings(root, {
    provider,
    state: 'preflight',
    step: 'preflight',
    progress: 5,
    log: ['Checking the Hugo build and deployment settings.'],
    error: '',
    warning: '',
    liveUrl: '',
    deploymentId: '',
    dashboardUrl: '',
    customDomainUrl: '',
    attempt: current.attempt + 1,
    startedAt: new Date().toISOString(),
    ...context,
  })
}

function githubRepositoryFromName(fullName) {
  return parseGitHubRemote(`https://github.com/${fullName}.git`)
}

async function refreshGitHubDeployment(root, current, token) {
  const repository = githubRepositoryFromName(current.repository)
  if (!repository || !token) return current
  const status = await githubWorkflowStatus(repository, '', token, current.startedAt)
  if (status.state === 'live') {
    const pages = await githubPagesDetails(token, repository).catch(() => ({ liveUrl: current.liveUrl, customDomain: '' }))
    await saveHostingSettings(root, { hostingProvider: 'github-pages', publicUrl: pages.liveUrl || current.liveUrl })
    return transition(root, {
      state: 'live',
      step: 'verified',
      progress: 100,
      liveUrl: pages.liveUrl || current.liveUrl,
      dashboardUrl: status.runUrl || current.dashboardUrl,
      customDomainUrl: `https://github.com/${repository.fullName}/settings/pages`,
      error: '',
    }, 'GitHub Pages is live and the public address was verified.')
  }
  if (status.state === 'failed') {
    return transition(root, {
      state: 'failed',
      step: 'deploy',
      progress: 80,
      dashboardUrl: status.runUrl || current.dashboardUrl,
      error: 'The GitHub Pages build failed. Open the build details to see the failing Hugo step.',
    }, 'GitHub reported a failed website build.')
  }
  return { ...current, dashboardUrl: status.runUrl || current.dashboardUrl }
}

async function refreshCloudflareDeployment(root, current, token) {
  if (!token || !current.accountId || !current.projectName || !current.deploymentId) return current
  const deployment = await getCloudflareDeployment(token, current.accountId, current.projectName, current.deploymentId)
  const subdomain = current.liveUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
  const status = cloudflareDeploymentStatus(deployment, { name: current.projectName, subdomain })
  if (status.state === 'live') {
    await saveHostingSettings(root, { hostingProvider: 'cloudflare-pages', publicUrl: status.liveUrl || current.liveUrl })
    return transition(root, {
      state: 'live',
      step: 'verified',
      progress: 100,
      liveUrl: status.liveUrl || current.liveUrl,
      error: '',
    }, 'Cloudflare Pages is live and the public address was verified.')
  }
  if (status.state === 'failed') {
    return transition(root, { state: 'failed', step: 'deploy', progress: 80, error: status.error }, 'Cloudflare reported a failed deployment.')
  }
  return current
}

async function deploymentStatus(root, credentials = {}) {
  let current = await deploymentSettings(root)
  if (!current.provider) {
    const metadata = await siteMetadata(root)
    const hosting = await hostingSettings(root, metadata.baseURL)
    if (hosting.hostingConfigured && ['github-pages', 'cloudflare-pages'].includes(hosting.hostingProvider)) {
      current = {
        ...current,
        provider: hosting.hostingProvider,
        state: 'live',
        step: 'verified',
        progress: 100,
        liveUrl: hosting.publicUrl,
      }
    }
    return current
  }
  const key = path.resolve(root)
  if (['preflight', 'provisioning', 'uploading'].includes(current.state) && !activeDeployments.has(key)) {
    return transition(root, {
      state: 'failed',
      error: 'The previous local deployment was interrupted. No partial local process is still running; try the deployment again safely.',
    }, 'Detected an interrupted local deployment after Plumbago restarted.')
  }
  if (current.state !== 'deploying') return current
  if (current.provider === 'github-pages') return refreshGitHubDeployment(root, current, credentials.githubToken)
  if (current.provider === 'cloudflare-pages') return refreshCloudflareDeployment(root, current, credentials.cloudflareToken)
  return current
}

async function deployGitHubPages(root, token) {
  if (!token) throw new Error('Connect GitHub before deploying with GitHub Pages.')
  const authorization = await githubAuthorizationStatus(token)
  if (!authorization.repository || !authorization.workflow) {
    throw new Error('Reconnect GitHub to grant the repository and workflow permissions required for one-click deployment.')
  }
  const context = await validateBlog(root)
  await run(root, 'hugo', ['--renderToMemory', '--minify'])
  await transition(root, { state: 'provisioning', step: 'provider', progress: 20 }, `Hugo ${context.hugo || ''} built the site successfully.`)

  const configured = await configureGitHubPages(root, token)
  await transition(root, {
    repository: configured.repository.fullName,
    liveUrl: configured.liveUrl,
    dashboardUrl: `https://github.com/${configured.repository.fullName}/actions`,
    customDomainUrl: `https://github.com/${configured.repository.fullName}/settings/pages`,
    warning: configured.warning,
    progress: 38,
  }, configured.workflowChanged ? 'Added the official Hugo workflow for GitHub Pages.' : 'The existing GitHub Pages workflow is already current.')

  await syncGit(root, 'Configure one-click deployment with Plumbago', { githubToken: token })
  await transition(root, { step: 'upload', progress: 58 }, 'Uploaded the deployment workflow and production URL to GitHub.')

  try {
    await triggerGitHubPages(token, configured.repository, configured.branch)
    await transition(root, {}, 'Asked GitHub to start a fresh website deployment.')
  } catch (error) {
    await transition(root, { warning: [configured.warning, error.message].filter(Boolean).join(' ') }, 'The source push will trigger GitHub Pages automatically.')
  }

  await transition(root, { state: 'deploying', step: 'deploy', progress: 70 }, 'GitHub is building the public website.')
  for (let attempt = 0; attempt < 45; attempt += 1) {
    await delay(4_000)
    const current = await deploymentStatus(root, { githubToken: token })
    if (['live', 'failed'].includes(current.state)) return current
  }
  return transition(root, { warning: 'The build is taking longer than expected. Plumbago will keep checking when this screen is open.' }, 'The deployment is still running safely on GitHub.')
}

function safeBuildDirectory(root) {
  const resolvedRoot = path.resolve(root)
  const output = path.resolve(resolvedRoot, '.plumbago-build')
  if (path.dirname(output) !== resolvedRoot || path.basename(output) !== '.plumbago-build') throw new Error('Could not create a safe temporary build directory.')
  return output
}

async function gitDeploymentMetadata(root) {
  const [status, commitHash, commitMessage] = await Promise.all([
    gitStatus(root).catch(() => ({ branch: 'main', changes: [] })),
    run(root, 'git', ['rev-parse', 'HEAD']).then((result) => result.stdout).catch(() => ''),
    run(root, 'git', ['show', '-s', '--format=%B', 'HEAD']).then((result) => result.stdout).catch(() => ''),
  ])
  return {
    branch: status.branch || 'main',
    commitHash,
    commitMessage: commitMessage || 'Deploy website with Plumbago',
    commitDirty: Boolean(status.changes?.length),
  }
}

async function deployCloudflarePages(root, token, input) {
  if (!token) throw new Error('Connect Cloudflare before deploying with Cloudflare Pages.')
  await cloudflareTokenStatus(token)
  await validateBlog(root)
  const git = await gitDeploymentMetadata(root)
  const ensured = await ensureCloudflareProject(token, input.accountId, input.projectName, git.branch)
  const project = ensured.project
  await transition(root, {
    state: 'provisioning',
    step: 'provider',
    progress: 20,
    accountId: input.accountId,
    projectName: project.name,
    liveUrl: project.liveUrl,
    dashboardUrl: `https://dash.cloudflare.com/${input.accountId}/pages/view/${project.name}`,
    customDomainUrl: `https://dash.cloudflare.com/${input.accountId}/pages/view/${project.name}/domains`,
  }, ensured.created ? `Created the ${project.name} project without Git integration.` : `Reusing the existing ${project.name} Pages project.`)

  await updateSiteConfig(root, { baseURL: project.liveUrl })
  await saveHostingSettings(root, { hostingProvider: 'cloudflare-pages', publicUrl: project.liveUrl })
  const output = safeBuildDirectory(root)
  await fs.rm(output, { recursive: true, force: true })
  try {
    await run(root, 'hugo', ['--gc', '--minify', '--destination', '.plumbago-build', '--baseURL', project.liveUrl])
    await transition(root, { state: 'uploading', step: 'build', progress: 35 }, 'Built the production Hugo site locally with its final address.')
    const created = await createCloudflareDeployment(token, {
      accountId: input.accountId,
      projectName: project.name,
      directory: output,
      ...git,
      onProgress: ({ uploaded, total, cached }) => transition(root, {
        state: 'uploading',
        step: 'upload',
        progress: total ? 38 + Math.round((uploaded / total) * 34) : 68,
      }, uploaded === total ? `Prepared ${total} website files (${cached} reused from Cloudflare's cache).` : `Uploaded ${uploaded} of ${total} website files.`),
    })
    await transition(root, {
      state: 'deploying',
      step: 'deploy',
      progress: 78,
      deploymentId: created.deployment.id,
      warning: created.warning,
    }, `Cloudflare accepted deployment ${created.deployment.short_id || created.deployment.id}.`)
    for (let attempt = 0; attempt < 45; attempt += 1) {
      await delay(2_000)
      const current = await deploymentStatus(root, { cloudflareToken: token })
      if (['live', 'failed'].includes(current.state)) return current
    }
    return transition(root, { warning: 'Cloudflare accepted the files but is taking longer than expected to confirm the public address.' }, 'The deployment remains active on Cloudflare.')
  } finally {
    await fs.rm(output, { recursive: true, force: true })
  }
}

async function deploySite(root, input, credentials = {}) {
  const provider = String(input?.provider || '')
  if (!['github-pages', 'cloudflare-pages'].includes(provider)) throw new Error('Choose GitHub Pages or Cloudflare Pages.')
  const key = path.resolve(root)
  if (activeDeployments.has(key)) throw new Error('A deployment is already running for this blog.')
  activeDeployments.add(key)
  try {
    await beginDeployment(root, provider, provider === 'cloudflare-pages' ? { accountId: input.accountId, projectName: input.projectName } : {})
    return provider === 'github-pages'
      ? await deployGitHubPages(root, credentials.githubToken)
      : await deployCloudflarePages(root, credentials.cloudflareToken, input)
  } catch (error) {
    await transition(root, { state: 'failed', error: error.message, step: (await deploymentSettings(root)).step || 'preflight' }, `Deployment stopped safely: ${error.message}`)
    throw error
  } finally {
    activeDeployments.delete(key)
  }
}

module.exports = {
  beginDeployment,
  deploySite,
  deploymentStatus,
  safeBuildDirectory,
  transition,
}
