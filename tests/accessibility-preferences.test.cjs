const test = require('node:test')
const assert = require('node:assert/strict')

test('normalizes and persists local editor and menu font-size preferences', async () => {
  const {
    ACCESSIBILITY_STORAGE_KEY,
    DEFAULT_EDITOR_FONT_SIZE,
    DEFAULT_MENU_FONT_SIZE,
    applyAccessibilityPreferences,
    normalizeEditorFontSize,
    normalizeMenuFontSize,
    readAccessibilityPreferences,
    saveAccessibilityPreferences,
  } = await import('../src/lib/accessibility.js')
  const values = new Map()
  const storage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) }
  assert.equal(normalizeEditorFontSize(99), 22)
  assert.equal(normalizeEditorFontSize(5), 12)
  assert.equal(normalizeEditorFontSize('invalid'), DEFAULT_EDITOR_FONT_SIZE)
  assert.equal(normalizeMenuFontSize(99), 20)
  assert.equal(normalizeMenuFontSize(5), 12)
  assert.equal(normalizeMenuFontSize('invalid'), DEFAULT_MENU_FONT_SIZE)

  assert.deepEqual(saveAccessibilityPreferences({ editorFontSize: 19, menuFontSize: 17 }, storage), { editorFontSize: 19, menuFontSize: 17 })
  assert.deepEqual(readAccessibilityPreferences(storage), { editorFontSize: 19, menuFontSize: 17 })
  assert.match(values.get(ACCESSIBILITY_STORAGE_KEY), /"menuFontSize":17/)

  const style = new Map()
  const root = { style: { setProperty: (name, value) => style.set(name, value) } }
  assert.deepEqual(applyAccessibilityPreferences({ editorFontSize: 18, menuFontSize: 16 }, root), { editorFontSize: 18, menuFontSize: 16 })
  assert.equal(style.get('--editor-font-size'), '18px')
  assert.equal(style.get('--menu-font-size'), '16px')
})

test('adds the default menu size to accessibility preferences saved by older versions', async () => {
  const { ACCESSIBILITY_STORAGE_KEY, DEFAULT_MENU_FONT_SIZE, readAccessibilityPreferences } = await import('../src/lib/accessibility.js')
  const storage = { getItem: (key) => key === ACCESSIBILITY_STORAGE_KEY ? '{"editorFontSize":18}' : null }
  assert.deepEqual(readAccessibilityPreferences(storage), { editorFontSize: 18, menuFontSize: DEFAULT_MENU_FONT_SIZE })
})
