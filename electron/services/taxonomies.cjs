const fs = require('node:fs/promises')
const path = require('node:path')
const TOML = require('@iarna/toml')
const YAML = require('yaml')
const { contentPath, parsePostSource, revisionFor, serializePostSource, slugify } = require('./content.cjs')
const { createRecoveryPoint, restoreRecoveryPoint } = require('./history.cjs')
const { CONFIG_FILES } = require('./languages.cjs')

const DEFAULT_TAXONOMIES = { category: 'categories', tag: 'tags' }

function cleanTerm(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, 120)
}

function termIdentity(value) {
  return cleanTerm(value).normalize('NFKC').toLocaleLowerCase('en-US')
}

function exactTermIdentity(value) {
  return cleanTerm(value).normalize('NFKC')
}

function variantIdentity(value) {
  return slugify(cleanTerm(value))
}

function languageFromId(id) {
  return id.match(/\.([a-z]{2}(?:-[a-z0-9]{2,8})*)\.md$/i)?.[1]?.toLowerCase() || 'default'
}

async function walkMarkdown(directory, root, output = []) {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) await walkMarkdown(absolute, root, output)
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) output.push(path.relative(root, absolute).replaceAll(path.sep, '/'))
  }
  return output
}

async function readHugoConfiguration(root) {
  const entries = await fs.readdir(root)
  const config = CONFIG_FILES.find((candidate) => entries.includes(candidate))
  if (!config) throw new Error('No Hugo configuration file was found.')
  const source = await fs.readFile(path.join(root, config), 'utf8')
  let data
  if (config.endsWith('.toml')) data = TOML.parse(source)
  else if (config.endsWith('.json')) data = JSON.parse(source)
  else data = YAML.parse(source) || {}
  return { config, data: data && typeof data === 'object' ? data : {} }
}

async function configuredTaxonomies(root) {
  const { config, data } = await readHugoConfiguration(root)
  const configured = data.taxonomies && typeof data.taxonomies === 'object' ? data.taxonomies : DEFAULT_TAXONOMIES
  const definitions = Object.entries(configured).flatMap(([singular, plural]) => {
    const safeSingular = String(singular || '').trim()
    const safePlural = String(plural || '').trim()
    if (!/^[a-z0-9_-]{1,80}$/i.test(safeSingular) || !/^[a-z0-9_-]{1,80}$/i.test(safePlural)) return []
    return [{ id: safePlural, singular: safeSingular, plural: safePlural, route: `/${safePlural}/` }]
  })
  const unique = [...new Map(definitions.map((item) => [item.id, item])).values()]
  const disabledKinds = new Set(Array.isArray(data.disableKinds) ? data.disableKinds.map((item) => String(item).toLocaleLowerCase('en-US')) : [])
  return {
    config,
    definitions: unique,
    routesEnabled: !disabledKinds.has('taxonomy') && !disabledKinds.has('term'),
    disabledKinds: [...disabledKinds],
    languages: [...new Set([data.defaultContentLanguage, ...Object.keys(data.languages && typeof data.languages === 'object' ? data.languages : {})].map((item) => String(item || '').toLowerCase()).filter(Boolean))],
  }
}

function termsFromValue(value) {
  if (typeof value === 'string' || typeof value === 'number') return { supported: true, shape: 'scalar', terms: [cleanTerm(value)].filter(Boolean) }
  if (Array.isArray(value) && value.every((item) => typeof item === 'string' || typeof item === 'number')) {
    return { supported: true, shape: 'array', terms: value.map(cleanTerm).filter(Boolean) }
  }
  if (value === undefined || value === null) return { supported: true, shape: 'missing', terms: [] }
  return { supported: false, shape: Array.isArray(value) ? 'nested-array' : typeof value, terms: [] }
}

function publicPost(post) {
  return {
    id: post.id,
    title: post.title,
    language: post.language,
    draft: post.draft,
    taxonomies: post.taxonomies,
  }
}

async function taxonomyTermPages(root, definition) {
  const directory = path.join(root, 'content', definition.plural)
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => [])
  const pages = []
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const termRoot = path.join(directory, entry.name)
    const index = (await fs.readdir(termRoot).catch(() => [])).find((name) => /^_index(?:\.[^.]+)?\.md$/i.test(name))
    let title = entry.name
    if (index) {
      try { title = cleanTerm(parsePostSource(await fs.readFile(path.join(termRoot, index), 'utf8')).data.title) || title } catch { /* Keep the portable folder name. */ }
    }
    pages.push({ term: title, path: path.relative(root, termRoot).replaceAll(path.sep, '/') })
  }
  return pages
}

async function taxonomyIndex(root) {
  const configuration = await configuredTaxonomies(root)
  const ids = await walkMarkdown(path.join(root, 'content', 'posts'), root)
  const posts = []
  const unsupported = []
  const termsByTaxonomy = new Map(configuration.definitions.map((definition) => [definition.id, new Map()]))

  for (const id of ids) {
    try {
      const raw = await fs.readFile(contentPath(root, id), 'utf8')
      const parsed = parsePostSource(raw)
      const taxonomies = {}
      for (const definition of configuration.definitions) {
        const values = termsFromValue(parsed.data[definition.id])
        taxonomies[definition.id] = values.terms
        if (!values.supported) unsupported.push({ postId: id, title: String(parsed.data.title || path.basename(path.dirname(id))), taxonomy: definition.id, shape: values.shape })
      }
      const post = {
        id,
        title: String(parsed.data.title || path.basename(path.dirname(id))),
        language: languageFromId(id),
        draft: parsed.data.draft !== false,
        taxonomies,
        revision: revisionFor(raw),
      }
      posts.push(post)
      for (const definition of configuration.definitions) {
        for (const term of taxonomies[definition.id]) {
          const identity = exactTermIdentity(term)
          const terms = termsByTaxonomy.get(definition.id)
          const current = terms.get(identity) || { id: term, name: term, posts: [], languages: new Set(), draftCount: 0, publishedCount: 0, termPage: '' }
          current.posts.push(id)
          current.languages.add(post.language)
          if (post.draft) current.draftCount += 1
          else current.publishedCount += 1
          terms.set(identity, current)
        }
      }
    } catch (error) {
      unsupported.push({ postId: id, title: path.basename(path.dirname(id)), taxonomy: '', shape: 'unreadable', details: error.message })
    }
  }

  for (const definition of configuration.definitions) {
    const terms = termsByTaxonomy.get(definition.id)
    for (const page of await taxonomyTermPages(root, definition)) {
      const identity = exactTermIdentity(page.term)
      const current = terms.get(identity) || { id: page.term, name: page.term, posts: [], languages: new Set(), draftCount: 0, publishedCount: 0, termPage: '' }
      current.termPage = page.path
      terms.set(identity, current)
    }
  }

  const taxonomies = configuration.definitions.map((definition) => {
    const terms = [...termsByTaxonomy.get(definition.id).values()].map((term) => ({
      ...term,
      count: term.posts.length,
      languages: [...term.languages].sort(),
      empty: term.posts.length === 0,
      route: `/${definition.plural}/${variantIdentity(term.name)}/`,
    })).sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
    const groups = new Map()
    for (const term of terms) {
      const identity = variantIdentity(term.name)
      if (!identity) continue
      const group = groups.get(identity) || []
      group.push(term.name)
      groups.set(identity, group)
    }
    const variants = [...groups.entries()].filter(([, names]) => names.length > 1).map(([identity, names]) => ({ identity, names }))
    return { ...definition, terms, variants, emptyTerms: terms.filter((term) => term.empty).map((term) => term.name) }
  })
  const unclassified = posts.filter((post) => configuration.definitions.every((definition) => !(post.taxonomies[definition.id] || []).length)).map(publicPost)
  return {
    ...configuration,
    taxonomies,
    posts: posts.map(publicPost),
    unclassified,
    unsupported,
    summary: {
      taxonomies: taxonomies.length,
      terms: taxonomies.reduce((total, taxonomy) => total + taxonomy.terms.length, 0),
      variants: taxonomies.reduce((total, taxonomy) => total + taxonomy.variants.length, 0),
      emptyTerms: taxonomies.reduce((total, taxonomy) => total + taxonomy.emptyTerms.length, 0),
      unclassified: unclassified.length,
      posts: posts.length,
    },
  }
}

function safeTaxonomy(index, value) {
  const taxonomy = index.taxonomies.find((item) => item.id === String(value || ''))
  if (!taxonomy) throw new Error('Choose a configured Hugo taxonomy.')
  return taxonomy
}

function uniqueTerms(values) {
  const seen = new Set()
  return values.flatMap((value) => {
    const term = cleanTerm(value)
    const identity = termIdentity(term)
    if (!term || seen.has(identity)) return []
    seen.add(identity)
    return [term]
  })
}

function renamedTerms(values, source, target) {
  const sourceId = termIdentity(source)
  return uniqueTerms(values.map((term) => termIdentity(term) === sourceId ? target : term))
}

function assignedTerms(values, addTerms, removeTerms) {
  const removed = new Set(removeTerms.map(termIdentity))
  return uniqueTerms([...values.filter((term) => !removed.has(termIdentity(term))), ...addTerms])
}

function dataWithTerms(data, taxonomy, terms, shape) {
  const next = { ...data }
  if (shape === 'scalar') {
    if (terms.length) next[taxonomy] = terms.length === 1 ? terms[0] : terms
    else delete next[taxonomy]
  } else if (shape === 'missing') {
    if (terms.length) next[taxonomy] = terms
  } else {
    next[taxonomy] = terms
  }
  return next
}

async function previewTaxonomyChange(root, input = {}) {
  const index = await taxonomyIndex(root)
  const taxonomy = safeTaxonomy(index, input.taxonomy)
  const action = String(input.action || '')
  if (!['rename', 'merge', 'assign'].includes(action)) throw new Error('Choose a supported taxonomy change.')
  const sourceTerm = cleanTerm(input.sourceTerm)
  const targetTerm = cleanTerm(input.targetTerm)
  const selectedIds = new Set(Array.isArray(input.postIds) ? input.postIds.map(String) : [])
  const addTerms = uniqueTerms(Array.isArray(input.addTerms) ? input.addTerms : [])
  const removeTerms = uniqueTerms(Array.isArray(input.removeTerms) ? input.removeTerms : [])
  if (action !== 'assign' && (!sourceTerm || !targetTerm)) throw new Error('Enter both the current term and its new name.')
  if (action === 'assign' && (!selectedIds.size || (!addTerms.length && !removeTerms.length))) throw new Error('Choose posts and at least one term to add or remove.')

  const changes = []
  const skipped = []
  const candidates = action === 'assign' ? [...selectedIds] : index.posts.map((post) => post.id)
  for (const id of candidates) {
    try {
      const absolute = contentPath(root, id)
      const raw = await fs.readFile(absolute, 'utf8')
      const parsed = parsePostSource(raw)
      const current = termsFromValue(parsed.data[taxonomy.id])
      if (!current.supported) {
        skipped.push({ postId: id, title: String(parsed.data.title || path.basename(path.dirname(id))), shape: current.shape })
        continue
      }
      const nextTerms = action === 'assign'
        ? assignedTerms(current.terms, addTerms, removeTerms)
        : renamedTerms(current.terms, sourceTerm, targetTerm)
      if (JSON.stringify(nextTerms) === JSON.stringify(uniqueTerms(current.terms))) continue
      const nextData = dataWithTerms(parsed.data, taxonomy.id, nextTerms, current.shape)
      changes.push({
        postId: id,
        title: String(parsed.data.title || path.basename(path.dirname(id))),
        language: languageFromId(id),
        draft: parsed.data.draft !== false,
        before: current.terms,
        after: nextTerms,
        revision: revisionFor(raw),
        source: serializePostSource(nextData, parsed.content, parsed.format),
      })
    } catch (error) {
      skipped.push({ postId: id, title: path.basename(path.dirname(id)), shape: 'unreadable', details: error.message })
    }
  }
  if (!changes.length) throw new Error('This change would not modify any supported post.')
  const targetExists = taxonomy.terms.some((term) => termIdentity(term.name) === termIdentity(targetTerm) && exactTermIdentity(term.name) !== exactTermIdentity(sourceTerm))
  return {
    action: action === 'rename' && targetExists ? 'merge' : action,
    taxonomy: { id: taxonomy.id, singular: taxonomy.singular, plural: taxonomy.plural },
    sourceTerm,
    targetTerm,
    addTerms,
    removeTerms,
    changes: changes.map((change) => ({
      postId: change.postId,
      title: change.title,
      language: change.language,
      draft: change.draft,
      before: change.before,
      after: change.after,
      revision: change.revision,
    })),
    skipped,
    revisions: Object.fromEntries(changes.map((change) => [change.postId, change.revision])),
    impact: {
      files: changes.length,
      published: changes.filter((change) => !change.draft).length,
      drafts: changes.filter((change) => change.draft).length,
      languages: [...new Set(changes.map((change) => change.language))].sort(),
      routeBefore: sourceTerm ? `/${taxonomy.plural}/${variantIdentity(sourceTerm)}/` : '',
      routeAfter: targetTerm ? `/${taxonomy.plural}/${variantIdentity(targetTerm)}/` : '',
      targetExists,
      aliasesPreserved: false,
    },
  }
}

async function applyTaxonomyChange(root, input = {}) {
  const preview = await previewTaxonomyChange(root, input)
  const expected = input.expectedRevisions && typeof input.expectedRevisions === 'object' ? input.expectedRevisions : null
  if (!expected) throw new Error('Preview this taxonomy change again before applying it.')
  for (const change of preview.changes) {
    if (expected[change.postId] !== change.revision) throw new Error(`${change.title} changed after the preview. Review the taxonomy change again before applying it.`)
  }
  const recoveryPoint = await createRecoveryPoint(root, {
    reason: 'before-taxonomy-change',
    label: preview.action === 'assign' ? `Before editing ${preview.taxonomy.plural}` : `Before ${preview.action} ${preview.sourceTerm}`,
    paths: preview.changes.map((change) => change.postId),
  })
  try {
    for (const change of preview.changes) {
      const raw = await fs.readFile(contentPath(root, change.postId), 'utf8')
      if (revisionFor(raw) !== change.revision) throw new Error(`${change.title} changed while the taxonomy update was being applied.`)
      const parsed = parsePostSource(raw)
      const current = termsFromValue(parsed.data[preview.taxonomy.id])
      const nextTerms = preview.action === 'assign'
        ? assignedTerms(current.terms, preview.addTerms, preview.removeTerms)
        : renamedTerms(current.terms, preview.sourceTerm, preview.targetTerm)
      const source = serializePostSource(dataWithTerms(parsed.data, preview.taxonomy.id, nextTerms, current.shape), parsed.content, parsed.format)
      const absolute = contentPath(root, change.postId)
      const temporary = `${absolute}.${process.pid}.${Date.now()}.tmp`
      try {
        await fs.writeFile(temporary, source, 'utf8')
        await fs.rename(temporary, absolute)
      } finally {
        await fs.rm(temporary, { force: true }).catch(() => {})
      }
    }
    return { preview, recoveryPoint, index: await taxonomyIndex(root) }
  } catch (error) {
    await restoreRecoveryPoint(root, recoveryPoint.id, { createUndo: false }).catch(() => {})
    throw error
  }
}

module.exports = {
  applyTaxonomyChange,
  configuredTaxonomies,
  previewTaxonomyChange,
  taxonomyIndex,
  termIdentity,
  termsFromValue,
  variantIdentity,
}
