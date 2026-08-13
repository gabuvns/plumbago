import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, Check, CheckCircle2, FilePlus2, FileText, FolderTree, Languages, LayoutTemplate, Link2, LoaderCircle, Menu as MenuIcon, PencilLine, RefreshCw, Route, Search, ShieldCheck, Trash2 } from 'lucide-react'
import { api } from '../../app/api'
import { Modal } from '../../components/ui/Modal'
import { useI18n } from '../../i18n'
import { friendlyError } from '../../lib/errors'

const emptyInventory = {
  pages: [],
  routes: [],
  languages: ['en-us', 'pt-br'],
  virtualRoutes: [],
  collisions: [],
  unsupported: [],
  summary: { pages: 0, published: 0, drafts: 0, menuPages: 0, collisions: 0, themeDependent: 0 },
}

const blankPage = {
  title: '',
  route: '/about/',
  language: 'en-us',
  kind: 'leaf',
  draft: true,
  description: '',
  layout: '',
  type: '',
  menu: '',
  body: '',
}

function pageMatches(page, query) {
  return `${page.title} ${page.route} ${page.id} ${page.language} ${page.aliases.join(' ')} ${page.menus.join(' ')}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())
}

function PageKindIcon({ kind }) {
  if (kind === 'branch') return <FolderTree size={17} />
  if (kind === 'leaf') return <LayoutTemplate size={17} />
  return <FileText size={17} />
}

export function PageManager({ onChanged, onClose, notify }) {
  const { t } = useI18n()
  const [inventory, setInventory] = useState(emptyInventory)
  const [selectedId, setSelectedId] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [working, setWorking] = useState('load')
  const [mode, setMode] = useState('browse')
  const [newPage, setNewPage] = useState(blankPage)
  const [renameRoute, setRenameRoute] = useState('')
  const [preserveAlias, setPreserveAlias] = useState(true)
  const [includeResources, setIncludeResources] = useState(false)
  const [preview, setPreview] = useState(null)
  const [pendingInput, setPendingInput] = useState(null)

  const load = useCallback(async () => {
    setWorking('load')
    try {
      const next = await api.pageInventory()
      setInventory(next)
      setSelectedId((current) => next.pages.some((page) => page.id === current) ? current : next.pages[0]?.id || '')
    } catch (error) {
      notify(friendlyError(error, t), 'error')
    } finally {
      setWorking('')
    }
  }, [notify, t])

  useEffect(() => { load() }, [load])

  const visiblePages = useMemo(() => inventory.pages.filter((page) => {
    if (!pageMatches(page, query)) return false
    if (filter === 'published') return !page.draft
    if (filter === 'drafts') return page.draft
    if (filter === 'menu') return page.menus.length > 0
    if (filter === 'collisions') return page.collision
    if (filter === 'theme') return page.themeDependent
    return true
  }), [filter, inventory.pages, query])
  const selected = visiblePages.find((page) => page.id === selectedId) || visiblePages[0] || null
  const selectedCollisions = selected ? inventory.collisions.filter((collision) => collision.entries.some((entry) => entry.id === selected.id)) : []

  useEffect(() => {
    if (!selected) return
    if (selected.id !== selectedId) setSelectedId(selected.id)
    setRenameRoute(selected.route)
    setIncludeResources(false)
  }, [selected, selectedId])

  function choosePage(id) {
    setSelectedId(id)
    setMode('browse')
    setPreview(null)
  }

  function startCreate() {
    setMode('create')
    setPreview(null)
    setNewPage({ ...blankPage, language: inventory.languages[0] || 'en-us' })
  }

  async function reviewChange(input) {
    setWorking('preview')
    try {
      const result = await api.previewPageChange(input)
      setPendingInput(input)
      setPreview(result)
    } catch (error) {
      notify(friendlyError(error, t), 'error')
    } finally {
      setWorking('')
    }
  }

  async function applyChange() {
    if (!preview || !pendingInput) return
    setWorking('apply')
    try {
      const result = await api.applyPageChange({ ...pendingInput, expectedRevisions: preview.revisions })
      setInventory(result.inventory)
      const deleted = result.preview.action === 'delete'
      setSelectedId(deleted ? result.inventory.pages[0]?.id || '' : result.preview.page.id)
      setMode('browse')
      setPreview(null)
      setPendingInput(null)
      setNewPage(blankPage)
      await onChanged?.()
      notify(t(`notice.pageChanged.${result.preview.action}`))
    } catch (error) {
      notify(friendlyError(error, t), 'error')
    } finally {
      setWorking('')
    }
  }

  return (
    <Modal title={t('pages.title')} onClose={onClose} width="1200px">
      <div className="page-workspace">
        <header className="page-hero">
          <div><span><Route size={24} /></span><div><h3>{t('pages.heroTitle')}</h3><p>{t('pages.heroCopy')}</p></div></div>
          <dl>
            <div><dt>{t('pages.summary.pages')}</dt><dd>{inventory.summary.pages}</dd></div>
            <div><dt>{t('pages.summary.menu')}</dt><dd>{inventory.summary.menuPages}</dd></div>
            <div className={inventory.summary.collisions ? 'warning' : ''}><dt>{t('pages.summary.collisions')}</dt><dd>{inventory.summary.collisions}</dd></div>
          </dl>
        </header>

        {working === 'load' ? <div className="page-loading"><LoaderCircle className="spin" /> {t('pages.loading')}</div> : <>
          <div className="page-toolbar">
            <div className="search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('pages.search')} /></div>
            <div className="page-filters" aria-label={t('pages.filters.label')}>
              {['all', 'published', 'drafts', 'menu', 'collisions', 'theme'].map((item) => <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{t(`pages.filters.${item}`)}</button>)}
            </div>
            <button className="button primary" onClick={startCreate}><FilePlus2 size={15} /> {t('pages.create')}</button>
          </div>

          {inventory.summary.collisions > 0 && <div className="page-collision-banner"><AlertTriangle size={17} /><div><strong>{t('pages.collisionBannerTitle', { count: inventory.summary.collisions })}</strong><p>{t('pages.collisionBannerCopy')}</p></div><button onClick={() => setFilter('collisions')}>{t('pages.inspect')}</button></div>}

          <div className="page-layout">
            <nav className="page-list" aria-label={t('pages.listLabel')}>
              {visiblePages.map((page) => <button key={page.id} className={selected?.id === page.id && mode === 'browse' ? 'active' : ''} onClick={() => choosePage(page.id)}>
                <span className="page-kind-icon"><PageKindIcon kind={page.kind} /></span>
                <span><strong>{page.title}</strong><code>{page.route}</code><small>{page.language} · {t(`pages.kind.${page.kind}`)}</small></span>
                <span className="page-list-badges">{page.collision && <i className="danger">!</i>}{page.menus.length > 0 && <i><MenuIcon size={10} /></i>}{page.themeDependent && <i><LayoutTemplate size={10} /></i>}<b className={page.draft ? 'draft' : 'live'}>{t(page.draft ? 'posts.draft' : 'posts.live')}</b></span>
              </button>)}
              {!visiblePages.length && <div className="page-empty"><Route size={25} /><p>{t(inventory.pages.length ? 'pages.noMatch' : 'pages.empty')}</p><button className="button quiet" onClick={startCreate}><FilePlus2 size={14} /> {t('pages.create')}</button></div>}
            </nav>

            <section className="page-detail">
              {mode === 'create' ? <PageCreationForm value={newPage} languages={inventory.languages} onChange={(change) => { setNewPage((current) => ({ ...current, ...change })); setPreview(null) }} onCancel={() => setMode('browse')} onPreview={() => reviewChange({ action: 'create', ...newPage })} working={working} t={t} /> : selected ? <>
                <header className="page-detail-header">
                  <div className="page-title-mark"><PageKindIcon kind={selected.kind} /></div>
                  <div><span>{t(`pages.kind.${selected.kind}`)}</span><h3>{selected.title}</h3><code>{selected.route}</code></div>
                  <b className={selected.draft ? 'draft' : 'live'}>{t(selected.draft ? 'posts.draft' : 'posts.live')}</b>
                </header>

                {selected.collision && <div className="page-warning danger"><AlertTriangle size={17} /><div><strong>{t('pages.routeCollisionTitle')}</strong><p>{t('pages.routeCollisionCopy')}</p>{selectedCollisions.map((collision) => <div key={collision.key}><code>{collision.route}</code>{collision.entries.filter((entry) => entry.id !== selected.id).map((entry) => <small key={`${entry.id}:${entry.kind}`}>{entry.title} · {t(`pages.routeKind.${entry.kind}`)}</small>)}</div>)}</div></div>}
                {selected.isHome && <div className="page-warning"><Route size={17} /><div><strong>{t('pages.homeTitle')}</strong><p>{t('pages.homeCopy')}</p></div></div>}
                {selected.themeDependent && <div className="page-warning"><LayoutTemplate size={17} /><div><strong>{t('pages.themeTitle')}</strong><p>{t('pages.themeCopy')}</p></div></div>}

                <dl className="page-metadata">
                  <div><dt>{t('pages.language')}</dt><dd>{selected.language}</dd></div>
                  <div><dt>{t('pages.section')}</dt><dd>{selected.section || '—'}</dd></div>
                  <div><dt>{t('pages.layout')}</dt><dd>{selected.layout || '—'}</dd></div>
                  <div><dt>{t('pages.type')}</dt><dd>{selected.type || '—'}</dd></div>
                </dl>

                <div className="page-detail-grid">
                  <section><h4><Link2 size={15} /> {t('pages.links')}</h4><dl><div><dt>{t('pages.publicRoute')}</dt><dd><code>{selected.route}</code>{selected.explicitUrl && <i>{t('pages.explicit')}</i>}</dd></div><div><dt>{t('pages.aliases')}</dt><dd>{selected.aliases.length ? selected.aliases.map((alias) => <code key={alias}>{alias}</code>) : '—'}</dd></div><div><dt>{t('pages.menus')}</dt><dd>{selected.menus.length ? selected.menus.join(', ') : '—'}</dd></div></dl></section>
                  <section><h4><FolderTree size={15} /> {t('pages.files')}</h4><dl><div><dt>{t('pages.source')}</dt><dd><code title={selected.id}>{selected.id}</code></dd></div><div><dt>{t('pages.translations')}</dt><dd>{selected.translations.length}</dd></div><div><dt>{t('pages.resources')}</dt><dd>{selected.resources.length}</dd></div><div><dt>{t('pages.descendants')}</dt><dd>{selected.descendants.length}</dd></div></dl></section>
                </div>

                {selected.bodyExcerpt && <section className="page-excerpt"><h4>{t('pages.contentPreview')}</h4><p>{selected.bodyExcerpt}</p></section>}
                {selected.unknownFields.length > 0 && <div className="page-unknown"><ShieldCheck size={15} /><div><strong>{t('pages.preservedFields')}</strong><p>{t('pages.preservedFieldsCopy')}</p><span>{selected.unknownFields.map((field) => <code key={field}>{field}</code>)}</span></div></div>}

                <div className="page-actions">
                  <section><h4><PencilLine size={15} /> {t('pages.renameTitle')}</h4><p>{t(selected.isHome ? 'pages.homeRenameCopy' : 'pages.renameCopy')}</p><label>{t('pages.newRoute')}<input value={renameRoute} disabled={selected.isHome} onChange={(event) => { setRenameRoute(event.target.value); setPreview(null) }} /></label><label className="page-checkbox"><input type="checkbox" checked={preserveAlias} disabled={selected.isHome} onChange={(event) => setPreserveAlias(event.target.checked)} /><span><strong>{t('pages.preserveAlias')}</strong><small>{t('pages.preserveAliasCopy')}</small></span></label><button className="button primary" disabled={selected.isHome || working === 'preview' || renameRoute === selected.route} onClick={() => reviewChange({ action: 'rename', id: selected.id, route: renameRoute, preserveAlias })}>{working === 'preview' ? <LoaderCircle className="spin" size={15} /> : <ArrowRight size={15} />} {t('pages.preview')}</button></section>
                  <section className="danger"><h4><Trash2 size={15} /> {t('pages.removeTitle')}</h4><p>{t(selected.kind === 'branch' ? 'pages.branchRemoveCopy' : 'pages.removeCopy')}</p>{selected.resources.length > 0 && <label className="page-checkbox"><input type="checkbox" checked={includeResources} disabled={!selected.canRemoveBundle} onChange={(event) => setIncludeResources(event.target.checked)} /><span><strong>{t('pages.removeResources', { count: selected.resources.length })}</strong><small>{t(selected.canRemoveBundle ? 'pages.removeResourcesCopy' : selected.sharedBundle ? 'pages.sharedResourcesCopy' : 'pages.branchResourcesCopy')}</small></span></label>}<button className="button danger" disabled={selected.kind === 'branch' || working === 'preview'} onClick={() => reviewChange({ action: 'delete', id: selected.id, includeResources })}><Trash2 size={15} /> {t('pages.previewRemoval')}</button></section>
                </div>
              </> : <div className="page-empty"><Route size={28} /><p>{t('pages.choose')}</p></div>}
            </section>
          </div>
        </>}

        {preview && <PageChangePreview preview={preview} working={working} onClose={() => setPreview(null)} onApply={applyChange} t={t} />}
      </div>
      <footer className="page-footer"><small><ShieldCheck size={14} /> {t('pages.portable')}</small>{inventory.unsupported.length > 0 && <span><AlertTriangle size={13} /> {t('pages.unsupported', { count: inventory.unsupported.length })}</span>}<button className="button quiet" onClick={load} disabled={Boolean(working)}><RefreshCw size={14} /> {t('common.refresh')}</button><button className="button quiet" onClick={onClose}>{t('common.close')}</button></footer>
    </Modal>
  )
}

function PageCreationForm({ value, languages, onChange, onCancel, onPreview, working, t }) {
  return <div className="page-create-form">
    <header><span><FilePlus2 size={20} /></span><div><h3>{t('pages.createTitle')}</h3><p>{t('pages.createCopy')}</p></div></header>
    <div className="page-form-grid">
      <label className="wide">{t('pages.pageTitle')}<input value={value.title} onChange={(event) => onChange({ title: event.target.value })} placeholder={t('pages.pageTitlePlaceholder')} /></label>
      <label className="wide">{t('pages.route')}<input value={value.route} onChange={(event) => onChange({ route: event.target.value })} placeholder="/about/" /><small>{t('pages.routeHelp')}</small></label>
      <label>{t('pages.language')}<select value={value.language} onChange={(event) => onChange({ language: event.target.value })}>{languages.map((language) => <option key={language} value={language}>{language === 'en-us' ? 'English (en-us)' : language === 'pt-br' ? 'Português (pt-br)' : language}</option>)}</select></label>
      <label>{t('pages.pageKind')}<select value={value.kind} onChange={(event) => onChange({ kind: event.target.value })}><option value="leaf">{t('pages.kind.leaf')}</option><option value="standalone">{t('pages.kind.standalone')}</option><option value="branch">{t('pages.kind.branch')}</option></select><small>{t(`pages.kindHelp.${value.kind}`)}</small></label>
      <label className="wide">{t('pages.description')}<input value={value.description} onChange={(event) => onChange({ description: event.target.value })} /></label>
      <label>{t('pages.layout')}<input value={value.layout} onChange={(event) => onChange({ layout: event.target.value })} placeholder="about" /></label>
      <label>{t('pages.type')}<input value={value.type} onChange={(event) => onChange({ type: event.target.value })} placeholder="page" /></label>
      <label>{t('pages.menu')}<input value={value.menu} onChange={(event) => onChange({ menu: event.target.value })} placeholder="main" /></label>
      <label className="page-checkbox publish"><input type="checkbox" checked={!value.draft} onChange={(event) => onChange({ draft: !event.target.checked })} /><span><strong>{t('pages.publishImmediately')}</strong><small>{t('pages.publishImmediatelyCopy')}</small></span></label>
      <label className="wide">{t('pages.startingContent')}<textarea rows="7" value={value.body} onChange={(event) => onChange({ body: event.target.value })} placeholder={t('pages.startingContentPlaceholder')} /></label>
    </div>
    {(value.layout || value.type) && <div className="page-warning"><LayoutTemplate size={16} /><div><strong>{t('pages.themeTitle')}</strong><p>{t('pages.themeCopy')}</p></div></div>}
    <footer><button className="button quiet" onClick={onCancel}>{t('common.cancel')}</button><button className="button primary" disabled={!value.title.trim() || !value.route.trim() || working === 'preview'} onClick={onPreview}>{working === 'preview' ? <LoaderCircle className="spin" size={15} /> : <ArrowRight size={15} />} {t('pages.preview')}</button></footer>
  </div>
}

function PageChangePreview({ preview, working, onClose, onApply, t }) {
  const destructive = preview.action === 'delete'
  return <div className="page-preview" role="dialog" aria-modal="true" aria-label={t('pages.previewTitle')}>
    <section>
      <header><div>{destructive ? <AlertTriangle size={22} /> : <CheckCircle2 size={22} />}<div><h3>{t('pages.previewTitle')}</h3><p>{t(`pages.previewAction.${preview.action}`, { title: preview.page.title })}</p></div></div><button className="icon-button" onClick={onClose} aria-label={t('common.close')}>×</button></header>
      <dl><div><dt>{t('pages.filesChanged')}</dt><dd>{preview.impact.files}</dd></div><div><dt>{t('pages.resources')}</dt><dd>{preview.impact.resources}</dd></div><div><dt>{t('pages.translations')}</dt><dd>{preview.impact.translations}</dd></div><div><dt>{t('pages.publication')}</dt><dd>{preview.impact.published ? t('posts.live') : t('posts.draft')}</dd></div></dl>
      {(preview.impact.routeBefore || preview.impact.routeAfter) && <div className="page-route-change"><code>{preview.impact.routeBefore || t('pages.newFile')}</code><ArrowRight size={15} /><code>{preview.impact.routeAfter || t('pages.removed')}</code></div>}
      <div className={`page-preview-warning ${destructive ? 'danger' : 'safe'}`}>{destructive ? <AlertTriangle size={17} /> : <ShieldCheck size={17} />}<div><strong>{t(`pages.previewWarning.${preview.action}.title`)}</strong><p>{t(`pages.previewWarning.${preview.action}.copy`, { resources: preview.impact.resources, descendants: preview.impact.descendants || 0 })}</p></div></div>
      {preview.impact.aliasesAdded.length > 0 && <div className="page-alias-added"><Link2 size={15} /><span><strong>{t('pages.aliasAdded')}</strong>{preview.impact.aliasesAdded.map((alias) => <code key={alias}>{alias}</code>)}</span></div>}
      {preview.impact.resourcesPreserved && <div className="page-alias-added"><ShieldCheck size={15} /><span><strong>{t('pages.resourcesPreserved')}</strong><small>{t('pages.resourcesPreservedCopy')}</small></span></div>}
      {preview.impact.sharedBundle && <div className="page-alias-added"><Languages size={15} /><span><strong>{t('pages.sharedProtected')}</strong><small>{t('pages.sharedProtectedCopy')}</small></span></div>}
      <div className="page-change-list">{preview.changes.map((change) => <article key={`${change.kind}:${change.path}`}><FileText size={14} /><span><strong>{change.path}</strong><small>{t(`pages.change.${change.kind}`)}{change.field ? ` · ${change.field}` : ''}</small></span></article>)}</div>
      <footer><button className="button quiet" onClick={onClose} disabled={working === 'apply'}>{t('common.cancel')}</button><button className={`button ${destructive ? 'danger' : 'primary'}`} onClick={onApply} disabled={working === 'apply'}>{working === 'apply' ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />} {t(destructive ? 'pages.confirmRemoval' : 'pages.apply')}</button></footer>
    </section>
  </div>
}
