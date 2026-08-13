export const DEFAULT_EDITOR_FONT_SIZE = 14
export const MIN_EDITOR_FONT_SIZE = 12
export const MAX_EDITOR_FONT_SIZE = 22
export const DEFAULT_MENU_FONT_SIZE = 13
export const MIN_MENU_FONT_SIZE = 12
export const MAX_MENU_FONT_SIZE = 20
export const ACCESSIBILITY_STORAGE_KEY = 'plumbago.accessibility.v1'

export function normalizeEditorFontSize(value) {
  const numeric = Math.round(Number(value))
  if (!Number.isFinite(numeric)) return DEFAULT_EDITOR_FONT_SIZE
  return Math.min(MAX_EDITOR_FONT_SIZE, Math.max(MIN_EDITOR_FONT_SIZE, numeric))
}

export function normalizeMenuFontSize(value) {
  const numeric = Math.round(Number(value))
  if (!Number.isFinite(numeric)) return DEFAULT_MENU_FONT_SIZE
  return Math.min(MAX_MENU_FONT_SIZE, Math.max(MIN_MENU_FONT_SIZE, numeric))
}

function normalizePreferences(preferences = {}) {
  return {
    editorFontSize: normalizeEditorFontSize(preferences.editorFontSize),
    menuFontSize: normalizeMenuFontSize(preferences.menuFontSize),
  }
}

export function readAccessibilityPreferences(storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage?.getItem(ACCESSIBILITY_STORAGE_KEY) || '{}')
    return normalizePreferences(value)
  } catch {
    return normalizePreferences()
  }
}

export function saveAccessibilityPreferences(preferences, storage = globalThis.localStorage) {
  const normalized = normalizePreferences(preferences)
  try { storage?.setItem(ACCESSIBILITY_STORAGE_KEY, JSON.stringify(normalized)) } catch { /* A local preference may remain session-only. */ }
  return normalized
}

export function applyAccessibilityPreferences(preferences, root = globalThis.document?.documentElement) {
  const normalized = saveAccessibilityPreferences(preferences)
  root?.style?.setProperty('--editor-font-size', `${normalized.editorFontSize}px`)
  root?.style?.setProperty('--menu-font-size', `${normalized.menuFontSize}px`)
  return normalized
}
