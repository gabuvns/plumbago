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

export function isPostPublished(post, now = new Date()) {
  if (!post || post.draft) return false
  const current = now instanceof Date ? now : new Date(now)
  const publicationTime = postPublicationTime(post)
  return publicationTime === null || publicationTime <= current.valueOf()
}

export function postPublicationTime(post) {
  const publishAt = post?.publishDate ? new Date(post.publishDate) : null
  if (publishAt && !Number.isNaN(publishAt.valueOf())) return publishAt.valueOf()
  const contentAt = /^\d{4}-\d{2}-\d{2}$/.test(String(post?.date || '')) ? new Date(`${post.date}T00:00:00`) : null
  return contentAt && !Number.isNaN(contentAt.valueOf()) ? contentAt.valueOf() : null
}
