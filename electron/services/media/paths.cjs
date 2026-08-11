const fs = require('node:fs/promises')
const path = require('node:path')

const IMAGE_EXTENSIONS = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp'])
const MEDIA_ROOTS = ['content', 'static', 'assets']

function normalizeMediaId(value) {
  const normalized = String(value || '').replaceAll('\\', '/').replace(/^\.\//, '')
  if (!normalized || normalized.startsWith('/') || normalized.split('/').includes('..')) throw new Error('Choose a valid image in this blog.')
  const root = normalized.split('/')[0]
  if (!MEDIA_ROOTS.includes(root) || !IMAGE_EXTENSIONS.has(path.posix.extname(normalized).toLowerCase())) throw new Error('Choose a valid image in this blog.')
  return normalized
}

function mediaPath(root, id) {
  const relative = normalizeMediaId(id)
  const resolvedRoot = path.resolve(root)
  const resolved = path.resolve(resolvedRoot, ...relative.split('/'))
  if (!resolved.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error('The image is outside this blog.')
  return resolved
}

async function requireMediaFile(root, id) {
  const absolute = mediaPath(root, id)
  const stat = await fs.lstat(absolute).catch(() => null)
  if (!stat?.isFile() || stat.isSymbolicLink()) throw new Error('This image no longer exists in the blog. Refresh the media library.')
  return absolute
}

function mediaScope(id) {
  if (id.startsWith('static/')) return 'static'
  if (id.startsWith('assets/')) return 'assets'
  return 'bundle'
}

function mediaMime(id) {
  const extension = path.posix.extname(id).toLowerCase()
  if (extension === '.svg') return 'image/svg+xml'
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg'
  return `image/${extension.slice(1)}`
}

module.exports = { IMAGE_EXTENSIONS, MEDIA_ROOTS, mediaMime, mediaPath, mediaScope, normalizeMediaId, requireMediaFile }
