import { useEffect, useState } from 'react'
import { AlertCircle, ArrowUpRight, LoaderCircle, Palette, Save, ShieldCheck } from 'lucide-react'
import { api } from '../../app/api'
import { Modal } from '../../components/ui/Modal'
import { useI18n } from '../../i18n'
import { friendlyError } from '../../lib/errors'
import { hugoInstallUrl } from '../../lib/hugo'
import { ThemeBrowser } from './ThemeBrowser'

export function ThemeManagerModal({ context, onClose, onInstall, onDeactivate, busy, notify }) {
  const { t } = useI18n()
  const [selected, setSelected] = useState('')
  const [site, setSite] = useState(null)
  const [saving, setSaving] = useState(false)
  const [installReport, setInstallReport] = useState(null)

  useEffect(() => {
    api.siteSettings().then(setSite).catch((error) => notify(friendlyError(error, t), 'error'))
  }, [notify, t])

  async function saveAppearance(event) {
    event.preventDefault()
    setSaving(true)
    try { setSite(await api.saveSiteSettings(site)); notify(t('notice.appearanceSaved')) } catch (error) { notify(friendlyError(error, t), 'error') } finally { setSaving(false) }
  }

  async function installSelected() {
    setInstallReport(null)
    const report = await onInstall(selected)
    if (report && !report.ok) setInstallReport(report)
  }

  async function deactivateCurrent() {
    if (await onDeactivate()) setInstallReport(null)
  }

  function compatibilityCopy(report) {
    const issue = report.compatibility?.issues?.[0]
    if (!issue) return report.message
    if (issue.code === 'minimum') return t('themes.compat.minimum', { current: issue.current, required: issue.required })
    if (issue.code === 'maximum') return t('themes.compat.maximum', { current: issue.current, required: issue.required })
    if (issue.code === 'extended') return t('themes.compat.extended', { current: issue.current })
    return t('themes.compat.unknown')
  }

  const helpUrl = hugoInstallUrl(context.runtime)

  return (
    <Modal title={t('themes.manage')} onClose={onClose} width="940px">
      <div className="theme-manager-intro"><div><Palette size={19} /><span><strong>{t('themes.current')}</strong><small>{context.theme || t('themes.noCurrent')}</small></span></div>{context.theme && <button className="button quiet" onClick={deactivateCurrent} disabled={busy}>{t('themes.deactivate')}</button>}<p>{t('themes.installCopy')}</p></div>
      <div className={`theme-runtime ${context.hugo ? '' : 'missing'}`}><ShieldCheck size={16} /><span><strong>{t('themes.currentHugo')}</strong><small>{context.hugo || t('settings.notFound')}</small></span><button className="button quiet" type="button" onClick={() => api.openPublishingUrl(helpUrl)}><ArrowUpRight size={14} /> {context.hugo ? t('settings.updateHugo') : t('settings.installHugo')}</button></div>
      {site && <form className="theme-site-settings" onSubmit={saveAppearance}><div><label>{t('themes.blogTitle')}<input value={site.title} onChange={(event) => setSite({ ...site, title: event.target.value })} /></label><label>{t('themes.siteAddress')}<input value={site.baseURL} onChange={(event) => setSite({ ...site, baseURL: event.target.value })} placeholder="https://username.github.io/blog/" /></label></div><div><label>{t('themes.languageCode')}<input value={site.languageCode} onChange={(event) => setSite({ ...site, languageCode: event.target.value })} placeholder="en-US" /></label><label>{t('themes.copyright')}<input value={site.copyright} onChange={(event) => setSite({ ...site, copyright: event.target.value })} placeholder="© 2026 Your name" /></label></div><button className="button quiet" disabled={saving}>{saving ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />} {t('themes.saveIdentity')}</button></form>}
      <div className="theme-gallery-heading"><div><h3>{t('themes.galleryTitle')}</h3><p>{t('themes.galleryCopy')}</p></div></div>
      <ThemeBrowser selected={selected} onSelect={(value) => { setSelected(value); setInstallReport(null) }} allowNone={false} />
      {installReport && (
        <section className={`theme-install-report ${installReport.stage}`}>
          <AlertCircle size={20} />
          <div>
            <strong>{t(`themes.failure.${installReport.stage}Title`)}</strong>
            <p>{installReport.stage === 'compatibility' ? compatibilityCopy(installReport) : installReport.stage === 'build' ? t('themes.failure.buildCopy') : installReport.message}</p>
            {installReport.stage !== 'unexpected' && <small>{installReport.deactivated ? t('themes.failure.deactivated') : t('themes.failure.rolledBack')}</small>}
            <div className="theme-install-actions">
              {installReport.stage === 'compatibility' && <button className="button quiet" onClick={() => api.openPublishingUrl(helpUrl)}><ArrowUpRight size={14} /> {t('themes.updateHugo')}</button>}
              <button className="button quiet" onClick={() => api.openTheme(selected)}><ArrowUpRight size={14} /> {t('themes.viewDocs')}</button>
            </div>
            {installReport.details && <details><summary>{t('themes.technicalDetails')}</summary><pre>{installReport.details}</pre></details>}
          </div>
        </section>
      )}
      <footer className="theme-manager-footer"><button className="button quiet" onClick={onClose}>{t('common.close')}</button><button className="button primary" disabled={!selected || busy} onClick={installSelected}>{busy ? <LoaderCircle className="spin" size={16} /> : <Palette size={16} />} {busy ? t('themes.checking') : t('themes.install')}</button></footer>
    </Modal>
  )
}
