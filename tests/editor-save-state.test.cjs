const test = require('node:test')
const assert = require('node:assert/strict')

test('rebases edits made while autosave finishes onto Plumbago own new revision', async () => {
  const { reconcileSavedPost } = await import('../src/app/editor-save-state.js')
  const submitted = { id: 'content/posts/example/index.en-us.md', title: 'Example', body: 'First edit', revision: 'revision-1' }
  const current = { ...submitted, body: 'First edit plus a newer sentence' }
  const saved = { ...submitted, revision: 'revision-2', frontMatterFormat: 'yaml' }

  assert.deepEqual(reconcileSavedPost(current, submitted, saved), {
    ...current,
    revision: 'revision-2',
    frontMatterFormat: 'yaml',
    repairedNestedFrontMatter: false,
  })
  assert.deepEqual(reconcileSavedPost(submitted, submitted, saved), saved)
})

test('rebases a queued save only when it was waiting for the matching Plumbago save', async () => {
  const { rebaseQueuedSubmission } = await import('../src/app/editor-save-state.js')
  const queued = { id: 'content/posts/example/index.en-us.md', body: 'Newer edit', revision: 'revision-1' }
  const completed = {
    id: queued.id,
    submittedRevision: 'revision-1',
    saved: { ...queued, body: 'Earlier edit', revision: 'revision-2', frontMatterFormat: 'toml' },
  }

  assert.deepEqual(rebaseQueuedSubmission(queued, completed), {
    ...queued,
    revision: 'revision-2',
    frontMatterFormat: 'toml',
    repairedNestedFrontMatter: false,
  })
  assert.equal(rebaseQueuedSubmission({ ...queued, revision: 'external-revision' }, completed).revision, 'external-revision')
})

test('protects only posts that are already published, not drafts or future schedules', async () => {
  const { isPostPublished, postPublicationTime } = await import('../src/app/editor-save-state.js')
  const now = new Date('2026-08-13T12:00:00.000Z')
  assert.equal(isPostPublished({ draft: true, date: '2026-08-10' }, now), false)
  assert.equal(isPostPublished({ draft: false, publishDate: '2026-08-13T11:59:00.000Z' }, now), true)
  assert.equal(isPostPublished({ draft: false, publishDate: '2026-08-13T12:01:00.000Z' }, now), false)
  assert.equal(isPostPublished({ draft: false, date: '2026-08-12' }, now), true)
  assert.equal(isPostPublished({ draft: false, date: '2026-08-14' }, now), false)
  assert.equal(postPublicationTime({ publishDate: '2026-08-13T12:01:00.000Z' }), Date.parse('2026-08-13T12:01:00.000Z'))
  assert.equal(postPublicationTime({ date: 'not-a-date' }), null)
})
