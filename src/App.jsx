import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import {
  AlertCircle, ArrowUpRight, Bold, Check, Clock3, Cloud, Code2, Eye, FileText,
  FolderOpen, GitBranch, HardDrive, Heading2, ImagePlus, Images, Italic, Link,
  List, LoaderCircle, Menu, MoreHorizontal, PanelLeftClose, Plus, Save, Search,
  Palette, Settings, Sparkles, UploadCloud, UserRound, X,
} from 'lucide-react'
import { createDemoBridge } from './demo'
import { supportedLanguages, useI18n } from './i18n'

const api = window.plumbago || createDemoBridge()
const emptyContext = { root: '', runtime: { kind: 'native' }, hugo: null, git: null }

function friendlyError(error, t) {
  return error?.message?.replace(/^Error invoking remote method '[^']+': Error: /, '') || t('error.generic')
}

function formatDate(value, locale, t) {
  if (!value) return t('posts.noDate')
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
}

function Welcome({ onChoose, onCreate, busy }) {
  const { t } = useI18n()
  return (
    <main className="welcome-shell">
      <div className="welcome-card">
        <div className="welcome-mark"><span>p</span></div>
        <p className="eyebrow">{t('welcome.eyebrow')}</p>
        <h1>{t('welcome.title')}</h1>
        <p className="welcome-copy">{t('welcome.copy')}</p>
        <div className="welcome-actions">
          <button className="button primary large" onClick={onChoose} disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={18} /> : <FolderOpen size={18} />}
            {t('welcome.choose')}
          </button>
          <button className="button quiet large" onClick={onCreate} disabled={busy}><Plus size={18} /> {t('welcome.create')}</button>
        </div>
        <div className="welcome-features">
          <span><Check size={15} /> {t('welcome.wsl')}</span>
          <span><Check size={15} /> {t('welcome.ownership')}</span>
          <span><Check size={15} /> {t('welcome.git')}</span>
        </div>
      </div>
      <div className="welcome-art" aria-hidden="true">
        <div className="orb orb-one" /><div className="orb orb-two" />
        <div className="paper paper-back" />
        <div className="paper paper-front">
          <div className="paper-bar" /><div className="paper-title" /><div className="paper-title short" />
          <div className="paper-image"><Sparkles size={44} /></div>
          <div className="paper-line" /><div className="paper-line short" /><div className="paper-line" />
        </div>
        <div className="plumbago-flower"><i /><i /><i /><i /><i /><span>p</span></div>
      </div>
    </main>
  )
}

function Modal({ title, onClose, children, width = '520px' }) {
  const { t } = useI18n()
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal" style={{ width }}>
        <header><h2>{title}</h2><button className="icon-button" onClick={onClose} title={t('common.close')}><X size={19} /></button></header>
        {children}
      </section>
    </div>
  )
}

function NewPostModal({ onClose, onCreate, busy }) {
  const { t } = useI18n()
  const [title, setTitle] = useState('')
  const [language, setLanguage] = useState('pt-br')
  return (
    <Modal title={t('new.title')} onClose={onClose}>
      <form className="modal-form" onSubmit={(event) => { event.preventDefault(); onCreate({ title, language }) }}>
        <label>{t('new.fieldTitle')}<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t('new.placeholder')} /></label>
        <label>{t('new.language')}<select value={language} onChange={(event) => setLanguage(event.target.value)}><option value="en-us">English (US)</option><option value="pt-br">Português (Brasil)</option></select></label>
        <p className="form-hint">{t('new.hint')}</p>
        <footer><button type="button" className="button quiet" onClick={onClose}>{t('common.cancel')}</button><button className="button primary" disabled={!title.trim() || busy}>{busy && <LoaderCircle className="spin" size={16} />} {t('new.create')}</button></footer>
      </form>
    </Modal>
  )
}

function ThemeBrowser({ selected, onSelect, allowNone = true }) {
  const { t } = useI18n()
  const [themes, setThemes] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    api.listThemes()
      .then((items) => { if (!cancelled) setThemes(items) })
      .catch((reason) => { if (!cancelled) setError(friendlyError(reason, t)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [t])

  const matches = themes.filter((theme) => `${theme.name} ${theme.slug}`.toLowerCase().includes(query.toLowerCase())).slice(0, 60)
  return (
    <div className="theme-browser">
      <div className={`theme-browser-toolbar ${allowNone ? '' : 'without-none'}`}>
        <div className="search theme-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('themes.search')} /></div>
        {allowNone && <button type="button" className={`theme-none ${selected ? '' : 'selected'}`} onClick={() => onSelect('')}><span><Palette size={17} /></span><strong>{t('themes.none')}</strong><small>{t('themes.noneCopy')}</small></button>}
      </div>
      {loading && <div className="themes-state"><LoaderCircle className="spin" size={22} /> {t('themes.loading')}</div>}
      {error && <div className="themes-state error"><AlertCircle size={21} /> {error}</div>}
      {!loading && !error && (
        <div className="theme-grid">
          {matches.map((theme) => (
            <article className={`theme-card ${selected === theme.slug ? 'selected' : ''}`} key={theme.slug}>
              <button type="button" className="theme-select" onClick={() => onSelect(theme.slug)} aria-pressed={selected === theme.slug}>
                <span className="theme-preview"><img src={theme.image} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none' }} />{selected === theme.slug && <b><Check size={14} /></b>}</span>
                <span className="theme-card-copy"><strong>{theme.name}</strong><small>{theme.slug}</small></span>
              </button>
              <button type="button" className="theme-details" onClick={() => api.openTheme(theme.slug)} title={t('themes.details')}><ArrowUpRight size={14} /></button>
            </article>
          ))}
          {!matches.length && <div className="themes-state"><Search size={21} /> {t('themes.empty')}</div>}
        </div>
      )}
      <p className="theme-source">{t('themes.source')}</p>
    </div>
  )
}

function CreateBlogModal({ onClose, onCreate, busy }) {
  const { t } = useI18n()
  const [title, setTitle] = useState('')
  const [folder, setFolder] = useState('')
  const [folderEdited, setFolderEdited] = useState(false)
  const [languageCode, setLanguageCode] = useState('en-US')
  const [theme, setTheme] = useState('')

  function changeTitle(value) {
    setTitle(value)
    if (!folderEdited) setFolder(value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
  }

  return (
    <Modal title={t('createBlog.title')} onClose={onClose} width="920px">
      <form className="create-blog-form" onSubmit={(event) => { event.preventDefault(); onCreate({ title, folder, languageCode, theme }) }}>
        <div className="create-blog-fields">
          <label>{t('createBlog.siteTitle')}<input autoFocus value={title} onChange={(event) => changeTitle(event.target.value)} placeholder={t('createBlog.siteTitlePlaceholder')} /></label>
          <label>{t('createBlog.folder')}<input value={folder} onChange={(event) => { setFolderEdited(true); setFolder(event.target.value) }} placeholder="my-hugo-blog" /></label>
          <label>{t('createBlog.language')}<select value={languageCode} onChange={(event) => setLanguageCode(event.target.value)}><option value="en-US">English (US)</option><option value="pt-BR">Português (Brasil)</option></select></label>
        </div>
        <div className="create-blog-theme"><div><h3>{t('createBlog.theme')}</h3><p>{t('createBlog.themeCopy')}</p></div><ThemeBrowser selected={theme} onSelect={setTheme} /></div>
        <footer className="create-blog-footer"><p><FolderOpen size={15} /> {t('createBlog.destinationHint')}</p><button type="button" className="button quiet" onClick={onClose}>{t('common.cancel')}</button><button className="button primary" disabled={busy || !title.trim() || !folder.trim()}>{busy ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />} {t('createBlog.create')}</button></footer>
      </form>
    </Modal>
  )
}

function ThemeManagerModal({ context, onClose, onInstall, busy }) {
  const { t } = useI18n()
  const [selected, setSelected] = useState('')
  return (
    <Modal title={t('themes.manage')} onClose={onClose} width="900px">
      <div className="theme-manager-intro"><div><Palette size={19} /><span><strong>{t('themes.current')}</strong><small>{context.theme || t('themes.noCurrent')}</small></span></div><p>{t('themes.installCopy')}</p></div>
      <ThemeBrowser selected={selected} onSelect={setSelected} allowNone={false} />
      <footer className="theme-manager-footer"><button className="button quiet" onClick={onClose}>{t('common.close')}</button><button className="button primary" disabled={!selected || busy} onClick={() => onInstall(selected)}>{busy ? <LoaderCircle className="spin" size={16} /> : <Palette size={16} />} {t('themes.install')}</button></footer>
    </Modal>
  )
}

function SyncModal({ status, busy, onClose, onSync }) {
  const { t, locale } = useI18n()
  const [message, setMessage] = useState(t('sync.defaultMessage', { date: new Intl.DateTimeFormat(locale).format(new Date()) }))
  return (
    <Modal title={t('sync.title')} onClose={onClose}>
      <div className="sync-summary">
        <div><GitBranch size={18} /><span><small>{t('sync.branch')}</small>{status?.branch || '—'}</span></div>
        <div><Cloud size={18} /><span><small>{t('sync.destination')}</small>{status?.remote || t('sync.noOrigin')}</span></div>
      </div>
      <div className="change-list">
        <div className="section-label"><span>{t('sync.localChanges')}</span><b>{status?.changes?.length || 0}</b></div>
        {status?.changes?.length ? status.changes.slice(0, 8).map((change) => <code key={change}>{change}</code>) : <p>{t('sync.clean')}</p>}
      </div>
      <form className="modal-form" onSubmit={(event) => { event.preventDefault(); onSync(message) }}>
        <label>{t('sync.commitMessage')}<input value={message} onChange={(event) => setMessage(event.target.value)} /></label>
        <footer><button type="button" className="button quiet" onClick={onClose}>{t('sync.later')}</button><button className="button primary" disabled={busy || !status?.remote}>{busy ? <LoaderCircle className="spin" size={16} /> : <UploadCloud size={16} />} {t('sync.now')}</button></footer>
      </form>
    </Modal>
  )
}

function ImageLibrary({ post, onClose, onAdd, onDrop, onInsert, onFeatured }) {
  const { t } = useI18n()
  const [assets, setAssets] = useState({})
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all((post.assets || []).map(async (name) => [name, await api.readAsset(post.id, name)]))
      .then((entries) => { if (!cancelled) setAssets(Object.fromEntries(entries)) })
      .catch(() => setAssets({}))
    return () => { cancelled = true }
  }, [post.assets, post.id])

  function drop(event) {
    event.preventDefault()
    setDragging(false)
    const files = Array.from(event.dataTransfer.files || [])
    if (files.length) onDrop(files)
  }

  return (
    <Modal title={t('images.title', { title: post.title })} onClose={onClose} width="780px">
      <div className="image-library-actions">
        <div><strong>{t(post.assets.length === 1 ? 'images.attached.one' : 'images.attached.other', { count: post.assets.length })}</strong><span>{t('images.location')}</span></div>
        <button className="button primary" onClick={onAdd}><ImagePlus size={16} /> {t('images.add')}</button>
      </div>
      <div
        className={`image-drop-zone compact ${dragging ? 'dragging' : ''}`}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false) }}
        onDrop={drop}
      >
        <UploadCloud size={20} /> {t('images.drop')}
      </div>
      {post.assets.length ? (
        <div className="image-grid">
          {post.assets.map((name) => (
            <article className="image-card" key={name}>
              <div className="image-thumb">{assets[name] ? <img src={assets[name]} alt={name} /> : <LoaderCircle className="spin" size={20} />}</div>
              <div className="image-card-info"><strong title={name}>{name}</strong>{post.featuredImage === name && <span>{t('images.featured')}</span>}</div>
              <div className="image-card-actions">
                <button className="button quiet" onClick={() => onFeatured(name)}>{post.featuredImage === name ? <Check size={14} /> : <Sparkles size={14} />} {post.featuredImage === name ? t('images.featured') : t('images.useFeatured')}</button>
                <button className="button primary" onClick={() => onInsert(name)}><Plus size={14} /> {t('images.insert')}</button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="image-empty"><Images size={34} /><h3>{t('images.emptyTitle')}</h3><p>{t('images.emptyCopy')}</p></div>
      )}
    </Modal>
  )
}

function SettingsModal({ context, onClose, onChooseBlog, onCreateBlog, onSync, notify }) {
  const { t, locale, setLocale } = useI18n()
  const [config, setConfig] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.gitConfig().then(setConfig).catch((error) => notify(friendlyError(error, t), 'error'))
  }, [notify, t])

  async function saveConfig(event) {
    event.preventDefault()
    setSaving(true)
    try {
      const saved = await api.saveGitConfig(config)
      setConfig(saved)
      notify(t('notice.gitSaved'))
    } catch (error) {
      notify(friendlyError(error, t), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={t('settings.title')} onClose={onClose} width="680px">
      <div className="settings-content">
        <section className="settings-section">
          <div className="settings-heading"><HardDrive size={18} /><div><h3>{t('settings.blog')}</h3><p>{t('settings.blogCopy')}</p></div></div>
          <div className="settings-blog-card">
            <div><small>{t('settings.folder')}</small><strong title={context.root}>{context.root}</strong></div>
            <div className="settings-blog-actions"><button className="button quiet" onClick={onChooseBlog}><FolderOpen size={15} /> {t('settings.changeBlog')}</button><button className="button quiet" onClick={onCreateBlog}><Plus size={15} /> {t('settings.createBlog')}</button></div>
          </div>
          <div className="tool-status"><span className={context.hugo ? 'ok' : 'error'} /><div><strong>Hugo</strong><small>{context.hugo || t('settings.notFound')}</small></div><span className={context.git ? 'ok' : 'error'} /><div><strong>Git</strong><small>{context.git || t('settings.notFound')}</small></div></div>
          <label className="language-setting">{t('language.label')}<select value={locale} onChange={(event) => setLocale(event.target.value)}>{supportedLanguages.map((language) => <option key={language.value} value={language.value}>{language.label}</option>)}</select></label>
        </section>
        <section className="settings-section">
          <div className="settings-heading"><GitBranch size={18} /><div><h3>{t('settings.git')}</h3><p>{t('settings.gitCopy')}</p></div></div>
          {config ? (
            <form className="settings-form" onSubmit={saveConfig}>
              <div className="two-fields">
                <label>{t('settings.author')}<input value={config.name || ''} onChange={(event) => setConfig({ ...config, name: event.target.value })} placeholder={t('settings.authorPlaceholder')} /></label>
                <label>{t('settings.email')}<input type="email" value={config.email || ''} onChange={(event) => setConfig({ ...config, email: event.target.value })} placeholder="you@example.com" /></label>
              </div>
              <label>{t('settings.origin')}<input value={config.remote || ''} onChange={(event) => setConfig({ ...config, remote: event.target.value })} placeholder="git@github.com:user/blog.git" /></label>
              <div className="settings-form-footer"><span><GitBranch size={14} /> {t('settings.branch')} <b>{config.branch || '—'}</b></span><button className="button quiet" type="button" onClick={onSync}><UploadCloud size={15} /> {t('settings.viewSync')}</button><button className="button primary" disabled={saving}>{saving ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />} {t('settings.save')}</button></div>
            </form>
          ) : <div className="settings-loading"><LoaderCircle className="spin" size={20} /> {t('settings.reading')}</div>}
        </section>
      </div>
    </Modal>
  )
}

function Sidebar({ context, onChooseBlog, onImages, onThemes, onSettings }) {
  const { t, locale } = useI18n()
  return (
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">p</div><div><strong>Plumbago</strong><span>Hugo UI manager</span></div></div>
      <nav>
        <button className="nav-item active"><FileText size={18} /><span>{t('sidebar.posts')}</span><small>⌘ 1</small></button>
        <button className="nav-item" onClick={onImages}><ImagePlus size={18} /><span>{t('sidebar.images')}</span></button>
        <button className="nav-item" onClick={onThemes}><Palette size={18} /><span>{t('sidebar.themes')}</span>{context.theme && <small>✓</small>}</button>
      </nav>
      <div className="sidebar-spacer" />
      <div className="site-card">
        <div className="site-icon">H</div>
        <div><strong>{context.root.split(/[\\/]/).filter(Boolean).at(-1)}</strong><span>{context.runtime.kind === 'wsl' ? `WSL · ${context.runtime.distro}` : t('sidebar.localFolder')}</span></div>
        <button className="icon-button small" onClick={onChooseBlog} title={t('sidebar.changeBlog')}><MoreHorizontal size={17} /></button>
      </div>
      <button className="nav-item muted" onClick={onSettings}><Settings size={18} /><span>{t('sidebar.settings')}</span><small>{locale === 'en-US' ? 'EN' : 'PT'}</small></button>
    </aside>
  )
}

function PostList({ posts, activeId, onSelect, onNew }) {
  const { t, locale } = useI18n()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('todos')
  const visible = posts.filter((post) => {
    const matchesQuery = `${post.title} ${post.description}`.toLowerCase().includes(query.toLowerCase())
    return matchesQuery && (filter === 'todos' || (filter === 'rascunhos' ? post.draft : !post.draft))
  })
  return (
    <section className="post-panel">
      <header className="panel-header"><div><p className="eyebrow">{t('posts.content')}</p><h2>{t('posts.title')} <span>{posts.length}</span></h2></div><button className="icon-button brand-action" onClick={onNew} title={t('posts.new')}><Plus size={20} /></button></header>
      <div className="search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('posts.search')} /></div>
      <div className="filters"><button className={filter === 'todos' ? 'active' : ''} onClick={() => setFilter('todos')}>{t('posts.all')}</button><button className={filter === 'publicados' ? 'active' : ''} onClick={() => setFilter('publicados')}>{t('posts.published')}</button><button className={filter === 'rascunhos' ? 'active' : ''} onClick={() => setFilter('rascunhos')}>{t('posts.drafts')}</button></div>
      <div className="post-list">
        {visible.map((post) => (
          <button key={post.id} className={`post-row ${post.id === activeId ? 'active' : ''}`} onClick={() => onSelect(post.id)}>
            <div className="post-row-top"><strong>{post.title || t('posts.noTitle')}</strong>{post.draft && <span className="draft-dot" title={t('posts.draft')} />}</div>
            <p>{post.description || t('posts.noDescription')}</p>
            <div><span>{formatDate(post.date, locale, t)}</span><span className="lang">{post.language}</span></div>
          </button>
        ))}
        {!visible.length && <div className="empty-list"><Search size={24} /><p>{t('posts.empty')}</p></div>}
      </div>
    </section>
  )
}

function MarkdownToolbar({ onFormat, onImages }) {
  const { t } = useI18n()
  return (
    <div className="markdown-toolbar">
      <button onClick={() => onFormat('**', '**', t('toolbar.boldText'))} title={t('toolbar.bold')}><Bold size={16} /></button>
      <button onClick={() => onFormat('_', '_', t('toolbar.italicText'))} title={t('toolbar.italic')}><Italic size={16} /></button>
      <span />
      <button onClick={() => onFormat('## ', '', t('toolbar.headingText'))} title={t('toolbar.heading')}><Heading2 size={16} /></button>
      <button onClick={() => onFormat('- ', '', t('toolbar.listText'))} title={t('toolbar.list')}><List size={16} /></button>
      <button onClick={() => onFormat('[', '](https://)', t('toolbar.linkText'))} title={t('toolbar.link')}><Link size={16} /></button>
      <button onClick={onImages} title={t('toolbar.images')}><ImagePlus size={16} /></button>
      <span />
      <button onClick={() => onFormat('`', '`', t('toolbar.codeText'))} title={t('toolbar.code')}><Code2 size={16} /></button>
    </div>
  )
}

function Editor({ post, onChange, onSave, onOpenImages, onDropImages, saveState }) {
  const { t } = useI18n()
  const [mode, setMode] = useState('split')
  const [assetMap, setAssetMap] = useState({})
  const [dragging, setDragging] = useState(false)
  const textareaRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    Promise.all((post.assets || []).map(async (name) => [name, await api.readAsset(post.id, name)]))
      .then((entries) => { if (!cancelled) setAssetMap(Object.fromEntries(entries)) })
      .catch(() => setAssetMap({}))
    return () => { cancelled = true }
  }, [post.id, post.assets])

  const preview = useMemo(() => {
    let markdown = post.body || ''
    for (const [name, data] of Object.entries(assetMap)) markdown = markdown.replaceAll(`](${name})`, `](${data})`)
    return DOMPurify.sanitize(marked.parse(markdown, { breaks: true }))
  }, [assetMap, post.body])

  function format(before, after, fallback) {
    const textarea = textareaRef.current
    const body = post.body || ''
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = body.slice(start, end) || fallback
    const value = `${body.slice(0, start)}${before}${selected}${after}${body.slice(end)}`
    onChange({ body: value })
    requestAnimationFrame(() => { textarea.focus(); textarea.setSelectionRange(start + before.length, start + before.length + selected.length) })
  }

  function drop(event) {
    event.preventDefault()
    setDragging(false)
    const files = Array.from(event.dataTransfer.files || [])
    if (files.length) onDropImages(files)
  }

  const status = saveState.saving
    ? { icon: <LoaderCircle className="spin" size={14} />, label: t('editor.saving'), className: 'saving' }
    : saveState.error
      ? { icon: <AlertCircle size={14} />, label: t('editor.saveError'), className: 'error' }
      : saveState.dirty
        ? { icon: <Clock3 size={14} />, label: t('editor.unsaved'), className: 'dirty' }
        : { icon: <Check size={14} />, label: t('editor.saved'), className: 'saved' }

  return (
    <section
      className={`editor ${dragging ? 'is-dragging' : ''}`}
      onDragEnter={(event) => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); setDragging(true) } }}
      onDragOver={(event) => { if (event.dataTransfer.types.includes('Files')) event.preventDefault() }}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false) }}
      onDrop={drop}
    >
      {dragging && <div className="editor-drop-overlay"><div><UploadCloud size={34} /><strong>{t('editor.dropTitle')}</strong><span>{t('editor.dropTypes')}</span></div></div>}
      <div className="editor-title-row">
        <input className="title-input" value={post.title} onChange={(event) => onChange({ title: event.target.value })} placeholder={t('editor.title')} />
        <div className={`save-state ${status.className}`}>{status.icon} {status.label}</div>
        <button className="button quiet save-now" onClick={onSave} disabled={saveState.saving || !saveState.dirty}><Save size={15} /> {t('editor.saveNow')}</button>
      </div>
      <input className="description-input" value={post.description} onChange={(event) => onChange({ description: event.target.value })} placeholder={t('editor.description')} />
      <div className="metadata-row">
        <label>{t('editor.date')}<input type="date" value={post.date} onChange={(event) => onChange({ date: event.target.value })} /></label>
        <label>{t('editor.tags')}<input value={post.tags.join(', ')} onChange={(event) => onChange({ tags: event.target.value.split(',').map((tag) => tag.trim()) })} placeholder={t('editor.tagsPlaceholder')} /></label>
        <label className="draft-toggle"><input type="checkbox" checked={!post.draft} onChange={(event) => onChange({ draft: !event.target.checked })} /><span /> {t('editor.published')}</label>
      </div>
      <div className="editor-controls">
        <MarkdownToolbar onFormat={format} onImages={onOpenImages} />
        <div className="view-toggle"><button className={mode === 'write' ? 'active' : ''} onClick={() => setMode('write')}>{t('editor.write')}</button><button className={mode === 'split' ? 'active' : ''} onClick={() => setMode('split')}>{t('editor.split')}</button><button className={mode === 'preview' ? 'active' : ''} onClick={() => setMode('preview')}>{t('editor.preview')}</button></div>
      </div>
      <div className={`editor-workspace mode-${mode}`}>
        {mode !== 'preview' && <textarea ref={textareaRef} value={post.body || ''} onChange={(event) => onChange({ body: event.target.value })} placeholder={t('editor.placeholder')} spellCheck="true" />}
        {mode !== 'write' && <article className="markdown-preview" dangerouslySetInnerHTML={{ __html: preview }} />}
      </div>
      <footer className="editor-footer"><span>{t('editor.markdown')}</span><span>{t('editor.words', { count: post.body?.trim() ? post.body.trim().split(/\s+/).length : 0 })}</span><span className="autosave-hint">{t('editor.autosaveHint')}</span><button className="button primary compact" onClick={onSave} disabled={saveState.saving || !saveState.dirty}><Save size={15} /> {t('common.save')}</button></footer>
    </section>
  )
}

export default function App() {
  const { t } = useI18n()
  const [context, setContext] = useState(emptyContext)
  const [ready, setReady] = useState(false)
  const [posts, setPosts] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [post, setPost] = useState(null)
  const [savedPost, setSavedPost] = useState(null)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [createBlogOpen, setCreateBlogOpen] = useState(false)
  const [newPostOpen, setNewPostOpen] = useState(false)
  const [syncOpen, setSyncOpen] = useState(false)
  const [imagesOpen, setImagesOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [themesOpen, setThemesOpen] = useState(false)
  const [gitStatus, setGitStatus] = useState(null)
  const [toast, setToast] = useState(null)
  const savePromiseRef = useRef(null)
  const tRef = useRef(t)
  tRef.current = t

  const notify = useCallback((message, kind = 'success') => {
    setToast({ message, kind })
    setTimeout(() => setToast(null), 4200)
  }, [])

  const performSave = useCallback(async (target, announce = false) => {
    if (!target) return false
    if (savePromiseRef.current) await savePromiseRef.current.catch(() => {})

    const snapshot = JSON.stringify(target)
    setSaving(true)
    setSaveError(null)
    const request = api.savePost(target)
    savePromiseRef.current = request
    try {
      const saved = await request
      setSavedPost(JSON.stringify(saved))
      setPost((current) => JSON.stringify(current) === snapshot ? saved : current)
      setPosts((current) => current.map((item) => item.id === saved.id ? {
        ...item,
        title: saved.title,
        description: saved.description,
        date: saved.date,
        draft: saved.draft,
        language: saved.language,
        featuredImage: saved.featuredImage,
      } : item))
      if (announce) notify(t('notice.postSaved'))
      return true
    } catch (error) {
      const message = friendlyError(error, t)
      setSaveError(message)
      notify(message, 'error')
      return false
    } finally {
      if (savePromiseRef.current === request) savePromiseRef.current = null
      setSaving(false)
    }
  }, [notify, t])

  const refreshPosts = useCallback(async (preferredId, replaceSelection = false) => {
    const result = await api.listPosts()
    setPosts(result)
    const id = preferredId || (!replaceSelection && activeId) || result[0]?.id
    if (id) {
      const loaded = await api.readPost(id)
      setActiveId(id); setPost(loaded); setSavedPost(JSON.stringify(loaded))
    } else {
      setActiveId(null); setPost(null); setSavedPost(null)
    }
  }, [activeId])

  useEffect(() => {
    api.getContext().then(async (value) => {
      if (value) { setContext(value); const result = await api.listPosts(); setPosts(result); if (result[0]) { const loaded = await api.readPost(result[0].id); setActiveId(result[0].id); setPost(loaded); setSavedPost(JSON.stringify(loaded)) } }
    }).catch((error) => notify(friendlyError(error, tRef.current), 'error')).finally(() => setReady(true))
  }, [notify])

  const dirty = Boolean(post && savedPost && JSON.stringify(post) !== savedPost)

  useEffect(() => {
    if (!dirty || saving || saveError || !post) return undefined
    const timer = setTimeout(() => performSave(post), 1200)
    return () => clearTimeout(timer)
  }, [dirty, performSave, post, saveError, saving])

  async function chooseBlog() {
    setBusy(true)
    try {
      const value = await api.chooseBlog()
      if (value) { setContext(value); await refreshPosts(undefined, true); notify(t('notice.blogConnected')) }
    } catch (error) { notify(friendlyError(error, t), 'error') } finally { setBusy(false); setReady(true) }
  }

  async function createBlog(input) {
    setBusy(true)
    try {
      const value = await api.createBlog(input)
      if (value) {
        setContext(value)
        setCreateBlogOpen(false)
        await refreshPosts(undefined, true)
        notify(value.themeWarning ? t('notice.blogCreatedThemeWarning', { detail: value.themeWarning }) : t('notice.blogCreated'), value.themeWarning ? 'error' : 'success')
      }
    } catch (error) { notify(friendlyError(error, t), 'error') } finally { setBusy(false); setReady(true) }
  }

  async function installTheme(slug) {
    setBusy(true)
    try {
      const result = await api.installTheme(slug)
      setContext(result.context)
      setThemesOpen(false)
      notify(t('notice.themeInstalled', { theme: result.folder }))
    } catch (error) { notify(friendlyError(error, t), 'error') } finally { setBusy(false) }
  }

  async function selectPost(id) {
    if (dirty && !(await performSave(post))) return
    try { const loaded = await api.readPost(id); setActiveId(id); setPost(loaded); setSavedPost(JSON.stringify(loaded)) } catch (error) { notify(friendlyError(error, t), 'error') }
  }

  async function save() {
    await performSave(post, true)
  }

  async function create(input) {
    setBusy(true)
    try { const created = await api.createPost(input); setNewPostOpen(false); await refreshPosts(created.id); notify(t('notice.draftCreated')) } catch (error) { notify(friendlyError(error, t), 'error') } finally { setBusy(false) }
  }

  function applyImportedImages(imported) {
    if (!imported.length) return
    const markdown = imported.map((item) => `![${t('image.alt')}](${item.name})`).join('\n\n')
    setPost((current) => {
      const body = current.body || ''
      return {
        ...current,
        body: `${body}${body && !body.endsWith('\n') ? '\n\n' : ''}${markdown}`,
        assets: [...new Set([...(current.assets || []), ...imported.map((item) => item.name)])],
      }
    })
    notify(t(imported.length === 1 ? 'notice.imagesAdded.one' : 'notice.imagesAdded.other', { count: imported.length }))
  }

  async function addImages() {
    try {
      const imported = await api.importImages(post.id)
      applyImportedImages(imported)
    } catch (error) { notify(friendlyError(error, t), 'error') }
  }

  async function addDroppedImages(files) {
    try {
      const imported = await api.importDroppedImages(post.id, files)
      applyImportedImages(imported)
    } catch (error) { notify(friendlyError(error, t), 'error') }
  }

  function insertExistingImage(name) {
    setPost((current) => {
      const body = current.body || ''
      const markdown = `![${t('image.alt')}](${name})`
      return { ...current, body: `${body}${body && !body.endsWith('\n') ? '\n\n' : ''}${markdown}` }
    })
    setImagesOpen(false)
    notify(t('notice.imageInserted'))
  }

  async function showSync() {
    try { setGitStatus(await api.gitStatus()); setSettingsOpen(false); setSyncOpen(true) } catch (error) { notify(friendlyError(error, t), 'error') }
  }

  async function sync(message) {
    setBusy(true)
    try { const result = await api.syncGit(message); setGitStatus(result.status); setSyncOpen(false); notify(t('notice.synced')) } catch (error) { notify(friendlyError(error, t), 'error') } finally { setBusy(false) }
  }

  if (!ready) return <div className="app-loading"><div className="welcome-mark"><span>p</span></div><LoaderCircle className="spin" /></div>
  if (!context.root) return <><Welcome onChoose={chooseBlog} onCreate={() => setCreateBlogOpen(true)} busy={busy} />{createBlogOpen && <CreateBlogModal onClose={() => setCreateBlogOpen(false)} onCreate={createBlog} busy={busy} />}{toast && <div className={`toast ${toast.kind}`}>{toast.message}</div>}</>

  return (
    <div className="app-shell">
      <Sidebar context={context} onChooseBlog={chooseBlog} onImages={() => post && setImagesOpen(true)} onThemes={() => setThemesOpen(true)} onSettings={() => setSettingsOpen(true)} />
      <PostList posts={posts} activeId={activeId} onSelect={selectPost} onNew={() => setNewPostOpen(true)} />
      <main className="content-area">
        <header className="topbar">
          <button className="icon-button ghost"><PanelLeftClose size={19} /></button>
          <div className="breadcrumbs"><span>{context.root.split(/[\\/]/).filter(Boolean).at(-1)}</span><b>/</b><strong>{post?.title || t('posts.title')}</strong></div>
          <div className="topbar-actions"><button className="button quiet" onClick={() => api.openPreview().catch((error) => notify(friendlyError(error, t), 'error'))}><Eye size={17} /> {t('top.preview')} <ArrowUpRight size={14} /></button><button className="button primary" onClick={showSync}><UploadCloud size={17} /> {t('top.sync')}</button><button className="icon-button" onClick={() => setSettingsOpen(true)} title={t('top.openSettings')}><Menu size={18} /></button></div>
        </header>
        {post ? <Editor post={post} onChange={(change) => { setSaveError(null); setPost((current) => ({ ...current, ...change })) }} onSave={save} onOpenImages={() => setImagesOpen(true)} onDropImages={addDroppedImages} saveState={{ saving, dirty, error: saveError }} /> : <div className="empty-editor"><FileText size={34} /><h2>{t('empty.title')}</h2><p>{t('empty.copy')}</p><button className="button primary" onClick={() => setNewPostOpen(true)}><Plus size={17} /> {t('posts.new')}</button></div>}
      </main>
      {newPostOpen && <NewPostModal onClose={() => setNewPostOpen(false)} onCreate={create} busy={busy} />}
      {createBlogOpen && <CreateBlogModal onClose={() => setCreateBlogOpen(false)} onCreate={createBlog} busy={busy} />}
      {syncOpen && <SyncModal status={gitStatus} busy={busy} onClose={() => setSyncOpen(false)} onSync={sync} />}
      {imagesOpen && post && <ImageLibrary post={post} onClose={() => setImagesOpen(false)} onAdd={addImages} onDrop={addDroppedImages} onInsert={insertExistingImage} onFeatured={(name) => setPost((current) => ({ ...current, featuredImage: name }))} />}
      {themesOpen && <ThemeManagerModal context={context} onClose={() => setThemesOpen(false)} onInstall={installTheme} busy={busy} />}
      {settingsOpen && <SettingsModal context={context} onClose={() => setSettingsOpen(false)} onChooseBlog={() => { setSettingsOpen(false); chooseBlog() }} onCreateBlog={() => { setSettingsOpen(false); setCreateBlogOpen(true) }} onSync={showSync} notify={notify} />}
      {toast && <div className={`toast ${toast.kind}`}>{toast.kind === 'success' && <Check size={17} />}{toast.message}</div>}
    </div>
  )
}
