import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import TurndownService from 'turndown'
import {
  Activity, AlertCircle, ArrowUpRight, Bold, Check, Clock3, Cloud, Code2, Download, Eye, FileText,
  FolderOpen, GitBranch, Github, Globe2, HardDrive, Heading2, ImagePlus, Images, Italic, Link,
  List, LoaderCircle, Menu, MoreHorizontal, PanelLeftClose, Plus, Save, Search,
  Palette, Settings, Sparkles, UploadCloud, UserRound, X,
} from 'lucide-react'
import { createDemoBridge } from './demo'
import { supportedLanguages, useI18n } from './i18n'

const api = window.plumbago || createDemoBridge()
const emptyContext = { root: '', runtime: { kind: 'native' }, hugo: null, git: null }
const visualTurndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', codeBlockStyle: 'fenced' })

function friendlyError(error, t) {
  return error?.message?.replace(/^Error invoking remote method '[^']+': Error: /, '') || t('error.generic')
}

function formatDate(value, locale, t) {
  if (!value) return t('posts.noDate')
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
}

function formatDateTime(value, locale, t) {
  if (!value) return t('posts.noDate')
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function dateTimeInputValue(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return ''
  const local = new Date(date.valueOf() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
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

function ThemeManagerModal({ context, onClose, onInstall, busy, notify }) {
  const { t } = useI18n()
  const [selected, setSelected] = useState('')
  const [site, setSite] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.siteSettings().then(setSite).catch((error) => notify(friendlyError(error, t), 'error'))
  }, [notify, t])

  async function saveAppearance(event) {
    event.preventDefault()
    setSaving(true)
    try { setSite(await api.saveSiteSettings(site)); notify(t('notice.appearanceSaved')) } catch (error) { notify(friendlyError(error, t), 'error') } finally { setSaving(false) }
  }

  return (
    <Modal title={t('themes.manage')} onClose={onClose} width="940px">
      <div className="theme-manager-intro"><div><Palette size={19} /><span><strong>{t('themes.current')}</strong><small>{context.theme || t('themes.noCurrent')}</small></span></div><p>{t('themes.installCopy')}</p></div>
      {site && <form className="theme-site-settings" onSubmit={saveAppearance}><div><label>{t('themes.blogTitle')}<input value={site.title} onChange={(event) => setSite({ ...site, title: event.target.value })} /></label><label>{t('themes.siteAddress')}<input value={site.baseURL} onChange={(event) => setSite({ ...site, baseURL: event.target.value })} placeholder="https://username.github.io/blog/" /></label></div><div><label>{t('themes.languageCode')}<input value={site.languageCode} onChange={(event) => setSite({ ...site, languageCode: event.target.value })} placeholder="en-US" /></label><label>{t('themes.copyright')}<input value={site.copyright} onChange={(event) => setSite({ ...site, copyright: event.target.value })} placeholder="© 2026 Your name" /></label></div><button className="button quiet" disabled={saving}>{saving ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />} {t('themes.saveIdentity')}</button></form>}
      <div className="theme-gallery-heading"><div><h3>{t('themes.galleryTitle')}</h3><p>{t('themes.galleryCopy')}</p></div></div>
      <ThemeBrowser selected={selected} onSelect={setSelected} allowNone={false} />
      <footer className="theme-manager-footer"><button className="button quiet" onClick={onClose}>{t('common.close')}</button><button className="button primary" disabled={!selected || busy} onClick={() => onInstall(selected)}>{busy ? <LoaderCircle className="spin" size={16} /> : <Palette size={16} />} {t('themes.install')}</button></footer>
    </Modal>
  )
}

function PublishModal({ status, busy, phase, error, log, onClose, onPublish, onRefresh, onSettings }) {
  const { t, locale } = useI18n()
  const [message, setMessage] = useState(t('publish.defaultMessage', { date: new Intl.DateTimeFormat(locale).format(new Date()) }))
  const deployment = status?.deployment?.state || 'unknown'

  useEffect(() => {
    if (phase !== 'complete' || deployment !== 'deploying') return undefined
    const timer = setInterval(onRefresh, 5000)
    return () => clearInterval(timer)
  }, [deployment, onRefresh, phase])

  const publishState = phase === 'error'
    ? { kind: 'error', icon: <AlertCircle size={20} />, title: t('publish.failed'), copy: error }
    : phase === 'publishing'
      ? { kind: 'working', icon: <LoaderCircle className="spin" size={20} />, title: t('publish.working'), copy: t('publish.workingCopy') }
      : phase === 'complete' && deployment === 'live'
        ? { kind: 'success', icon: <Check size={20} />, title: t('publish.live'), copy: t('publish.liveCopy') }
        : phase === 'complete' && deployment === 'failed'
          ? { kind: 'error', icon: <AlertCircle size={20} />, title: t('publish.deployFailed'), copy: t('publish.deployFailedCopy') }
          : phase === 'complete' && deployment === 'deploying'
            ? { kind: 'working', icon: <LoaderCircle className="spin" size={20} />, title: t('publish.deploying'), copy: t('publish.deployingCopy') }
            : phase === 'complete'
              ? { kind: 'success', icon: <UploadCloud size={20} />, title: t('publish.uploaded'), copy: t(`publish.deployment.${deployment}`) }
              : { kind: 'ready', icon: <Cloud size={20} />, title: t('publish.ready'), copy: t('publish.readyCopy') }

  return (
    <Modal title={t('publish.title')} onClose={onClose} width="570px">
      <div className="publish-summary">
        <div><GitBranch size={18} /><span><small>{t('publish.branch')}</small>{status?.branch || '—'}</span></div>
        <div><Cloud size={18} /><span><small>{t('publish.destination')}</small>{status?.repository?.fullName || status?.remote || t('publish.noDestination')}</span></div>
      </div>
      <div className={`publish-state ${publishState.kind}`}>
        <span className="publish-state-icon">{publishState.icon}</span>
        <div><strong>{publishState.title}</strong><p>{publishState.copy}</p></div>
      </div>
      <div className="publish-steps">
        <div className="done"><span><Check size={13} /></span><div><strong>{t('publish.stepSave')}</strong><small>{t('publish.stepSaveCopy')}</small></div></div>
        <div className={phase === 'publishing' ? 'active' : phase === 'complete' ? 'done' : ''}><span>{phase === 'publishing' ? <LoaderCircle className="spin" size={13} /> : phase === 'complete' ? <Check size={13} /> : '2'}</span><div><strong>{t('publish.stepUpload')}</strong><small>{t('publish.stepUploadCopy')}</small></div></div>
        <div className={deployment === 'live' ? 'done' : deployment === 'deploying' ? 'active' : ''}><span>{deployment === 'live' ? <Check size={13} /> : deployment === 'deploying' ? <LoaderCircle className="spin" size={13} /> : '3'}</span><div><strong>{t('publish.stepLive')}</strong><small>{t('publish.stepLiveCopy')}</small></div></div>
      </div>
      {log?.length > 0 && <details className="publish-details"><summary>{t('publish.details')}</summary>{log.map((entry) => <code key={entry}>{entry}</code>)}</details>}
      <form className="modal-form publish-form" onSubmit={(event) => { event.preventDefault(); onPublish(message) }}>
        {phase !== 'complete' && status?.remote && <label>{t('publish.message')}<input value={message} onChange={(event) => setMessage(event.target.value)} /></label>}
        <footer>
          <button type="button" className="button quiet" onClick={onClose}>{phase === 'complete' ? t('common.close') : t('publish.later')}</button>
          {!status?.remote && <button type="button" className="button primary" onClick={onSettings}><Settings size={16} /> {t('publish.setup')}</button>}
          {phase === 'complete' && <button type="button" className="button quiet" onClick={onRefresh} disabled={busy}><Clock3 size={15} /> {t('publish.check')}</button>}
          {phase === 'complete' && status?.liveUrl && <button type="button" className="button primary" onClick={() => api.openPublishingUrl(status.liveUrl)}><ArrowUpRight size={15} /> {t('publish.viewSite')}</button>}
          {status?.remote && phase !== 'complete' && <button className="button primary" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <UploadCloud size={16} />} {phase === 'error' ? t('publish.retry') : t('publish.now')}</button>}
        </footer>
      </form>
    </Modal>
  )
}

function GitHubSetupModal({ context, onClose, onPublish, notify }) {
  const { t } = useI18n()
  const defaultName = context.root.split(/[\\/]/).filter(Boolean).at(-1)?.toLowerCase().replace(/[^a-z0-9_.-]+/g, '-') || 'my-blog'
  const [github, setGitHub] = useState(null)
  const [flow, setFlow] = useState(null)
  const [repositories, setRepositories] = useState([])
  const [mode, setMode] = useState('create')
  const [selectedRepository, setSelectedRepository] = useState('')
  const [repositoryName, setRepositoryName] = useState(defaultName)
  const [description, setDescription] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [protocol, setProtocol] = useState('ssh')
  const [connectedRepository, setConnectedRepository] = useState(null)
  const [pages, setPages] = useState(null)
  const [working, setWorking] = useState(false)
  const [accessToken, setAccessToken] = useState('')

  const loadAccount = useCallback(async () => {
    const next = await api.githubStatus()
    setGitHub(next)
    if (next.connected) {
      const items = await api.listGitHubRepositories()
      setRepositories(items.filter((repository) => repository.permissions?.push !== false))
    }
  }, [])

  useEffect(() => {
    loadAccount().catch((error) => notify(friendlyError(error, t), 'error'))
  }, [loadAccount, notify, t])

  useEffect(() => {
    if (!flow?.deviceCode) return undefined
    let cancelled = false
    let timer
    async function poll() {
      try {
        const result = await api.completeGitHubSignIn(flow.deviceCode)
        if (cancelled) return
        if (result.state === 'complete') {
          setFlow(null)
          setGitHub({ configured: true, connected: true, account: result.account, persistent: result.persistent })
          setRepositories((await api.listGitHubRepositories()).filter((repository) => repository.permissions?.push !== false))
          notify(t('github.connected', { login: result.account.login }))
          return
        }
        if (['expired', 'denied', 'error'].includes(result.state)) {
          setFlow({ ...flow, error: result.description || t(`github.flow.${result.state}`) })
          return
        }
        timer = setTimeout(poll, (result.state === 'slow-down' ? flow.interval + 5 : flow.interval) * 1000)
      } catch (error) {
        if (!cancelled) setFlow({ ...flow, error: friendlyError(error, t) })
      }
    }
    timer = setTimeout(poll, flow.interval * 1000)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [flow, notify, t])

  async function signIn() {
    setWorking(true)
    try { setFlow(await api.beginGitHubSignIn()) } catch (error) { notify(friendlyError(error, t), 'error') } finally { setWorking(false) }
  }

  async function connectToken() {
    setWorking(true)
    try {
      const result = await api.connectGitHubToken(accessToken)
      setAccessToken('')
      setGitHub({ configured: github.configured, connected: true, account: result.account, persistent: result.persistent })
      setRepositories((await api.listGitHubRepositories()).filter((repository) => repository.permissions?.push !== false))
      notify(t('github.connected', { login: result.account.login }))
    } catch (error) { notify(friendlyError(error, t), 'error') } finally { setWorking(false) }
  }

  async function createRepository(event) {
    event.preventDefault()
    setWorking(true)
    try {
      const result = await api.createGitHubRepository({ name: repositoryName, description, private: isPrivate, protocol })
      setConnectedRepository(result.repository)
      notify(t('github.repositoryCreated', { repository: result.repository.fullName }))
    } catch (error) { notify(friendlyError(error, t), 'error') } finally { setWorking(false) }
  }

  async function connectRepository(event) {
    event.preventDefault()
    setWorking(true)
    try {
      const result = await api.connectGitHubRepository(selectedRepository, protocol)
      setConnectedRepository(result.repository)
      notify(t('github.repositoryConnected', { repository: result.repository.fullName }))
    } catch (error) { notify(friendlyError(error, t), 'error') } finally { setWorking(false) }
  }

  async function configurePages() {
    setWorking(true)
    try {
      const result = await api.configureGitHubPages()
      setPages(result)
      notify(result.warning ? t('github.pagesWarning') : t('github.pagesReady'), result.warning ? 'error' : 'success')
    } catch (error) { notify(friendlyError(error, t), 'error') } finally { setWorking(false) }
  }

  async function disconnect() {
    await api.disconnectGitHub()
    setGitHub({ configured: true, connected: false, account: null, persistent: false })
    setRepositories([])
    setConnectedRepository(null)
    setPages(null)
  }

  return (
    <Modal title={t('github.title')} onClose={onClose} width="720px">
      <div className="github-setup">
        {!github && <div className="github-loading"><LoaderCircle className="spin" size={22} /> {t('github.loading')}</div>}
        {github && !github.connected && (
          <section className="github-signin">
            <div className="github-hero-icon"><Github size={30} /></div>
            <h3>{t('github.signInTitle')}</h3>
            <p>{t('github.signInCopy')}</p>
            {github.configured && (!flow ? <button className="button primary large" onClick={signIn} disabled={working}>{working ? <LoaderCircle className="spin" size={17} /> : <Github size={17} />} {t('github.signIn')}</button> : (
              <div className="github-device-code">
                <span>{t('github.codeCopied')}</span>
                <strong>{flow.userCode}</strong>
                <p>{flow.error || t('github.waiting')}</p>
                {flow.error && <button className="button quiet" onClick={() => setFlow(null)}>{t('github.tryAgain')}</button>}
              </div>
            ))}
            <div className="github-token-option">
              <span>{github.configured ? t('github.orToken') : t('github.tokenRequired')}</span>
              <p>{t('github.tokenCopy')}</p>
              <button className="button quiet" onClick={() => api.openPublishingUrl('https://github.com/settings/personal-access-tokens/new')}><ExternalLink size={14} /> {t('github.createToken')}</button>
              <div><input type="password" value={accessToken} onChange={(event) => setAccessToken(event.target.value)} placeholder={t('github.tokenPlaceholder')} autoComplete="off" /><button className="button primary" onClick={connectToken} disabled={working || accessToken.trim().length < 20}>{working && <LoaderCircle className="spin" size={15} />} {t('github.connectToken')}</button></div>
              <small>{t('github.tokenStorage')}</small>
            </div>
          </section>
        )}
        {github?.connected && !connectedRepository && (
          <>
            <div className="github-account">
              <img src={github.account.avatarUrl} alt="" /><div><small>{t('github.connectedAs')}</small><strong>{github.account.name}</strong><span>@{github.account.login}{!github.persistent && ` · ${t('github.sessionOnly')}`}</span></div>
              <button className="button quiet" onClick={disconnect}>{t('github.disconnect')}</button>
            </div>
            <div className="github-mode-tabs"><button className={mode === 'create' ? 'active' : ''} onClick={() => setMode('create')}>{t('github.createRepository')}</button><button className={mode === 'existing' ? 'active' : ''} onClick={() => setMode('existing')}>{t('github.existingRepository')}</button></div>
            {mode === 'create' ? (
              <form className="github-repository-form" onSubmit={createRepository}>
                <label>{t('github.repositoryName')}<div className="repository-name"><span>{github.account.login} /</span><input value={repositoryName} onChange={(event) => setRepositoryName(event.target.value)} /></div></label>
                <label>{t('github.description')}<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t('github.descriptionPlaceholder')} /></label>
                <div className="github-options">
                  <label><input type="radio" checked={!isPrivate} onChange={() => setIsPrivate(false)} /> <Globe2 size={15} /><span><strong>{t('github.public')}</strong><small>{t('github.publicCopy')}</small></span></label>
                  <label><input type="radio" checked={isPrivate} onChange={() => setIsPrivate(true)} /> <Github size={15} /><span><strong>{t('github.private')}</strong><small>{t('github.privateCopy')}</small></span></label>
                </div>
                <label>{t('github.gitConnection')}<select value={protocol} onChange={(event) => setProtocol(event.target.value)}><option value="ssh">SSH</option><option value="https">HTTPS</option></select></label>
                <footer><button className="button primary" disabled={working || !repositoryName}>{working && <LoaderCircle className="spin" size={15} />} {t('github.createAndConnect')}</button></footer>
              </form>
            ) : (
              <form className="github-repository-form" onSubmit={connectRepository}>
                <label>{t('github.chooseRepository')}<select value={selectedRepository} onChange={(event) => setSelectedRepository(event.target.value)}><option value="">{t('github.choosePlaceholder')}</option>{repositories.map((repository) => <option key={repository.fullName} value={repository.fullName}>{repository.fullName}{repository.private ? ` · ${t('github.private')}` : ''}</option>)}</select></label>
                <label>{t('github.gitConnection')}<select value={protocol} onChange={(event) => setProtocol(event.target.value)}><option value="ssh">SSH</option><option value="https">HTTPS</option></select></label>
                <footer><button className="button primary" disabled={working || !selectedRepository}>{working && <LoaderCircle className="spin" size={15} />} {t('github.connectSelected')}</button></footer>
              </form>
            )}
          </>
        )}
        {connectedRepository && !pages && (
          <section className="github-pages-step"><div className="github-success"><Check size={20} /><div><strong>{connectedRepository.fullName}</strong><span>{t('github.remoteReady')}</span></div></div><Globe2 size={34} /><h3>{t('github.pagesTitle')}</h3><p>{t('github.pagesCopy')}</p><button className="button primary large" onClick={configurePages} disabled={working}>{working ? <LoaderCircle className="spin" size={17} /> : <Globe2 size={17} />} {t('github.configurePages')}</button></section>
        )}
        {pages && (
          <section className="github-pages-step"><div className="github-finished"><Check size={28} /></div><h3>{t('github.finishedTitle')}</h3><p>{t('github.finishedCopy', { url: pages.liveUrl })}</p>{pages.warning && <div className="github-warning"><AlertCircle size={16} /> {pages.warning}</div>}<div className="github-live-url">{pages.liveUrl}</div><button className="button primary large" onClick={() => { onClose(); onPublish() }}><UploadCloud size={17} /> {t('github.publishFirst')}</button></section>
        )}
      </div>
    </Modal>
  )
}

function PublishingHealthModal({ onClose, onAction, notify }) {
  const { t } = useI18n()
  const [report, setReport] = useState(null)
  const [running, setRunning] = useState(false)

  const runChecks = useCallback(async () => {
    setRunning(true)
    try { setReport(await api.publishingHealth()) } catch (error) { notify(friendlyError(error, t), 'error') } finally { setRunning(false) }
  }, [notify, t])

  useEffect(() => { runChecks() }, [runChecks])

  return (
    <Modal title={t('health.title')} onClose={onClose} width="680px">
      <div className="health-center">
        <header className="health-overview">
          <div className={`health-score ${report?.ready ? 'ready' : ''}`}><strong>{report ? `${report.score}/${report.total}` : '—'}</strong><span>{t('health.checks')}</span></div>
          <div><h3>{report?.ready ? t('health.readyTitle') : t('health.attentionTitle')}</h3><p>{report?.ready ? t('health.readyCopy') : t('health.attentionCopy')}</p></div>
          <button className="button quiet" onClick={runChecks} disabled={running}>{running ? <LoaderCircle className="spin" size={15} /> : <Activity size={15} />} {t('health.runAgain')}</button>
        </header>
        {running && !report ? <div className="health-loading"><LoaderCircle className="spin" size={23} /> {t('health.running')}</div> : (
          <div className="health-list">
            {report?.checks.map((check) => (
              <article className={`health-check ${check.state}`} key={check.id}>
                <span>{check.state === 'ok' ? <Check size={15} /> : check.state === 'error' ? <AlertCircle size={15} /> : <Clock3 size={15} />}</span>
                <div><strong>{t(`health.check.${check.id}`)}</strong><p>{check.detail}</p></div>
                {check.state !== 'ok' && <button className="button quiet" onClick={() => onAction(check.action)}>{t(`health.action.${check.action}`)}</button>}
              </article>
            ))}
          </div>
        )}
        <footer className="health-footer"><button className="button quiet" onClick={onClose}>{t('common.close')}</button>{report?.publishing?.liveUrl && <button className="button primary" onClick={() => api.openPublishingUrl(report.publishing.liveUrl)}><ArrowUpRight size={15} /> {t('publish.viewSite')}</button>}</footer>
      </div>
    </Modal>
  )
}

function BloggerImportModal({ onClose, onImported, notify }) {
  const { t } = useI18n()
  const [inspection, setInspection] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [language, setLanguage] = useState('en-us')
  const [working, setWorking] = useState(false)
  const [result, setResult] = useState(null)

  async function chooseExport() {
    setWorking(true)
    try {
      const next = await api.chooseBloggerExport()
      if (next) {
        setInspection(next)
        setSelectedIds(new Set(next.posts.map((post) => post.id)))
        setResult(null)
      }
    } catch (error) { notify(friendlyError(error, t), 'error') } finally { setWorking(false) }
  }

  function toggle(id) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function importPosts() {
    setWorking(true)
    try {
      const imported = await api.importBloggerExport({ selectedIds: [...selectedIds], language })
      setResult(imported)
      await onImported(imported)
    } catch (error) { notify(friendlyError(error, t), 'error') } finally { setWorking(false) }
  }

  return (
    <Modal title={t('blogger.title')} onClose={onClose} width="780px">
      <div className="blogger-import">
        {!inspection && !result && <section className="blogger-start"><div><Download size={31} /></div><h3>{t('blogger.startTitle')}</h3><p>{t('blogger.startCopy')}</p><ol><li>{t('blogger.stepOne')}</li><li>{t('blogger.stepTwo')}</li><li>{t('blogger.stepThree')}</li></ol><button className="button primary large" onClick={chooseExport} disabled={working}>{working ? <LoaderCircle className="spin" size={17} /> : <FolderOpen size={17} />} {t('blogger.choose')}</button></section>}
        {inspection && !result && (
          <>
            <header className="blogger-summary"><div><strong>{inspection.posts.length}</strong><span>{t('blogger.postsFound')}</span></div><div><strong>{inspection.imageCount}</strong><span>{t('blogger.imagesFound')}</span></div><div><strong>{inspection.labels.length}</strong><span>{t('blogger.labelsFound')}</span></div><button className="button quiet" onClick={chooseExport}>{t('blogger.changeFile')}</button></header>
            <div className="blogger-toolbar"><label><input type="checkbox" checked={selectedIds.size === inspection.posts.length} onChange={(event) => setSelectedIds(event.target.checked ? new Set(inspection.posts.map((post) => post.id)) : new Set())} /> {t('blogger.selectAll')}</label><span>{t('blogger.selected', { count: selectedIds.size })}</span><label>{t('blogger.language')}<select value={language} onChange={(event) => setLanguage(event.target.value)}><option value="en-us">English (US)</option><option value="pt-br">Português (Brasil)</option></select></label></div>
            <div className="blogger-posts">
              {inspection.posts.map((item) => <label className={selectedIds.has(item.id) ? 'selected' : ''} key={item.id}><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggle(item.id)} /><div><strong>{item.title}</strong><span>{item.date || t('posts.noDate')} · {item.draft ? t('posts.draft') : t('posts.published')}</span><small>{item.labels.join(', ') || t('blogger.noLabels')}{item.imageCount ? ` · ${t('blogger.imagesCount', { count: item.imageCount })}` : ''}</small></div></label>)}
            </div>
            <footer className="blogger-footer"><p>{t('blogger.importHint')}</p><button className="button quiet" onClick={onClose}>{t('common.cancel')}</button><button className="button primary" onClick={importPosts} disabled={working || !selectedIds.size}>{working ? <LoaderCircle className="spin" size={16} /> : <Download size={16} />} {t('blogger.importSelected', { count: selectedIds.size })}</button></footer>
          </>
        )}
        {result && <section className="blogger-result"><div><Check size={28} /></div><h3>{t('blogger.completeTitle')}</h3><p>{t('blogger.completeCopy', { posts: result.posts.length, images: result.importedImages })}</p>{result.failures.length > 0 && <div className="blogger-failures"><AlertCircle size={17} /> {t('blogger.failures', { count: result.failures.length })}</div>}<button className="button primary large" onClick={onClose}>{t('blogger.viewPosts')}</button></section>}
      </div>
    </Modal>
  )
}

function ImageLibrary({ post, onClose, onAdd, onDrop, onInsert, onFeatured }) {
  const { t } = useI18n()
  const [assets, setAssets] = useState({})
  const [dragging, setDragging] = useState(false)
  const [selectedName, setSelectedName] = useState('')
  const [altText, setAltText] = useState('')
  const [caption, setCaption] = useState('')
  const [dimensions, setDimensions] = useState({})

  useEffect(() => {
    let cancelled = false
    Promise.all((post.assets || []).map(async (name) => [name, await api.readAssetInfo(post.id, name)]))
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

  function selectAsset(name) {
    setSelectedName(name)
    setAltText(pathToAlt(name))
    setCaption('')
  }

  function pathToAlt(name) {
    return name.replace(/\.[^.]+$/, '').replaceAll('-', ' ')
  }

  function fileSize(bytes) {
    if (!Number.isFinite(bytes)) return ''
    return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  function recordDimensions(name, image) {
    const value = `${image.naturalWidth} × ${image.naturalHeight}`
    setDimensions((current) => ({ ...current, [name]: value }))
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
      {selectedName && assets[selectedName] && <section className="image-detail"><div className="image-detail-preview"><img src={assets[selectedName].dataUrl} alt={altText} onLoad={(event) => recordDimensions(selectedName, event.currentTarget)} /></div><div className="image-detail-fields"><div><strong>{selectedName}</strong><span>{[dimensions[selectedName], fileSize(assets[selectedName].size)].filter(Boolean).join(' · ')}</span></div><label>{t('images.altText')}<input value={altText} onChange={(event) => setAltText(event.target.value)} /></label><label>{t('images.caption')}<input value={caption} onChange={(event) => setCaption(event.target.value)} placeholder={t('images.captionPlaceholder')} /></label><footer><button className="button quiet" onClick={() => onFeatured(selectedName)}><Sparkles size={14} /> {t('images.useFeatured')}</button><button className="button primary" onClick={() => onInsert(selectedName, { alt: altText, caption })}><Plus size={14} /> {t('images.insert')}</button></footer></div></section>}
      {post.assets.length ? (
        <div className={`image-grid ${selectedName ? 'with-detail' : ''}`}>
          {post.assets.map((name) => (
            <article className={`image-card ${selectedName === name ? 'selected' : ''}`} key={name}>
              <button className="image-thumb" onClick={() => selectAsset(name)}>{assets[name] ? <img src={assets[name].dataUrl} alt={name} onLoad={(event) => recordDimensions(name, event.currentTarget)} /> : <LoaderCircle className="spin" size={20} />}</button>
              <div className="image-card-info"><strong title={name}>{name}</strong>{post.featuredImage === name && <span>{t('images.featured')}</span>}<small>{assets[name] ? fileSize(assets[name].size) : ''}</small></div>
              <div className="image-card-actions">
                <button className="button quiet" onClick={() => onFeatured(name)}>{post.featuredImage === name ? <Check size={14} /> : <Sparkles size={14} />} {post.featuredImage === name ? t('images.featured') : t('images.useFeatured')}</button>
                <button className="button primary" onClick={() => selectAsset(name)}><Eye size={14} /> {t('images.details')}</button>
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

function SettingsModal({ context, onClose, onChooseBlog, onCreateBlog, onSync, onGitHub, notify }) {
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
        <section className="settings-section github-settings-card">
          <div className="settings-heading"><Github size={18} /><div><h3>{t('settings.github')}</h3><p>{t('settings.githubCopy')}</p></div></div>
          <button className="button quiet" type="button" onClick={onGitHub}><Github size={16} /> {t('settings.githubManage')}</button>
        </section>
      </div>
    </Modal>
  )
}

function Sidebar({ context, onChooseBlog, onImages, onThemes, onHealth, onImport, onSettings }) {
  const { t, locale } = useI18n()
  return (
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">p</div><div><strong>Plumbago</strong><span>Hugo UI manager</span></div></div>
      <nav>
        <button className="nav-item active"><FileText size={18} /><span>{t('sidebar.posts')}</span><small>⌘ 1</small></button>
        <button className="nav-item" onClick={onImages}><ImagePlus size={18} /><span>{t('sidebar.images')}</span></button>
        <button className="nav-item" onClick={onThemes}><Palette size={18} /><span>{t('sidebar.themes')}</span>{context.theme && <small>✓</small>}</button>
        <button className="nav-item" onClick={onHealth}><Activity size={18} /><span>{t('sidebar.publishing')}</span></button>
        <button className="nav-item" onClick={onImport}><Download size={18} /><span>{t('sidebar.import')}</span></button>
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
    const scheduled = !post.draft && post.publishDate && new Date(post.publishDate) > new Date()
    const matchesQuery = `${post.title} ${post.description} ${(post.tags || []).join(' ')}`.toLowerCase().includes(query.toLowerCase())
    return matchesQuery && (filter === 'todos' || (filter === 'rascunhos' ? post.draft : filter === 'agendados' ? scheduled : !post.draft && !scheduled))
  })
  return (
    <section className="post-panel">
      <header className="panel-header"><div><p className="eyebrow">{t('posts.content')}</p><h2>{t('posts.title')} <span>{posts.length}</span></h2></div><button className="icon-button brand-action" onClick={onNew} title={t('posts.new')}><Plus size={20} /></button></header>
      <div className="search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('posts.search')} /></div>
      <div className="filters"><button className={filter === 'todos' ? 'active' : ''} onClick={() => setFilter('todos')}>{t('posts.all')}</button><button className={filter === 'publicados' ? 'active' : ''} onClick={() => setFilter('publicados')}>{t('posts.published')}</button><button className={filter === 'agendados' ? 'active' : ''} onClick={() => setFilter('agendados')}>{t('posts.scheduled')}</button><button className={filter === 'rascunhos' ? 'active' : ''} onClick={() => setFilter('rascunhos')}>{t('posts.drafts')}</button></div>
      <div className="post-list">
        {visible.map((post) => (
          <button key={post.id} className={`post-row ${post.id === activeId ? 'active' : ''}`} onClick={() => onSelect(post.id)}>
            <div className="post-row-top"><strong>{post.title || t('posts.noTitle')}</strong>{post.draft ? <span className="post-status draft">{t('posts.draft')}</span> : post.publishDate && new Date(post.publishDate) > new Date() ? <span className="post-status scheduled">{t('posts.scheduled')}</span> : <span className="post-status live">{t('posts.live')}</span>}</div>
            <p>{post.description || t('posts.noDescription')}</p>
            <div><span>{post.publishDate && new Date(post.publishDate) > new Date() ? formatDateTime(post.publishDate, locale, t) : formatDate(post.date, locale, t)}</span><span className="lang">{post.language}</span></div>
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
    <div className="markdown-toolbar" onMouseDown={(event) => { if (event.target.closest('button')) event.preventDefault() }}>
      <button onClick={() => onFormat('bold', '**', '**', t('toolbar.boldText'))} title={t('toolbar.bold')}><Bold size={16} /></button>
      <button onClick={() => onFormat('italic', '_', '_', t('toolbar.italicText'))} title={t('toolbar.italic')}><Italic size={16} /></button>
      <span />
      <button onClick={() => onFormat('formatBlock', '## ', '', t('toolbar.headingText'), 'h2')} title={t('toolbar.heading')}><Heading2 size={16} /></button>
      <button onClick={() => onFormat('insertUnorderedList', '- ', '', t('toolbar.listText'))} title={t('toolbar.list')}><List size={16} /></button>
      <button onClick={() => onFormat('createLink', '[', '](https://)', t('toolbar.linkText'), 'https://')} title={t('toolbar.link')}><Link size={16} /></button>
      <button onClick={onImages} title={t('toolbar.images')}><ImagePlus size={16} /></button>
      <span />
      <button onClick={() => onFormat('formatBlock', '`', '`', t('toolbar.codeText'), 'pre')} title={t('toolbar.code')}><Code2 size={16} /></button>
    </div>
  )
}

function VisualEditor({ html, assetMap, onChange, placeholder }) {
  const editorRef = useRef(null)

  useEffect(() => {
    if (editorRef.current && document.activeElement !== editorRef.current && editorRef.current.innerHTML !== html) editorRef.current.innerHTML = html
  }, [html])

  function update(event) {
    let nextHtml = DOMPurify.sanitize(event.currentTarget.innerHTML)
    for (const [name, data] of Object.entries(assetMap)) nextHtml = nextHtml.replaceAll(data, name)
    onChange(visualTurndown.turndown(nextHtml))
  }

  return <div ref={editorRef} className="visual-editor" contentEditable suppressContentEditableWarning data-placeholder={placeholder} onInput={update} spellCheck="true" />
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

  function format(command, before, after, fallback, commandValue) {
    if (mode === 'visual') {
      document.execCommand(command, false, commandValue)
      return
    }
    const textarea = textareaRef.current
    if (!textarea) return
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
        <label>{t('editor.schedule')}<input type="datetime-local" value={dateTimeInputValue(post.publishDate)} onChange={(event) => onChange({ publishDate: event.target.value ? new Date(event.target.value).toISOString() : '' })} /></label>
        <label>{t('editor.tags')}<input value={post.tags.join(', ')} onChange={(event) => onChange({ tags: event.target.value.split(',').map((tag) => tag.trim()) })} placeholder={t('editor.tagsPlaceholder')} /></label>
        <label className="draft-toggle"><input type="checkbox" checked={!post.draft} onChange={(event) => onChange({ draft: !event.target.checked })} /><span /> {t('editor.published')}</label>
      </div>
      <div className="editor-controls">
        <MarkdownToolbar onFormat={format} onImages={onOpenImages} />
        <div className="view-toggle"><button className={mode === 'visual' ? 'active' : ''} onClick={() => setMode('visual')}>{t('editor.visual')}</button><button className={mode === 'write' ? 'active' : ''} onClick={() => setMode('write')}>{t('editor.write')}</button><button className={mode === 'split' ? 'active' : ''} onClick={() => setMode('split')}>{t('editor.split')}</button><button className={mode === 'preview' ? 'active' : ''} onClick={() => setMode('preview')}>{t('editor.preview')}</button></div>
      </div>
      <div className={`editor-workspace mode-${mode}`}>
        {mode === 'visual' && <VisualEditor html={preview} assetMap={assetMap} onChange={(body) => onChange({ body })} placeholder={t('editor.visualPlaceholder')} />}
        {!['preview', 'visual'].includes(mode) && <textarea ref={textareaRef} value={post.body || ''} onChange={(event) => onChange({ body: event.target.value })} placeholder={t('editor.placeholder')} spellCheck="true" />}
        {!['write', 'visual'].includes(mode) && <article className="markdown-preview" dangerouslySetInnerHTML={{ __html: preview }} />}
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
  const [publishOpen, setPublishOpen] = useState(false)
  const [imagesOpen, setImagesOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [githubOpen, setGitHubOpen] = useState(false)
  const [healthOpen, setHealthOpen] = useState(false)
  const [bloggerOpen, setBloggerOpen] = useState(false)
  const [themesOpen, setThemesOpen] = useState(false)
  const [publishingStatus, setPublishingStatus] = useState(null)
  const [publishPhase, setPublishPhase] = useState('ready')
  const [publishError, setPublishError] = useState('')
  const [publishLog, setPublishLog] = useState([])
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
        publishDate: saved.publishDate,
        draft: saved.draft,
        tags: saved.tags,
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

  function insertExistingImage(name, options = {}) {
    setPost((current) => {
      const body = current.body || ''
      const alt = String(options.alt || t('image.alt')).replaceAll('[', '\\[').replaceAll(']', '\\]')
      const caption = String(options.caption || '').trim().replaceAll('*', '\\*')
      const markdown = `![${alt}](${name})${caption ? `\n\n*${caption}*` : ''}`
      return { ...current, body: `${body}${body && !body.endsWith('\n') ? '\n\n' : ''}${markdown}` }
    })
    setImagesOpen(false)
    notify(t('notice.imageInserted'))
  }

  const refreshPublishingStatus = useCallback(async () => {
    try { setPublishingStatus(await api.publishingStatus()) } catch (error) { notify(friendlyError(error, t), 'error') }
  }, [notify, t])

  async function showPublish() {
    if (dirty && !(await performSave(post))) return
    try {
      setPublishingStatus(await api.publishingStatus())
      setPublishPhase('ready')
      setPublishError('')
      setPublishLog([])
      setSettingsOpen(false)
      setPublishOpen(true)
    } catch (error) { notify(friendlyError(error, t), 'error') }
  }

  async function publish(message) {
    setBusy(true)
    setPublishPhase('publishing')
    setPublishError('')
    try {
      const result = await api.publishBlog(message)
      setPublishingStatus(result.status)
      setPublishLog(result.log || [])
      setPublishPhase('complete')
      notify(t('notice.published'))
    } catch (error) {
      const messageText = friendlyError(error, t)
      setPublishError(messageText)
      setPublishPhase('error')
      notify(messageText, 'error')
    } finally { setBusy(false) }
  }

  function handleHealthAction(action) {
    setHealthOpen(false)
    if (action === 'github') setGitHubOpen(true)
    else if (action === 'publish') showPublish()
    else if (action === 'preview') api.openPreview().catch((error) => notify(friendlyError(error, t), 'error'))
    else setSettingsOpen(true)
  }

  async function handleBloggerImported(result) {
    await refreshPosts(result.posts[0]?.id, true)
    notify(t('notice.bloggerImported', { count: result.posts.length }))
  }

  if (!ready) return <div className="app-loading"><div className="welcome-mark"><span>p</span></div><LoaderCircle className="spin" /></div>
  if (!context.root) return <><Welcome onChoose={chooseBlog} onCreate={() => setCreateBlogOpen(true)} busy={busy} />{createBlogOpen && <CreateBlogModal onClose={() => setCreateBlogOpen(false)} onCreate={createBlog} busy={busy} />}{toast && <div className={`toast ${toast.kind}`}>{toast.message}</div>}</>

  return (
    <div className="app-shell">
      <Sidebar context={context} onChooseBlog={chooseBlog} onImages={() => post && setImagesOpen(true)} onThemes={() => setThemesOpen(true)} onHealth={() => setHealthOpen(true)} onImport={() => setBloggerOpen(true)} onSettings={() => setSettingsOpen(true)} />
      <PostList posts={posts} activeId={activeId} onSelect={selectPost} onNew={() => setNewPostOpen(true)} />
      <main className="content-area">
        <header className="topbar">
          <button className="icon-button ghost"><PanelLeftClose size={19} /></button>
          <div className="breadcrumbs"><span>{context.root.split(/[\\/]/).filter(Boolean).at(-1)}</span><b>/</b><strong>{post?.title || t('posts.title')}</strong></div>
          <div className="topbar-actions"><button className="button quiet" onClick={() => api.openPreview().catch((error) => notify(friendlyError(error, t), 'error'))}><Eye size={17} /> {t('top.preview')} <ArrowUpRight size={14} /></button><button className="button primary" onClick={showPublish}><UploadCloud size={17} /> {t('top.publish')}</button><button className="icon-button" onClick={() => setSettingsOpen(true)} title={t('top.openSettings')}><Menu size={18} /></button></div>
        </header>
        {post ? <Editor post={post} onChange={(change) => { setSaveError(null); setPost((current) => ({ ...current, ...change })) }} onSave={save} onOpenImages={() => setImagesOpen(true)} onDropImages={addDroppedImages} saveState={{ saving, dirty, error: saveError }} /> : <div className="empty-editor"><FileText size={34} /><h2>{t('empty.title')}</h2><p>{t('empty.copy')}</p><button className="button primary" onClick={() => setNewPostOpen(true)}><Plus size={17} /> {t('posts.new')}</button></div>}
      </main>
      {newPostOpen && <NewPostModal onClose={() => setNewPostOpen(false)} onCreate={create} busy={busy} />}
      {createBlogOpen && <CreateBlogModal onClose={() => setCreateBlogOpen(false)} onCreate={createBlog} busy={busy} />}
      {publishOpen && <PublishModal status={publishingStatus} busy={busy} phase={publishPhase} error={publishError} log={publishLog} onClose={() => setPublishOpen(false)} onPublish={publish} onRefresh={refreshPublishingStatus} onSettings={() => { setPublishOpen(false); setGitHubOpen(true) }} />}
      {imagesOpen && post && <ImageLibrary post={post} onClose={() => setImagesOpen(false)} onAdd={addImages} onDrop={addDroppedImages} onInsert={insertExistingImage} onFeatured={(name) => setPost((current) => ({ ...current, featuredImage: name }))} />}
      {themesOpen && <ThemeManagerModal context={context} onClose={() => setThemesOpen(false)} onInstall={installTheme} busy={busy} notify={notify} />}
      {githubOpen && <GitHubSetupModal context={context} onClose={() => setGitHubOpen(false)} onPublish={showPublish} notify={notify} />}
      {healthOpen && <PublishingHealthModal onClose={() => setHealthOpen(false)} onAction={handleHealthAction} notify={notify} />}
      {bloggerOpen && <BloggerImportModal onClose={() => setBloggerOpen(false)} onImported={handleBloggerImported} notify={notify} />}
      {settingsOpen && <SettingsModal context={context} onClose={() => setSettingsOpen(false)} onChooseBlog={() => { setSettingsOpen(false); chooseBlog() }} onCreateBlog={() => { setSettingsOpen(false); setCreateBlogOpen(true) }} onSync={showPublish} onGitHub={() => { setSettingsOpen(false); setGitHubOpen(true) }} notify={notify} />}
      {toast && <div className={`toast ${toast.kind}`}>{toast.kind === 'success' && <Check size={17} />}{toast.message}</div>}
    </div>
  )
}
