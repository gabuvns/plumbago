function safeWorkflowTimeZone(value) {
  const timeZone = String(value || 'Etc/UTC').trim()
  try { new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date()) } catch { return 'Etc/UTC' }
  return timeZone.replace(/[^A-Za-z0-9_+/-]/g, '') || 'Etc/UTC'
}

module.exports = { safeWorkflowTimeZone }
