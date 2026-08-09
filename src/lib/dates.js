export function formatDate(value, locale, t) {
  if (!value) return t('posts.noDate')
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

export function formatDateTime(value, locale, t) {
  if (!value) return t('posts.noDate')
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function dateTimeInputValue(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return ''
  const local = new Date(date.valueOf() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}
