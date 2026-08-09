import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Check, ExternalLink, Github, Globe2, LoaderCircle, UploadCloud } from 'lucide-react'
import { api } from '../../app/api'
import { Modal } from '../../components/ui/Modal'
import { useI18n } from '../../i18n'
import { friendlyError } from '../../lib/errors'

export function GitHubSetupModal({ context, onClose, onPublish, notify }) {
  const { t } = useI18n()
  const defaultName = context.root.split(/[\\/]/).filter(Boolean).at(-1)?.toLowerCase().replace(/[^a-z0-9_.-]+/g, '-') || 'my-blog'
  const [github, setGitHub] = useState(null)
  const [flow, setFlow] = useState(null)
  const [repositories, setRepositories] = useState([])
  const [mode, setMode] = useState('create')
  const [selectedRepository, setSelectedRepository] = useState('')
  const [repositoryName, setRepositoryName] = useState(defaultName)
  const [description, setDescription] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [protocol, setProtocol] = useState('ssh')
  const [connectedRepository, setConnectedRepository] = useState(null)
  const [pages, setPages] = useState(null)
  const [working, setWorking] = useState(false)
  const [accessToken, setAccessToken] = useState('')

  const loadAccount = useCallback(async () => {
    const next = await api.githubStatus()
    setGitHub(next)
    if (next.connected) {
      const items = await api.listGitHubRepositories()
      setRepositories(items.filter((repository) => repository.permissions?.push !== false))
    }
  }, [])

  useEffect(() => {
    loadAccount().catch((error) => notify(friendlyError(error, t), 'error'))
  }, [loadAccount, notify, t])

  useEffect(() => {
    if (!flow?.deviceCode) return undefined
    let cancelled = false
    let timer
    async function poll() {
      try {
        const result = await api.completeGitHubSignIn(flow.deviceCode)
        if (cancelled) return
        if (result.state === 'complete') {
          setFlow(null)
          setGitHub({ configured: true, connected: true, account: result.account, persistent: result.persistent })
          setRepositories((await api.listGitHubRepositories()).filter((repository) => repository.permissions?.push !== false))
          notify(t('github.connected', { login: result.account.login }))
          return
        }
        if (['expired', 'denied', 'error'].includes(result.state)) {
          setFlow({ ...flow, error: result.description || t(`github.flow.${result.state}`) })
          return
        }
        timer = setTimeout(poll, (result.state === 'slow-down' ? flow.interval + 5 : flow.interval) * 1000)
      } catch (error) {
        if (!cancelled) setFlow({ ...flow, error: friendlyError(error, t) })
      }
    }
    timer = setTimeout(poll, flow.interval * 1000)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [flow, notify, t])

  async function signIn() {
    setWorking(true)
    try { setFlow(await api.beginGitHubSignIn()) } catch (error) { notify(friendlyError(error, t), 'error') } finally { setWorking(false) }
  }

  async function connectToken() {
    setWorking(true)
    try {
      const result = await api.connectGitHubToken(accessToken)
      setAccessToken('')
      setGitHub({ configured: github.configured, connected: true, account: result.account, persistent: result.persistent })
      setRepositories((await api.listGitHubRepositories()).filter((repository) => repository.permissions?.push !== false))
      notify(t('github.connected', { login: result.account.login }))
    } catch (error) { notify(friendlyError(error, t), 'error') } finally { setWorking(false) }
  }

  async function createRepository(event) {
    event.preventDefault()
    setWorking(true)
    try {
      const result = await api.createGitHubRepository({ name: repositoryName, description, private: isPrivate, protocol })
      setConnectedRepository(result.repository)
      notify(t('github.repositoryCreated', { repository: result.repository.fullName }))
    } catch (error) { notify(friendlyError(error, t), 'error') } finally { setWorking(false) }
  }

  async function connectRepository(event) {
    event.preventDefault()
    setWorking(true)
    try {
      const result = await api.connectGitHubRepository(selectedRepository, protocol)
      setConnectedRepository(result.repository)
      notify(t('github.repositoryConnected', { repository: result.repository.fullName }))
    } catch (error) { notify(friendlyError(error, t), 'error') } finally { setWorking(false) }
  }

  async function configurePages() {
    setWorking(true)
    try {
      const result = await api.configureGitHubPages()
      setPages(result)
      notify(result.warning ? t('github.pagesWarning') : t('github.pagesReady'), result.warning ? 'error' : 'success')
    } catch (error) { notify(friendlyError(error, t), 'error') } finally { setWorking(false) }
  }

  async function disconnect() {
    await api.disconnectGitHub()
    setGitHub({ configured: true, connected: false, account: null, persistent: false })
    setRepositories([])
    setConnectedRepository(null)
    setPages(null)
  }

  return (
    <Modal title={t('github.title')} onClose={onClose} width="720px">
      <div className="github-setup">
        {!github && <div className="github-loading"><LoaderCircle className="spin" size={22} /> {t('github.loading')}</div>}
        {github && !github.connected && (
          <section className="github-signin">
            <div className="github-hero-icon"><Github size={30} /></div>
            <h3>{t('github.signInTitle')}</h3>
            <p>{t('github.signInCopy')}</p>
            {github.configured && (!flow ? <button className="button primary large" onClick={signIn} disabled={working}>{working ? <LoaderCircle className="spin" size={17} /> : <Github size={17} />} {t('github.signIn')}</button> : (
              <div className="github-device-code">
                <span>{t('github.codeCopied')}</span>
                <strong>{flow.userCode}</strong>
                <p>{flow.error || t('github.waiting')}</p>
                {flow.error && <button className="button quiet" onClick={() => setFlow(null)}>{t('github.tryAgain')}</button>}
              </div>
            ))}
            <div className="github-token-option">
              <span>{github.configured ? t('github.orToken') : t('github.tokenRequired')}</span>
              <p>{t('github.tokenCopy')}</p>
              <button className="button quiet" onClick={() => api.openPublishingUrl('https://github.com/settings/personal-access-tokens/new')}><ExternalLink size={14} /> {t('github.createToken')}</button>
              <div><input type="password" value={accessToken} onChange={(event) => setAccessToken(event.target.value)} placeholder={t('github.tokenPlaceholder')} autoComplete="off" /><button className="button primary" onClick={connectToken} disabled={working || accessToken.trim().length < 20}>{working && <LoaderCircle className="spin" size={15} />} {t('github.connectToken')}</button></div>
              <small>{t('github.tokenStorage')}</small>
            </div>
          </section>
        )}
        {github?.connected && !connectedRepository && (
          <>
            <div className="github-account">
              <img src={github.account.avatarUrl} alt="" /><div><small>{t('github.connectedAs')}</small><strong>{github.account.name}</strong><span>@{github.account.login}{!github.persistent && ` · ${t('github.sessionOnly')}`}</span></div>
              <button className="button quiet" onClick={disconnect}>{t('github.disconnect')}</button>
            </div>
            <div className="github-mode-tabs"><button className={mode === 'create' ? 'active' : ''} onClick={() => setMode('create')}>{t('github.createRepository')}</button><button className={mode === 'existing' ? 'active' : ''} onClick={() => setMode('existing')}>{t('github.existingRepository')}</button></div>
            {mode === 'create' ? (
              <form className="github-repository-form" onSubmit={createRepository}>
                <label>{t('github.repositoryName')}<div className="repository-name"><span>{github.account.login} /</span><input value={repositoryName} onChange={(event) => setRepositoryName(event.target.value)} /></div></label>
                <label>{t('github.description')}<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t('github.descriptionPlaceholder')} /></label>
                <div className="github-options">
                  <label><input type="radio" checked={!isPrivate} onChange={() => setIsPrivate(false)} /> <Globe2 size={15} /><span><strong>{t('github.public')}</strong><small>{t('github.publicCopy')}</small></span></label>
                  <label><input type="radio" checked={isPrivate} onChange={() => setIsPrivate(true)} /> <Github size={15} /><span><strong>{t('github.private')}</strong><small>{t('github.privateCopy')}</small></span></label>
                </div>
                <label>{t('github.gitConnection')}<select value={protocol} onChange={(event) => setProtocol(event.target.value)}><option value="ssh">SSH</option><option value="https">HTTPS</option></select></label>
                <footer><button className="button primary" disabled={working || !repositoryName}>{working && <LoaderCircle className="spin" size={15} />} {t('github.createAndConnect')}</button></footer>
              </form>
            ) : (
              <form className="github-repository-form" onSubmit={connectRepository}>
                <label>{t('github.chooseRepository')}<select value={selectedRepository} onChange={(event) => setSelectedRepository(event.target.value)}><option value="">{t('github.choosePlaceholder')}</option>{repositories.map((repository) => <option key={repository.fullName} value={repository.fullName}>{repository.fullName}{repository.private ? ` · ${t('github.private')}` : ''}</option>)}</select></label>
                <label>{t('github.gitConnection')}<select value={protocol} onChange={(event) => setProtocol(event.target.value)}><option value="ssh">SSH</option><option value="https">HTTPS</option></select></label>
                <footer><button className="button primary" disabled={working || !selectedRepository}>{working && <LoaderCircle className="spin" size={15} />} {t('github.connectSelected')}</button></footer>
              </form>
            )}
          </>
        )}
        {connectedRepository && !pages && (
          <section className="github-pages-step"><div className="github-success"><Check size={20} /><div><strong>{connectedRepository.fullName}</strong><span>{t('github.remoteReady')}</span></div></div><Globe2 size={34} /><h3>{t('github.pagesTitle')}</h3><p>{t('github.pagesCopy')}</p><button className="button primary large" onClick={configurePages} disabled={working}>{working ? <LoaderCircle className="spin" size={17} /> : <Globe2 size={17} />} {t('github.configurePages')}</button></section>
        )}
        {pages && (
          <section className="github-pages-step"><div className="github-finished"><Check size={28} /></div><h3>{t('github.finishedTitle')}</h3><p>{t('github.finishedCopy', { url: pages.liveUrl })}</p>{pages.warning && <div className="github-warning"><AlertCircle size={16} /> {pages.warning}</div>}<div className="github-live-url">{pages.liveUrl}</div><button className="button primary large" onClick={() => { onClose(); onPublish() }}><UploadCloud size={17} /> {t('github.publishFirst')}</button></section>
        )}
      </div>
    </Modal>
  )
}
