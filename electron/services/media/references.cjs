const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')
const { parsePostSource } = require('../content.cjs')
const { IMAGE_EXTENSIONS, normalizeMediaId } = require('./paths.cjs')

async function walkMarkdown(directory, root, output = []) {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) await walkMarkdown(absolute, root, output)
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) output.push(path.relative(root, absolute).replaceAll(path.sep, '/'))
  }
  return output
}

function referenceId(postId, start, raw) {
  return crypto.createHash('sha1').update(`${postId}:${start}:${raw}`).digest('hex').slice(0, 20)
}

function cleanDestination(value) {
  let destination = String(value || '').trim().replace(/^<|>$/g, '')
  if (!destination || destination.startsWith('#') || destination.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(destination)) return ''
  destination = destination.split(/[?#]/, 1)[0]
  try { destination = decodeURIComponent(destination) } catch { /* Keep the literal path when percent encoding is incomplete. */ }
  return destination.replaceAll('\\', '/')
}

function resolveReference(postId, value) {
  const destination = cleanDestination(value)
  if (!destination) return ''
  const resolved = destination.startsWith('/')
    ? `static/${destination.replace(/^\/+/, '')}`
    : path.posix.normalize(path.posix.join(path.posix.dirname(postId), destination))
  if (resolved.startsWith('../') || resolved.startsWith('/') || !['content/', 'static/', 'assets/'].some((prefix) => resolved.startsWith(prefix))) return ''
  return IMAGE_EXTENSIONS.has(path.posix.extname(resolved).toLowerCase()) ? resolved : ''
}

function htmlAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))
  return match ? match[1] ?? match[2] ?? match[3] ?? '' : ''
}

function parseMarkdownReferences(raw, postId) {
  const references = []
  const markdownPattern = /!\[((?:\\.|[^\]\\])*)\]\(\s*(<[^>\r\n]+>|[^\s)]+)(?:\s+(?:"((?:\\.|[^"])*)"|'([^']*)'|\(([^)]*)\)))?\s*\)/g
  for (const match of raw.matchAll(markdownPattern)) {
    const destination = match[2]
    references.push({
      id: referenceId(postId, match.index, match[0]),
      kind: 'markdown',
      postId,
      start: match.index,
      end: match.index + match[0].length,
      raw: match[0],
      alt: match[1].replaceAll('\\]', ']').replaceAll('\\[', '['),
      caption: match[3] ?? match[4] ?? match[5] ?? '',
      destination,
      mediaId: resolveReference(postId, destination),
      editable: true,
    })
  }
  const htmlPattern = /<img\b[^>]*>/gi
  for (const match of raw.matchAll(htmlPattern)) {
    const destination = htmlAttribute(match[0], 'src')
    references.push({
      id: referenceId(postId, match.index, match[0]),
      kind: 'html',
      postId,
      start: match.index,
      end: match.index + match[0].length,
      raw: match[0],
      alt: htmlAttribute(match[0], 'alt'),
      caption: htmlAttribute(match[0], 'title'),
      destination,
      mediaId: resolveReference(postId, destination),
      editable: false,
    })
  }
  return references.sort((left, right) => left.start - right.start)
}

async function scanPostReferences(root) {
  const postIds = await walkMarkdown(path.join(root, 'content'), root)
  const posts = []
  const references = []
  for (const postId of postIds) {
    const raw = await fs.readFile(path.join(root, ...postId.split('/')), 'utf8')
    let parsed
    try { parsed = parsePostSource(raw) } catch { parsed = { data: {} } }
    posts.push({ id: postId, title: String(parsed.data?.title || path.posix.basename(postId, '.md')) })
    references.push(...parseMarkdownReferences(raw, postId))
    const featured = parsed.data?.featuredImage
    if (typeof featured === 'string' && featured.trim()) {
      references.push({
        id: referenceId(postId, -1, featured), kind: 'frontmatter', postId, start: -1, end: -1,
        raw: featured, alt: '', caption: '', destination: featured, mediaId: resolveReference(postId, featured), editable: false,
      })
    }
  }
  return { posts, references }
}

function publicReference(reference, postTitles) {
  return {
    id: reference.id,
    kind: reference.kind,
    postId: reference.postId,
    postTitle: postTitles.get(reference.postId) || reference.postId,
    alt: reference.alt,
    caption: reference.caption,
    destination: reference.destination,
    editable: reference.editable,
  }
}

function validateMediaReference(reference, expectedMediaId) {
  if (!reference || reference.mediaId !== normalizeMediaId(expectedMediaId)) throw new Error('This image reference changed. Refresh the media library and try again.')
  return reference
}

module.exports = { parseMarkdownReferences, publicReference, resolveReference, scanPostReferences, validateMediaReference }
