const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')
const { buildMediaLibrary } = require('./index.cjs')
const { mediaPath, normalizeMediaId } = require('./paths.cjs')

const MEDIA_TRASH_DIRECTORY = 'media-trash'

function safeTrashId(value) {
  const id = String(value || '')
  if (!/^\d{17}-[a-f0-9]{12}$/.test(id)) throw new Error('Choose a valid removed image.')
  return id
}

async function trashRoot(root) {
  const state = path.join(path.resolve(root), '.plumbago')
  await fs.mkdir(state, { recursive: true })
  await fs.writeFile(path.join(state, '.gitignore'), '*\n!.gitignore\n', { encoding: 'utf8', flag: 'wx' }).catch((error) => {
    if (error.code !== 'EEXIST') throw error
  })
  const directory = path.join(state, MEDIA_TRASH_DIRECTORY)
  await fs.mkdir(directory, { recursive: true })
  return directory
}

function publicItem(manifest) {
  return {
    id: String(manifest.id || ''),
    mediaId: String(manifest.mediaId || ''),
    name: path.posix.basename(String(manifest.mediaId || '')),
    deletedAt: String(manifest.deletedAt || ''),
    size: Number(manifest.size || 0),
    hash: String(manifest.hash || ''),
  }
}

async function readManifest(root, id) {
  const trashId = safeTrashId(id)
  const manifest = JSON.parse(await fs.readFile(path.join(await trashRoot(root), trashId, 'manifest.json'), 'utf8'))
  if (manifest.id !== trashId || normalizeMediaId(manifest.mediaId) !== manifest.mediaId) throw new Error('This removed image is damaged.')
  return manifest
}

async function removeMedia(root, id) {
  const mediaId = normalizeMediaId(id)
  const library = await buildMediaLibrary(root)
  const item = library.items.find((entry) => entry.id === mediaId)
  if (!item) throw new Error('This image no longer exists. Refresh the media library.')
  if (item.usageCount > 0) throw new Error('Remove every known reference to this image before moving it to the trash.')
  const source = mediaPath(root, mediaId)
  const idValue = `${new Date().toISOString().replace(/\D/g, '').slice(0, 17)}-${crypto.randomBytes(6).toString('hex')}`
  const rootDirectory = await trashRoot(root)
  const temporary = path.join(rootDirectory, `.tmp-${idValue}`)
  const destination = path.join(rootDirectory, idValue)
  await fs.mkdir(temporary, { recursive: true })
  try {
    await fs.copyFile(source, path.join(temporary, 'image'))
    const manifest = { id: idValue, mediaId, deletedAt: new Date().toISOString(), size: item.size, hash: item.hash }
    await fs.writeFile(path.join(temporary, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    await fs.rename(temporary, destination)
    await fs.rm(source)
    return publicItem(manifest)
  } catch (error) {
    await fs.rm(temporary, { recursive: true, force: true })
    await fs.rm(destination, { recursive: true, force: true }).catch(() => {})
    throw error
  }
}

async function listMediaTrash(root) {
  const directory = await trashRoot(root)
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const items = await Promise.all(entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.tmp-')).map(async (entry) => {
    try { return publicItem(await readManifest(root, entry.name)) } catch { return null }
  }))
  return items.filter(Boolean).sort((left, right) => right.deletedAt.localeCompare(left.deletedAt))
}

async function restoreMediaTrashItem(root, id) {
  const manifest = await readManifest(root, id)
  const destination = mediaPath(root, manifest.mediaId)
  if (await fs.lstat(destination).catch(() => null)) throw new Error('An image already exists at this location. Rename or remove it before restoring.')
  const entry = path.join(await trashRoot(root), manifest.id)
  await fs.mkdir(path.dirname(destination), { recursive: true })
  await fs.copyFile(path.join(entry, 'image'), destination)
  await fs.rm(entry, { recursive: true, force: true })
  return publicItem(manifest)
}

async function deleteMediaTrashItem(root, id) {
  const manifest = await readManifest(root, id)
  await fs.rm(path.join(await trashRoot(root), manifest.id), { recursive: true, force: true })
  return publicItem(manifest)
}

module.exports = { deleteMediaTrashItem, listMediaTrash, removeMedia, restoreMediaTrashItem }
