const test = require('node:test')
const assert = require('node:assert/strict')

test('normalizes and persists the local editor font-size preference', async () => {
  const {
    ACCESSIBILITY_STORAGE_KEY,
    DEFAULT_EDITOR_FONT_SIZE,
    applyAccessibilityPreferences,
    normalizeEditorFontSize,
    readAccessibilityPreferences,
    saveAccessibilityPreferences,
  } = await import('../src/lib/accessibility.js')
  const values = new Map()
  const storage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) }
  assert.equal(normalizeEditorFontSize(99), 22)
  assert.equal(normalizeEditorFontSize(5), 12)
  assert.equal(normalizeEditorFontSize('invalid'), DEFAULT_EDITOR_FONT_SIZE)

  assert.deepEqual(saveAccessibilityPreferences({ editorFontSize: 19 }, storage), { editorFontSize: 19 })
  assert.deepEqual(readAccessibilityPreferences(storage), { editorFontSize: 19 })
  assert.match(values.get(ACCESSIBILITY_STORAGE_KEY), /19/)

  const style = new Map()
  const root = { style: { setProperty: (name, value) => style.set(name, value) } }
  assert.deepEqual(applyAccessibilityPreferences({ editorFontSize: 18 }, root), { editorFontSize: 18 })
  assert.equal(style.get('--editor-font-size'), '18px')
})
