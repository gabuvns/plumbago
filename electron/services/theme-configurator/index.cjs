const { discoverThemeConfiguration, publicThemeConfiguration } = require('./discovery.cjs')
const {
  applyThemeConfiguration: applyConfiguration,
  deleteThemePreset,
  listThemePresets,
  previewThemeConfiguration,
  saveThemePreset,
  themePreviewLaunch,
} = require('./mutations.cjs')

async function themeConfiguration(root) {
  const [inventory, presets] = await Promise.all([discoverThemeConfiguration(root), listThemePresets(root)])
  return publicThemeConfiguration(inventory, presets)
}

async function applyThemeConfiguration(root, input) {
  const result = await applyConfiguration(root, input)
  return { ...result, inventory: publicThemeConfiguration(result.inventory, await listThemePresets(root)) }
}

module.exports = {
  applyThemeConfiguration,
  deleteThemePreset,
  previewThemeConfiguration,
  saveThemePreset,
  themeConfiguration,
  themePreviewLaunch,
}
