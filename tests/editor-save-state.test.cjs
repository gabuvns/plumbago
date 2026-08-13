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
