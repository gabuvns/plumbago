import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, ClipboardCopy, Download, ExternalLink, Laptop, LoaderCircle, RefreshCw, ShieldCheck, Terminal } from 'lucide-react'
import { api } from '../../app/api'
import { Modal } from '../../components/ui/Modal'
import { useI18n } from '../../i18n'
import { friendlyError } from '../../lib/errors'

function RuntimeIcon({ runtime }) {
  return runtime.kind === 'wsl' ? <Terminal size={20} /> : <Laptop size={20} />
}

function runtimeState(item, t) {
  if (!item.blogAccessible) return { label: t('hugoSetup.unavailable'), className: 'unavailable' }
  if (item.ready) return { label: t('hugoSetup.ready'), className: 'ready' }
  if (item.hugo.status === 'missing') return { label: t('hugoSetup.missing'), className: 'missing' }
  return { label: t('hugoSetup.failed'), className: 'error' }
}

export function HugoSetupModal({ onClose, onReady, onContextChange, notify }) {
  const { t } = useI18n()
  const [status, setStatus] = useState(null)
  const [working, setWorking] = useState('')
  const [confirmation, setConfirmation] = useState('')

  const check = useCallback(async () => {
    setWorking('checking')
    try {
      setStatus(await api.hugoReadiness())
    } catch (error) {
      notify(friendlyError(error, t), 'error')
    } finally {
      setWorking('')
    }
  }, [notify, t])

  useEffect(() => { check() }, [check])

  async function install(runtime) {
    setWorking(`install:${runtime.id}`)
    try {
      const next = await api.installHugo(runtime.id)
      setStatus(next)
      setConfirmation('')
      if (next.context) onContextChange(next.context)
      const notice = next.operation?.state === 'up-to-date'
        ? 'notice.hugoUpToDate'
        : next.operation?.state === 'updated' ? 'notice.hugoUpdated' : 'notice.hugoReady'
      notify(t(notice))
    } catch (error) {
      notify(friendlyError(error, t), 'error')
    } finally {
      setWorking('')
    }
  }

  async function selectRuntime(runtime) {
    setWorking(`select:${runtime.id}`)
    try {
      const result = await api.selectHugoRuntime(runtime.id)
      setStatus(result.readiness)
      notify(t('notice.hugoRuntimeSelected', { environment: runtime.environment.label }))
      await onReady(result.context)
    } catch (error) {
      notify(friendlyError(error, t), 'error')
    } finally {
      setWorking('')
    }
  }

  async function copyCommand(runtime) {
    try {
      await api.copyText(runtime.assistance.command)
      notify(t('notice.hugoCommandCopied'))
    } catch (error) {
      notify(friendlyError(error, t), 'error')
    }
  }

  function openInstructions(runtime) {
    api.openPublishingUrl(runtime.assistance.url).catch((error) => notify(friendlyError(error, t), 'error'))
  }

  const busy = Boolean(working)
  const runtimes = status?.runtimes || []
  const selected = runtimes.find((runtime) => runtime.selected)

  return (
    <Modal title={t('hugoSetup.title')} onClose={onClose} width="760px">
      <div className="hugo-runtime-manager">
        {!status && <div className="git-setup-loading"><LoaderCircle className="spin" size={24} /> {t('hugoSetup.checking')}</div>}
        {status && <>
          <section className="hugo-manager-summary">
            <ShieldCheck size={22} />
            <div><h3>{t('hugoSetup.summaryTitle')}</h3><p>{t('hugoSetup.summaryCopy', { environment: selected?.environment.label || t('hugoSetup.noneSelected') })}</p></div>
          </section>

          <div className="hugo-runtime-list" aria-label={t('hugoSetup.runtimeList')}>
            {runtimes.map((runtime) => {
              const state = runtimeState(runtime, t)
              const installing = working === `install:${runtime.id}`
              const selecting = working === `select:${runtime.id}`
              const automatic = runtime.assistance.mode === 'automatic'
              const installed = runtime.hugo.status === 'ready'
              return (
                <section className={`hugo-runtime-card ${runtime.selected ? 'selected' : ''}`} key={runtime.id} aria-label={runtime.environment.label}>
                  <header>
                    <span className="hugo-runtime-icon"><RuntimeIcon runtime={runtime.runtime} /></span>
                    <div><h3>{runtime.environment.label}</h3><p>{runtime.runtime.kind === 'wsl' ? t('hugoSetup.wslEnvironment') : t('hugoSetup.nativeEnvironment')}</p></div>
                    <div className="hugo-runtime-badges">
                      {runtime.selected && <span className="selected"><ShieldCheck size={11} /> {t('hugoSetup.selected')}</span>}
                      <span className={state.className}>{state.label}</span>
                    </div>
                  </header>

                  {!runtime.blogAccessible && <div className="hugo-runtime-warning"><AlertTriangle size={16} /><div><strong>{t('hugoSetup.pathUnavailableTitle')}</strong><span>{runtime.accessCode ? t(`hugoSetup.access.${runtime.accessCode}`, runtime.accessValues) : runtime.accessDetails || t('hugoSetup.pathUnavailableCopy')}</span></div></div>}

                  {runtime.hugo.status === 'ready' ? <dl className="hugo-runtime-details">
                    <div><dt>{t('hugoSetup.version')}</dt><dd>{runtime.hugo.versionNumber || runtime.hugo.version}</dd></div>
                    <div><dt>{t('hugoSetup.edition')}</dt><dd>{runtime.hugo.extended ? t('hugoSetup.extended') : t('hugoSetup.standard')}</dd></div>
                    <div><dt>{t('hugoSetup.architecture')}</dt><dd>{runtime.hugo.architecture || '—'}</dd></div>
                    <div><dt>{t('hugoSetup.executable')}</dt><dd title={runtime.hugo.executable}>{runtime.hugo.executable || t('settings.executableUnknown')}</dd></div>
                  </dl> : <div className={`hugo-runtime-empty ${runtime.hugo.status}`}>
                    <AlertTriangle size={18} />
                    <div><strong>{t(runtime.hugo.status === 'missing' ? 'hugoSetup.missingTitle' : 'hugoSetup.errorTitle')}</strong><span>{runtime.hugo.status === 'missing' ? t('hugoSetup.missingRuntimeCopy', { environment: runtime.environment.label }) : runtime.hugo.details}</span></div>
                  </div>}

                  {runtime.blogAccessible && runtime.build?.status === 'error' && <div className="hugo-runtime-empty error">
                    <AlertTriangle size={18} />
                    <div><strong>{t('hugoSetup.buildFailedTitle')}</strong><span>{t('hugoSetup.buildFailedCopy')}</span></div>
                  </div>}

                  {runtime.assistance.repositoryMayLag && <small className="hugo-version-warning">{t('hugoSetup.repositoryWarning')}</small>}

                  <div className="hugo-runtime-actions">
                    {runtime.ready && !runtime.selected && <button className="button primary" onClick={() => selectRuntime(runtime)} disabled={busy}>{selecting ? <LoaderCircle className="spin" size={15} /> : <CheckCircle2 size={15} />} {t('hugoSetup.useRuntime')}</button>}
                    {runtime.ready && runtime.selected && <button className="button primary" onClick={() => onReady()} disabled={busy}><CheckCircle2 size={15} /> {t('hugoSetup.continue')}</button>}
                    {runtime.blogAccessible && automatic && <button className="button quiet" onClick={() => setConfirmation(runtime.id)} disabled={busy}>{installing ? <LoaderCircle className="spin" size={15} /> : <Download size={15} />} {t(installed ? 'hugoSetup.update' : 'hugoSetup.install')}</button>}
                    {runtime.blogAccessible && !automatic && runtime.assistance.command && <button className="button quiet" onClick={() => copyCommand(runtime)} disabled={busy}><ClipboardCopy size={15} /> {t(installed ? 'hugoSetup.copyUpdate' : 'hugoSetup.copyCommand')}</button>}
                    <button className="button quiet" onClick={() => openInstructions(runtime)} disabled={busy}><ExternalLink size={15} /> {t('hugoSetup.instructions')}</button>
                  </div>

                  {confirmation === runtime.id && <div className="hugo-install-confirmation" role="region" aria-live="polite" aria-label={t(installed ? 'hugoSetup.confirmUpdateTitle' : 'hugoSetup.confirmInstallTitle')}>
                    <div><strong>{t(installed ? 'hugoSetup.confirmUpdateTitle' : 'hugoSetup.confirmInstallTitle')}</strong><p>{t('hugoSetup.confirmAutomaticCopy', { environment: runtime.environment.label })}</p></div>
                    <code>{runtime.assistance.command}</code>
                    <div><button className="button quiet" onClick={() => setConfirmation('')} disabled={installing}>{t('common.cancel')}</button><button className="button primary" onClick={() => install(runtime)} disabled={installing}>{installing ? <LoaderCircle className="spin" size={15} /> : <Download size={15} />} {t(installed ? 'hugoSetup.confirmUpdate' : 'hugoSetup.confirmInstall')}</button></div>
                  </div>}

                  {(runtime.hugo.details || runtime.build?.details) && <details><summary>{t('hugoSetup.details')}</summary><pre>{runtime.build?.details || runtime.hugo.details}</pre></details>}
                </section>
              )
            })}
          </div>
        </>}
      </div>
      <footer className="git-setup-footer"><button className="button quiet" onClick={onClose}>{t('common.close')}</button><button className="button quiet" onClick={check} disabled={busy}>{working === 'checking' ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />} {t('hugoSetup.recheck')}</button></footer>
    </Modal>
  )
}
