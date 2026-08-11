const { version } = require('../../package.json')

const USER_AGENT = `Plumbago-Hugo-UI/${version}`

async function fetchText(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.text()
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchJson(url) {
  return JSON.parse(await fetchText(url))
}

async function postForm(url, values) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
      },
      body: new URLSearchParams(values),
      signal: controller.signal,
    })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error_description || payload.message || `GitHub returned HTTP ${response.status}.`)
    return payload
  } finally {
    clearTimeout(timeout)
  }
}

function githubErrorMessage(status, payload, headers = new Headers()) {
  const detail = payload?.errors?.map((item) => item.message || item.code).filter(Boolean).join(', ')
  const reason = detail || payload?.message || ''
  const fallback = status === 401
    ? 'Your GitHub authorization expired. Disconnect and sign in again.'
    : status === 403
      ? headers.get('x-ratelimit-remaining') === '0'
        ? 'GitHub API limits were reached. Wait a few minutes and try again.'
        : 'GitHub denied this action. Reconnect the account or choose a repository where you have write access.'
      : `GitHub returned HTTP ${status}.`
  return [fallback, reason && reason !== fallback ? reason : ''].filter(Boolean).join(' ')
}

async function githubRequest(token, route, options = {}) {
  if (!token) throw new Error('Connect a GitHub account first.')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20_000)
  try {
    const response = await fetch(`https://api.github.com${route}`, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    })
    const payload = response.status === 204 ? null : await response.json().catch(() => null)
    if (!response.ok) {
      const error = new Error(githubErrorMessage(response.status, payload, response.headers))
      error.status = response.status
      throw error
    }
    return payload
  } finally {
    clearTimeout(timeout)
  }
}

module.exports = { fetchJson, fetchText, githubErrorMessage, githubRequest, postForm }
