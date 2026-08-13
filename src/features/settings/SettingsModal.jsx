import { createElement, useEffect, useState } from 'react'
import { Accessibility, AlertTriangle, ArrowUpRight, Bug, ClipboardCopy, ExternalLink, FileText, FolderOpen, GitBranch, Github, Globe2, HardDrive, Heart, ImagePlus, Info, Languages, LoaderCircle, Plug, Plus, Rocket, Save, SlidersHorizontal, Terminal, UploadCloud } from 'lucide-react'
import { api } from '../../app/api'
import { Modal } from '../../components/ui/Modal'
import { supportedLanguages, useI18n } from '../../i18n'
import { friendlyError } from '../../lib/errors'
import { hugoDiagnostics, hugoEnvironment, hugoInstallUrl } from '../../lib/hugo'
import { MAX_EDITOR_FONT_SIZE, MAX_MENU_FONT_SIZE, MIN_EDITOR_FONT_SIZE, MIN_MENU_FONT_SIZE, normalizeEditorFontSize, normalizeMenuFontSize } from '../../lib/accessibility'
import { UpdatePanel } from './UpdatePanel'

const PROJECT_LINKS = {
  website: 'https://gabuvns.github.io/plumbago/',
  releases: 'https://github.com/gabuvns/plumbago/releases/latest',
  issues: 'https://github.com/gabuvns/plumbago/issues/new/choose',
}

export function SettingsModal({ context, accessibility, onAccessibilityChange, onClose, onChooseBlog, onCreateBlog, onSync, onDeploy, onGitHub, onGitSetup, onHugoSetup, onSiteSettingsChanged, notify }) {
  const { t, locale, setLocale } = useI18n()
  const [activeCategory, setActiveCategory] = useState('general')
  const [config, setConfig] = useState(null)
  const [readiness, setReadiness] = useState(null)
  const [site, setSite] = useState(null)
  const [saving, setSaving] = useState(false)
  const [savingSite, setSavingSite] = useState(false)

  useEffect(() => {
    let active = true
    api.gitReadiness().then(async (next) => {
      if (!active) return
      setReadiness(next)
      if (next.ready) {
        const nextConfig = await api.gitConfig()
        if (active) setConfig(nextConfig)
      }
    }).catch((error) => notify(friendlyError(error, t), 'error'))
    api.siteSettings().then((next) => { if (active) setSite(next) }).catch((error) => notify(friendlyError(error, t), 'error'))
    return () => { active = false }
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

  async function copyDiagnostics() {
    try {
      await api.copyText(hugoDiagnostics(context))
      notify(t('notice.diagnosticsCopied'))
    } catch (error) {
      notify(friendlyError(error, t), 'error')
    }
  }

  async function savePublicSite(event) {
    event.preventDefault()
    setSavingSite(true)
    try {
      const input = site.hostingProvider === 'none' ? site : { ...site, baseURL: site.publicUrl }
      const saved = await api.saveSiteSettings(input)
      setSite(saved)
      onSiteSettingsChanged(saved)
      notify(t('notice.hostingSaved'))
    } catch (error) {
      notify(friendlyError(error, t), 'error')
    } finally {
      setSavingSite(false)
    }
  }

  function openProjectUrl(url) {
    api.openPublishingUrl(url).catch((error) => notify(friendlyError(error, t), 'error'))
  }

  function changeEditorFontSize(event) {
    onAccessibilityChange({ ...accessibility, editorFontSize: normalizeEditorFontSize(event.currentTarget.value) })
  }

  function changeMenuFontSize(event) {
    onAccessibilityChange({ ...accessibility, menuFontSize: normalizeMenuFontSize(event.currentTarget.value) })
  }

  const categories = [
    { id: 'general', icon: SlidersHorizontal, label: t('settings.category.general'), copy: t('settings.category.generalCopy') },
    { id: 'accessibility', icon: Accessibility, label: t('settings.category.accessibility'), copy: t('settings.category.accessibilityCopy') },
    { id: 'publishing', icon: Rocket, label: t('settings.category.publishing'), copy: t('settings.category.publishingCopy') },
    { id: 'integrations', icon: Plug, label: t('settings.category.integrations'), copy: t('settings.category.integrationsCopy') },
    { id: 'about', icon: Info, label: t('settings.category.about'), copy: t('settings.category.aboutCopy') },
  ]
  const currentCategory = categories.find((category) => category.id === activeCategory)
  const gitVersion = readiness?.git.version || context.git
  const gitSetupCopy = readiness?.git.status === 'ready' ? t('settings.gitUninitialized') : t('settings.gitMissing')

  return (
    <Modal title={t('settings.title')} onClose={onClose} width="940px">
      <div className="settings-layout">
        <aside className="settings-sidebar">
          <div className="settings-sidebar-intro">
            <strong>{t('settings.navigation')}</strong>
            <span>{t('settings.navigationCopy')}</span>
          </div>
          <nav aria-label={t('settings.navigation')}>
            {categories.map(({ id, icon, label, copy }) => <button key={id} className={`settings-nav-button ${activeCategory === id ? 'active' : ''}`} type="button" aria-current={activeCategory === id ? 'page' : undefined} onClick={() => setActiveCategory(id)}>{createElement(icon, { size: 18 })}<span><strong>{label}</strong><small>{copy}</small></span></button>)}
          </nav>
          <small className="settings-local-note">{t('settings.localNote')}</small>
        </aside>

        <div className="settings-content" id={`settings-category-${activeCategory}`} role="region" aria-labelledby="settings-category-title">
          <header className="settings-page-heading">
            {createElement(currentCategory.icon, { size: 22 })}
            <div><h2 id="settings-category-title">{currentCategory.label}</h2><p>{currentCategory.copy}</p></div>
          </header>

          {activeCategory === 'general' && <>
            <section className="settings-section">
              <div className="settings-heading"><HardDrive size={18} /><div><h3>{t('settings.blog')}</h3><p>{t('settings.blogCopy')}</p></div></div>
              <div className="settings-blog-card">
                <div><small>{t('settings.folder')}</small><strong title={context.root}>{context.root}</strong></div>
                <div className="settings-blog-actions"><button className="button quiet" type="button" onClick={onChooseBlog}><FolderOpen size={15} /> {t('settings.changeBlog')}</button><button className="button quiet" type="button" onClick={onCreateBlog}><Plus size={15} /> {t('settings.createBlog')}</button></div>
              </div>
              <div className="tool-status"><div><span className={context.hugo ? 'ok' : 'error'} /><div><strong>Hugo</strong><small>{context.hugo || t('settings.notFound')}</small></div></div><div><span className={gitVersion ? 'ok' : 'error'} /><div><strong>Git</strong><small>{gitVersion || t('settings.notFound')}</small></div></div></div>
              <div className={`hugo-help-card ${context.hugo ? '' : 'missing'}`}>
                <Terminal size={18} />
                <div><strong>{t('settings.hugoHelp')}</strong><p>{t('settings.hugoHelpCopy', { environment: hugoEnvironment(context.runtime) })}</p><code>{context.hugoExecutable || t('settings.executableUnknown')}</code></div>
                <div className="hugo-help-actions"><button className="button primary" type="button" onClick={onHugoSetup}><Terminal size={14} /> {t('settings.manageHugo')}</button><button className="button quiet" type="button" onClick={copyDiagnostics}><ClipboardCopy size={14} /> {t('settings.copyDiagnostics')}</button><button className="button quiet" type="button" onClick={() => openProjectUrl(hugoInstallUrl(context.runtime))}><ArrowUpRight size={14} /> {t('settings.hugoDocs')}</button></div>
              </div>
            </section>
            <section className="settings-section">
              <div className="settings-heading"><Languages size={18} /><div><h3>{t('settings.language')}</h3><p>{t('settings.languageCopy')}</p></div></div>
              <label className="language-setting">{t('language.label')}<select value={locale} onChange={(event) => setLocale(event.target.value)}>{supportedLanguages.map((language) => <option key={language.value} value={language.value}>{language.label}</option>)}</select></label>
            </section>
          </>}

          {activeCategory === 'accessibility' && <section className="settings-section accessibility-settings">
            <div className="settings-heading"><Accessibility size={18} /><div><h3>{t('accessibility.title')}</h3><p>{t('accessibility.copy')}</p></div></div>
            <div className="accessibility-setting-grid">
              <div>
                <div className="font-size-setting">
                  <label htmlFor="menu-font-size">{t('accessibility.menuFontSize')}<output htmlFor="menu-font-size">{t('accessibility.fontSizeValue', { size: accessibility.menuFontSize })}</output></label>
                  <input id="menu-font-size" type="range" min={MIN_MENU_FONT_SIZE} max={MAX_MENU_FONT_SIZE} step="1" value={accessibility.menuFontSize} aria-describedby="menu-font-size-help" onInput={changeMenuFontSize} onChange={changeMenuFontSize} />
                  <small id="menu-font-size-help">{t('accessibility.menuFontSizeHelp')}</small>
                </div>
                <div className="menu-font-preview" style={{ '--preview-menu-font-size': `${accessibility.menuFontSize}px` }} aria-live="polite" aria-label={t('accessibility.menuPreviewLabel')}>
                  <small>{t('accessibility.preview')}</small>
                  <span><FileText size={18} /> {t('sidebar.posts')}</span>
                  <span><ImagePlus size={18} /> {t('sidebar.images')}</span>
                  <span><SlidersHorizontal size={18} /> {t('sidebar.settings')}</span>
                </div>
              </div>
              <div>
                <div className="font-size-setting">
                  <label htmlFor="editor-font-size">{t('accessibility.fontSize')}<output htmlFor="editor-font-size">{t('accessibility.fontSizeValue', { size: accessibility.editorFontSize })}</output></label>
                  <input id="editor-font-size" type="range" min={MIN_EDITOR_FONT_SIZE} max={MAX_EDITOR_FONT_SIZE} step="1" value={accessibility.editorFontSize} aria-describedby="editor-font-size-help" onInput={changeEditorFontSize} onChange={changeEditorFontSize} />
                  <small id="editor-font-size-help">{t('accessibility.fontSizeHelp')}</small>
                </div>
                <div className="accessibility-preview" style={{ '--preview-font-size': `${accessibility.editorFontSize}px` }} aria-live="polite" aria-label={t('accessibility.previewLabel')}>
                  <small>{t('accessibility.preview')}</small>
                  <strong className="level-one">{t('accessibility.previewH1')}</strong>
                  <strong className="level-two">{t('accessibility.previewH2')}</strong>
                  <strong className="level-three">{t('accessibility.previewH3')}</strong>
                  <p>{t('accessibility.previewBody')}</p>
                </div>
              </div>
            </div>
          </section>}

          {activeCategory === 'publishing' && <section className="settings-section">
            <div className="settings-heading"><Globe2 size={18} /><div><h3>{t('hosting.title')}</h3><p>{t('hosting.copy')}</p></div></div>
            {site ? <form className="hosting-settings" onSubmit={savePublicSite}>
              <button className="button primary" type="button" onClick={onDeploy}><Rocket size={15} /> {t('hosting.oneClickDeploy')}</button>
              <label>{t('hosting.provider')}<select value={site.hostingProvider} onChange={(event) => setSite({ ...site, hostingProvider: event.target.value })}><option value="none">{t('hosting.none')}</option><option value="github-pages">{t('hosting.github-pages')}</option><option value="cloudflare-pages">{t('hosting.cloudflare-pages')}</option><option value="other">{t('hosting.other')}</option></select></label>
              <label>{t('hosting.address')}<input type="url" value={site.publicUrl || ''} disabled={site.hostingProvider === 'none'} onChange={(event) => setSite({ ...site, publicUrl: event.target.value })} placeholder={site.hostingProvider === 'cloudflare-pages' ? 'https://my-blog.pages.dev/' : 'https://username.github.io/my-blog/'} /></label>
              <button className="button primary" disabled={savingSite}>{savingSite ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />} {t('hosting.save')}</button>
              <p>{t('hosting.hint')}</p>
            </form> : <div className="settings-loading"><LoaderCircle className="spin" size={20} /> {t('settings.reading')}</div>}
          </section>}

          {activeCategory === 'integrations' && <>
            <section className="settings-section github-settings-card">
              <div className="settings-heading"><Github size={18} /><div><h3>{t('settings.github')}</h3><p>{t('settings.githubCopy')}</p></div></div>
              <button className="button quiet" type="button" onClick={onGitHub}><Github size={16} /> {t('settings.githubManage')}</button>
            </section>
            <section className="settings-section">
              <div className="settings-heading"><GitBranch size={18} /><div><h3>{t('settings.git')}</h3><p>{t('settings.gitCopy')}</p></div></div>
              {!readiness || readiness.ready && !config ? <div className="settings-loading"><LoaderCircle className="spin" size={20} /> {t('settings.gitChecking')}</div> : readiness.ready ? (
                <>
                  {readiness.repository.status === 'parent-repository' && <div className="git-settings-readiness warning"><AlertTriangle size={18} /><div><strong>{t('gitSetup.parentTitle')}</strong><span>{t('settings.gitParent', { path: readiness.repository.topLevel })}</span></div><button className="button quiet" type="button" onClick={onGitSetup}>{t('settings.prepareGit')}</button></div>}
                  <form className="settings-form" onSubmit={saveConfig}>
                    <div className="two-fields">
                      <label>{t('settings.author')}<input value={config.name || ''} onChange={(event) => setConfig({ ...config, name: event.target.value })} placeholder={t('settings.authorPlaceholder')} /></label>
                      <label>{t('settings.email')}<input type="email" value={config.email || ''} onChange={(event) => setConfig({ ...config, email: event.target.value })} placeholder="you@example.com" /></label>
                    </div>
                    <label>{t('settings.origin')}<input value={config.remote || ''} onChange={(event) => setConfig({ ...config, remote: event.target.value })} placeholder="git@github.com:user/blog.git" /></label>
                    <div className="settings-form-footer"><span><GitBranch size={14} /> {t('settings.branch')} <b>{config.branch || '—'}</b></span><button className="button quiet" type="button" onClick={onSync}><UploadCloud size={15} /> {t('settings.viewSync')}</button><button className="button primary" disabled={saving}>{saving ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />} {t('settings.save')}</button></div>
                  </form>
                </>
              ) : <div className={`git-settings-readiness ${readiness.git.status === 'ready' ? 'warning' : ''}`}><AlertTriangle size={18} /><div><strong>{readiness.git.status === 'ready' ? t('gitSetup.uninitializedTitle') : t('gitSetup.missingTitle')}</strong><span>{gitSetupCopy}</span></div><button className="button primary" type="button" onClick={onGitSetup}>{t('settings.prepareGit')}</button></div>}
            </section>
          </>}

          {activeCategory === 'about' && <>
            <section className="settings-section">
              <div className="project-about-card">
                <div className="project-about-mark">p</div>
                <div><h3>Plumbago</h3><strong>{t('about.tagline')}</strong><p>{t('about.copy')}</p><small><Heart size={13} /> {t('about.openSource')}</small></div>
              </div>
              <div className="project-links">
                <button className="button quiet" type="button" onClick={() => openProjectUrl(PROJECT_LINKS.website)}><ExternalLink size={15} /> {t('about.website')}</button>
                <button className="button quiet" type="button" onClick={() => openProjectUrl(PROJECT_LINKS.releases)}><ArrowUpRight size={15} /> {t('about.releases')}</button>
                <button className="button quiet" type="button" onClick={() => openProjectUrl(PROJECT_LINKS.issues)}><Bug size={15} /> {t('about.reportIssue')}</button>
              </div>
            </section>
            <UpdatePanel notify={notify} />
          </>}
        </div>
      </div>
    </Modal>
  )
}
