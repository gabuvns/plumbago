const fs = require('node:fs/promises')
const path = require('node:path')
const sharp = require('sharp')
const { contentPath, parsePostSource, readPost, slugify } = require('../content.cjs')
const { createRecoveryPoint, restoreRecoveryPoint } = require('../history.cjs')
const { inspectMedia } = require('./index.cjs')
const { IMAGE_EXTENSIONS, mediaPath, normalizeMediaId, requireMediaFile } = require('./paths.cjs')
const { parseMarkdownReferences, validateMediaReference } = require('./references.cjs')

function escapedAlt(value) {
  return String(value || '').replaceAll('\\', '\\\\').replaceAll('[', '\\[').replaceAll(']', '\\]')
}

function escapedCaption(value) {
  return String(value || '').trim().replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}

function markdownPath(value) {
  return /\s|[()]/.test(value) ? `<${value}>` : value
}

function imageMarkdown(destination, options = {}) {
  const defaultAlt = path.posix.basename(destination, path.posix.extname(destination)).replaceAll(/[-_]+/g, ' ')
  const alt = escapedAlt(Object.hasOwn(options, 'alt') ? options.alt : defaultAlt)
  const caption = escapedCaption(options.caption)
  const value = String(destination)
  const renderedDestination = value.startsWith('<') && value.endsWith('>') ? value : markdownPath(value)
  return `![${alt}](${renderedDestination}${caption ? ` "${caption}"` : ''})`
}

async function uniqueFile(directory, preferredName) {
  const extension = path.extname(preferredName).toLowerCase()
  const base = slugify(path.basename(preferredName, path.extname(preferredName))) || 'image'
  const used = new Set((await fs.readdir(directory).catch(() => [])).map((name) => name.toLowerCase()))
  let name = `${base}${extension}`
  let counter = 2
  while (used.has(name.toLowerCase())) name = `${base}-${counter++}${extension}`
  return name
}

function pageBundlePost(postId) {
  return /^index(?:\.[^.]+)*\.md$/i.test(path.posix.basename(postId))
}

async function reuseMedia(root, id, postId, options = {}) {
  const mediaId = normalizeMediaId(id)
  const source = await requireMediaFile(root, mediaId)
  const postAbsolute = contentPath(root, postId)
  const postDirectory = path.dirname(postAbsolute)
  const postRelativeDirectory = path.posix.dirname(postId)
  let destination
  let copiedId = ''
  if (mediaId.startsWith('static/')) {
    destination = `/${mediaId.slice('static/'.length)}`
  } else if (pageBundlePost(postId) && path.posix.dirname(mediaId) === postRelativeDirectory) {
    destination = path.posix.basename(mediaId)
  } else if (pageBundlePost(postId)) {
    const name = await uniqueFile(postDirectory, path.posix.basename(mediaId))
    copiedId = `${postRelativeDirectory}/${name}`
    await fs.copyFile(source, mediaPath(root, copiedId))
    destination = name
  } else {
    const uploadDirectory = `static/uploads/${slugify(path.posix.basename(postId, '.md')) || 'post'}`
    await fs.mkdir(path.join(root, ...uploadDirectory.split('/')), { recursive: true })
    const name = await uniqueFile(path.join(root, ...uploadDirectory.split('/')), path.posix.basename(mediaId))
    copiedId = `${uploadDirectory}/${name}`
    await fs.copyFile(source, mediaPath(root, copiedId))
    destination = `/${copiedId.slice('static/'.length)}`
  }
  return { mediaId, copiedId, destination, markdown: imageMarkdown(destination, options) }
}

async function updateMediaReference(root, input = {}) {
  const mediaId = normalizeMediaId(input.mediaId)
  const postId = String(input.postId || '')
  const absolute = contentPath(root, postId)
  const raw = await fs.readFile(absolute, 'utf8')
  const reference = validateMediaReference(parseMarkdownReferences(raw, postId).find((item) => item.id === input.referenceId), mediaId)
  if (!reference.editable) throw new Error('This reference format cannot be edited safely yet.')
  const replacement = imageMarkdown(reference.destination, { alt: input.alt, caption: input.caption })
  const recoveryPoint = await createRecoveryPoint(root, { reason: 'before-media-change', label: `Before editing image text in ${postId}`, paths: [postId] })
  const temporary = `${absolute}.${process.pid}.${Date.now()}.tmp`
  try {
    await fs.writeFile(temporary, `${raw.slice(0, reference.start)}${replacement}${raw.slice(reference.end)}`, 'utf8')
    await fs.rename(temporary, absolute)
    return { post: await readPost(root, postId), recoveryPoint }
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => {})
    await restoreRecoveryPoint(root, recoveryPoint.id, { createUndo: false }).catch(() => {})
    throw error
  }
}

async function encodedReplacement(sourcePath, targetExtension) {
  const sourceExtension = path.extname(sourcePath).toLowerCase()
  await sharp(sourcePath, { animated: targetExtension === '.gif', failOn: 'error' }).metadata()
  if (targetExtension === '.svg') {
    if (sourceExtension !== '.svg') throw new Error('Replace an SVG with another SVG, or create a raster derivative instead.')
    return fs.readFile(sourcePath)
  }
  if (targetExtension === '.gif' && sourceExtension === '.gif') return fs.readFile(sourcePath)
  let pipeline = sharp(sourcePath, { animated: false, failOn: 'error' }).rotate()
  if (targetExtension === '.jpg' || targetExtension === '.jpeg') pipeline = pipeline.flatten({ background: '#ffffff' }).jpeg({ quality: 88, mozjpeg: true })
  else if (targetExtension === '.png') pipeline = pipeline.png({ compressionLevel: 9 })
  else if (targetExtension === '.webp') pipeline = pipeline.webp({ quality: 86 })
  else if (targetExtension === '.avif') pipeline = pipeline.avif({ quality: 62 })
  else if (targetExtension === '.gif') pipeline = pipeline.gif()
  return pipeline.toBuffer()
}

async function replaceMedia(root, id, sourcePath) {
  const mediaId = normalizeMediaId(id)
  const target = await requireMediaFile(root, mediaId)
  const targetExtension = path.extname(target).toLowerCase()
  const sourceExtension = path.extname(String(sourcePath || '')).toLowerCase()
  if (!IMAGE_EXTENSIONS.has(sourceExtension)) throw new Error('Choose a supported image file.')
  if (path.resolve(sourcePath) === path.resolve(target)) return inspectMedia(root, mediaId)
  const recoveryPoint = await createRecoveryPoint(root, { reason: 'before-media-change', label: `Before replacing ${mediaId}`, paths: [mediaId] })
  const temporary = `${target}.${process.pid}.${Date.now()}${targetExtension}`
  try {
    await fs.writeFile(temporary, await encodedReplacement(sourcePath, targetExtension))
    await fs.rename(temporary, target)
    return { ...await inspectMedia(root, mediaId), recoveryPoint }
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => {})
    await restoreRecoveryPoint(root, recoveryPoint.id, { createUndo: false }).catch(() => {})
    throw error
  }
}

function dimension(value) {
  const number = Number(value || 0)
  if (!number) return undefined
  if (!Number.isInteger(number) || number < 32 || number > 8000) throw new Error('Image dimensions must be whole numbers between 32 and 8000 pixels.')
  return number
}

async function createMediaDerivative(root, id, options = {}) {
  const mediaId = normalizeMediaId(id)
  const source = await requireMediaFile(root, mediaId)
  const width = dimension(options.width)
  const height = dimension(options.height)
  if (!width && !height) throw new Error('Choose a width or height for the derivative.')
  const format = ['webp', 'avif', 'jpeg', 'png'].includes(options.format) ? options.format : 'webp'
  const quality = Math.min(100, Math.max(30, Number(options.quality) || (format === 'avif' ? 62 : 82)))
  const fit = options.fit === 'cover' && width && height ? 'cover' : 'inside'
  const directoryId = path.posix.dirname(mediaId)
  const directory = path.dirname(mediaPath(root, mediaId))
  const sourceBase = path.posix.basename(mediaId, path.posix.extname(mediaId))
  const extension = format === 'jpeg' ? '.jpg' : `.${format}`
  const preferred = `${sourceBase}-${width || 'auto'}x${height || 'auto'}${extension}`
  const name = await uniqueFile(directory, preferred)
  const outputId = `${directoryId}/${name}`
  const output = mediaPath(root, outputId)
  const temporary = `${output}.${process.pid}.${Date.now()}.tmp`
  try {
    let pipeline = sharp(source, { animated: false, failOn: 'error' }).rotate().resize({ width, height, fit, withoutEnlargement: options.allowEnlarge !== true })
    if (format === 'jpeg') pipeline = pipeline.flatten({ background: '#ffffff' }).jpeg({ quality, mozjpeg: true })
    if (format === 'png') pipeline = pipeline.png({ compressionLevel: 9, quality })
    if (format === 'webp') pipeline = pipeline.webp({ quality })
    if (format === 'avif') pipeline = pipeline.avif({ quality })
    await pipeline.toFile(temporary)
    await fs.rename(temporary, output)
    return { ...await inspectMedia(root, outputId), sourceId: mediaId }
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => {})
    throw error
  }
}

async function postTitle(root, postId) {
  const raw = await fs.readFile(contentPath(root, postId), 'utf8')
  try { return String(parsePostSource(raw).data?.title || postId) } catch { return postId }
}

module.exports = { createMediaDerivative, imageMarkdown, postTitle, replaceMedia, reuseMedia, updateMediaReference }
