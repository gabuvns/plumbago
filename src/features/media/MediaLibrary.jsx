import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArchiveRestore, Check, CopyPlus, Crop, FileImage, ImageOff, ImagePlus, Images, LoaderCircle, RefreshCw, Search, Sparkles, Trash2, WandSparkles } from 'lucide-react'
import { api } from '../../app/api'
import { Modal } from '../../components/ui/Modal'
import { useI18n } from '../../i18n'
import { friendlyError } from '../../lib/errors'

const emptyLibrary = { items: [], missingReferences: [], duplicateGroups: [], summary: { total: 0, used: 0, unused: 0, oversized: 0, duplicates: 0, missing: 0, missingAlt: 0, bytes: 0 } }
const filters = ['all', 'used', 'unused', 'issues', 'duplicates', 'oversized']

export function MediaLibrary({ post, onClose, onAdd, onDrop, onInsert, onFeatured, onChanged, prepare, notify }) {
  const { t } = useI18n()
  const [library, setLibrary] = useState(emptyLibrary)
  const [trash, setTrash] = useState([])
  const [view, setView] = useState('library')
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [working, setWorking] = useState('load')
  const [confirmAction, setConfirmAction] = useState('')
  const [dragging, setDragging] = useState(false)
  const [visibleCount, setVisibleCount] = useState(80)
  const [altText, setAltText] = useState('')
  const [caption, setCaption] = useState('')
  const [derivative, setDerivative] = useState({ width: '1200', height: '', format: 'webp', fit: 'inside' })

  const load = useCallback(async () => {
    setWorking('load')
    try {
      const [nextLibrary, nextTrash] = await Promise.all([api.mediaLibrary(), api.listMediaTrash()])
      setLibrary(nextLibrary)
      setTrash(nextTrash)
      setSelectedId((current) => current && nextLibrary.items.some((item) => item.id === current) ? current : '')
    } catch (error) { notify(friendlyError(error, t), 'error') } finally { setWorking('') }
  }, [notify, t])

  useEffect(() => { load() }, [load])

  const selected = library.items.find((item) => item.id === selectedId) || null
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    return library.items.filter((item) => {
      const matchesSearch = !needle || [item.id, item.name, ...item.ownerTitles].join(' ').toLocaleLowerCase().includes(needle)
      const matchesFilter = filter === 'all'
        || filter === 'used' && item.usageCount > 0
        || filter === 'unused' && item.usageCount === 0
        || filter === 'issues' && item.missingAltCount > 0
        || filter === 'duplicates' && item.duplicate
        || filter === 'oversized' && item.oversized
      return matchesSearch && matchesFilter
    })
  }, [filter, library.items, query])

  function select(item) {
    setSelectedId(item.id)
    setAltText(item.name.replace(/\.[^.]+$/, '').replaceAll(/[-_]+/g, ' '))
    setCaption('')
    setConfirmAction('')
  }

  async function readyForMutation() {
    return prepare ? prepare() : true
  }

  async function reuse() {
    if (!selected || !post || !await readyForMutation()) return
    setWorking('reuse')
    try {
      const result = await api.reuseMedia(selected.id, post.id, { alt: altText, caption })
      if (!await onInsert(result)) return
      notify(t('media.notice.inserted'))
      onClose()
    } catch (error) { notify(friendlyError(error, t), 'error') } finally { setWorking('') }
  }

  async function replace() {
    if (!selected) return
    const action = `replace:${selected.id}`
    if (confirmAction !== action) { setConfirmAction(action); return }
    if (!await readyForMutation()) return
    setWorking('replace')
    try {
      const result = await api.replaceMedia(selected.id)
      if (!result) { setConfirmAction(''); return }
      setConfirmAction('')
      notify(t('media.notice.replaced'))
      await onChanged()
      await load()
    } catch (error) { notify(friendlyError(error, t), 'error') } finally { setWorking('') }
  }

  async function createDerivative() {
    if (!selected) return
    setWorking('derivative')
    try {
      const result = await api.createMediaDerivative(selected.id, derivative)
      notify(t('media.notice.derivative', { name: result.name }))
      await load()
      setSelectedId(result.id)
    } catch (error) { notify(friendlyError(error, t), 'error') } finally { setWorking('') }
  }

  async function feature() {
    if (!selected || !post) return
    setWorking('featured')
    try {
      if (!await onFeatured(selected.name)) return
      notify(t('media.notice.featured'))
      await load()
    } finally { setWorking('') }
  }

  async function updateReference(reference, alt, referenceCaption) {
    if (!selected || !await readyForMutation()) return
    setWorking(`reference:${reference.id}`)
    try {
      const result = await api.updateMediaReference({ mediaId: selected.id, postId: reference.postId, referenceId: reference.id, alt, caption: referenceCaption })
      await onChanged(result.post.id)
      notify(t('media.notice.referenceUpdated'))
      await load()
    } catch (error) { notify(friendlyError(error, t), 'error') } finally { setWorking('') }
  }

  async function remove() {
    if (!selected) return
    const action = `remove:${selected.id}`
    if (confirmAction !== action) { setConfirmAction(action); return }
    if (!await readyForMutation()) return
    setWorking('remove')
    try {
      await api.removeMedia(selected.id)
      setSelectedId('')
      setConfirmAction('')
      notify(t('media.notice.removed'))
      await onChanged()
      await load()
    } catch (error) { notify(friendlyError(error, t), 'error') } finally { setWorking('') }
  }

  async function restoreTrash(item) {
    setWorking(`restore:${item.id}`)
    try {
      await api.restoreMediaTrashItem(item.id)
      notify(t('media.notice.restored'))
      await load()
    } catch (error) { notify(friendlyError(error, t), 'error') } finally { setWorking('') }
  }

  async function deleteTrash(item) {
    const action = `delete:${item.id}`
    if (confirmAction !== action) { setConfirmAction(action); return }
    setWorking(action)
    try {
      await api.deleteMediaTrashItem(item.id)
      setConfirmAction('')
      notify(t('media.notice.deleted'))
      await load()
    } catch (error) { notify(friendlyError(error, t), 'error') } finally { setWorking('') }
  }

  async function addFiles() {
    if (!post) return
    await onAdd()
    await load()
  }

  async function drop(event) {
    event.preventDefault()
    setDragging(false)
    if (!post) return
    const files = Array.from(event.dataTransfer.files || [])
    if (!files.length) return
    await onDrop(files)
    await load()
  }

  const busy = Boolean(working)
  const canFeature = Boolean(selected && post && selected.ownerPostIds.includes(post.id))
  return (
    <Modal title={t('media.title')} onClose={onClose} width="1060px">
      <div className="media-library">
        <header className="media-hero">
          <div><span><Images size={22} /></span><div><h3>{t('media.hero')}</h3><p>{t('media.copy')}</p></div></div>
          <div className="media-hero-actions"><button className="button quiet" onClick={load} disabled={busy}><RefreshCw className={working === 'load' ? 'spin' : ''} size={14} /> {t('media.refresh')}</button><button className="button primary" onClick={addFiles} disabled={!post || busy}><ImagePlus size={15} /> {t('media.addToPost')}</button></div>
        </header>
        <div className="media-summary">
          <Summary value={library.summary.total} label={t('media.summary.total')} />
          <Summary value={library.summary.used} label={t('media.summary.used')} tone="green" />
          <Summary value={library.summary.unused} label={t('media.summary.unused')} tone="gold" />
          <Summary value={library.summary.missing + library.summary.missingAlt} label={t('media.summary.issues')} tone="red" />
          <Summary value={fileSize(library.summary.bytes)} label={t('media.summary.storage')} />
        </div>
        <nav className="media-view-tabs">
          <button className={view === 'library' ? 'active' : ''} onClick={() => setView('library')}><Images size={14} /> {t('media.tab.library')}</button>
          <button className={view === 'diagnostics' ? 'active' : ''} onClick={() => setView('diagnostics')}><AlertTriangle size={14} /> {t('media.tab.diagnostics')}<small>{library.summary.missing + library.summary.missingAlt + library.summary.oversized + library.summary.duplicates}</small></button>
          <button className={view === 'trash' ? 'active' : ''} onClick={() => setView('trash')}><Trash2 size={14} /> {t('media.tab.trash')}<small>{trash.length}</small></button>
        </nav>

        {view === 'library' && <div className="media-browser">
          <div className="media-toolbar"><label><Search size={14} /><input value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(80) }} placeholder={t('media.search')} /></label><div>{filters.map((name) => <button key={name} className={filter === name ? 'active' : ''} onClick={() => { setFilter(name); setVisibleCount(80) }}>{t(`media.filter.${name}`)}</button>)}</div></div>
          {post && <div className={`media-drop-zone ${dragging ? 'dragging' : ''}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true) }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false) }} onDrop={drop}><CopyPlus size={15} /> {t('media.drop', { title: post.title })}</div>}
          <div className={`media-library-layout ${selected ? 'with-detail' : ''}`}>
            <section className="media-grid-panel">
              {working === 'load' && <div className="media-state"><LoaderCircle className="spin" size={22} /> {t('media.loading')}</div>}
              {working !== 'load' && filtered.length === 0 && <div className="media-state"><ImageOff size={28} /><strong>{t('media.empty')}</strong><span>{t('media.emptyCopy')}</span></div>}
              <div className="media-global-grid">{filtered.slice(0, visibleCount).map((item) => <MediaCard key={item.id} item={item} selected={item.id === selectedId} onClick={() => select(item)} t={t} />)}</div>
              {filtered.length > visibleCount && <button className="button quiet media-load-more" onClick={() => setVisibleCount((count) => count + 80)}>{t('media.loadMore', { count: filtered.length - visibleCount })}</button>}
            </section>
            {selected && <aside className="media-detail-panel">
              <MediaPreview id={selected.id} width={720} />
              <div className="media-detail-heading"><div><strong>{selected.name}</strong><code>{selected.id}</code></div><span>{selected.width && selected.height ? `${selected.width} × ${selected.height}` : t('media.unknownDimensions')} · {fileSize(selected.size)}</span></div>
              <div className="media-badges"><span>{t(`media.scope.${selected.scope}`)}</span><span className={selected.usageCount ? 'used' : 'unused'}>{t(selected.usageCount === 1 ? 'media.usage.one' : 'media.usage.other', { count: selected.usageCount })}</span>{selected.duplicate && <span className="warning">{t('media.duplicate')}</span>}{selected.oversized && <span className="warning">{t('media.oversized')}</span>}</div>
              {selected.ownerTitles.length > 0 && <p className="media-owner">{t('media.owner', { title: selected.ownerTitles.join(', ') })}</p>}
              <section className="media-reuse"><h4>{t('media.reuseTitle')}</h4><p>{post ? t('media.reuseCopy', { title: post.title }) : t('media.reuseNoPost')}</p><label>{t('images.altText')}<input value={altText} onChange={(event) => setAltText(event.target.value)} /></label><label>{t('images.caption')}<input value={caption} onChange={(event) => setCaption(event.target.value)} placeholder={t('images.captionPlaceholder')} /></label><div>{canFeature && <button className="button quiet" onClick={feature} disabled={busy}><Sparkles size={14} /> {t('images.useFeatured')}</button>}<button className="button primary" onClick={reuse} disabled={!post || busy}><CopyPlus size={14} /> {working === 'reuse' ? t('media.working') : t('media.insert')}</button></div></section>
              <section className="media-reference-section"><h4>{t('media.references')}</h4>{selected.references.length === 0 ? <p>{t('media.noReferences')}</p> : selected.references.map((reference) => <ReferenceEditor key={reference.id} reference={reference} working={working === `reference:${reference.id}`} onSave={updateReference} t={t} />)}</section>
              <section className="media-derivative"><h4><WandSparkles size={14} /> {t('media.optimizeTitle')}</h4><p>{t('media.optimizeCopy')}</p><div><label>{t('media.width')}<input type="number" value={derivative.width} onChange={(event) => setDerivative((current) => ({ ...current, width: event.target.value }))} /></label><label>{t('media.height')}<input type="number" value={derivative.height} onChange={(event) => setDerivative((current) => ({ ...current, height: event.target.value }))} placeholder={t('media.auto')} /></label><label>{t('media.format')}<select value={derivative.format} onChange={(event) => setDerivative((current) => ({ ...current, format: event.target.value }))}><option value="webp">WebP</option><option value="avif">AVIF</option><option value="jpeg">JPEG</option><option value="png">PNG</option></select></label><label>{t('media.fit')}<select value={derivative.fit} onChange={(event) => setDerivative((current) => ({ ...current, fit: event.target.value }))}><option value="inside">{t('media.fitInside')}</option><option value="cover">{t('media.fitCover')}</option></select></label></div><button className="button quiet" onClick={createDerivative} disabled={busy}><Crop size={14} /> {working === 'derivative' ? t('media.working') : t('media.createDerivative')}</button></section>
              <footer className="media-danger-actions"><button className={confirmAction === `replace:${selected.id}` ? 'button primary' : 'button quiet'} onClick={replace} disabled={busy}><RefreshCw size={14} /> {confirmAction === `replace:${selected.id}` ? t(selected.usageCount === 1 ? 'media.confirmReplace.one' : 'media.confirmReplace.other', { count: selected.usageCount }) : t('media.replace')}</button><button className={confirmAction === `remove:${selected.id}` ? 'button danger' : 'button quiet'} onClick={remove} disabled={!selected.removable || busy} title={!selected.removable ? t('media.removeBlocked') : t('media.remove')}><Trash2 size={14} /> {confirmAction === `remove:${selected.id}` ? t('media.confirmRemove') : t('media.remove')}</button></footer>
            </aside>}
          </div>
        </div>}

        {view === 'diagnostics' && <Diagnostics library={library} onSelect={(id, nextFilter = 'all') => { setFilter(nextFilter); setSelectedId(id); setView('library') }} t={t} />}
        {view === 'trash' && <Trash items={trash} working={working} confirmAction={confirmAction} onRestore={restoreTrash} onDelete={deleteTrash} t={t} />}
        <footer className="media-footer"><small><Check size={13} /> {t('media.footer')}</small><button className="button quiet" onClick={onClose}>{t('common.close')}</button></footer>
      </div>
    </Modal>
  )
}

function Summary({ value, label, tone = '' }) {
  return <div className={tone}><strong>{value}</strong><span>{label}</span></div>
}

function MediaPreview({ id, width }) {
  const [preview, setPreview] = useState(null)
  useEffect(() => {
    let active = true
    setPreview(null)
    api.mediaPreview(id, width).then((result) => { if (active) setPreview(result.dataUrl) }).catch(() => { if (active) setPreview('') })
    return () => { active = false }
  }, [id, width])
  return <div className="media-preview">{preview === null ? <LoaderCircle className="spin" size={19} /> : preview ? <img src={preview} alt="" /> : <ImageOff size={24} />}</div>
}

function MediaCard({ item, selected, onClick, t }) {
  return <button className={`media-global-card ${selected ? 'selected' : ''}`} onClick={onClick}><MediaPreview id={item.id} width={360} /><span><strong title={item.name}>{item.name}</strong><small>{item.width && item.height ? `${item.width} × ${item.height}` : item.extension.toUpperCase()} · {fileSize(item.size)}</small></span><div>{item.usageCount > 0 && <b className="used">{item.usageCount}</b>}{item.missingAltCount > 0 && <b className="issue" title={t('media.missingAlt')}>!</b>}{item.duplicate && <b className="duplicate" title={t('media.duplicate')}>2×</b>}</div></button>
}

function ReferenceEditor({ reference, working, onSave, t }) {
  const [alt, setAlt] = useState(reference.alt)
  const [caption, setCaption] = useState(reference.caption)
  useEffect(() => { setAlt(reference.alt); setCaption(reference.caption) }, [reference])
  return <article className="media-reference"><div><FileImage size={14} /><span><strong>{reference.postTitle}</strong><small>{t(`media.reference.${reference.kind}`)} · {reference.destination}</small></span></div>{reference.editable ? <><label>{t('images.altText')}<input value={alt} onChange={(event) => setAlt(event.target.value)} /></label><label>{t('images.caption')}<input value={caption} onChange={(event) => setCaption(event.target.value)} /></label><button className="button quiet" onClick={() => onSave(reference, alt, caption)} disabled={working}>{working ? <LoaderCircle className="spin" size={13} /> : <Check size={13} />} {t('media.saveReference')}</button></> : <p>{t('media.referenceReadOnly')}</p>}</article>
}

function Diagnostics({ library, onSelect, t }) {
  const missingAlt = library.items.filter((item) => item.missingAltCount > 0)
  const oversized = library.items.filter((item) => item.oversized)
  return <section className="media-diagnostics"><Diagnostic title={t('media.diagnostic.missing')} count={library.missingReferences.length} copy={t('media.diagnostic.missingCopy')}><div>{library.missingReferences.map((reference) => <article key={reference.id}><ImageOff size={16} /><span><strong>{reference.postTitle}</strong><code>{reference.expectedMediaId}</code></span></article>)}</div></Diagnostic><Diagnostic title={t('media.diagnostic.alt')} count={missingAlt.length} copy={t('media.diagnostic.altCopy')}><div>{missingAlt.map((item) => <button key={item.id} onClick={() => onSelect(item.id, 'issues')}><AlertTriangle size={15} /><span><strong>{item.name}</strong><small>{t('media.diagnostic.altCount', { count: item.missingAltCount })}</small></span></button>)}</div></Diagnostic><Diagnostic title={t('media.diagnostic.duplicates')} count={library.duplicateGroups.length} copy={t('media.diagnostic.duplicatesCopy')}><div>{library.duplicateGroups.map((group) => <button key={group.hash} onClick={() => onSelect(group.mediaIds[0], 'duplicates')}><CopyPlus size={15} /><span><strong>{t('media.diagnostic.duplicateCount', { count: group.mediaIds.length })}</strong><small>{group.mediaIds.map((id) => id.split('/').at(-1)).join(', ')}</small></span></button>)}</div></Diagnostic><Diagnostic title={t('media.diagnostic.oversized')} count={oversized.length} copy={t('media.diagnostic.oversizedCopy')}><div>{oversized.map((item) => <button key={item.id} onClick={() => onSelect(item.id, 'oversized')}><WandSparkles size={15} /><span><strong>{item.name}</strong><small>{fileSize(item.size)}</small></span></button>)}</div></Diagnostic></section>
}

function Diagnostic({ title, count, copy, children }) {
  return <article><header><span>{count}</span><div><strong>{title}</strong><p>{copy}</p></div></header>{count > 0 && children}</article>
}

function Trash({ items, working, confirmAction, onRestore, onDelete, t }) {
  if (items.length === 0) return <div className="media-state media-trash-empty"><ArchiveRestore size={28} /><strong>{t('media.trash.empty')}</strong><span>{t('media.trash.emptyCopy')}</span></div>
  return <section className="media-trash-list">{items.map((item) => <article key={item.id}><span><Trash2 size={17} /></span><div><strong>{item.name}</strong><code>{item.mediaId}</code><small>{new Date(item.deletedAt).toLocaleString()} · {fileSize(item.size)}</small></div><button className="button quiet" onClick={() => onRestore(item)} disabled={Boolean(working)}>{working === `restore:${item.id}` ? <LoaderCircle className="spin" size={13} /> : <ArchiveRestore size={13} />} {t('media.trash.restore')}</button><button className={confirmAction === `delete:${item.id}` ? 'button danger' : 'icon-button'} onClick={() => onDelete(item)} disabled={Boolean(working)} title={t('media.trash.delete')}>{working === `delete:${item.id}` ? <LoaderCircle className="spin" size={13} /> : confirmAction === `delete:${item.id}` ? t('media.trash.confirmDelete') : <Trash2 size={14} />}</button></article>)}</section>
}

function fileSize(bytes) {
  if (!Number.isFinite(Number(bytes))) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
