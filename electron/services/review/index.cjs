const path = require('node:path')
const { readPost, savePost } = require('../content.cjs')
const { createRecoveryPoint, restoreRecoveryPoint } = require('../history.cjs')
const { updateMediaReference } = require('../media.cjs')
const { hostingSettings, saveSiteSettings, siteMetadata, siteSettings } = require('../site.cjs')
const { finding, inspectContent } = require('./content.cjs')
const { inspectOutput } = require('./output.cjs')

const severityOrder = { error: 0, warning: 1, recommendation: 2 }
const activeReviews = new Map()

function siteFindings(metadata, hosting) {
  const findings = []
  if (!metadata.title.trim()) findings.push(finding('site-title-missing', 'warning', { fix: { kind: 'text', field: 'siteTitle', before: '', placeholder: 'review.fix.siteTitlePlaceholder' } }))
  let parsed = null
  try { parsed = metadata.baseURL ? new URL(metadata.baseURL) : null } catch { /* Report below. */ }
  if (!metadata.baseURL) findings.push(finding('site-base-url-missing', 'warning'))
  else if (!parsed) findings.push(finding('site-base-url-invalid', 'error', { values: { baseURL: metadata.baseURL } }))
  else if (parsed.protocol !== 'https:' || ['localhost', '127.0.0.1'].includes(parsed.hostname)) findings.push(finding('site-base-url-not-production', 'warning', { values: { baseURL: metadata.baseURL } }))
  if (hosting.publicUrl && metadata.baseURL !== hosting.publicUrl) {
    findings.push(finding('site-base-url-mismatch', 'warning', {
      values: { baseURL: metadata.baseURL || '—', publicUrl: hosting.publicUrl },
      fix: { kind: 'exact', field: 'baseURL', before: metadata.baseURL || '—', after: hosting.publicUrl },
    }))
  }
  if (!metadata.languageCode) findings.push(finding('site-language-missing', 'recommendation'))
  return findings
}

async function runSiteReview(root) {
  const metadata = await siteMetadata(root)
  const hosting = await hostingSettings(root, metadata.baseURL)
  const content = await inspectContent(root, { baseURL: hosting.publicUrl || metadata.baseURL })
  const outputFindings = await inspectOutput(root, hosting.publicUrl || metadata.baseURL)
  const findings = [...siteFindings(metadata, hosting), ...content.findings, ...outputFindings]
    .sort((left, right) => severityOrder[left.severity] - severityOrder[right.severity] || left.rule.localeCompare(right.rule) || left.postTitle.localeCompare(right.postTitle))
  const summary = {
    total: findings.length,
    errors: findings.filter((item) => item.severity === 'error').length,
    warnings: findings.filter((item) => item.severity === 'warning').length,
    recommendations: findings.filter((item) => item.severity === 'recommendation').length,
    fixable: findings.filter((item) => item.fix).length,
    postsChecked: content.posts.length,
  }
  return { findings, summary: { ...summary, ready: summary.errors === 0, score: Math.max(0, 100 - summary.errors * 20 - summary.warnings * 6 - summary.recommendations * 2) }, checkedAt: new Date().toISOString() }
}

async function siteReview(root) {
  const key = path.resolve(root)
  if (activeReviews.has(key)) return activeReviews.get(key)
  const task = runSiteReview(root)
  activeReviews.set(key, task)
  try { return await task } finally { if (activeReviews.get(key) === task) activeReviews.delete(key) }
}

function fixValue(input, maximum, label) {
  const value = String(input?.value || '').trim()
  if (!value) throw new Error(`Enter ${label} before applying this fix.`)
  if (value.length > maximum) throw new Error(`${label} must be ${maximum} characters or fewer.`)
  return value
}

async function savePostField(root, findingItem, field, value) {
  const post = await readPost(root, findingItem.postId)
  const recoveryPoint = await createRecoveryPoint(root, { reason: 'before-review-fix', label: `Before fixing ${findingItem.rule}`, paths: [findingItem.postId] })
  try {
    return { post: await savePost(root, { ...post, [field]: value }), recoveryPoint }
  } catch (error) {
    await restoreRecoveryPoint(root, recoveryPoint.id, { createUndo: false }).catch(() => {})
    throw error
  }
}

async function applyReviewFix(root, input = {}) {
  const review = await siteReview(root)
  const findingItem = review.findings.find((item) => item.id === input.findingId)
  if (!findingItem?.fix) throw new Error('This review finding changed or has no safe fix. Run the review again.')
  let result
  if (findingItem.fix.field === 'description') {
    result = await savePostField(root, findingItem, 'description', fixValue(input, 160, 'a description'))
  } else if (findingItem.fix.field === 'alt') {
    result = await updateMediaReference(root, {
      mediaId: findingItem.fix.mediaId,
      postId: findingItem.fix.postId,
      referenceId: findingItem.fix.referenceId,
      alt: fixValue(input, 300, 'alternative text'),
      caption: findingItem.fix.caption,
    })
  } else if (findingItem.fix.field === 'siteTitle') {
    result = await saveSiteSettings(root, { ...await siteSettings(root), title: fixValue(input, 100, 'a site title') })
  } else if (findingItem.fix.field === 'baseURL') {
    const settings = await siteSettings(root)
    result = await saveSiteSettings(root, { ...settings, baseURL: findingItem.fix.after })
  } else {
    throw new Error('This safe fix is not supported.')
  }
  return { findingId: findingItem.id, rule: findingItem.rule, result }
}

module.exports = { applyReviewFix, siteReview }
