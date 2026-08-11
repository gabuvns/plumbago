const fs = require('node:fs/promises')
const path = require('node:path')
const { hash: blake3Hash } = require('blake3-wasm')
const mime = require('mime-types')
const { version } = require('../../package.json')

const API_ROOT = 'https://api.cloudflare.com/client/v4'
const MAX_ASSET_SIZE = 25 * 1024 * 1024
const DEFAULT_FILE_LIMIT = 20_000
const UPLOAD_BUCKET_SIZE = 45 * 1024 * 1024
const UPLOAD_BUCKET_FILES = 500
const SPECIAL_FILES = new Set(['_headers', '_redirects', '_routes.json', '_worker.js'])
const IGNORE_DIRECTORIES = new Set(['.git', 'node_modules', '.wrangler'])

function assertCloudflareAccountId(accountId) {
  const value = String(accountId || '')
  if (!/^[a-f0-9]{32}$/i.test(value)) throw new Error('Choose a valid Cloudflare account.')
  return value
}

function cloudflareErrorMessage(status, payload) {
  const details = (payload?.errors || []).map((item) => item.message).filter(Boolean).join(' ')
  const fallback = status === 401 || status === 403
    ? 'Cloudflare denied this action. Create a token with Account Settings Read and Cloudflare Pages Edit permissions, then connect it again.'
    : status === 429
      ? 'Cloudflare API limits were reached. Wait a moment and try again.'
      : `Cloudflare returned HTTP ${status}.`
  return [fallback, details && details !== fallback ? details : ''].filter(Boolean).join(' ')
}

async function requestCloudflare(route, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeout || 30_000)
  const headers = {
    Accept: 'application/json',
    'User-Agent': `Plumbago-Hugo-UI/${version}`,
    ...(options.authorization ? { Authorization: `Bearer ${options.authorization}` } : {}),
    ...(options.headers || {}),
  }
  const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData
  if (options.body && !isForm && !headers['Content-Type']) headers['Content-Type'] = 'application/json'
  try {
    const response = await fetch(`${API_ROOT}${route}`, {
      method: options.method || 'GET',
      headers,
      body: options.body && !isForm && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body,
      signal: controller.signal,
    })
    const payload = response.status === 204 ? { success: true, result: null } : await response.json().catch(() => null)
    if (!response.ok || payload?.success === false) {
      const error = new Error(cloudflareErrorMessage(response.status, payload))
      error.status = response.status
      error.code = payload?.errors?.[0]?.code
      throw error
    }
    return payload?.result
  } finally {
    clearTimeout(timeout)
  }
}

async function cloudflareTokenStatus(token) {
  const value = String(token || '').trim()
  if (value.length < 20 || value.length > 512) throw new Error('Enter a valid Cloudflare API token.')
  const result = await requestCloudflare('/user/tokens/verify', { authorization: value })
  if (result?.status !== 'active') throw new Error('This Cloudflare API token is not active.')
  return { active: true, id: result.id || '' }
}

async function listCloudflareAccounts(token) {
  const accounts = await requestCloudflare('/accounts?per_page=50', { authorization: token })
  return (accounts || []).map((account) => ({ id: account.id, name: account.name || account.id }))
}

function normalizeCloudflareProject(project = {}) {
  const subdomain = String(project.subdomain || (project.name ? `${project.name}.pages.dev` : ''))
  return {
    id: String(project.id || project.name || ''),
    name: String(project.name || ''),
    subdomain,
    liveUrl: subdomain ? `https://${subdomain.replace(/^https?:\/\//, '').replace(/\/$/, '')}/` : '',
    productionBranch: String(project.production_branch || 'main'),
    directUpload: !project.source,
    sourceType: String(project.source?.type || ''),
    createdAt: String(project.created_on || ''),
  }
}

async function listCloudflareProjects(token, accountId) {
  const validAccountId = assertCloudflareAccountId(accountId)
  const projects = await requestCloudflare(`/accounts/${validAccountId}/pages/projects?per_page=100`, { authorization: token })
  return (projects || []).map(normalizeCloudflareProject)
}

async function ensureCloudflareProject(token, accountId, name, productionBranch = 'main') {
  const validAccountId = assertCloudflareAccountId(accountId)
  const projectName = String(name || '').trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9-]{0,57}[a-z0-9]$|^[a-z0-9]$/.test(projectName)) {
    throw new Error('Use 1-59 lowercase letters, numbers, or hyphens for the Cloudflare project name.')
  }
  try {
    const existing = await requestCloudflare(`/accounts/${validAccountId}/pages/projects/${projectName}`, { authorization: token })
    return { project: normalizeCloudflareProject(existing), created: false }
  } catch (error) {
    if (error.status !== 404 && error.code !== 8000007) throw error
  }
  try {
    const created = await requestCloudflare(`/accounts/${validAccountId}/pages/projects`, {
      method: 'POST',
      authorization: token,
      body: { name: projectName, production_branch: productionBranch || 'main' },
    })
    return { project: normalizeCloudflareProject(created), created: true }
  } catch (error) {
    if (error.status !== 409) throw error
    const existing = await requestCloudflare(`/accounts/${validAccountId}/pages/projects/${projectName}`, { authorization: token })
    return { project: normalizeCloudflareProject(existing), created: false }
  }
}

function cloudflareFileHash(contents, fileName) {
  const buffer = Buffer.isBuffer(contents) ? contents : Buffer.from(contents)
  const extension = path.extname(fileName).slice(1)
  return blake3Hash(buffer.toString('base64') + extension).toString('hex').slice(0, 32)
}

function jwtFileLimit(token) {
  try {
    const encoded = String(token || '').split('.')[1]
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
    return Number(payload.max_file_count_allowed || DEFAULT_FILE_LIMIT)
  } catch {
    return DEFAULT_FILE_LIMIT
  }
}

async function collectPagesAssets(directory, fileLimit = DEFAULT_FILE_LIMIT) {
  const root = path.resolve(directory)
  const assets = []
  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      const absolute = path.join(current, entry.name)
      const relative = path.relative(root, absolute).split(path.sep).join('/')
      if (entry.isSymbolicLink()) continue
      if (entry.isDirectory()) {
        if (!IGNORE_DIRECTORIES.has(entry.name)) await walk(absolute)
        continue
      }
      if (!entry.isFile() || entry.name === '.DS_Store' || SPECIAL_FILES.has(relative)) continue
      const stat = await fs.stat(absolute)
      if (stat.size > MAX_ASSET_SIZE) throw new Error(`${relative} exceeds Cloudflare Pages' 25 MiB per-file limit.`)
      const contents = await fs.readFile(absolute)
      assets.push({
        path: absolute,
        name: relative,
        size: stat.size,
        hash: cloudflareFileHash(contents, relative),
        contentType: mime.lookup(relative) || 'application/octet-stream',
      })
      if (assets.length > fileLimit) throw new Error(`This site contains more than Cloudflare Pages' ${fileLimit.toLocaleString()} file limit for the current account.`)
    }
  }
  await walk(root)
  return assets
}

function buildUploadBuckets(assets) {
  const buckets = []
  let current = []
  let size = 0
  for (const asset of [...assets].sort((left, right) => right.size - left.size)) {
    if (current.length && (current.length >= UPLOAD_BUCKET_FILES || size + asset.size > UPLOAD_BUCKET_SIZE)) {
      buckets.push(current)
      current = []
      size = 0
    }
    current.push(asset)
    size += asset.size
  }
  if (current.length) buckets.push(current)
  return buckets
}

async function uploadCloudflareAssets(token, accountId, projectName, directory, onProgress = () => {}) {
  const validAccountId = assertCloudflareAccountId(accountId)
  const uploadToken = await requestCloudflare(`/accounts/${validAccountId}/pages/projects/${projectName}/upload-token`, { authorization: token })
  const jwt = uploadToken?.jwt
  if (!jwt) throw new Error('Cloudflare did not provide a Pages upload token.')
  const assets = await collectPagesAssets(directory, jwtFileLimit(jwt))
  const hashes = assets.map((asset) => asset.hash)
  const missing = await requestCloudflare('/pages/assets/check-missing', {
    method: 'POST',
    authorization: jwt,
    body: { hashes },
  })
  const missingSet = new Set(missing || [])
  const buckets = buildUploadBuckets(assets.filter((asset) => missingSet.has(asset.hash)))
  let uploaded = assets.length - missingSet.size
  await onProgress({ uploaded, total: assets.length, cached: uploaded })
  for (const bucket of buckets) {
    const payload = await Promise.all(bucket.map(async (asset) => ({
      key: asset.hash,
      value: (await fs.readFile(asset.path)).toString('base64'),
      metadata: { contentType: asset.contentType },
      base64: true,
    })))
    await requestCloudflare('/pages/assets/upload', { method: 'POST', authorization: jwt, body: payload, timeout: 90_000 })
    uploaded += bucket.length
    await onProgress({ uploaded, total: assets.length, cached: assets.length - missingSet.size })
  }
  let warning = ''
  try {
    await requestCloudflare('/pages/assets/upsert-hashes', { method: 'POST', authorization: jwt, body: { hashes } })
  } catch (error) {
    warning = `Cloudflare could not cache uploaded hashes; this deployment is safe, but the next upload may take longer. ${error.message}`
  }
  return {
    manifest: Object.fromEntries(assets.map((asset) => [`/${asset.name}`, asset.hash])),
    assets,
    warning,
  }
}

async function optionalSpecialFile(directory, name) {
  const contents = await fs.readFile(path.join(directory, name)).catch(() => null)
  return contents ? new Blob([contents]) : null
}

async function createCloudflareDeployment(token, input) {
  const accountId = assertCloudflareAccountId(input.accountId)
  const uploaded = await uploadCloudflareAssets(token, input.accountId, input.projectName, input.directory, input.onProgress)
  const form = new FormData()
  form.append('manifest', JSON.stringify(uploaded.manifest))
  if (input.branch) form.append('branch', input.branch)
  if (input.commitHash) form.append('commit_hash', input.commitHash)
  if (input.commitMessage) form.append('commit_message', String(input.commitMessage).slice(0, 384))
  form.append('commit_dirty', input.commitDirty ? 'true' : 'false')
  for (const name of ['_headers', '_redirects', '_routes.json']) {
    const file = await optionalSpecialFile(input.directory, name)
    if (file) form.append(name, file, name)
  }
  const deployment = await requestCloudflare(`/accounts/${accountId}/pages/projects/${input.projectName}/deployments`, {
    method: 'POST',
    authorization: token,
    body: form,
    timeout: 90_000,
  })
  return { deployment, warning: uploaded.warning, totalFiles: uploaded.assets.length }
}

async function getCloudflareDeployment(token, accountId, projectName, deploymentId) {
  const validAccountId = assertCloudflareAccountId(accountId)
  return requestCloudflare(`/accounts/${validAccountId}/pages/projects/${projectName}/deployments/${deploymentId}`, { authorization: token })
}

function cloudflareDeploymentStatus(deployment = {}, project = {}) {
  const stage = deployment.latest_stage || {}
  const live = stage.name === 'deploy' && stage.status === 'success'
  const failed = stage.status === 'failure'
  const pagesAlias = (deployment.aliases || []).find((alias) => String(alias).includes('.pages.dev'))
  const liveUrl = live
    ? pagesAlias
      ? `https://${String(pagesAlias).replace(/^https?:\/\//, '').replace(/\/$/, '')}/`
      : normalizeCloudflareProject(project).liveUrl || String(deployment.url || '')
    : ''
  return {
    state: live ? 'live' : failed ? 'failed' : 'deploying',
    step: stage.name || 'deploy',
    error: failed ? 'Cloudflare could not publish this deployment. Open the deployment details for the provider log.' : '',
    liveUrl,
    updatedAt: String(deployment.modified_on || deployment.created_on || ''),
  }
}

module.exports = {
  MAX_ASSET_SIZE,
  assertCloudflareAccountId,
  buildUploadBuckets,
  cloudflareDeploymentStatus,
  cloudflareErrorMessage,
  cloudflareFileHash,
  cloudflareTokenStatus,
  collectPagesAssets,
  createCloudflareDeployment,
  ensureCloudflareProject,
  getCloudflareDeployment,
  listCloudflareAccounts,
  listCloudflareProjects,
  normalizeCloudflareProject,
  requestCloudflare,
  uploadCloudflareAssets,
}
