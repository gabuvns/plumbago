const { automationStatus, cloudflareWorkflow, disableAutomation, enableAutomation, runAutomationNow } = require('./automation.cjs')
const { applyCalendarChange, calendarContent, previewCalendarChange, saveCalendarTimeZone } = require('./content.cjs')
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

module.exports = {
  applyCalendarChange,
  calendarCloudflareWorkflow: cloudflareWorkflow,
  calendarDefaultTimeZone: defaultTimeZone,
  disableCalendarAutomation: disableAutomation,
  editorialCalendar,
  enableCalendarAutomation: enableAutomation,
  previewCalendarChange,
  runCalendarAutomationNow: runAutomationNow,
  saveCalendarTimeZone,
  validCalendarTimeZone: validTimeZone,
  wallDateTimeFromIso,
  zonedDateTimeToIso,
}
