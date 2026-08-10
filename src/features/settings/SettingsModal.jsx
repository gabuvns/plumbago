import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowUpRight, ClipboardCopy, FolderOpen, GitBranch, Github, HardDrive, LoaderCircle, Plus, Save, Terminal, UploadCloud } from 'lucide-react'
import { api } from '../../app/api'
import { Modal } from '../../components/ui/Modal'
import { supportedLanguages, useI18n } from '../../i18n'
import { friendlyError } from '../../lib/errors'
import { hugoDiagnostics, hugoEnvironment, hugoInstallUrl } from '../../lib/hugo'
import { UpdatePanel } from './UpdatePanel'

export function SettingsModal({ context, onClose, onChooseBlog, onCreateBlog, onSync, onGitHub, onGitSetup, notify }) {
  const { t, locale, setLocale } = useI18n()
  const [config, setConfig] = useState(null)
  const [readiness, setReadiness] = useState(null)
  const [saving, setSaving] = useState(false)

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

  function openHugoHelp() {
    api.openPublishingUrl(hugoInstallUrl(context.runtime)).catch((error) => notify(friendlyError(error, t), 'error'))
  }

  const gitVersion = readiness?.git.version || context.git
  const gitSetupCopy = readiness?.git.status === 'ready' ? t('settings.gitUninitialized') : t('settings.gitMissing')

  return (
    <Modal title={t('settings.title')} onClose={onClose} width="680px">
      <div className="settings-content">
        <section className="settings-section">
          <div className="settings-heading"><HardDrive size={18} /><div><h3>{t('settings.blog')}</h3><p>{t('settings.blogCopy')}</p></div></div>
          <div className="settings-blog-card">
            <div><small>{t('settings.folder')}</small><strong title={context.root}>{context.root}</strong></div>
            <div className="settings-blog-actions"><button className="button quiet" onClick={onChooseBlog}><FolderOpen size={15} /> {t('settings.changeBlog')}</button><button className="button quiet" onClick={onCreateBlog}><Plus size={15} /> {t('settings.createBlog')}</button></div>
          </div>
          <div className="tool-status"><div><span className={context.hugo ? 'ok' : 'error'} /><div><strong>Hugo</strong><small>{context.hugo || t('settings.notFound')}</small></div></div><div><span className={gitVersion ? 'ok' : 'error'} /><div><strong>Git</strong><small>{gitVersion || t('settings.notFound')}</small></div></div></div>
          <div className={`hugo-help-card ${context.hugo ? '' : 'missing'}`}>
            <Terminal size={18} />
            <div><strong>{t('settings.hugoHelp')}</strong><p>{t('settings.hugoHelpCopy', { environment: hugoEnvironment(context.runtime) })}</p></div>
            <div className="hugo-help-actions"><button className="button quiet" type="button" onClick={copyDiagnostics}><ClipboardCopy size={14} /> {t('settings.copyDiagnostics')}</button><button className="button quiet" type="button" onClick={openHugoHelp}><ArrowUpRight size={14} /> {context.hugo ? t('settings.updateHugo') : t('settings.installHugo')}</button></div>
          </div>
          <label className="language-setting">{t('language.label')}<select value={locale} onChange={(event) => setLocale(event.target.value)}>{supportedLanguages.map((language) => <option key={language.value} value={language.value}>{language.label}</option>)}</select></label>
        </section>
        <UpdatePanel notify={notify} />
        <section className="settings-section">
          <div className="settings-heading"><GitBranch size={18} /><div><h3>{t('settings.git')}</h3><p>{t('settings.gitCopy')}</p></div></div>
          {!readiness ? <div className="settings-loading"><LoaderCircle className="spin" size={20} /> {t('settings.gitChecking')}</div> : readiness.ready && config ? (
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
        <section className="settings-section github-settings-card">
          <div className="settings-heading"><Github size={18} /><div><h3>{t('settings.github')}</h3><p>{t('settings.githubCopy')}</p></div></div>
          <button className="button quiet" type="button" onClick={onGitHub}><Github size={16} /> {t('settings.githubManage')}</button>
        </section>
      </div>
    </Modal>
  )
}
