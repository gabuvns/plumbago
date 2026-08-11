const crypto = require('node:crypto')
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const sharp = require('sharp')
const { IMAGE_EXTENSIONS, MEDIA_ROOTS, mediaScope, normalizeMediaId, requireMediaFile } = require('./paths.cjs')
const { publicReference, scanPostReferences } = require('./references.cjs')

const OVERSIZED_BYTES = 2 * 1024 * 1024
sharp.cache({ files: 0 })

async function walkImages(directory, root, output = []) {
  const entries = await fsp.readdir(directory, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) await walkImages(absolute, root, output)
    if (entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) output.push(path.relative(root, absolute).replaceAll(path.sep, '/'))
  }
  return output
}

async function mapLimit(values, limit, mapper) {
  const results = new Array(values.length)
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor++
      results[index] = await mapper(values[index], index)
    }
  }))
  return results
}

function hashFile(absolute) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    fs.createReadStream(absolute).on('data', (chunk) => hash.update(chunk)).on('error', reject).on('end', () => resolve(hash.digest('hex')))
  })
}

async function inspectMedia(root, id) {
  const absolute = await requireMediaFile(root, id)
  const [stat, hash, metadata] = await Promise.all([
    fsp.stat(absolute),
    hashFile(absolute),
    sharp(absolute, { animated: false, failOn: 'none' }).metadata().catch(() => ({})),
  ])
  return {
    id,
    name: path.posix.basename(id),
    extension: path.posix.extname(id).slice(1).toLowerCase(),
    scope: mediaScope(id),
    size: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    hash,
    width: metadata.width || 0,
    height: metadata.height || 0,
    format: metadata.format || path.posix.extname(id).slice(1).toLowerCase(),
    animated: Number(metadata.pages || 1) > 1,
  }
}

async function buildMediaLibrary(root) {
  const ids = (await Promise.all(MEDIA_ROOTS.map((folder) => walkImages(path.join(root, folder), root)))).flat().map(normalizeMediaId).sort()
  const [{ posts, references }, inspected] = await Promise.all([scanPostReferences(root), mapLimit(ids, 8, (id) => inspectMedia(root, id))])
  const postTitles = new Map(posts.map((post) => [post.id, post.title]))
  const known = new Set(ids)
  const duplicateHashes = new Map()
  for (const item of inspected) {
    const group = duplicateHashes.get(item.hash) || []
    group.push(item.id)
    duplicateHashes.set(item.hash, group)
  }
  const items = inspected.map((item) => {
    const itemReferences = references.filter((reference) => reference.mediaId === item.id).map((reference) => publicReference(reference, postTitles))
    const directory = path.posix.dirname(item.id)
    const ownerPostIds = item.id.startsWith('content/')
      ? posts.filter((post) => path.posix.dirname(post.id) === directory && /^index(?:\.[^.]+)*\.md$/i.test(path.posix.basename(post.id))).map((post) => post.id)
      : []
    const duplicateIds = (duplicateHashes.get(item.hash) || []).filter((id) => id !== item.id)
    return {
      ...item,
      scope: ownerPostIds.length ? 'bundle' : item.id.startsWith('content/') ? 'content' : item.scope,
      ownerPostIds,
      ownerTitles: ownerPostIds.map((id) => postTitles.get(id) || id),
      references: itemReferences,
      usageCount: itemReferences.length,
      missingAltCount: itemReferences.filter((reference) => reference.kind !== 'frontmatter' && !reference.alt.trim()).length,
      duplicateIds,
      duplicate: duplicateIds.length > 0,
      oversized: item.size > OVERSIZED_BYTES,
      removable: itemReferences.length === 0,
    }
  })
  const missingReferences = references
    .filter((reference) => reference.mediaId && !known.has(reference.mediaId))
    .map((reference) => ({ ...publicReference(reference, postTitles), expectedMediaId: reference.mediaId }))
  const duplicateGroups = [...duplicateHashes.entries()].filter(([, group]) => group.length > 1).map(([hash, mediaIds]) => ({ hash, mediaIds }))
  return {
    items,
    missingReferences,
    duplicateGroups,
    summary: {
      total: items.length,
      used: items.filter((item) => item.usageCount > 0).length,
      unused: items.filter((item) => item.usageCount === 0).length,
      oversized: items.filter((item) => item.oversized).length,
      duplicates: duplicateGroups.length,
      missing: missingReferences.length,
      missingAlt: items.reduce((total, item) => total + item.missingAltCount, 0),
      bytes: items.reduce((total, item) => total + item.size, 0),
    },
  }
}

async function mediaPreview(root, id, options = {}) {
  const mediaId = normalizeMediaId(id)
  const width = Math.min(1600, Math.max(160, Number(options.width) || 720))
  const result = await sharp(await requireMediaFile(root, mediaId), { animated: false, failOn: 'none' })
    .rotate()
    .resize({ width, height: Math.round(width * 0.72), fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer({ resolveWithObject: true })
  return { id: mediaId, width: result.info.width, height: result.info.height, dataUrl: `data:image/webp;base64,${result.data.toString('base64')}` }
}

module.exports = { OVERSIZED_BYTES, buildMediaLibrary, inspectMedia, mediaPreview }
