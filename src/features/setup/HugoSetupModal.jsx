import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, ClipboardCopy, Download, ExternalLink, HardDrive, LoaderCircle, RefreshCw, Terminal } from 'lucide-react'
import { api } from '../../app/api'
import { Modal } from '../../components/ui/Modal'
import { useI18n } from '../../i18n'
import { friendlyError } from '../../lib/errors'

function environmentLabel(status, t) {
  if (!status?.environment) return '—'
  if (status.environment.kind === 'wsl') return status.environment.label
  return t(`gitSetup.environment.${status.environment.platform}`)
}

export function HugoSetupModal({ onClose, onReady, notify }) {
  const { t } = useI18n()
  const [status, setStatus] = useState(null)
  const [working, setWorking] = useState('')
  const [distro, setDistro] = useState('')

  const check = useCallback(async (resume = false) => {
    setWorking('checking')
    try {
      const next = await api.hugoReadiness()
      setStatus(next)
      setDistro((current) => current || next.wslDistributions?.[0] || '')
      if (resume && next.ready) await onReady()
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
      const next = await api.installHugo()
      setStatus(next)
      notify(t(next.hugo.status === 'ready' ? 'notice.hugoReady' : 'notice.hugoInstallFinished'))
      if (next.ready) await onReady()
    } catch (error) {
      notify(friendlyError(error, t), 'error')
    } finally {
      setWorking('')
    }
  }

  async function copyCommand() {
    try {
      await api.copyText(status.assistance.command)
      notify(t('notice.hugoCommandCopied'))
    } catch (error) {
      notify(friendlyError(error, t), 'error')
    }
  }

  async function switchToWsl() {
    if (!distro) return
    setWorking('switching')
    try {
      const context = await api.useWslForBlog(distro)
      notify(t('notice.hugoWslSelected', { distro }))
      await onReady(context)
    } catch (error) {
      notify(friendlyError(error, t), 'error')
    } finally {
      setWorking('')
    }
  }

  const environment = environmentLabel(status, t)
  const missing = status?.hugo.status === 'missing'
  const failed = status?.hugo.status === 'error'
  const ready = Boolean(status?.ready)
  const busy = Boolean(working)

  return (
    <Modal title={t('hugoSetup.title')} onClose={onClose} width="660px">
      <div className="git-setup hugo-setup">
        {!status && <div className="git-setup-loading"><LoaderCircle className="spin" size={24} /> {t('hugoSetup.checking')}</div>}
        {status && <>
          <div className="git-environment"><Terminal size={17} /><span><small>{t('hugoSetup.environment')}</small><strong>{environment}</strong></span></div>

          {(missing || failed) && <section className="git-setup-state error">
            <div className="git-setup-icon"><AlertTriangle size={25} /></div>
            <h3>{t(missing ? 'hugoSetup.missingTitle' : 'hugoSetup.errorTitle')}</h3>
            <p>{missing ? t('hugoSetup.missingCopy', { environment }) : status.hugo.details}</p>
            {status.assistance.command && <code>{status.assistance.command}</code>}
            {status.assistance.repositoryMayLag && <small className="hugo-version-warning">{t('hugoSetup.repositoryWarning')}</small>}
            <div className="git-setup-actions">
              {status.assistance.mode === 'automatic'
                ? <button className="button primary" onClick={install} disabled={busy}>{working === 'installing' ? <LoaderCircle className="spin" size={15} /> : <Download size={15} />} {t('hugoSetup.install')}</button>
                : <button className="button primary" onClick={copyCommand} disabled={busy}><ClipboardCopy size={15} /> {t('hugoSetup.copyCommand')}</button>}
              <button className="button quiet" onClick={() => api.openPublishingUrl(status.assistance.url).catch((error) => notify(friendlyError(error, t), 'error'))}><ExternalLink size={15} /> {t('hugoSetup.instructions')}</button>
            </div>
            {status.hugo.details && <details><summary>{t('hugoSetup.details')}</summary><pre>{status.hugo.details}</pre></details>}
          </section>}

          {ready && <section className="git-setup-state ready">
            <div className="git-setup-icon"><CheckCircle2 size={25} /></div>
            <h3>{t('hugoSetup.readyTitle')}</h3>
            <p>{t('hugoSetup.readyCopy', { environment })}</p>
            <dl className="hugo-runtime-details"><div><dt>{t('hugoSetup.version')}</dt><dd>{status.hugo.version}</dd></div><div><dt>{t('hugoSetup.executable')}</dt><dd>{status.hugo.executable || t('settings.executableUnknown')}</dd></div><div><dt>{t('hugoSetup.edition')}</dt><dd>{status.hugo.extended ? t('hugoSetup.extended') : t('hugoSetup.standard')}</dd></div></dl>
            <div className="git-setup-actions">
              {status.assistance.mode === 'automatic' ? <button className="button quiet" onClick={install} disabled={busy}>{working === 'installing' ? <LoaderCircle className="spin" size={15} /> : <Download size={15} />} {t('hugoSetup.update')}</button> : <button className="button quiet" onClick={copyCommand}><ClipboardCopy size={15} /> {t('hugoSetup.copyUpdate')}</button>}
              <button className="button primary" onClick={() => onReady()}><CheckCircle2 size={15} /> {t('hugoSetup.continue')}</button>
            </div>
          </section>}

          {status.environment.kind === 'native' && status.environment.platform === 'win32' && status.wslDistributions?.length > 0 && <section className="hugo-wsl-choice">
            <HardDrive size={20} />
            <div><h3>{t('hugoSetup.wslTitle')}</h3><p>{t('hugoSetup.wslCopy')}</p><label>{t('hugoSetup.wslDistro')}<select value={distro} onChange={(event) => setDistro(event.target.value)}>{status.wslDistributions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label></div>
            <button className="button quiet" onClick={switchToWsl} disabled={busy || !distro}>{working === 'switching' ? <LoaderCircle className="spin" size={15} /> : <Terminal size={15} />} {t('hugoSetup.useWsl')}</button>
          </section>}
        </>}
      </div>
      <footer className="git-setup-footer"><button className="button quiet" onClick={onClose}>{t('common.close')}</button><button className="button quiet" onClick={() => check(true)} disabled={busy}>{working === 'checking' ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />} {t('hugoSetup.recheck')}</button></footer>
    </Modal>
  )
}
