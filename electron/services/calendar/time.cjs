function validTimeZone(value) {
  const timeZone = String(value || '').trim()
  if (!timeZone) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date())
    return true
  } catch {
    return false
  }
}

function defaultTimeZone() {
  const local = Intl.DateTimeFormat().resolvedOptions().timeZone
  return validTimeZone(local) ? local : 'Etc/UTC'
}

function parseWallDateTime(value) {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (!match) throw new Error('Choose a complete date and time.')
  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]), hour: Number(match[4]), minute: Number(match[5]), second: Number(match[6] || 0) }
  const probe = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second))
  if (probe.getUTCFullYear() !== parts.year || probe.getUTCMonth() !== parts.month - 1 || probe.getUTCDate() !== parts.day || probe.getUTCHours() !== parts.hour || probe.getUTCMinutes() !== parts.minute) throw new Error('Choose a valid calendar date and time.')
  return parts
}

function partsInZone(value, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  })
  return Object.fromEntries(formatter.formatToParts(value).filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]))
}

function sameWallTime(left, right) {
  return ['year', 'month', 'day', 'hour', 'minute', 'second'].every((key) => left[key] === right[key])
}

function offsetAt(value, timeZone) {
  const parts = partsInZone(value, timeZone)
  const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return represented - Math.floor(value.getTime() / 1000) * 1000
}

function zonedDateTimeToIso(value, timeZone) {
  if (!validTimeZone(timeZone)) throw new Error('Choose a valid IANA time zone.')
  const desired = parseWallDateTime(value)
  const target = Date.UTC(desired.year, desired.month - 1, desired.day, desired.hour, desired.minute, desired.second)
  let guess = target
  for (let index = 0; index < 4; index += 1) guess = target - offsetAt(new Date(guess), timeZone)
  const possible = [...new Set([guess - 3_600_000, guess, guess + 3_600_000])]
    .filter((instant) => sameWallTime(partsInZone(new Date(instant), timeZone), desired))
    .sort((left, right) => left - right)
  if (!possible.length) throw new Error('This local time does not exist because the clock changes in the selected time zone. Choose another time.')
  return { iso: new Date(possible[0]).toISOString(), ambiguous: possible.length > 1 }
}

function wallDateTimeFromIso(value, timeZone) {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf()) || !validTimeZone(timeZone)) return ''
  const parts = partsInZone(date, timeZone)
  const pad = (number) => String(number).padStart(2, '0')
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`
}

module.exports = { defaultTimeZone, validTimeZone, wallDateTimeFromIso, zonedDateTimeToIso }
