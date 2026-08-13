import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, Check, CheckCircle2, FileText, Filter, FolderTree, Languages, LoaderCircle, Merge, PencilLine, RefreshCw, Search, Tags, UsersRound } from 'lucide-react'
import { api } from '../../app/api'
import { Modal } from '../../components/ui/Modal'
import { useI18n } from '../../i18n'
import { friendlyError } from '../../lib/errors'

const emptyIndex = { taxonomies: [], posts: [], unclassified: [], unsupported: [], summary: { taxonomies: 0, terms: 0, variants: 0, emptyTerms: 0, unclassified: 0, posts: 0 } }

function splitTerms(value) {
  return [...new Set(String(value || '').split(',').map((item) => item.trim()).filter(Boolean))]
}

function sameTerm(left, right) {
  return String(left || '').trim().toLocaleLowerCase('en-US') === String(right || '').trim().toLocaleLowerCase('en-US')
}

function TaxonomyIcon({ id }) {
  if (/author|people|contributor/i.test(id)) return <UsersRound size={18} />
  if (/categor/i.test(id)) return <FolderTree size={18} />
  return <Tags size={18} />
}

export function TaxonomyManager({ filters, onApplyFilters, onChanged, onClose, notify }) {
  const { t } = useI18n()
  const [index, setIndex] = useState(emptyIndex)
  const [taxonomyId, setTaxonomyId] = useState('')
  const [termName, setTermName] = useState('')
  const [query, setQuery] = useState('')
  const [diagnostic, setDiagnostic] = useState('all')
  const [working, setWorking] = useState('load')
  const [mode, setMode] = useState('browse')
  const [targetTerm, setTargetTerm] = useState('')
  const [selectedPosts, setSelectedPosts] = useState([])
  const [addTerms, setAddTerms] = useState('')
  const [removeTerms, setRemoveTerms] = useState('')
  const [preview, setPreview] = useState(null)
  const [localFilters, setLocalFilters] = useState(filters || [])

  const load = useCallback(async () => {
    setWorking('load')
    try {
      const next = await api.taxonomyIndex()
      setIndex(next)
      setTaxonomyId((current) => next.taxonomies.some((item) => item.id === current) ? current : next.taxonomies[0]?.id || '')
    } catch (error) {
      notify(friendlyError(error, t), 'error')
    } finally {
      setWorking('')
    }
  }, [notify, t])

  useEffect(() => { load() }, [load])

  const taxonomy = index.taxonomies.find((item) => item.id === taxonomyId) || index.taxonomies[0]
  const variantTerms = useMemo(() => new Set((taxonomy?.variants || []).flatMap((group) => group.names)), [taxonomy])
  const visibleTerms = useMemo(() => (taxonomy?.terms || []).filter((term) => {
    const matchesQuery = `${term.name} ${term.languages.join(' ')}`.toLowerCase().includes(query.toLowerCase())
    if (!matchesQuery) return false
    if (diagnostic === 'variants') return variantTerms.has(term.name)
    if (diagnostic === 'empty') return term.empty
    if (diagnostic === 'drafts') return term.draftCount > 0 && term.publishedCount === 0
    return true
  }), [diagnostic, query, taxonomy, variantTerms])
  const selectedTerm = taxonomy?.terms.find((term) => term.name === termName) || visibleTerms[0] || taxonomy?.terms[0]
  const unclassifiedPosts = useMemo(() => taxonomy ? index.posts.filter((post) => !(post.taxonomies?.[taxonomy.id] || []).length) : [], [index.posts, taxonomy])

  useEffect(() => {
    if (selectedTerm && selectedTerm.name !== termName) setTermName(selectedTerm.name)
  }, [selectedTerm, termName])

  const matchedPostIds = useMemo(() => index.posts.filter((post) => localFilters.every((filter) => (post.taxonomies?.[filter.taxonomy] || []).some((term) => sameTerm(term, filter.term)))).map((post) => post.id), [index.posts, localFilters])

  function selectTaxonomy(id) {
    setTaxonomyId(id)
    setTermName('')
    setPreview(null)
    setMode('browse')
  }

  function toggleFilter(term) {
    const exists = localFilters.some((item) => item.taxonomy === taxonomy.id && sameTerm(item.term, term.name))
    setLocalFilters((current) => exists
      ? current.filter((item) => !(item.taxonomy === taxonomy.id && sameTerm(item.term, term.name)))
      : [...current, { taxonomy: taxonomy.id, term: term.name }])
  }

  async function previewRename() {
    setWorking('preview')
    try {
      setPreview(await api.previewTaxonomyChange({ action: 'rename', taxonomy: taxonomy.id, sourceTerm: selectedTerm.name, targetTerm }))
    } catch (error) {
      notify(friendlyError(error, t), 'error')
    } finally { setWorking('') }
  }

  async function previewAssignment() {
    setWorking('preview')
    try {
      setPreview(await api.previewTaxonomyChange({ action: 'assign', taxonomy: taxonomy.id, postIds: selectedPosts, addTerms: splitTerms(addTerms), removeTerms: splitTerms(removeTerms) }))
    } catch (error) {
      notify(friendlyError(error, t), 'error')
    } finally { setWorking('') }
  }

  async function applyChange() {
    setWorking('apply')
    try {
      const input = preview.action === 'assign'
        ? { action: 'assign', taxonomy: preview.taxonomy.id, postIds: preview.changes.map((change) => change.postId), addTerms: preview.addTerms, removeTerms: preview.removeTerms }
        : { action: preview.action, taxonomy: preview.taxonomy.id, sourceTerm: preview.sourceTerm, targetTerm: preview.targetTerm }
      const result = await api.applyTaxonomyChange({ ...input, expectedRevisions: preview.revisions })
      setIndex(result.index)
      setPreview(null)
      setTargetTerm('')
      setAddTerms('')
      setRemoveTerms('')
      setSelectedPosts([])
      setTermName(preview.targetTerm || '')
      await onChanged()
      notify(t(result.preview.impact.files === 1 ? 'notice.taxonomyChanged.one' : 'notice.taxonomyChanged.other', { count: result.preview.impact.files }))
    } catch (error) {
      notify(friendlyError(error, t), 'error')
    } finally { setWorking('') }
  }

  function togglePost(id) {
    setSelectedPosts((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  return (
    <Modal title={t('taxonomy.title')} onClose={onClose} width="1180px">
      <div className="taxonomy-workspace">
        <header className="taxonomy-hero">
          <div><span className="taxonomy-hero-icon"><Tags size={24} /></span><div><h3>{t('taxonomy.heroTitle')}</h3><p>{t('taxonomy.heroCopy')}</p></div></div>
          <dl>
            <div><dt>{t('taxonomy.summary.terms')}</dt><dd>{index.summary.terms}</dd></div>
            <div><dt>{t('taxonomy.summary.variants')}</dt><dd>{index.summary.variants}</dd></div>
            <div><dt>{t('taxonomy.summary.unclassified')}</dt><dd>{index.summary.unclassified}</dd></div>
          </dl>
        </header>

        {working === 'load' ? <div className="taxonomy-loading"><LoaderCircle className="spin" /> {t('taxonomy.loading')}</div> : !index.taxonomies.length ? <div className="taxonomy-loading"><AlertTriangle /> {t('taxonomy.noDefinitions')}</div> : <>
          <nav className="taxonomy-tabs" aria-label={t('taxonomy.definitions')}>
            {index.taxonomies.map((item) => <button key={item.id} className={item.id === taxonomy?.id ? 'active' : ''} onClick={() => selectTaxonomy(item.id)}><TaxonomyIcon id={item.id} /><span>{item.plural}</span><small>{item.terms.length}</small></button>)}
          </nav>

          {!index.routesEnabled && <div className="taxonomy-route-disabled"><AlertTriangle size={16} /><div><strong>{t('taxonomy.routesDisabledTitle')}</strong><p>{t('taxonomy.routesDisabledCopy')}</p></div></div>}

          {localFilters.length > 0 && <div className="taxonomy-active-filters" role="status"><Filter size={15} /><strong>{t('taxonomy.filters.active')}</strong>{localFilters.map((filter) => <button key={`${filter.taxonomy}:${filter.term}`} onClick={() => setLocalFilters((current) => current.filter((item) => item !== filter))}>{filter.taxonomy}: {filter.term} ×</button>)}<button className="button primary" onClick={() => { onApplyFilters(localFilters); onClose() }}>{t(matchedPostIds.length === 1 ? 'taxonomy.filters.showPosts.one' : 'taxonomy.filters.showPosts.other', { count: matchedPostIds.length })}</button><button className="button quiet" onClick={() => { setLocalFilters([]); onApplyFilters([]) }}>{t('taxonomy.filters.clear')}</button></div>}

          <div className="taxonomy-toolbar">
            <div className="search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('taxonomy.search')} /></div>
            <div className="taxonomy-diagnostics">
              {['all', 'variants', 'empty', 'drafts'].map((item) => <button key={item} className={diagnostic === item ? 'active' : ''} onClick={() => setDiagnostic(item)}>{t(`taxonomy.diagnostic.${item}`)}</button>)}
            </div>
            <button className="button quiet" onClick={() => { setMode(mode === 'bulk' ? 'browse' : 'bulk'); setPreview(null) }}><PencilLine size={15} /> {t(mode === 'bulk' ? 'taxonomy.browseTerms' : 'taxonomy.bulkEdit')}</button>
          </div>

          <div className={`taxonomy-layout ${mode === 'bulk' ? 'bulk' : ''}`}>
            {mode === 'browse' ? <>
              <div className="taxonomy-term-list" role="list" aria-label={t('taxonomy.terms')}>
                {visibleTerms.map((term) => {
                  const filtered = localFilters.some((item) => item.taxonomy === taxonomy.id && sameTerm(item.term, term.name))
                  return <div key={term.name} role="listitem" className={`taxonomy-term-row ${selectedTerm?.name === term.name ? 'active' : ''}`}>
                    <button className="taxonomy-term-select" aria-pressed={selectedTerm?.name === term.name} onClick={() => { setTermName(term.name); setPreview(null); setTargetTerm('') }}>
                      <span><strong>{term.name}</strong><small>{term.route}</small></span>
                      <span className="taxonomy-term-meta"><b>{term.count}</b>{term.empty && <i>{t('taxonomy.empty')}</i>}{variantTerms.has(term.name) && <i>{t('taxonomy.variant')}</i>}</span>
                    </button>
                    <button type="button" className={`taxonomy-term-filter ${filtered ? 'filtered' : ''}`} onClick={() => toggleFilter(term)} title={t('taxonomy.filters.toggle')} aria-label={t('taxonomy.filters.toggleTerm', { term: term.name })} aria-pressed={filtered}><Filter size={13} /></button>
                  </div>
                })}
                {!visibleTerms.length && <div className="taxonomy-empty"><Search size={22} /><p>{t('taxonomy.noTerms')}</p></div>}
              </div>

              <aside className="taxonomy-detail">
                {selectedTerm ? <>
                  <header><div><span>{taxonomy.singular}</span><h3>{selectedTerm.name}</h3><code>{selectedTerm.route}</code></div><button className={localFilters.some((item) => item.taxonomy === taxonomy.id && sameTerm(item.term, selectedTerm.name)) ? 'button primary' : 'button quiet'} onClick={() => toggleFilter(selectedTerm)}><Filter size={15} /> {t('taxonomy.filters.toggle')}</button></header>
                  <dl className="taxonomy-term-summary">
                    <div><dt>{t('taxonomy.posts')}</dt><dd>{selectedTerm.count}</dd></div>
                    <div><dt>{t('taxonomy.published')}</dt><dd>{selectedTerm.publishedCount}</dd></div>
                    <div><dt>{t('taxonomy.drafts')}</dt><dd>{selectedTerm.draftCount}</dd></div>
                    <div><dt>{t('taxonomy.languages')}</dt><dd>{selectedTerm.languages.join(', ') || '—'}</dd></div>
                  </dl>
                  {selectedTerm.termPage && <p className="taxonomy-term-page"><FileText size={14} /> {t('taxonomy.termPage', { path: selectedTerm.termPage })}</p>}
                  <div className="taxonomy-posts"><h4>{t('taxonomy.affectedPosts')}</h4>{selectedTerm.posts.map((id) => { const post = index.posts.find((item) => item.id === id); return <div key={id}><FileText size={14} /><span><strong>{post?.title || id}</strong><small>{post?.language} · {post?.draft ? t('posts.draft') : t('posts.live')}</small></span></div> })}{!selectedTerm.posts.length && <p>{t('taxonomy.emptyTermCopy')}</p>}</div>
                  <section className="taxonomy-rename"><h4><Merge size={15} /> {t('taxonomy.renameTitle')}</h4><p>{t('taxonomy.renameCopy')}</p><label>{t('taxonomy.newTerm')}<input value={targetTerm} onChange={(event) => { setTargetTerm(event.target.value); setPreview(null) }} placeholder={selectedTerm.name} /></label><button className="button primary" disabled={!targetTerm.trim() || working === 'preview'} onClick={previewRename}>{working === 'preview' ? <LoaderCircle className="spin" size={15} /> : <ArrowRight size={15} />} {t('taxonomy.preview')}</button></section>
                </> : <div className="taxonomy-empty"><Tags size={28} /><p>{t('taxonomy.chooseTerm')}</p></div>}
              </aside>
            </> : <>
              <section className="taxonomy-bulk-posts">
                <header><div><h3>{t('taxonomy.bulkTitle')}</h3><p>{t('taxonomy.bulkCopy', { taxonomy: taxonomy.plural })}</p></div><button className="button quiet" onClick={() => setSelectedPosts(selectedPosts.length === index.posts.length ? [] : index.posts.map((post) => post.id))}><Check size={14} /> {t(selectedPosts.length === index.posts.length ? 'taxonomy.selectNone' : 'taxonomy.selectAll')}</button></header>
                <div>{index.posts.map((post) => <label key={post.id}><input type="checkbox" checked={selectedPosts.includes(post.id)} onChange={() => togglePost(post.id)} /><span><strong>{post.title}</strong><small>{post.language} · {post.draft ? t('posts.draft') : t('posts.live')} · {(post.taxonomies[taxonomy.id] || []).join(', ') || t('taxonomy.none')}</small></span></label>)}</div>
              </section>
              <aside className="taxonomy-bulk-editor">
                <h3>{t(selectedPosts.length === 1 ? 'taxonomy.editSelection.one' : 'taxonomy.editSelection.other', { count: selectedPosts.length })}</h3>
                <p>{t('taxonomy.editSelectionCopy')}</p>
                <label>{t('taxonomy.addTerms')}<input value={addTerms} onChange={(event) => { setAddTerms(event.target.value); setPreview(null) }} placeholder={t('taxonomy.commaSeparated')} /></label>
                <label>{t('taxonomy.removeTerms')}<input value={removeTerms} onChange={(event) => { setRemoveTerms(event.target.value); setPreview(null) }} placeholder={t('taxonomy.commaSeparated')} /></label>
                <button className="button primary" onClick={previewAssignment} disabled={!selectedPosts.length || (!addTerms.trim() && !removeTerms.trim()) || working === 'preview'}>{working === 'preview' ? <LoaderCircle className="spin" size={15} /> : <ArrowRight size={15} />} {t('taxonomy.preview')}</button>
                {unclassifiedPosts.length > 0 && <div className="taxonomy-unclassified"><AlertTriangle size={16} /><div><strong>{t(unclassifiedPosts.length === 1 ? 'taxonomy.unclassifiedTitle.one' : 'taxonomy.unclassifiedTitle.other', { count: unclassifiedPosts.length })}</strong><p>{t('taxonomy.unclassifiedCopy', { taxonomy: taxonomy.plural })}</p><button onClick={() => setSelectedPosts(unclassifiedPosts.map((post) => post.id))}>{t('taxonomy.selectUnclassified')}</button></div></div>}
              </aside>
            </>}
          </div>
        </>}

        {preview && <div className="taxonomy-preview" role="dialog" aria-modal="true" aria-label={t('taxonomy.previewTitle')}>
          <section>
            <header><div><CheckCircle2 size={22} /><div><h3>{t('taxonomy.previewTitle')}</h3><p>{t(`taxonomy.previewAction.${preview.action}.${preview.impact.files === 1 ? 'one' : 'other'}`, { source: preview.sourceTerm, target: preview.targetTerm, count: preview.impact.files })}</p></div></div><button className="icon-button" onClick={() => setPreview(null)}>×</button></header>
            <dl><div><dt>{t('taxonomy.files')}</dt><dd>{preview.impact.files}</dd></div><div><dt>{t('taxonomy.published')}</dt><dd>{preview.impact.published}</dd></div><div><dt>{t('taxonomy.drafts')}</dt><dd>{preview.impact.drafts}</dd></div><div><dt>{t('taxonomy.languages')}</dt><dd>{preview.impact.languages.join(', ')}</dd></div></dl>
            {preview.impact.routeBefore && <div className="taxonomy-route-change"><code>{preview.impact.routeBefore}</code><ArrowRight size={15} /><code>{preview.impact.routeAfter}</code></div>}
            <div className={`taxonomy-warning ${preview.action === 'assign' ? 'safe' : ''}`}>{preview.action === 'assign' ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}<div><strong>{t(preview.action === 'assign' ? 'taxonomy.assignmentWarningTitle' : 'taxonomy.aliasWarningTitle')}</strong><p>{t(preview.action === 'assign' ? 'taxonomy.assignmentWarningCopy' : 'taxonomy.aliasWarningCopy')}</p></div></div>
            <div className="taxonomy-change-list">{preview.changes.map((change) => <article key={change.postId}><FileText size={14} /><span><strong>{change.title}</strong><small>{change.before.join(', ') || t('taxonomy.none')} <ArrowRight size={11} /> {change.after.join(', ') || t('taxonomy.none')}</small></span></article>)}</div>
            {preview.skipped.length > 0 && <p className="taxonomy-skipped"><AlertTriangle size={14} /> {t('taxonomy.skipped', { count: preview.skipped.length })}</p>}
            <footer><button className="button quiet" onClick={() => setPreview(null)} disabled={working === 'apply'}>{t('common.cancel')}</button><button className="button primary" onClick={applyChange} disabled={working === 'apply'}>{working === 'apply' ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />} {t('taxonomy.apply')}</button></footer>
          </section>
        </div>}
      </div>
      <footer className="taxonomy-footer"><small><Languages size={14} /> {t('taxonomy.portable')}</small><button className="button quiet" onClick={load} disabled={Boolean(working)}><RefreshCw size={14} /> {t('common.refresh')}</button><button className="button quiet" onClick={onClose}>{t('common.close')}</button></footer>
    </Modal>
  )
}
