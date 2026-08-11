import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowUpRight, Check, Cloud, Github, Globe2, KeyRound, LoaderCircle, RefreshCw, Rocket, ShieldCheck } from 'lucide-react'
import { api } from '../../app/api'
import { Modal } from '../../components/ui/Modal'
import { useI18n } from '../../i18n'
import { friendlyError } from '../../lib/errors'

const activeStates = new Set(['preflight', 'provisioning', 'uploading', 'deploying'])
const steps = ['preflight', 'provider', 'build', 'upload', 'deploy', 'verified']

export function DeploymentSetupModal({ context, onClose, onGitHub, onSiteChanged, notify }) {
  const { t } = useI18n()
  const defaultProject = context.root.split(/[\\/]/).filter(Boolean).at(-1)?.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || 'my-blog'
  const [status, setStatus] = useState(null)
  const [provider, setProvider] = useState('github-pages')
  const [github, setGitHub] = useState(null)
  const [publishing, setPublishing] = useState(null)
  const [cloudflare, setCloudflare] = useState(null)
  const [cloudflareToken, setCloudflareToken] = useState('')
  const [accounts, setAccounts] = useState([])
  const [accountId, setAccountId] = useState('')
  const [projects, setProjects] = useState([])
  const [projectName, setProjectName] = useState(defaultProject)
  const [working, setWorking] = useState('')
  const [showConfiguration, setShowConfiguration] = useState(false)

  const refreshStatus = useCallback(async () => {
    const next = await api.deploymentStatus()
    setStatus(next)
    if (next.provider) setProvider(next.provider)
    if (next.state === 'live' && next.liveUrl) onSiteChanged?.({ hostingProvider: next.provider, publicUrl: next.liveUrl, hostingConfigured: true })
    return next
  }, [onSiteChanged])

  const loadCloudflareAccounts = useCallback(async () => {
    const next = await api.listCloudflareAccounts()
    setAccounts(next)
    setAccountId((current) => current || next[0]?.id || '')
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([api.deploymentStatus(), api.githubStatus(), api.publishingStatus(), api.cloudflareStatus()])
      .then(async ([nextStatus, nextGitHub, nextPublishing, nextCloudflare]) => {
        if (!active) return
        setStatus(nextStatus)
        setGitHub(nextGitHub)
        setPublishing(nextPublishing)
        setCloudflare(nextCloudflare)
        if (nextStatus.provider) setProvider(nextStatus.provider)
        if (nextStatus.accountId) setAccountId(nextStatus.accountId)
        if (nextStatus.projectName) setProjectName(nextStatus.projectName)
        if (nextCloudflare.connected) await loadCloudflareAccounts()
      })
      .catch((error) => notify(friendlyError(error, t), 'error'))
    return () => { active = false }
  }, [loadCloudflareAccounts, notify, t])

  useEffect(() => {
    if (!accountId || !cloudflare?.connected) { setProjects([]); return undefined }
    let active = true
    api.listCloudflareProjects(accountId)
      .then((next) => { if (active) setProjects(next) })
      .catch((error) => notify(friendlyError(error, t), 'error'))
    return () => { active = false }
  }, [accountId, cloudflare?.connected, notify, t])

  useEffect(() => {
    if (!activeStates.has(status?.state) && !working.startsWith('deploy')) return undefined
    const timer = setInterval(() => refreshStatus().catch(() => {}), 1200)
    return () => clearInterval(timer)
  }, [refreshStatus, status?.state, working])

  async function connectCloudflare() {
    setWorking('cloudflare-connect')
    try {
      const result = await api.connectCloudflareToken(cloudflareToken)
      setCloudflareToken('')
      setCloudflare({ connected: true, ...result })
      await loadCloudflareAccounts()
      notify(t('deploy.cloudflare.connected'))
    } catch (error) {
      notify(friendlyError(error, t), 'error')
    } finally {
      setWorking('')
    }
  }

  async function disconnectCloudflare() {
    await api.disconnectCloudflare()
    setCloudflare({ connected: false, persistent: false })
    setAccounts([])
    setProjects([])
    setAccountId('')
  }

  async function startDeployment() {
    setShowConfiguration(false)
    setStatus((current) => ({
      ...(current || {}),
      provider,
      state: 'preflight',
      step: 'preflight',
      progress: 5,
      log: [t('deploy.log.preflight')],
      error: '',
      warning: '',
    }))
    setWorking(`deploy-${provider}`)
    try {
      const result = await api.deploySite({ provider, accountId, projectName })
      setStatus(result)
      if (result.state === 'live') {
        onSiteChanged?.({ hostingProvider: provider, publicUrl: result.liveUrl, hostingConfigured: true })
        notify(t('deploy.notice.live'))
      }
    } catch (error) {
      await refreshStatus().catch(() => {})
      notify(friendlyError(error, t), 'error')
    } finally {
      setWorking('')
    }
  }

  const currentStep = useMemo(() => Math.max(0, steps.indexOf(status?.step || 'preflight')), [status?.step])
  const running = activeStates.has(status?.state) || working.startsWith('deploy')
  const githubReady = github?.connected && publishing?.repository && github.authorization?.workflow !== false
  const cloudflareReady = cloudflare?.connected && accountId && projectName
  const canDeploy = provider === 'github-pages' ? githubReady : cloudflareReady

  return (
    <Modal title={t('deploy.title')} onClose={onClose} width="760px">
      <div className="deploy-assistant">
        <header className="deploy-hero"><div><span><Rocket size={20} /></span><div><h3>{t('deploy.hero')}</h3><p>{t('deploy.copy')}</p></div></div><small><ShieldCheck size={14} /> {t('deploy.secure')}</small></header>

        {!running && (status?.state !== 'live' || showConfiguration) && (
          <>
            <div className="deploy-provider-grid">
              <button className={provider === 'github-pages' ? 'selected' : ''} onClick={() => setProvider('github-pages')}>
                <span className="provider-icon github"><Github size={22} /></span><strong>{t('deploy.github.title')}</strong><p>{t('deploy.github.copy')}</p><small>{t('deploy.recommended')}</small>
              </button>
              <button className={provider === 'cloudflare-pages' ? 'selected' : ''} onClick={() => setProvider('cloudflare-pages')}>
                <span className="provider-icon cloudflare"><Cloud size={22} /></span><strong>{t('deploy.cloudflare.title')}</strong><p>{t('deploy.cloudflare.copy')}</p><small>{t('deploy.directUpload')}</small>
              </button>
            </div>

            {provider === 'github-pages' && (
              <section className="deploy-configuration">
                <div className={githubReady ? 'deploy-readiness ready' : 'deploy-readiness'}>{githubReady ? <Check size={18} /> : <AlertCircle size={18} />}<div><strong>{githubReady ? publishing.repository.fullName : t('deploy.github.notReady')}</strong><span>{githubReady ? t('deploy.github.ready') : github?.connected && publishing?.repository ? t('deploy.github.permissionCopy') : t('deploy.github.notReadyCopy')}</span></div>{!githubReady && <button className="button quiet" onClick={onGitHub}><Github size={15} /> {t('deploy.github.connect')}</button>}</div>
                <p className="deploy-explanation">{t('deploy.github.explanation')}</p>
              </section>
            )}

            {provider === 'cloudflare-pages' && (
              <section className="deploy-configuration">
                {!cloudflare?.connected ? <div className="cloudflare-token-setup"><div><KeyRound size={20} /><div><strong>{t('deploy.cloudflare.tokenTitle')}</strong><p>{t('deploy.cloudflare.tokenCopy')}</p></div></div><button className="button quiet" onClick={() => api.openPublishingUrl('https://dash.cloudflare.com/profile/api-tokens')}><ArrowUpRight size={14} /> {t('deploy.cloudflare.createToken')}</button><div><input type="password" value={cloudflareToken} onChange={(event) => setCloudflareToken(event.target.value)} placeholder={t('deploy.cloudflare.tokenPlaceholder')} autoComplete="off" /><button className="button primary" onClick={connectCloudflare} disabled={working || cloudflareToken.trim().length < 20}>{working === 'cloudflare-connect' && <LoaderCircle className="spin" size={15} />} {t('deploy.cloudflare.connect')}</button></div><small><ShieldCheck size={13} /> {t('deploy.cloudflare.storage')}</small></div> : <div className="cloudflare-project-setup"><div className="cloudflare-connected"><Check size={16} /><span>{t('deploy.cloudflare.connected')}</span><button onClick={disconnectCloudflare}>{t('deploy.cloudflare.disconnect')}</button></div><div className="two-fields"><label>{t('deploy.cloudflare.account')}<select value={accountId} onChange={(event) => setAccountId(event.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><label>{t('deploy.cloudflare.project')}<input value={projectName} onChange={(event) => setProjectName(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} /></label></div>{projects.length > 0 && <label>{t('deploy.cloudflare.existing')}<select value={projects.some((project) => project.name === projectName) ? projectName : ''} onChange={(event) => event.target.value && setProjectName(event.target.value)}><option value="">{t('deploy.cloudflare.newProject')}</option>{projects.map((project) => <option key={project.id} value={project.name}>{project.name} · {project.liveUrl}</option>)}</select></label>}<p>{t('deploy.cloudflare.explanation')}</p></div>}
              </section>
            )}
          </>
        )}

        {(running || status?.state === 'failed' || (status?.state === 'live' && !showConfiguration)) && status && (
          <section className={`deploy-progress-state ${status.state}`}>
            <div className="deploy-progress-heading"><span>{status.state === 'live' ? <Check size={23} /> : status.state === 'failed' ? <AlertCircle size={23} /> : <LoaderCircle className="spin" size={23} />}</span><div><h3>{t(`deploy.state.${status.state}`)}</h3><p>{status.state === 'failed' ? status.error : status.state === 'live' ? t('deploy.liveCopy', { url: status.liveUrl }) : t(`deploy.step.${status.step || 'preflight'}`)}</p></div><strong>{Math.round(status.progress || 0)}%</strong></div>
            <div className="deploy-progress-bar"><span style={{ width: `${status.progress || 0}%` }} /></div>
            <div className="deploy-timeline">{steps.map((step, index) => <div key={step} className={index < currentStep || status.state === 'live' ? 'done' : index === currentStep ? 'active' : ''}><span>{index < currentStep || status.state === 'live' ? <Check size={12} /> : index + 1}</span><small>{t(`deploy.timeline.${step}`)}</small></div>)}</div>
            {status.log?.length > 0 && <details className="deploy-log" open={status.state === 'failed'}><summary>{t('deploy.log')}</summary>{status.log.map((entry, index) => <code key={`${index}-${entry}`}>{entry}</code>)}</details>}
            {status.warning && <div className="deploy-warning"><AlertCircle size={15} /> {status.warning}</div>}
          </section>
        )}

        <footer className="deploy-footer">
          <button className="button quiet" onClick={onClose}>{t('common.close')}</button>
          {status?.dashboardUrl && !showConfiguration && <button className="button quiet" onClick={() => api.openPublishingUrl(status.dashboardUrl)}><ArrowUpRight size={14} /> {t('deploy.details')}</button>}
          {status?.state === 'live' && !showConfiguration && <button className="button quiet" onClick={() => setShowConfiguration(true)}><RefreshCw size={15} /> {t('deploy.changeProvider')}</button>}
          {status?.state === 'live' && !showConfiguration && <button className="button quiet" onClick={startDeployment} disabled={!canDeploy}><Rocket size={15} /> {t('deploy.redeploy')}</button>}
          {status?.state === 'live' && !showConfiguration && status.customDomainUrl && <button className="button quiet" onClick={() => api.openPublishingUrl(status.customDomainUrl)}><Globe2 size={15} /> {t('deploy.customDomain')}</button>}
          {status?.state === 'live' && !showConfiguration && status.liveUrl && <button className="button primary" onClick={() => api.openPublishingUrl(status.liveUrl)}><Globe2 size={15} /> {t('deploy.viewSite')}</button>}
          {status?.state === 'failed' && provider === 'github-pages' && <button className="button quiet" onClick={onGitHub}><Github size={15} /> {t('deploy.github.connect')}</button>}
          {!running && (status?.state !== 'live' || showConfiguration) && <button className="button primary" onClick={startDeployment} disabled={!canDeploy}><Rocket size={16} /> {status?.state === 'failed' ? t('deploy.retry') : t('deploy.start')}</button>}
          {running && <button className="button quiet" onClick={() => refreshStatus()}><RefreshCw size={15} /> {t('deploy.refresh')}</button>}
        </footer>
      </div>
    </Modal>
  )
}
