const { fetchJson } = require('../core/http.cjs')
const { compareVersions } = require('./theme-compatibility.cjs')

const RELEASES_URL = 'https://github.com/gabuvns/plumbago/releases/latest'
const LATEST_RELEASE_API = 'https://api.github.com/repos/gabuvns/plumbago/releases/latest'

function cleanVersion(value) {
  const match = String(value || '').match(/\d+\.\d+(?:\.\d+)?/)
  return match?.[0] || ''
}

function releaseSummary(currentVersion, release) {
  const version = cleanVersion(release?.tag_name || release?.name)
  if (!version) throw new Error('The latest Plumbago release does not have a valid version number.')
  const available = compareVersions(version, currentVersion) > 0
  return {
    state: available ? 'available' : 'up-to-date',
    currentVersion: cleanVersion(currentVersion),
    version,
    name: String(release?.name || release?.tag_name || `Plumbago ${version}`),
    notes: String(release?.body || '').trim().slice(0, 4_000),
    publishedAt: String(release?.published_at || ''),
    releaseUrl: String(release?.html_url || RELEASES_URL),
  }
}

async function checkLatestRelease(currentVersion) {
  return releaseSummary(currentVersion, await fetchJson(LATEST_RELEASE_API))
}

module.exports = { checkLatestRelease, cleanVersion, releaseSummary, RELEASES_URL }
