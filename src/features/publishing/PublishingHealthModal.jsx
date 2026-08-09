import { useCallback, useEffect, useState } from 'react'
import { Activity, AlertCircle, ArrowUpRight, Check, Clock3, LoaderCircle } from 'lucide-react'
import { api } from '../../app/api'
import { Modal } from '../../components/ui/Modal'
import { useI18n } from '../../i18n'
import { friendlyError } from '../../lib/errors'

export function PublishingHealthModal({ onClose, onAction, notify }) {
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
