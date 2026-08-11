const { createRecoveryPoint, restoreRecoveryPoint, siteConfigurationPaths } = require('../history.cjs')
const { listPosts, readPost, savePost } = require('../content.cjs')
const { defaultTimeZone, validTimeZone, zonedDateTimeToIso } = require('./time.cjs')
const { siteMetadata, updateSiteConfig } = require('../site.cjs')

function instant(value) {
  const parsed = value ? new Date(value) : null
  return parsed && !Number.isNaN(parsed.valueOf()) ? parsed : null
}

function dateInstant(value, timeZone) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null
  try { return new Date(zonedDateTimeToIso(`${value}T00:00`, timeZone).iso) } catch { return null }
}

function stateFor(post, timeZone, now) {
  const publishAt = instant(post.publishDate)
  const contentAt = dateInstant(post.date, timeZone)
  const expiryAt = instant(post.expiryDate)
  const effectiveAt = [publishAt, contentAt].filter(Boolean).sort((left, right) => right - left)[0] || null
  if (expiryAt && expiryAt <= now) return { state: 'expired', effectiveAt: expiryAt.toISOString(), source: 'expiryDate' }
  if (post.draft) return publishAt ? { state: publishAt > now ? 'scheduled-draft' : 'draft', effectiveAt: publishAt.toISOString(), source: 'publishDate' } : { state: 'unscheduled', effectiveAt: '', source: '' }
  if (effectiveAt && effectiveAt > now) return { state: 'scheduled', effectiveAt: effectiveAt.toISOString(), source: publishAt && publishAt >= contentAt ? 'publishDate' : 'date' }
  return { state: 'published', effectiveAt: (publishAt || contentAt)?.toISOString() || '', source: publishAt ? 'publishDate' : 'date' }
}

async function calendarContent(root, options = {}) {
  const metadata = await siteMetadata(root)
  const configured = validTimeZone(metadata.timeZone)
  const timeZone = configured ? metadata.timeZone : defaultTimeZone()
  const now = options.now ? new Date(options.now) : new Date()
  if (Number.isNaN(now.valueOf())) throw new Error('The calendar clock is invalid.')
  const posts = await listPosts(root)
  const items = posts.map((post) => ({ ...post, ...stateFor(post, timeZone, now) }))
  const counts = Object.fromEntries(['published', 'scheduled', 'unscheduled', 'draft', 'scheduled-draft', 'expired'].map((state) => [state, items.filter((item) => item.state === state).length]))
  const next = items.filter((item) => item.state === 'scheduled').sort((left, right) => left.effectiveAt.localeCompare(right.effectiveAt))[0] || null
  return { timeZone, timeZoneConfigured: configured, now: now.toISOString(), items, summary: { total: items.length, ...counts }, next }
}

function changed(field, before, after) {
  return before === after ? null : { field, before, after }
}

async function previewCalendarChange(root, input = {}, options = {}) {
  const post = await readPost(root, String(input.postId || ''))
  const metadata = await siteMetadata(root)
  const timeZone = String(input.timeZone || metadata.timeZone || defaultTimeZone())
  if (!validTimeZone(timeZone)) throw new Error('Choose a valid IANA time zone.')
  const now = options.now ? new Date(options.now) : new Date()
  const action = String(input.action || '')
  let next = { ...post }
  let ambiguous = false
  if (action === 'schedule') {
    const converted = zonedDateTimeToIso(input.publishLocal, timeZone)
    ambiguous = converted.ambiguous
    if (new Date(converted.iso) <= new Date(now.getTime() + 30_000)) throw new Error('Choose a publication time in the future, or use Publish now.')
    let expiryDate = post.expiryDate
    if (Object.hasOwn(input, 'expiryLocal')) expiryDate = input.expiryLocal ? zonedDateTimeToIso(input.expiryLocal, timeZone).iso : ''
    if (expiryDate && new Date(expiryDate) <= new Date(converted.iso)) throw new Error('The expiry time must be later than the publication time.')
    next = { ...next, draft: false, publishDate: converted.iso, expiryDate }
  } else if (action === 'cancel') {
    next = { ...next, draft: true, publishDate: '' }
  } else if (action === 'publish-now') {
    const requested = instant(input.publishInstant)
    if (input.publishInstant && (!requested || Math.abs(requested - now) > 300_000)) throw new Error('The Publish now preview expired. Review the change again.')
    const publishNow = requested || now
    next = { ...next, draft: false, publishDate: publishNow.toISOString(), expiryDate: instant(post.expiryDate) > publishNow ? post.expiryDate : '' }
  } else {
    throw new Error('Choose a supported calendar action.')
  }
  const changes = [
    changed('draft', post.draft, next.draft),
    changed('publishDate', post.publishDate, next.publishDate),
    changed('expiryDate', post.expiryDate, next.expiryDate),
  ].filter(Boolean)
  if (!changes.length) throw new Error('This post already has the requested schedule.')
  return { action, timeZone, ambiguous, post: { id: post.id, title: post.title, revision: post.revision }, changes, next }
}

async function applyCalendarChange(root, input = {}) {
  const preview = await previewCalendarChange(root, input)
  const recoveryPoint = await createRecoveryPoint(root, { reason: 'before-calendar-change', label: `Before changing the schedule for ${preview.post.title}`, paths: [preview.post.id] })
  try {
    const post = await savePost(root, preview.next)
    return { action: preview.action, changes: preview.changes, post, recoveryPoint }
  } catch (error) {
    await restoreRecoveryPoint(root, recoveryPoint.id, { createUndo: false }).catch(() => {})
    throw error
  }
}

async function saveCalendarTimeZone(root, value) {
  const timeZone = String(value || '').trim()
  if (!validTimeZone(timeZone)) throw new Error('Choose a valid IANA time zone.')
  const metadata = await siteMetadata(root)
  if (metadata.timeZone === timeZone) return { timeZone, changed: false }
  const recoveryPoint = await createRecoveryPoint(root, { reason: 'before-calendar-timezone-change', label: 'Before changing the editorial calendar time zone', paths: await siteConfigurationPaths(root) })
  try {
    await updateSiteConfig(root, { timeZone })
    return { timeZone, changed: true, recoveryPoint }
  } catch (error) {
    await restoreRecoveryPoint(root, recoveryPoint.id, { createUndo: false }).catch(() => {})
    throw error
  }
}

module.exports = { applyCalendarChange, calendarContent, previewCalendarChange, saveCalendarTimeZone, stateFor }
