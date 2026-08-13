export function savedSnapshot(value) {
  return JSON.stringify(value?.repairedNestedFrontMatter ? { ...value, repairedNestedFrontMatter: false } : value)
}

export function rebaseQueuedSubmission(target, completedSave) {
  if (!target || !completedSave?.saved) return target
  if (target.id !== completedSave.id || target.revision !== completedSave.submittedRevision) return target
  return {
    ...target,
    revision: completedSave.saved.revision,
    frontMatterFormat: completedSave.saved.frontMatterFormat || target.frontMatterFormat,
    repairedNestedFrontMatter: false,
  }
}

export function reconcileSavedPost(current, submitted, saved) {
  if (!current || current.id !== saved?.id) return current
  if (JSON.stringify(current) === JSON.stringify(submitted)) return saved
  return {
    ...current,
    revision: saved.revision,
    frontMatterFormat: saved.frontMatterFormat || current.frontMatterFormat,
    repairedNestedFrontMatter: false,
  }
}
