const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')
const { diffLines } = require('diff')
const { run } = require('../core/runtime.cjs')
const { contentPath, readPost } = require('./content.cjs')

const STATE_DIRECTORY = '.plumbago'
const RECOVERY_DIRECTORY = 'recovery'
const MAX_RECOVERY_POINTS = 20
const MAX_REVISION_BYTES = 2 * 1024 * 1024
const CONFIG_FILES = ['hugo.toml', 'hugo.yaml', 'hugo.yml', 'hugo.json', 'config.toml', 'config.yaml', 'config.yml', 'config.json']

function safeRelative(value) {
  const normalized = String(value || '').replaceAll('\\', '/').replace(/^\.\//, '')
  if (!normalized || normalized.startsWith('/') || normalized.split('/').includes('..')) throw new Error('Recovery path is outside this blog.')
  return normalized
}

function localPath(root, relative) {
  const safe = safeRelative(relative)
  const resolvedRoot = path.resolve(root)
  const resolved = path.resolve(resolvedRoot, ...safe.split('/'))
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error('Recovery path is outside this blog.')
  return resolved
}

function safePointId(value) {
  const id = String(value || '')
  if (!/^\d{17}-[a-f0-9]{12}$/.test(id)) throw new Error('Choose a valid recovery point.')
  return id
}

function safeCommit(value) {
  const hash = String(value || '')
  if (!/^[a-f0-9]{40}$/i.test(hash)) throw new Error('Choose a valid saved version.')
  return hash
}

async function ensureStateDirectory(root) {
  const state = localPath(root, STATE_DIRECTORY)
  await fs.mkdir(state, { recursive: true })
  await fs.writeFile(path.join(state, '.gitignore'), '*\n!.gitignore\n', { encoding: 'utf8', flag: 'wx' }).catch((error) => {
    if (error.code !== 'EEXIST') throw error
  })
  return state
}

async function siteConfigurationPaths(root) {
  const entries = new Set(await fs.readdir(root).catch(() => []))
  return [...CONFIG_FILES.filter((file) => entries.has(file)), '.plumbago.json', '.gitmodules']
}

function publicRecoveryPoint(manifest) {
  return {
    id: String(manifest.id || ''),
    reason: String(manifest.reason || 'manual'),
    label: String(manifest.label || ''),
    createdAt: String(manifest.createdAt || ''),
    targets: Array.isArray(manifest.targets) ? manifest.targets.map((target) => String(target.path || '')).filter(Boolean) : [],
  }
}

async function readRecoveryManifest(root, id) {
  const safeId = safePointId(id)
  const manifestPath = path.join(await ensureStateDirectory(root), RECOVERY_DIRECTORY, safeId, 'manifest.json')
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
  if (manifest.id !== safeId || !Array.isArray(manifest.targets)) throw new Error('This recovery point is damaged.')
  return manifest
}

async function pruneRecoveryPoints(root) {
  const directory = path.join(await ensureStateDirectory(root), RECOVERY_DIRECTORY)
  const entries = (await fs.readdir(directory, { withFileTypes: true }).catch(() => []))
    .filter((entry) => entry.isDirectory() && /^\d{17}-[a-f0-9]{12}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort()
  for (const id of entries.slice(0, Math.max(0, entries.length - MAX_RECOVERY_POINTS))) {
    await fs.rm(path.join(directory, id), { recursive: true, force: true })
  }
}

async function createRecoveryPoint(root, input = {}) {
  const paths = [...new Set((input.paths || []).map(safeRelative))]
  if (!paths.length) throw new Error('There is nothing to include in this recovery point.')
  const state = await ensureStateDirectory(root)
  const recoveryRoot = path.join(state, RECOVERY_DIRECTORY)
  const id = `${new Date().toISOString().replace(/\D/g, '').slice(0, 17)}-${crypto.randomBytes(6).toString('hex')}`
  const temporary = path.join(recoveryRoot, `.tmp-${id}`)
  const destination = path.join(recoveryRoot, id)
  await fs.mkdir(path.join(temporary, 'files'), { recursive: true })
  const targets = []
  try {
    for (const relative of paths) {
      const source = localPath(root, relative)
      const stat = await fs.lstat(source).catch(() => null)
      targets.push({ path: relative, existed: Boolean(stat), type: stat?.isDirectory() ? 'directory' : 'file' })
      if (!stat) continue
      await fs.mkdir(path.dirname(path.join(temporary, 'files', relative)), { recursive: true })
      await fs.cp(source, path.join(temporary, 'files', relative), { recursive: stat.isDirectory(), preserveTimestamps: true })
    }
    const manifest = {
      id,
      reason: String(input.reason || 'manual').slice(0, 80),
      label: String(input.label || '').slice(0, 200),
      createdAt: new Date().toISOString(),
      targets,
    }
    await fs.writeFile(path.join(temporary, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    await fs.mkdir(recoveryRoot, { recursive: true })
    await fs.rename(temporary, destination)
    await pruneRecoveryPoints(root)
    return publicRecoveryPoint(manifest)
  } catch (error) {
    await fs.rm(temporary, { recursive: true, force: true })
    throw error
  }
}

async function listRecoveryPoints(root) {
  const directory = path.join(await ensureStateDirectory(root), RECOVERY_DIRECTORY)
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => [])
  const points = await Promise.all(entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.tmp-')).map(async (entry) => {
    try { return publicRecoveryPoint(await readRecoveryManifest(root, entry.name)) } catch { return null }
  }))
  return points.filter(Boolean).sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

async function restoreRecoveryPoint(root, id, options = {}) {
  const manifest = await readRecoveryManifest(root, id)
  if (options.createUndo !== false) {
    await createRecoveryPoint(root, {
      reason: 'before-recovery-restore',
      label: `Before restoring ${manifest.label || manifest.reason}`,
      paths: manifest.targets.map((target) => target.path),
    })
  }
  const state = await ensureStateDirectory(root)
  const pointRoot = path.join(state, RECOVERY_DIRECTORY, manifest.id, 'files')
  const rollbackRoot = path.join(state, `.restore-${manifest.id}-${crypto.randomBytes(4).toString('hex')}`)
  const rollbackTargets = []
  await fs.mkdir(path.join(rollbackRoot, 'files'), { recursive: true })
  try {
    for (const target of manifest.targets) {
      const relative = safeRelative(target.path)
      const source = localPath(root, relative)
      const stat = await fs.lstat(source).catch(() => null)
      rollbackTargets.push({ path: relative, existed: Boolean(stat) })
      if (!stat) continue
      const destination = path.join(rollbackRoot, 'files', ...relative.split('/'))
      await fs.mkdir(path.dirname(destination), { recursive: true })
      await fs.cp(source, destination, { recursive: stat.isDirectory(), preserveTimestamps: true })
    }
  } catch (error) {
    await fs.rm(rollbackRoot, { recursive: true, force: true })
    throw error
  }
  try {
    for (const target of manifest.targets) {
      const relative = safeRelative(target.path)
      const destination = localPath(root, relative)
      await fs.rm(destination, { recursive: true, force: true })
      if (!target.existed) continue
      const source = path.join(pointRoot, ...relative.split('/'))
      const stat = await fs.lstat(source)
      await fs.mkdir(path.dirname(destination), { recursive: true })
      await fs.cp(source, destination, { recursive: stat.isDirectory(), preserveTimestamps: true })
    }
  } catch (error) {
    for (const target of rollbackTargets) {
      const destination = localPath(root, target.path)
      await fs.rm(destination, { recursive: true, force: true }).catch(() => {})
      if (!target.existed) continue
      const source = path.join(rollbackRoot, 'files', ...target.path.split('/'))
      const stat = await fs.lstat(source).catch(() => null)
      if (!stat) continue
      await fs.mkdir(path.dirname(destination), { recursive: true }).catch(() => {})
      await fs.cp(source, destination, { recursive: stat.isDirectory(), preserveTimestamps: true }).catch(() => {})
    }
    throw error
  } finally {
    await fs.rm(rollbackRoot, { recursive: true, force: true })
  }
  return publicRecoveryPoint(manifest)
}

async function repositoryPath(root, relative) {
  const prefix = await run(root, 'git', ['rev-parse', '--show-prefix']).then((result) => result.stdout).catch(() => '')
  return `${prefix}${safeRelative(relative)}`.replaceAll('\\', '/')
}

function parseHistoryRecords(raw) {
  return String(raw || '').split('\x1e').map((record) => record.trim()).filter(Boolean).map((record) => {
    const [metadata, ...fileLines] = record.split(/\r?\n/)
    const [hash, createdAt, author, subject] = metadata.split('\x1f')
    const files = fileLines.map((line) => {
      const [status, ...name] = line.split('\t')
      return { status: String(status || '').slice(0, 1), path: name.at(-1) || '' }
    }).filter((file) => file.path && !/(^|\/)\.plumbago\//.test(file.path))
    return { hash, createdAt, author, subject, files }
  }).filter((entry) => /^[a-f0-9]{40}$/i.test(entry.hash || ''))
}

function historyKind(files) {
  const names = files.map((file) => file.path)
  if (names.length && names.every((name) => /(^|\/)content\//.test(name))) return 'content'
  if (names.some((name) => /(^|\/)themes\//.test(name) || name.endsWith('.gitmodules'))) return 'theme'
  if (names.some((name) => /(^|\/)(?:hugo|config)\.(?:toml|ya?ml|json)$/.test(name) || name.endsWith('.plumbago.json'))) return 'settings'
  return 'site'
}

async function listSiteHistory(root) {
  const format = '--format=%x1e%H%x1f%aI%x1f%an%x1f%s'
  const raw = await run(root, 'git', ['log', '-n', '40', '--date=iso-strict', format, '--name-status', '--', '.'])
    .then((result) => result.stdout).catch(() => '')
  const changes = await run(root, 'git', ['status', '--porcelain=v1', '--', '.']).then((result) => result.stdout.split(/\r?\n/).filter(Boolean)).catch(() => [])
  return {
    hasLocalChanges: changes.length > 0,
    localChangeCount: changes.length,
    entries: parseHistoryRecords(raw).map((entry) => ({ ...entry, kind: historyKind(entry.files) })),
  }
}

async function listPostHistory(root, id) {
  contentPath(root, id)
  const relative = await repositoryPath(root, id)
  const format = '--format=%x1e%H%x1f%aI%x1f%an%x1f%s'
  const [raw, changed] = await Promise.all([
    run(root, 'git', ['log', '--follow', '-n', '50', '--date=iso-strict', format, '--', relative]).then((result) => result.stdout).catch(() => ''),
    run(root, 'git', ['status', '--porcelain=v1', '--', relative]).then((result) => Boolean(result.stdout)).catch(() => false),
  ])
  return { id, currentChanged: changed, revisions: parseHistoryRecords(raw).map((entry) => ({ hash: entry.hash, createdAt: entry.createdAt, author: entry.author, subject: entry.subject })) }
}

async function revisionSource(root, id, hash) {
  contentPath(root, id)
  const commit = safeCommit(hash)
  const relative = await repositoryPath(root, id)
  const raw = await run(root, 'git', ['show', `${commit}:${relative}`], { preserveOutput: true }).then((result) => result.stdout)
  if (Buffer.byteLength(raw, 'utf8') > MAX_REVISION_BYTES) throw new Error('This saved version is too large to preview safely.')
  return raw
}

async function comparePostRevision(root, id, hash) {
  const before = await revisionSource(root, id, hash)
  const after = await fs.readFile(contentPath(root, id), 'utf8')
  return {
    id,
    hash: safeCommit(hash),
    changes: diffLines(before, after).map((change) => ({
      type: change.added ? 'added' : change.removed ? 'removed' : 'same',
      value: change.value,
      count: change.count || 0,
    })),
  }
}

async function restorePostRevision(root, id, hash) {
  const source = await revisionSource(root, id, hash)
  const target = contentPath(root, id)
  const recoveryPoint = await createRecoveryPoint(root, {
    reason: 'before-post-restore',
    label: `Before restoring ${id}`,
    paths: [id],
  })
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(temporary, source, 'utf8')
  await fs.rename(temporary, target)
  return { post: await readPost(root, id), recoveryPoint }
}

module.exports = {
  comparePostRevision,
  createRecoveryPoint,
  listPostHistory,
  listRecoveryPoints,
  listSiteHistory,
  restorePostRevision,
  restoreRecoveryPoint,
  siteConfigurationPaths,
}
