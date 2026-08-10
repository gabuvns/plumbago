import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, ClipboardCopy, Download, ExternalLink, GitBranch, LoaderCircle, RefreshCw, Terminal } from 'lucide-react'
import { api } from '../../app/api'
import { Modal } from '../../components/ui/Modal'
import { useI18n } from '../../i18n'
import { friendlyError } from '../../lib/errors'

function environmentLabel(status, t) {
  if (!status?.environment) return '—'
  if (status.environment.kind === 'wsl') return status.environment.label
  return t(`gitSetup.environment.${status.environment.platform}`)
}

export function GitSetupModal({ onClose, onReady, notify }) {
  const { t } = useI18n()
  const [status, setStatus] = useState(null)
  const [working, setWorking] = useState('')

  const check = useCallback(async (resume = false) => {
    setWorking('checking')
    try {
      const next = await api.gitReadiness()
      setStatus(next)
      if (resume && next.ready) await onReady(next)
    } catch (error) {
      notify(friendlyError(error, t), 'error')
    } finally {
      setWorking('')
    }
  }, [notify, onReady, t])

  useEffect(() => { check() }, [check])

  async function install() {
    setWorking('installing')
    try {
      const next = await api.installGit()
      setStatus(next)
      if (next.git.status === 'ready') notify(t('notice.gitInstalled'))
      if (next.ready) await onReady(next)
    } catch (error) {
      notify(friendlyError(error, t), 'error')
    } finally {
      setWorking('')
    }
  }

  async function copyCommand() {
    try {
      await api.copyText(status.assistance.command)
      notify(t('notice.gitCommandCopied'))
    } catch (error) {
      notify(friendlyError(error, t), 'error')
    }
  }

  async function initialize() {
    setWorking('initializing')
    try {
      const next = await api.initializeGit()
      setStatus(next)
      notify(t('notice.gitInitialized'))
      if (next.ready) await onReady(next)
    } catch (error) {
      notify(friendlyError(error, t), 'error')
    } finally {
      setWorking('')
    }
  }

  const environment = environmentLabel(status, t)
  const missing = status?.git.status === 'missing'
  const gitError = status?.git.status === 'error'
  const repositoryError = status?.repository.status === 'error'
  const uninitialized = status?.git.status === 'ready' && status?.repository.status === 'uninitialized'
  const parentRepository = status?.repository.status === 'parent-repository'
  const ready = Boolean(status?.ready)
  const busy = Boolean(working)

  return (
    <Modal title={t('gitSetup.title')} onClose={onClose} width="620px">
      <div className="git-setup">
        {!status && <div className="git-setup-loading"><LoaderCircle className="spin" size={24} /> {t('gitSetup.checking')}</div>}
        {status && (
          <>
            <div className="git-environment"><Terminal size={17} /><span><small>{t('gitSetup.environment')}</small><strong>{environment}</strong></span></div>

            {(missing || gitError || repositoryError) && (
              <section className="git-setup-state error">
                <div className="git-setup-icon"><AlertTriangle size={25} /></div>
                <h3>{t(missing ? 'gitSetup.missingTitle' : 'gitSetup.errorTitle')}</h3>
                <p>{missing ? t('gitSetup.missingCopy', { environment }) : status.git.details || status.repository.details}</p>
                {missing && status.assistance.command && <code>{status.assistance.command}</code>}
                {missing && <div className="git-setup-actions">
                  {status.assistance.mode === 'automatic'
                    ? <button className="button primary" onClick={install} disabled={busy}>{working === 'installing' ? <LoaderCircle className="spin" size={15} /> : <Download size={15} />} {t(working === 'installing' ? 'gitSetup.installing' : 'gitSetup.install')}</button>
                    : <button className="button primary" onClick={copyCommand} disabled={busy}><ClipboardCopy size={15} /> {t('gitSetup.copyCommand')}</button>}
                  <button className="button quiet" onClick={() => api.openPublishingUrl(status.assistance.url).catch((error) => notify(friendlyError(error, t), 'error'))}><ExternalLink size={15} /> {t('gitSetup.instructions')}</button>
                </div>}
                {(status.git.details || status.repository.details) && <details><summary>{t('gitSetup.details')}</summary><pre>{status.git.details || status.repository.details}</pre></details>}
              </section>
            )}

            {uninitialized && (
              <section className="git-setup-state warning">
                <div className="git-setup-icon"><GitBranch size={25} /></div>
                <h3>{t('gitSetup.uninitializedTitle')}</h3>
                <p>{t('gitSetup.uninitializedCopy')}</p>
                <button className="button primary" onClick={initialize} disabled={busy}>{working === 'initializing' ? <LoaderCircle className="spin" size={15} /> : <GitBranch size={15} />} {t(working === 'initializing' ? 'gitSetup.initializing' : 'gitSetup.initialize')}</button>
              </section>
            )}

            {ready && (
              <section className="git-setup-state ready">
                <div className="git-setup-icon"><CheckCircle2 size={25} /></div>
                <h3>{t(parentRepository ? 'gitSetup.parentTitle' : 'gitSetup.readyTitle')}</h3>
                <p>{parentRepository ? t('gitSetup.parentCopy', { path: status.repository.topLevel }) : t('gitSetup.readyCopy', { version: status.git.version, environment })}</p>
                <button className="button primary" onClick={() => onReady(status)}><CheckCircle2 size={15} /> {t('gitSetup.continue')}</button>
              </section>
            )}
          </>
        )}
      </div>
      <footer className="git-setup-footer">
        <button className="button quiet" onClick={onClose}>{t('common.close')}</button>
        <button className="button quiet" onClick={() => check(true)} disabled={busy}>{working === 'checking' ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />} {t('gitSetup.recheck')}</button>
      </footer>
    </Modal>
  )
}
