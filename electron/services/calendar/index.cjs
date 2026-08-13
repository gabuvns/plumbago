const { automationStatus, cloudflareWorkflow, disableAutomation, enableAutomation, runAutomationNow } = require('./automation.cjs')
const { applyCalendarChange, calendarContent, previewCalendarChange, saveCalendarTimeZone } = require('./content.cjs')
const { syncGit } = require('../publishing.cjs')
const { defaultTimeZone, validTimeZone, wallDateTimeFromIso, zonedDateTimeToIso } = require('./time.cjs')

async function editorialCalendar(root, credentials = {}, options = {}) {
  const [content, automation] = await Promise.all([calendarContent(root, options), automationStatus(root, credentials)])
  const lastRunAt = automation.lastRun?.updatedAt || ''
  const boundaries = content.items.flatMap((item) => [
    item.publishDate && !item.draft ? { item, at: item.publishDate, kind: 'publication' } : null,
    item.expiryDate ? { item, at: item.expiryDate, kind: 'expiry' } : null,
  ]).filter((entry) => entry && new Date(entry.at) <= new Date(content.now)).sort((left, right) => right.at.localeCompare(left.at))
  const missed = automation.enabled ? boundaries.find((entry) => !lastRunAt || new Date(lastRunAt) < new Date(entry.at)) || null : null
  const grace = (automation.intervalMinutes || 30) * 60_000 + 15 * 60_000
  const overdue = Boolean(missed && new Date(content.now) - new Date(missed.at) > grace)
  return { ...content, automation: { ...automation, overdue, missed: missed ? { postId: missed.item.id, postTitle: missed.item.title, boundaryAt: missed.at, kind: missed.kind } : null } }
}

async function syncCalendarChanges(root, credentials = {}, options = {}) {
  const readStatus = options.automationStatus || automationStatus
  const sync = options.syncGit || syncGit
  const automation = options.automation || await readStatus(root, credentials)
  if (!automation.enabled) throw new Error('Enable background publishing before synchronizing an editorial schedule.')
  const result = await sync(root, 'Update editorial schedule with Plumbago', { githubToken: credentials.githubToken })
  return { required: true, state: 'synced', log: result.log || [], automation: await readStatus(root, credentials) }
}

async function applyEditorialCalendarChange(root, input = {}, credentials = {}, options = {}) {
  const applied = await applyCalendarChange(root, input)
  const readStatus = options.automationStatus || automationStatus
  let automation
  try {
    automation = await readStatus(root, credentials)
  } catch (error) {
    return { ...applied, sync: { required: true, state: 'failed', message: error.message } }
  }
  if (!automation.enabled) return { ...applied, sync: { required: false, state: 'not-required' } }
  try {
    return { ...applied, sync: await syncCalendarChanges(root, credentials, { ...options, automation }) }
  } catch (error) {
    return { ...applied, sync: { required: true, state: 'failed', message: error.message } }
  }
}

module.exports = {
  applyCalendarChange,
  applyEditorialCalendarChange,
  calendarCloudflareWorkflow: cloudflareWorkflow,
  calendarDefaultTimeZone: defaultTimeZone,
  disableCalendarAutomation: disableAutomation,
  editorialCalendar,
  enableCalendarAutomation: enableAutomation,
  previewCalendarChange,
  runCalendarAutomationNow: runAutomationNow,
  saveCalendarTimeZone,
  syncCalendarChanges,
  validCalendarTimeZone: validTimeZone,
  wallDateTimeFromIso,
  zonedDateTimeToIso,
}
