// Stable public facade for Electron. Implementation lives in focused core and service modules.
const runtime = require('./core/runtime.cjs')
const content = require('./services/content.cjs')
const github = require('./services/github.cjs')
const publishing = require('./services/publishing.cjs')
const site = require('./services/site.cjs')
const themes = require('./services/themes.cjs')
const updates = require('./services/updates.cjs')

async function importBloggerExport(root, filePath, options = {}) {
  return content.importBloggerExport(root, filePath, options, site.validateBlog)
}

module.exports = {
  ...content,
  ...github,
  ...publishing,
  ...site,
  ...themes,
  ...updates,
  importBloggerExport,
  runtimeFor: runtime.runtimeFor,
  spawnLongRunning: runtime.spawnLongRunning,
  wslCommandArgs: runtime.wslCommandArgs,
}
