import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Check, Eye, FileText, LoaderCircle, Menu, PanelLeftClose, Plus, UploadCloud } from 'lucide-react'
import { Sidebar } from '../components/layout/Sidebar'
import { CreateBlogModal } from '../features/blogs/CreateBlogModal'
import { Editor } from '../features/editor/Editor'
import { BloggerImportModal } from '../features/importing/BloggerImportModal'
import { ImageLibrary } from '../features/media/ImageLibrary'
import { Welcome } from '../features/onboarding/Welcome'
import { NewPostModal } from '../features/posts/NewPostModal'
import { PostList } from '../features/posts/PostList'
import { GitHubSetupModal } from '../features/publishing/GitHubSetupModal'
import { PublishModal } from '../features/publishing/PublishModal'
import { PublishingHealthModal } from '../features/publishing/PublishingHealthModal'
import { SettingsModal } from '../features/settings/SettingsModal'
import { GitSetupModal } from '../features/setup/GitSetupModal'
import { ThemeManagerModal } from '../features/themes/ThemeManagerModal'
import { useI18n } from '../i18n'
import { friendlyError } from '../lib/errors'
import { hugoInstallUrl } from '../lib/hugo'
import { api, emptyContext } from './api'

export default function App() {
  const { t } = useI18n()
  const [context, setContext] = useState(emptyContext)
  const [ready, setReady] = useState(false)
  const [posts, setPosts] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [post, setPost] = useState(null)
  const [savedPost, setSavedPost] = useState(null)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [createBlogOpen, setCreateBlogOpen] = useState(false)
  const [newPostOpen, setNewPostOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [imagesOpen, setImagesOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [githubOpen, setGitHubOpen] = useState(false)
  const [healthOpen, setHealthOpen] = useState(false)
  const [gitSetupOpen, setGitSetupOpen] = useState(false)
  const [bloggerOpen, setBloggerOpen] = useState(false)
  const [themesOpen, setThemesOpen] = useState(false)
  const [publishingStatus, setPublishingStatus] = useState(null)
  const [publishPhase, setPublishPhase] = useState('ready')
  const [publishError, setPublishError] = useState('')
  const [publishLog, setPublishLog] = useState([])
  const [toast, setToast] = useState(null)
  const savePromiseRef = useRef(null)
  const pendingGitActionRef = useRef(null)
  const tRef = useRef(t)
  tRef.current = t

  const notify = useCallback((message, kind = 'success') => {
    setToast({ message, kind })
    setTimeout(() => setToast(null), 4200)
  }, [])

  const performSave = useCallback(async (target, announce = false) => {
    if (!target) return false
    if (savePromiseRef.current) await savePromiseRef.current.catch(() => {})

    const snapshot = JSON.stringify(target)
    setSaving(true)
    setSaveError(null)
    const request = api.savePost(target)
    savePromiseRef.current = request
    try {
      const saved = await request
      setSavedPost(JSON.stringify(saved))
      setPost((current) => JSON.stringify(current) === snapshot ? saved : current)
      setPosts((current) => current.map((item) => item.id === saved.id ? {
        ...item,
        title: saved.title,
        description: saved.description,
        date: saved.date,
        publishDate: saved.publishDate,
        draft: saved.draft,
        tags: saved.tags,
        language: saved.language,
        featuredImage: saved.featuredImage,
      } : item))
      if (announce) notify(t('notice.postSaved'))
      return true
    } catch (error) {
      const message = friendlyError(error, t)
      setSaveError(message)
      notify(message, 'error')
      return false
    } finally {
      if (savePromiseRef.current === request) savePromiseRef.current = null
      setSaving(false)
    }
  }, [notify, t])

  const refreshPosts = useCallback(async (preferredId, replaceSelection = false) => {
    const result = await api.listPosts()
    setPosts(result)
    const id = preferredId || (!replaceSelection && activeId) || result[0]?.id
    if (id) {
      const loaded = await api.readPost(id)
      setActiveId(id)
      setPost(loaded)
      setSavedPost(JSON.stringify(loaded))
    } else {
      setActiveId(null)
      setPost(null)
      setSavedPost(null)
    }
  }, [activeId])

  useEffect(() => {
    api.getContext().then(async (value) => {
      if (value) {
        setContext(value)
        const result = await api.listPosts()
        setPosts(result)
        if (result[0]) {
          const loaded = await api.readPost(result[0].id)
          setActiveId(result[0].id)
          setPost(loaded)
          setSavedPost(JSON.stringify(loaded))
        }
      }
    }).catch((error) => notify(friendlyError(error, tRef.current), 'error')).finally(() => setReady(true))
  }, [notify])

  const dirty = Boolean(post && savedPost && JSON.stringify(post) !== savedPost)

  useEffect(() => {
    if (!dirty || saving || saveError || !post) return undefined
    const timer = setTimeout(() => performSave(post), 1200)
    return () => clearTimeout(timer)
  }, [dirty, performSave, post, saveError, saving])

  async function chooseBlog() {
    setBusy(true)
    try {
      const value = await api.chooseBlog()
      if (value) {
        setContext(value)
        await refreshPosts(undefined, true)
        notify(t('notice.blogConnected'))
      }
    } catch (error) { notify(friendlyError(error, t), 'error') } finally { setBusy(false); setReady(true) }
  }

  async function createBlog(input) {
    setBusy(true)
    try {
      const value = await api.createBlog(input)
      if (value) {
        setContext(value)
        setCreateBlogOpen(false)
        await refreshPosts(undefined, true)
        notify(value.themeWarning ? t('notice.blogCreatedThemeWarning', { detail: value.themeWarning }) : t('notice.blogCreated'), value.themeWarning ? 'error' : 'success')
      }
    } catch (error) { notify(friendlyError(error, t), 'error') } finally { setBusy(false); setReady(true) }
  }

  async function installTheme(slug) {
    setBusy(true)
    try {
      const result = await api.installTheme(slug)
      if (result.context) setContext(result.context)
      if (result.ok) {
        setThemesOpen(false)
        notify(t('notice.themeInstalled', { theme: result.folder }))
      }
      return result
    } catch (error) {
      const message = friendlyError(error, t)
      notify(message, 'error')
      return { ok: false, stage: 'unexpected', message }
    } finally { setBusy(false) }
  }

  async function deactivateTheme() {
    setBusy(true)
    try {
      setContext(await api.deactivateTheme())
      notify(t('notice.themeDeactivated'))
      return true
    } catch (error) {
      notify(friendlyError(error, t), 'error')
      return false
    } finally { setBusy(false) }
  }

  async function selectPost(id) {
    if (dirty && !(await performSave(post))) return
    try {
      const loaded = await api.readPost(id)
      setActiveId(id)
      setPost(loaded)
      setSavedPost(JSON.stringify(loaded))
    } catch (error) { notify(friendlyError(error, t), 'error') }
  }

  async function save() {
    await performSave(post, true)
  }

  async function create(input) {
    setBusy(true)
    try {
      const created = await api.createPost(input)
      setNewPostOpen(false)
      await refreshPosts(created.id)
      notify(t('notice.draftCreated'))
    } catch (error) { notify(friendlyError(error, t), 'error') } finally { setBusy(false) }
  }

  function applyImportedImages(imported) {
    if (!imported.length) return
    const markdown = imported.map((item) => `![${t('image.alt')}](${item.name})`).join('\n\n')
    setPost((current) => {
      const body = current.body || ''
      return {
        ...current,
        body: `${body}${body && !body.endsWith('\n') ? '\n\n' : ''}${markdown}`,
        assets: [...new Set([...(current.assets || []), ...imported.map((item) => item.name)])],
      }
    })
    notify(t(imported.length === 1 ? 'notice.imagesAdded.one' : 'notice.imagesAdded.other', { count: imported.length }))
  }

  async function addImages() {
    try {
      const imported = await api.importImages(post.id)
      applyImportedImages(imported)
    } catch (error) { notify(friendlyError(error, t), 'error') }
  }

  async function addDroppedImages(files) {
    try {
      const imported = await api.importDroppedImages(post.id, files)
      applyImportedImages(imported)
    } catch (error) { notify(friendlyError(error, t), 'error') }
  }

  function insertExistingImage(name, options = {}) {
    setPost((current) => {
      const body = current.body || ''
      const alt = String(options.alt || t('image.alt')).replaceAll('[', '\\[').replaceAll(']', '\\]')
      const caption = String(options.caption || '').trim().replaceAll('*', '\\*')
      const markdown = `![${alt}](${name})${caption ? `\n\n*${caption}*` : ''}`
      return { ...current, body: `${body}${body && !body.endsWith('\n') ? '\n\n' : ''}${markdown}` }
    })
    setImagesOpen(false)
    notify(t('notice.imageInserted'))
  }

  const refreshPublishingStatus = useCallback(async () => {
    try { setPublishingStatus(await api.publishingStatus()) } catch (error) { notify(friendlyError(error, t), 'error') }
  }, [notify, t])

  const requestGitSetup = useCallback((nextAction = null) => {
    pendingGitActionRef.current = nextAction
    setGitSetupOpen(true)
  }, [])

  const ensureGitReady = useCallback(async (nextAction) => {
    try {
      const status = await api.gitReadiness()
      if (status.ready) await nextAction()
      else requestGitSetup(nextAction)
    } catch (error) {
      notify(friendlyError(error, t), 'error')
    }
  }, [notify, requestGitSetup, t])

  const finishGitSetup = useCallback(async () => {
    const nextAction = pendingGitActionRef.current
    pendingGitActionRef.current = null
    setGitSetupOpen(false)
    try {
      const nextContext = await api.getContext()
      if (nextContext) setContext(nextContext)
      if (nextAction) await nextAction()
    } catch (error) {
      notify(friendlyError(error, t), 'error')
    }
  }, [notify, t])

  useEffect(() => {
    if (!ready || !context.root) return
    api.gitReadiness()
      .then((status) => { if (!status.ready) requestGitSetup() })
      .catch((error) => notify(friendlyError(error, t), 'error'))
  }, [context.root, notify, ready, requestGitSetup, t])

  function closeGitSetup() {
    pendingGitActionRef.current = null
    setGitSetupOpen(false)
  }

  async function openPublish() {
    try {
      setPublishingStatus(await api.publishingStatus())
      setPublishPhase('ready')
      setPublishError('')
      setPublishLog([])
      setSettingsOpen(false)
      setPublishOpen(true)
    } catch (error) { notify(friendlyError(error, t), 'error') }
  }

  async function showPublish() {
    if (dirty && !(await performSave(post))) return
    setSettingsOpen(false)
    await ensureGitReady(openPublish)
  }

  async function showGitHub() {
    setSettingsOpen(false)
    setPublishOpen(false)
    await ensureGitReady(async () => setGitHubOpen(true))
  }

  async function publish(message) {
    setBusy(true)
    setPublishPhase('publishing')
    setPublishError('')
    try {
      const result = await api.publishBlog(message)
      setPublishingStatus(result.status)
      setPublishLog(result.log || [])
      setPublishPhase('complete')
      notify(t('notice.published'))
    } catch (error) {
      const messageText = friendlyError(error, t)
      setPublishError(messageText)
      setPublishPhase('error')
      notify(messageText, 'error')
    } finally { setBusy(false) }
  }

  function handleHealthAction(action) {
    setHealthOpen(false)
    if (action === 'github') showGitHub()
    else if (action === 'git') requestGitSetup(() => setHealthOpen(true))
    else if (action === 'publish') showPublish()
    else if (action === 'preview') api.openPreview().catch((error) => notify(friendlyError(error, t), 'error'))
    else if (action === 'hugo') api.openPublishingUrl(hugoInstallUrl(context.runtime)).catch((error) => notify(friendlyError(error, t), 'error'))
    else setSettingsOpen(true)
  }

  async function handleBloggerImported(result) {
    await refreshPosts(result.posts[0]?.id, true)
    notify(t('notice.bloggerImported', { count: result.posts.length }))
  }

  if (!ready) return <div className="app-loading"><div className="welcome-mark"><span>p</span></div><LoaderCircle className="spin" /></div>
  if (!context.root) return <><Welcome onChoose={chooseBlog} onCreate={() => setCreateBlogOpen(true)} busy={busy} />{createBlogOpen && <CreateBlogModal onClose={() => setCreateBlogOpen(false)} onCreate={createBlog} busy={busy} />}{toast && <div className={`toast ${toast.kind}`}>{toast.message}</div>}</>

  return (
    <div className="app-shell">
      <Sidebar context={context} onChooseBlog={chooseBlog} onImages={() => post && setImagesOpen(true)} onThemes={() => setThemesOpen(true)} onHealth={() => setHealthOpen(true)} onImport={() => setBloggerOpen(true)} onSettings={() => setSettingsOpen(true)} />
      <PostList posts={posts} activeId={activeId} onSelect={selectPost} onNew={() => setNewPostOpen(true)} />
      <main className="content-area">
        <header className="topbar">
          <button className="icon-button ghost"><PanelLeftClose size={19} /></button>
          <div className="breadcrumbs"><span>{context.root.split(/[\\/]/).filter(Boolean).at(-1)}</span><b>/</b><strong>{post?.title || t('posts.title')}</strong></div>
          <div className="topbar-actions"><button className="button quiet" onClick={() => api.openPreview().catch((error) => notify(friendlyError(error, t), 'error'))}><Eye size={17} /> {t('top.preview')} <ArrowUpRight size={14} /></button><button className="button primary" onClick={showPublish}><UploadCloud size={17} /> {t('top.publish')}</button><button className="icon-button" onClick={() => setSettingsOpen(true)} title={t('top.openSettings')}><Menu size={18} /></button></div>
        </header>
        {post ? <Editor post={post} onChange={(change) => { setSaveError(null); setPost((current) => ({ ...current, ...change })) }} onSave={save} onOpenImages={() => setImagesOpen(true)} onDropImages={addDroppedImages} saveState={{ saving, dirty, error: saveError }} /> : <div className="empty-editor"><FileText size={34} /><h2>{t('empty.title')}</h2><p>{t('empty.copy')}</p><button className="button primary" onClick={() => setNewPostOpen(true)}><Plus size={17} /> {t('posts.new')}</button></div>}
      </main>
      {newPostOpen && <NewPostModal onClose={() => setNewPostOpen(false)} onCreate={create} busy={busy} />}
      {createBlogOpen && <CreateBlogModal onClose={() => setCreateBlogOpen(false)} onCreate={createBlog} busy={busy} />}
      {publishOpen && <PublishModal status={publishingStatus} busy={busy} phase={publishPhase} error={publishError} log={publishLog} onClose={() => setPublishOpen(false)} onPublish={publish} onRefresh={refreshPublishingStatus} onSettings={showGitHub} />}
      {imagesOpen && post && <ImageLibrary post={post} onClose={() => setImagesOpen(false)} onAdd={addImages} onDrop={addDroppedImages} onInsert={insertExistingImage} onFeatured={(name) => setPost((current) => ({ ...current, featuredImage: name }))} />}
      {themesOpen && <ThemeManagerModal context={context} onClose={() => setThemesOpen(false)} onInstall={installTheme} onDeactivate={deactivateTheme} busy={busy} notify={notify} />}
      {githubOpen && <GitHubSetupModal context={context} onClose={() => setGitHubOpen(false)} onPublish={showPublish} notify={notify} />}
      {healthOpen && <PublishingHealthModal onClose={() => setHealthOpen(false)} onAction={handleHealthAction} notify={notify} />}
      {gitSetupOpen && <GitSetupModal onClose={closeGitSetup} onReady={finishGitSetup} notify={notify} />}
      {bloggerOpen && <BloggerImportModal onClose={() => setBloggerOpen(false)} onImported={handleBloggerImported} notify={notify} />}
      {settingsOpen && <SettingsModal context={context} onClose={() => setSettingsOpen(false)} onChooseBlog={() => { setSettingsOpen(false); chooseBlog() }} onCreateBlog={() => { setSettingsOpen(false); setCreateBlogOpen(true) }} onSync={showPublish} onGitHub={showGitHub} onGitSetup={() => { setSettingsOpen(false); requestGitSetup(() => setSettingsOpen(true)) }} notify={notify} />}
      {toast && <div className={`toast ${toast.kind}`}>{toast.kind === 'success' && <Check size={17} />}{toast.message}</div>}
    </div>
  )
}
