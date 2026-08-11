const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')

const STATE_DIRECTORY = '.plumbago'
const TRASH_DIRECTORY = 'trash'

function safeRelative(value) {
  const normalized = String(value || '').replaceAll('\\', '/')
  if (!normalized.startsWith('content/') || normalized.startsWith('/') || normalized.split('/').includes('..')) throw new Error('Choose a valid post in this blog.')
  return normalized
}

function blogPath(root, relative) {
  const safe = safeRelative(relative)
  const contentRoot = path.resolve(root, 'content')
  const resolved = path.resolve(root, ...safe.split('/'))
  if (!resolved.startsWith(`${contentRoot}${path.sep}`)) throw new Error('Choose a valid post in this blog.')
  return resolved
}

function safeTrashId(value) {
  const id = String(value || '')
  if (!/^\d{17}-[a-f0-9]{12}$/.test(id)) throw new Error('Choose a valid item from the trash.')
  return id
}

async function ensureTrashRoot(root) {
  const state = path.join(path.resolve(root), STATE_DIRECTORY)
  await fs.mkdir(state, { recursive: true })
  await fs.writeFile(path.join(state, '.gitignore'), '*\n!.gitignore\n', { encoding: 'utf8', flag: 'wx' }).catch((error) => {
    if (error.code !== 'EEXIST') throw error
  })
  const trash = path.join(state, TRASH_DIRECTORY)
  await fs.mkdir(trash, { recursive: true })
  return trash
}

async function walkFiles(directory, root = directory, output = []) {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) await walkFiles(absolute, root, output)
    if (entry.isFile()) output.push(path.relative(root, absolute).replaceAll(path.sep, '/'))
  }
  return output
}

function titleFromSource(raw, id) {
  const match = String(raw).match(/^\s*title\s*[:=]\s*['"]?([^'"\r\n]+)['"]?\s*$/mi)
  return match?.[1]?.trim() || path.basename(path.dirname(id)) || path.basename(id, '.md')
}

function publicTrashItem(manifest) {
  const files = Array.isArray(manifest.files) ? manifest.files.map(String) : []
  return {
    id: String(manifest.id || ''),
    postId: String(manifest.postId || ''),
    title: String(manifest.title || ''),
    deletedAt: String(manifest.deletedAt || ''),
    files,
    assetCount: files.filter((file) => !file.toLowerCase().endsWith('.md')).length,
  }
}

async function readTrashManifest(root, id) {
  const safeId = safeTrashId(id)
  const manifest = JSON.parse(await fs.readFile(path.join(await ensureTrashRoot(root), safeId, 'manifest.json'), 'utf8'))
  if (manifest.id !== safeId || !Array.isArray(manifest.files)) throw new Error('This trash item is damaged.')
  return manifest
}

async function movePostToTrash(root, id) {
  const postId = safeRelative(id)
  const source = blogPath(root, postId)
  if (path.extname(source).toLowerCase() !== '.md') throw new Error('Only Markdown posts can be moved to the trash.')
  const raw = await fs.readFile(source, 'utf8')
  const directory = path.dirname(source)
  const bundleRelative = path.relative(root, directory).replaceAll(path.sep, '/')
  const postName = path.basename(source)
  const pageBundle = /^index(?:\.[^.]+)*\.md$/i.test(postName)
  const bundleFiles = pageBundle ? await walkFiles(directory) : [postName]
  const otherMarkdown = bundleFiles.filter((file) => file.toLowerCase().endsWith('.md') && file !== postName)
  const relativeFiles = pageBundle && otherMarkdown.length
    ? [postId]
    : bundleFiles.map((file) => `${bundleRelative}/${file}`)
  const files = [...new Set(relativeFiles.map(safeRelative))]
  const trashRoot = await ensureTrashRoot(root)
  const trashId = `${new Date().toISOString().replace(/\D/g, '').slice(0, 17)}-${crypto.randomBytes(6).toString('hex')}`
  const temporary = path.join(trashRoot, `.tmp-${trashId}`)
  const destination = path.join(trashRoot, trashId)
  await fs.mkdir(path.join(temporary, 'files'), { recursive: true })
  try {
    for (const relative of files) {
      const target = path.join(temporary, 'files', ...relative.split('/'))
      await fs.mkdir(path.dirname(target), { recursive: true })
      await fs.copyFile(blogPath(root, relative), target)
    }
    const manifest = {
      id: trashId,
      postId,
      title: titleFromSource(raw, postId),
      deletedAt: new Date().toISOString(),
      files,
    }
    await fs.writeFile(path.join(temporary, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    await fs.rename(temporary, destination)
    for (const relative of [...files].sort((left, right) => right.length - left.length)) await fs.rm(blogPath(root, relative), { force: true })
    const postsRoot = path.resolve(root, 'content', 'posts')
    let current = directory
    while (current.startsWith(`${postsRoot}${path.sep}`)) {
      const removed = await fs.rmdir(current).then(() => true).catch(() => false)
      if (!removed) break
      current = path.dirname(current)
    }
    const movedAssets = files.filter((file) => !file.toLowerCase().endsWith('.md'))
    const preservedAssets = pageBundle ? bundleFiles.filter((file) => !file.toLowerCase().endsWith('.md') && !movedAssets.some((moved) => moved.endsWith(`/${file}`))) : []
    return { ...publicTrashItem(manifest), id: postId, trashId, movedAssets, preservedAssets }
  } catch (error) {
    await fs.rm(temporary, { recursive: true, force: true })
    throw error
  }
}

async function listTrash(root) {
  const trashRoot = await ensureTrashRoot(root)
  const entries = await fs.readdir(trashRoot, { withFileTypes: true })
  const items = await Promise.all(entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.tmp-')).map(async (entry) => {
    try { return publicTrashItem(await readTrashManifest(root, entry.name)) } catch { return null }
  }))
  return items.filter(Boolean).sort((left, right) => right.deletedAt.localeCompare(left.deletedAt))
}

async function restoreTrashItem(root, id) {
  const manifest = await readTrashManifest(root, id)
  const conflicts = []
  for (const relative of manifest.files) {
    if (await fs.lstat(blogPath(root, safeRelative(relative))).catch(() => null)) conflicts.push(relative)
  }
  if (conflicts.length) throw new Error(`Restore stopped because ${conflicts[0]} already exists. Rename or remove that file first.`)
  const entryRoot = path.join(await ensureTrashRoot(root), manifest.id)
  const restored = []
  try {
    for (const relativeValue of manifest.files) {
      const relative = safeRelative(relativeValue)
      const destination = blogPath(root, relative)
      await fs.mkdir(path.dirname(destination), { recursive: true })
      await fs.copyFile(path.join(entryRoot, 'files', ...relative.split('/')), destination)
      restored.push(destination)
    }
  } catch (error) {
    for (const destination of restored.reverse()) await fs.rm(destination, { force: true }).catch(() => {})
    throw error
  }
  await fs.rm(entryRoot, { recursive: true, force: true })
  return publicTrashItem(manifest)
}

async function deleteTrashItem(root, id) {
  const manifest = await readTrashManifest(root, id)
  await fs.rm(path.join(await ensureTrashRoot(root), manifest.id), { recursive: true, force: true })
  return publicTrashItem(manifest)
}

module.exports = { deleteTrashItem, listTrash, movePostToTrash, restoreTrashItem }
