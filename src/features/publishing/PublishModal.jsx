import { useEffect, useState } from 'react'
import { AlertCircle, ArrowUpRight, Check, Clock3, Cloud, GitBranch, LoaderCircle, Settings, UploadCloud } from 'lucide-react'
import { api } from '../../app/api'
import { Modal } from '../../components/ui/Modal'
import { useI18n } from '../../i18n'

export function PublishModal({ status, busy, phase, error, log, onClose, onPublish, onRefresh, onSettings }) {
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
