import { useEffect, useState } from 'react'
import { AlertCircle, ArrowUpRight, CheckCircle2, Download, LoaderCircle, RefreshCw, RotateCcw } from 'lucide-react'
import { api } from '../../app/api'
import { useI18n } from '../../i18n'
import { friendlyError } from '../../lib/errors'

export function UpdatePanel({ notify }) {
  const { t } = useI18n()
  const [report, setReport] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.updateStatus().then(setReport).catch((error) => notify(friendlyError(error, t), 'error'))
  }, [notify, t])

  async function perform(action) {
    setBusy(true)
    try { setReport(await action()) } catch (error) { notify(friendlyError(error, t), 'error') } finally { setBusy(false) }
  }

  async function downloadUpdate() {
    setBusy(true)
    setReport((current) => ({ ...current, state: 'downloading', progress: 0 }))
    const poll = setInterval(() => api.updateStatus().then(setReport).catch(() => {}), 500)
    try { setReport(await api.downloadUpdate()) } catch (error) { notify(friendlyError(error, t), 'error') } finally { clearInterval(poll); setBusy(false) }
  }

  async function installUpdate() {
    try { await api.installUpdate() } catch (error) { notify(friendlyError(error, t), 'error') }
  }

  function openRelease() {
    api.openPublishingUrl(report?.releaseUrl || 'https://github.com/gabuvns/plumbago/releases/latest').catch((error) => notify(friendlyError(error, t), 'error'))
  }

  const state = busy && report?.state !== 'downloading' ? 'checking' : report?.state || 'idle'
  const available = state === 'available'
  const downloaded = state === 'downloaded'
  const failed = state === 'error'

  return (
    <section className="settings-section update-settings">
      <div className="settings-heading"><RefreshCw size={18} /><div><h3>{t('updates.title')}</h3><p>{t('updates.copy')}</p></div></div>
      <div className={`update-card ${state}`}>
        <div className="update-state-icon">{state === 'checking' || state === 'downloading' ? <LoaderCircle className="spin" size={19} /> : failed ? <AlertCircle size={19} /> : state === 'up-to-date' || downloaded ? <CheckCircle2 size={19} /> : available ? <Download size={19} /> : <RefreshCw size={19} />}</div>
        <div className="update-copy">
          <strong>{t(`updates.state.${state}`)}</strong>
          <p>{available ? t('updates.availableCopy', { current: report.currentVersion, version: report.version }) : downloaded ? t('updates.downloadedCopy', { version: report.version }) : failed ? report.error : state === 'downloading' ? t('updates.downloadingCopy', { progress: report.progress || 0 }) : t('updates.currentCopy', { version: report?.currentVersion || '—' })}</p>
          {available && report.notes && <small>{report.notes}</small>}
          {available && !report.canAutoUpdate && <small className="update-manual-note">{t(`updates.manual.${report.reason || 'package'}`)}</small>}
          {state === 'downloading' && <div className="update-progress"><i style={{ width: `${report.progress || 4}%` }} /></div>}
        </div>
        <div className="update-actions">
          {(state === 'idle' || state === 'up-to-date' || failed) && <button className="button quiet" type="button" disabled={busy} onClick={() => perform(api.checkForUpdates)}>{busy ? <LoaderCircle className="spin" size={14} /> : <RefreshCw size={14} />} {t(state === 'idle' ? 'updates.check' : 'updates.checkAgain')}</button>}
          {available && report.canAutoUpdate && <button className="button primary" type="button" disabled={busy} onClick={downloadUpdate}><Download size={14} /> {t('updates.download')}</button>}
          {(available && !report.canAutoUpdate) || failed ? <button className="button quiet" type="button" onClick={openRelease}><ArrowUpRight size={14} /> {t('updates.openRelease')}</button> : null}
          {downloaded && <button className="button primary" type="button" onClick={installUpdate}><RotateCcw size={14} /> {t('updates.restartInstall')}</button>}
        </div>
      </div>
    </section>
  )
}
