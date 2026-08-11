import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Check, Eye, FileText, Globe2, LoaderCircle, Menu, PanelLeftClose, Plus, Rocket, UploadCloud } from 'lucide-react'
import { Sidebar } from '../components/layout/Sidebar'
import { CreateBlogModal } from '../features/blogs/CreateBlogModal'
import { Editor } from '../features/editor/Editor'
import { BloggerImportModal } from '../features/importing/BloggerImportModal'
import { HistoryModal } from '../features/history/HistoryModal'
import { MediaLibrary } from '../features/media/MediaLibrary'
import { Welcome } from '../features/onboarding/Welcome'
import { DeletePostModal } from '../features/posts/DeletePostModal'
import { NewPostModal } from '../features/posts/NewPostModal'
import { PostList } from '../features/posts/PostList'
import { GitHubSetupModal } from '../features/publishing/GitHubSetupModal'
import { DeploymentSetupModal } from '../features/publishing/DeploymentSetupModal'
import { PublishModal } from '../features/publishing/PublishModal'
import { PublishingHealthModal } from '../features/publishing/PublishingHealthModal'
import { ReviewModal } from '../features/review/ReviewModal'
import { SettingsModal } from '../features/settings/SettingsModal'
import { GitSetupModal } from '../features/setup/GitSetupModal'
import { HugoSetupModal } from '../features/setup/HugoSetupModal'
import { ThemeManagerModal } from '../features/themes/ThemeManagerModal'
import { useI18n } from '../i18n'
import { friendlyError } from '../lib/errors'
import { api, emptyContext } from './api'

function savedSnapshot(value) {
  return JSON.stringify(value?.repairedNestedFrontMatter ? { ...value, repairedNestedFrontMatter: false } : value)
}

export default function App() {
  const { t } = useI18n()
  const [context, setContext] = useState(emptyContext)
  const [ready, setReady] = useState(false)
  const [posts, setPosts] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [post, setPost] = useState(null)
  const [savedPost, setSavedPost] = useState(null)
  const [site, setSite] = useState(null)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [createBlogOpen, setCreateBlogOpen] = useState(false)
  const [newPostOpen, setNewPostOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [imagesOpen, setImagesOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [githubOpen, setGitHubOpen] = useState(false)
  const [deployOpen, setDeployOpen] = useState(false)
  const [healthOpen, setHealthOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [gitSetupOpen, setGitSetupOpen] = useState(false)
  const [hugoSetupOpen, setHugoSetupOpen] = useState(false)
  const [bloggerOpen, setBloggerOpen] = useState(false)
  const [themesOpen, setThemesOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [publishingStatus, setPublishingStatus] = useState(null)
  const [publishingReview, setPublishingReview] = useState(null)
  const [publishPhase, setPublishPhase] = useState('ready')
  const [publishError, setPublishError] = useState('')
  const [publishLog, setPublishLog] = useState([])
  const [toast, setToast] = useState(null)
  const savePromiseRef = useRef(null)
  const externalRefreshRef = useRef(false)
  const externalSignatureRef = useRef('')
  const pendingGitActionRef = useRef(null)
  const editorStateRef = useRef(null)
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
        revision: saved.revision,
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
      setSavedPost(savedSnapshot(loaded))
    } else {
      setActiveId(null)
      setPost(null)
      setSavedPost(null)
    }
  }, [activeId])

  const refreshSiteSettings = useCallback(async () => {
    const value = await api.siteSettings()
    setSite(value)
    return value
  }, [])

  useEffect(() => {
    api.getContext().then(async (value) => {
      if (value) {
        setContext(value)
        const [result] = await Promise.all([api.listPosts(), refreshSiteSettings()])
        setPosts(result)
        if (result[0]) {
          const loaded = await api.readPost(result[0].id)
          setActiveId(result[0].id)
          setPost(loaded)
          setSavedPost(savedSnapshot(loaded))
        }
      }
    }).catch((error) => notify(friendlyError(error, tRef.current), 'error')).finally(() => setReady(true))
  }, [notify, refreshSiteSettings])

  const dirty = Boolean(post && savedPost && JSON.stringify(post) !== savedPost)
  editorStateRef.current = { activeId, dirty, post, posts, saving }

  useEffect(() => {
    if (!dirty || saving || saveError || !post) return undefined
    const timer = setTimeout(() => performSave(post), 1200)
    return () => clearTimeout(timer)
  }, [dirty, performSave, post, saveError, saving])

  useEffect(() => {
    if (!context.root) return undefined
    externalSignatureRef.current = ''
    const checkForExternalPosts = async () => {
      if (externalRefreshRef.current) return
      externalRefreshRef.current = true
      try {
        const next = await api.listPosts()
        const signature = next.map((item) => `${item.id}:${item.revision || ''}`).join('|')
        if (signature === externalSignatureRef.current) return
        externalSignatureRef.current = signature

        const current = editorStateRef.current || {}
        const previousIds = new Set((current.posts || []).map((item) => item.id))
        const added = next.filter((item) => !previousIds.has(item.id))
        setPosts(next)
        if (added.length) notify(tRef.current(added.length === 1 ? 'notice.externalPost.one' : 'notice.externalPost.other', { count: added.length }))

        const activeSummary = next.find((item) => item.id === current.activeId)
        if (current.activeId && !activeSummary) {
          if (current.dirty || current.saving) {
            setSaveError(tRef.current('notice.externalDeletedDirty'))
          } else if (next[0]) {
            const loaded = await api.readPost(next[0].id)
            setActiveId(loaded.id)
            setPost(loaded)
            setSavedPost(savedSnapshot(loaded))
            notify(tRef.current('notice.externalDeleted'))
          } else {
            setActiveId(null)
            setPost(null)
            setSavedPost(null)
          }
        } else if (activeSummary && activeSummary.revision !== current.post?.revision && !current.dirty && !current.saving) {
          const loaded = await api.readPost(activeSummary.id)
          setPost(loaded)
          setSavedPost(savedSnapshot(loaded))
          notify(tRef.current('notice.externalUpdated'))
        }
      } catch {
        // Periodic refresh is best-effort; explicit actions still surface their errors.
      } finally {
        externalRefreshRef.current = false
      }
    }
    const timer = setInterval(checkForExternalPosts, 5000)
    return () => clearInterval(timer)
  }, [context.root, notify])

  async function chooseBlog() {
    setBusy(true)
    try {
      const value = await api.chooseBlog()
      if (value) {
        setContext(value)
        await Promise.all([refreshPosts(undefined, true), refreshSiteSettings()])
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
        await Promise.all([refreshPosts(undefined, true), refreshSiteSettings()])
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
      setSavedPost(savedSnapshot(loaded))
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

  async function requestDelete(target) {
    try {
      setDeleteTarget(target.id === post?.id ? post : await api.readPost(target.id))
    } catch (error) {
      notify(friendlyError(error, t), 'error')
    }
  }

  async function removePost() {
    if (!deleteTarget) return
    setBusy(true)
    try {
      await api.deletePost(deleteTarget.id)
      const remaining = posts.filter((item) => item.id !== deleteTarget.id)
      setPosts(remaining)
      if (activeId === deleteTarget.id) {
        if (remaining[0]) {
          const loaded = await api.readPost(remaining[0].id)
          setActiveId(loaded.id)
          setPost(loaded)
          setSavedPost(savedSnapshot(loaded))
        } else {
          setActiveId(null)
          setPost(null)
          setSavedPost(null)
        }
        setSaveError(null)
      }
      setDeleteTarget(null)
      notify(t('notice.postDeleted'))
    } catch (error) {
      notify(friendlyError(error, t), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function refreshContext() {
    try {
      const value = await api.getContext()
      if (value) setContext(value)
      return value
    } catch (error) {
      notify(friendlyError(error, t), 'error')
      return null
    }
  }

  function openPublicSite() {
    if (!site?.publicUrl) return
    api.openPublishingUrl(site.publicUrl).catch((error) => notify(friendlyError(error, t), 'error'))
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
    if (!post) return []
    try {
      const imported = await api.importImages(post.id)
      applyImportedImages(imported)
      return imported
    } catch (error) { notify(friendlyError(error, t), 'error') }
    return []
  }

  async function addDroppedImages(files) {
    if (!post) return []
    try {
      const imported = await api.importDroppedImages(post.id, files)
      applyImportedImages(imported)
      return imported
    } catch (error) { notify(friendlyError(error, t), 'error') }
    return []
  }

  async function prepareMediaMutation() {
    if (!post || !dirty) return true
    return performSave(post)
  }

  async function insertMedia(result) {
    if (!post || !result?.markdown) return false
    const current = await api.readPost(post.id)
    const body = current.body || ''
    const next = {
      ...current,
      body: `${body}${body && !body.endsWith('\n') ? '\n\n' : ''}${result.markdown}`,
      assets: result.copiedId
        ? [...new Set([...(current.assets || []), result.copiedId.split('/').at(-1)])]
        : current.assets,
    }
    setSaveError(null)
    setPost(next)
    return performSave(next)
  }

  async function setFeaturedMedia(name) {
    if (!post || !await prepareMediaMutation()) return false
    try {
      const current = await api.readPost(post.id)
      const next = { ...current, featuredImage: name }
      setSaveError(null)
      setPost(next)
      return performSave(next)
    } catch (error) {
      notify(friendlyError(error, t), 'error')
      return false
    }
  }

  async function refreshAfterMediaChange() {
    await refreshPosts(activeId, true)
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

  const finishHugoSetup = useCallback(async (providedContext = null) => {
    try {
      const nextContext = providedContext || await api.getContext()
      if (nextContext) {
        const rootChanged = nextContext.root !== context.root
        setContext(nextContext)
        if (rootChanged) await Promise.all([refreshPosts(undefined, true), refreshSiteSettings()])
      }
      setHugoSetupOpen(false)
    } catch (error) {
      notify(friendlyError(error, t), 'error')
    }
  }, [context.root, notify, refreshPosts, refreshSiteSettings, t])

  useEffect(() => {
    if (ready && context.root && !context.hugo) setHugoSetupOpen(true)
  }, [context.hugo, context.root, ready])

  useEffect(() => {
    if (!ready || !context.root || !context.hugo) return
    api.gitReadiness()
      .then((status) => { if (!status.ready) requestGitSetup() })
      .catch((error) => notify(friendlyError(error, t), 'error'))
  }, [context.hugo, context.root, notify, ready, requestGitSetup, t])

  function closeGitSetup() {
    pendingGitActionRef.current = null
    setGitSetupOpen(false)
  }

  async function openPublish() {
    try {
      const [status, review] = await Promise.all([api.publishingStatus(), api.siteReview()])
      setPublishingStatus(status)
      setPublishingReview(review)
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

  async function showDeploy() {
    if (dirty && !(await performSave(post))) return
    setSettingsOpen(false)
    setGitHubOpen(false)
    setDeployOpen(true)
  }

  async function publish(message) {
    try {
      const review = await api.siteReview()
      setPublishingReview(review)
      if (review.summary.errors > 0) {
        setPublishOpen(false)
        setReviewOpen(true)
        notify(t('review.notice.publishBlocked'), 'error')
        return
      }
    } catch (error) {
      notify(friendlyError(error, t), 'error')
      return
    }
    setBusy(true)
    setPublishPhase('publishing')
    setPublishError('')
    try {
      const result = await api.publishBlog(message)
      setPublishingStatus(result.status)
      if (result.status?.site) setSite(result.status.site)
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
    else if (action === 'hugo') setHugoSetupOpen(true)
    else setSettingsOpen(true)
  }

  async function handleBloggerImported(result) {
    await refreshPosts(result.posts[0]?.id, true)
    notify(t('notice.bloggerImported', { count: result.posts.length }))
  }

  async function handleHistoryPostRestored(restoredPost) {
    await refreshPosts(restoredPost.id, true)
  }

  async function handleHistorySiteRestored(preferredId) {
    const nextContext = await api.getContext()
    if (nextContext) setContext(nextContext)
    await Promise.all([refreshPosts(preferredId, true), refreshSiteSettings()])
  }

  async function showReview() {
    if (dirty && !(await performSave(post))) return
    setReviewOpen(true)
  }

  async function handleReviewChanged() {
    await Promise.all([refreshPosts(activeId, true), refreshSiteSettings()])
  }

  if (!ready) return <div className="app-loading"><div className="welcome-mark"><span>p</span></div><LoaderCircle className="spin" /></div>
  if (!context.root) return <><Welcome onChoose={chooseBlog} onCreate={() => setCreateBlogOpen(true)} busy={busy} />{createBlogOpen && <CreateBlogModal onClose={() => setCreateBlogOpen(false)} onCreate={createBlog} busy={busy} />}{toast && <div className={`toast ${toast.kind}`}>{toast.message}</div>}</>

  return (
    <div className="app-shell">
      <Sidebar context={context} onChooseBlog={chooseBlog} onImages={() => setImagesOpen(true)} onThemes={() => setThemesOpen(true)} onHistory={() => setHistoryOpen(true)} onReview={showReview} onHealth={() => setHealthOpen(true)} onImport={() => setBloggerOpen(true)} onSettings={() => setSettingsOpen(true)} />
      <PostList posts={posts} activeId={activeId} onSelect={selectPost} onNew={() => setNewPostOpen(true)} onDelete={requestDelete} />
      <main className="content-area">
        <header className="topbar">
          <button className="icon-button ghost"><PanelLeftClose size={19} /></button>
          <div className="breadcrumbs"><span>{context.root.split(/[\\/]/).filter(Boolean).at(-1)}</span><b>/</b><strong>{post?.title || t('posts.title')}</strong></div>
          <div className="topbar-actions"><button className="button quiet" onClick={() => api.openPreview().catch((error) => notify(friendlyError(error, t), 'error'))}><Eye size={17} /> {t('top.preview')} <ArrowUpRight size={14} /></button>{site?.publicUrl && <button className="button quiet" onClick={openPublicSite} title={t('top.publicProvider', { provider: t(`hosting.${site.hostingProvider}`) })}><Globe2 size={17} /> {t('top.publicSite')} <ArrowUpRight size={14} /></button>}<button className="button quiet" onClick={showDeploy}><Rocket size={17} /> {t('top.deploy')}</button><button className="button primary" onClick={showPublish}><UploadCloud size={17} /> {t('top.publish')}</button><button className="icon-button" onClick={() => setSettingsOpen(true)} title={t('top.openSettings')}><Menu size={18} /></button></div>
        </header>
        {post ? <Editor post={post} onChange={(change) => { setSaveError(null); setPost((current) => ({ ...current, ...change })) }} onSave={save} onOpenImages={() => setImagesOpen(true)} onDropImages={addDroppedImages} saveState={{ saving, dirty, error: saveError }} /> : <div className="empty-editor"><FileText size={34} /><h2>{t('empty.title')}</h2><p>{t('empty.copy')}</p><button className="button primary" onClick={() => setNewPostOpen(true)}><Plus size={17} /> {t('posts.new')}</button></div>}
      </main>
      {newPostOpen && <NewPostModal onClose={() => setNewPostOpen(false)} onCreate={create} busy={busy} />}
      {deleteTarget && <DeletePostModal post={deleteTarget} busy={busy} onClose={() => setDeleteTarget(null)} onDelete={removePost} />}
      {createBlogOpen && <CreateBlogModal onClose={() => setCreateBlogOpen(false)} onCreate={createBlog} busy={busy} />}
      {publishOpen && <PublishModal status={publishingStatus} review={publishingReview} busy={busy} phase={publishPhase} error={publishError} log={publishLog} onClose={() => setPublishOpen(false)} onPublish={publish} onReview={() => { setPublishOpen(false); setReviewOpen(true) }} onRefresh={refreshPublishingStatus} onSettings={showGitHub} />}
      {imagesOpen && <MediaLibrary post={post} onClose={() => setImagesOpen(false)} onAdd={addImages} onDrop={addDroppedImages} onInsert={insertMedia} onFeatured={setFeaturedMedia} onChanged={refreshAfterMediaChange} prepare={prepareMediaMutation} notify={notify} />}
      {themesOpen && <ThemeManagerModal context={context} onClose={() => setThemesOpen(false)} onInstall={installTheme} onDeactivate={deactivateTheme} onRefreshContext={refreshContext} onManageHugo={() => setHugoSetupOpen(true)} onSiteSettingsChanged={setSite} busy={busy} notify={notify} />}
      {githubOpen && <GitHubSetupModal context={context} onClose={() => { setGitHubOpen(false); refreshSiteSettings().catch(() => {}) }} onDeploy={showDeploy} notify={notify} />}
      {deployOpen && <DeploymentSetupModal context={context} onClose={() => { setDeployOpen(false); refreshSiteSettings().catch(() => {}) }} onGitHub={() => { setDeployOpen(false); setGitHubOpen(true) }} onSiteChanged={setSite} notify={notify} />}
      {historyOpen && <HistoryModal post={post} onClose={() => setHistoryOpen(false)} onPostRestored={handleHistoryPostRestored} onSiteRestored={handleHistorySiteRestored} notify={notify} />}
      {reviewOpen && <ReviewModal onClose={() => setReviewOpen(false)} onOpenPost={selectPost} onChanged={handleReviewChanged} notify={notify} />}
      {healthOpen && <PublishingHealthModal onClose={() => setHealthOpen(false)} onAction={handleHealthAction} notify={notify} />}
      {gitSetupOpen && <GitSetupModal onClose={closeGitSetup} onReady={finishGitSetup} notify={notify} />}
      {hugoSetupOpen && <HugoSetupModal onClose={() => setHugoSetupOpen(false)} onReady={finishHugoSetup} notify={notify} />}
      {bloggerOpen && <BloggerImportModal onClose={() => setBloggerOpen(false)} onImported={handleBloggerImported} notify={notify} />}
      {settingsOpen && <SettingsModal context={context} onClose={() => setSettingsOpen(false)} onChooseBlog={() => { setSettingsOpen(false); chooseBlog() }} onCreateBlog={() => { setSettingsOpen(false); setCreateBlogOpen(true) }} onSync={showPublish} onDeploy={showDeploy} onGitHub={showGitHub} onGitSetup={() => { setSettingsOpen(false); requestGitSetup(() => setSettingsOpen(true)) }} onHugoSetup={() => { setSettingsOpen(false); setHugoSetupOpen(true) }} onSiteSettingsChanged={setSite} notify={notify} />}
      {toast && <div className={`toast ${toast.kind}`}>{toast.kind === 'success' && <Check size={17} />}{toast.message}</div>}
    </div>
  )
}
