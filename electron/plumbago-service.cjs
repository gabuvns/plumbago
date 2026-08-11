// Stable public facade for Electron. Implementation lives in focused core and service modules.
const runtime = require('./core/runtime.cjs'), content = require('./services/content.cjs')
const cloudflare = require('./services/cloudflare.cjs'), deployments = require('./services/deployments.cjs'), history = require('./services/history.cjs'), trash = require('./services/trash.cjs')
const git = require('./services/git.cjs')
const github = require('./services/github.cjs')
const hugo = require('./services/hugo.cjs')
const languages = require('./services/languages.cjs')
const publishing = require('./services/publishing.cjs')
const site = require('./services/site.cjs')
const themes = require('./services/themes.cjs')
const updates = require('./services/updates.cjs')
async function importBloggerExport(root, filePath, options = {}) {
  const recoveryPoint = await history.createRecoveryPoint(root, { reason: 'before-import', label: 'Before Blogger import', paths: ['content', ...await history.siteConfigurationPaths(root)] })
  try { return { ...await content.importBloggerExport(root, filePath, options, site.validateBlog), recoveryPoint } }
  catch (error) { await history.restoreRecoveryPoint(root, recoveryPoint.id, { createUndo: false }); throw error }
}
module.exports = {
  ...content, ...history, ...trash,
  ...cloudflare, ...deployments,
  ...git,
  ...github,
  ...hugo,
  ...languages,
  ...publishing,
  ...site,
  ...themes,
  ...updates, importBloggerExport,
  runtimeFor: runtime.runtimeFor, spawnLongRunning: runtime.spawnLongRunning, wslCommandArgs: runtime.wslCommandArgs,
}
