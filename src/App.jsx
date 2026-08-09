import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import {
  ArrowUpRight, Bold, Check, ChevronDown, Cloud, Code2, Eye, FileText, GitBranch,
  Heading2, ImagePlus, Italic, Link, List, LoaderCircle, Menu, MoreHorizontal,
  PanelLeftClose, Plus, Search, Settings, Sparkles, UploadCloud, X,
} from 'lucide-react'
import { createDemoBridge } from './demo'

const api = window.plum || createDemoBridge()
const emptyContext = { root: '', runtime: { kind: 'native' }, hugo: null, git: null }

function friendlyError(error) {
  return error?.message?.replace(/^Error invoking remote method '[^']+': Error: /, '') || 'Algo não saiu como esperado.'
}

function formatDate(value) {
  if (!value) return 'Sem data'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
}

function Welcome({ onChoose, busy }) {
  return (
    <main className="welcome-shell">
      <div className="welcome-card">
        <div className="welcome-mark"><span>p</span></div>
        <p className="eyebrow">PLUM · A HUGO UI MANAGER</p>
        <h1>Seu blog, sem a<br />linha de comando.</h1>
        <p className="welcome-copy">Escreva em Markdown, organize imagens e publique no Git — com o Hugo rodando onde seu blog já está.</p>
        <button className="button primary large" onClick={onChoose} disabled={busy}>
          {busy ? <LoaderCircle className="spin" size={18} /> : <FileText size={18} />}
          Escolher um blog Hugo
        </button>
        <div className="welcome-features">
          <span><Check size={15} /> Windows + WSL</span>
          <span><Check size={15} /> Seus arquivos continuam seus</span>
          <span><Check size={15} /> Git e GitHub</span>
        </div>
      </div>
      <div className="welcome-art" aria-hidden="true">
        <div className="orb orb-one" /><div className="orb orb-two" />
        <div className="paper paper-back" />
        <div className="paper paper-front">
          <div className="paper-bar" /><div className="paper-title" /><div className="paper-title short" />
          <div className="paper-image"><Sparkles size={44} /></div>
          <div className="paper-line" /><div className="paper-line short" /><div className="paper-line" />
        </div>
        <div className="plum-fruit"><span>p</span></div>
      </div>
    </main>
  )
}

function Modal({ title, onClose, children, width = '520px' }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal" style={{ width }}>
        <header><h2>{title}</h2><button className="icon-button" onClick={onClose}><X size={19} /></button></header>
        {children}
      </section>
    </div>
  )
}

function NewPostModal({ onClose, onCreate, busy }) {
  const [title, setTitle] = useState('')
  const [language, setLanguage] = useState('pt-br')
  return (
    <Modal title="Criar um novo post" onClose={onClose}>
      <form className="modal-form" onSubmit={(event) => { event.preventDefault(); onCreate({ title, language }) }}>
        <label>Título<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Uma ideia que vale compartilhar" /></label>
        <label>Idioma<select value={language} onChange={(event) => setLanguage(event.target.value)}><option value="pt-br">Português (Brasil)</option><option value="en-us">English (US)</option></select></label>
        <p className="form-hint">O Plum usará o Hugo para criar um page bundle com o Markdown e as imagens deste post.</p>
        <footer><button type="button" className="button quiet" onClick={onClose}>Cancelar</button><button className="button primary" disabled={!title.trim() || busy}>{busy && <LoaderCircle className="spin" size={16} />} Criar rascunho</button></footer>
      </form>
    </Modal>
  )
}

function SyncModal({ status, busy, onClose, onSync }) {
  const [message, setMessage] = useState(`Atualiza o blog em ${new Intl.DateTimeFormat('pt-BR').format(new Date())}`)
  return (
    <Modal title="Sincronizar com o Git" onClose={onClose}>
      <div className="sync-summary">
        <div><GitBranch size={18} /><span><small>Branch</small>{status?.branch || '—'}</span></div>
        <div><Cloud size={18} /><span><small>Destino</small>{status?.remote || 'Origin não configurado'}</span></div>
      </div>
      <div className="change-list">
        <div className="section-label"><span>ALTERAÇÕES LOCAIS</span><b>{status?.changes?.length || 0}</b></div>
        {status?.changes?.length ? status.changes.slice(0, 8).map((change) => <code key={change}>{change}</code>) : <p>Tudo já está sincronizado.</p>}
      </div>
      <form className="modal-form" onSubmit={(event) => { event.preventDefault(); onSync(message) }}>
        <label>Mensagem do commit<input value={message} onChange={(event) => setMessage(event.target.value)} /></label>
        <footer><button type="button" className="button quiet" onClick={onClose}>Agora não</button><button className="button primary" disabled={busy || !status?.remote}>{busy ? <LoaderCircle className="spin" size={16} /> : <UploadCloud size={16} />} Sincronizar agora</button></footer>
      </form>
    </Modal>
  )
}

function Sidebar({ context, onChooseBlog }) {
  return (
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">p</div><div><strong>Plum</strong><span>Hugo UI manager</span></div></div>
      <nav>
        <button className="nav-item active"><FileText size={18} /><span>Posts</span><small>⌘ 1</small></button>
        <button className="nav-item"><ImagePlus size={18} /><span>Imagens</span></button>
      </nav>
      <div className="sidebar-spacer" />
      <div className="site-card">
        <div className="site-icon">H</div>
        <div><strong>{context.root.split(/[\\/]/).filter(Boolean).at(-1)}</strong><span>{context.runtime.kind === 'wsl' ? `WSL · ${context.runtime.distro}` : 'Pasta local'}</span></div>
        <button className="icon-button small" onClick={onChooseBlog} title="Trocar de blog"><MoreHorizontal size={17} /></button>
      </div>
      <button className="nav-item muted"><Settings size={18} /><span>Configurações</span></button>
    </aside>
  )
}

function PostList({ posts, activeId, onSelect, onNew }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('todos')
  const visible = posts.filter((post) => {
    const matchesQuery = `${post.title} ${post.description}`.toLowerCase().includes(query.toLowerCase())
    return matchesQuery && (filter === 'todos' || (filter === 'rascunhos' ? post.draft : !post.draft))
  })
  return (
    <section className="post-panel">
      <header className="panel-header"><div><p className="eyebrow">CONTEÚDO</p><h2>Posts <span>{posts.length}</span></h2></div><button className="icon-button plum" onClick={onNew} title="Novo post"><Plus size={20} /></button></header>
      <div className="search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar posts..." /></div>
      <div className="filters"><button className={filter === 'todos' ? 'active' : ''} onClick={() => setFilter('todos')}>Todos</button><button className={filter === 'publicados' ? 'active' : ''} onClick={() => setFilter('publicados')}>Publicados</button><button className={filter === 'rascunhos' ? 'active' : ''} onClick={() => setFilter('rascunhos')}>Rascunhos</button></div>
      <div className="post-list">
        {visible.map((post) => (
          <button key={post.id} className={`post-row ${post.id === activeId ? 'active' : ''}`} onClick={() => onSelect(post.id)}>
            <div className="post-row-top"><strong>{post.title || 'Sem título'}</strong>{post.draft && <span className="draft-dot" title="Rascunho" />}</div>
            <p>{post.description || 'Sem descrição'}</p>
            <div><span>{formatDate(post.date)}</span><span className="lang">{post.language}</span></div>
          </button>
        ))}
        {!visible.length && <div className="empty-list"><Search size={24} /><p>Nenhum post encontrado.</p></div>}
      </div>
    </section>
  )
}

function MarkdownToolbar({ onFormat, onImages }) {
  return (
    <div className="markdown-toolbar">
      <button onClick={() => onFormat('**', '**', 'texto em negrito')} title="Negrito"><Bold size={16} /></button>
      <button onClick={() => onFormat('_', '_', 'texto em itálico')} title="Itálico"><Italic size={16} /></button>
      <span />
      <button onClick={() => onFormat('## ', '', 'Título')} title="Título"><Heading2 size={16} /></button>
      <button onClick={() => onFormat('- ', '', 'Item da lista')} title="Lista"><List size={16} /></button>
      <button onClick={() => onFormat('[', '](https://)', 'texto do link')} title="Link"><Link size={16} /></button>
      <button onClick={onImages} title="Adicionar imagens"><ImagePlus size={16} /></button>
      <span />
      <button onClick={() => onFormat('`', '`', 'código')} title="Código"><Code2 size={16} /></button>
    </div>
  )
}

function Editor({ post, onChange, onSave, onImages, saving }) {
  const [mode, setMode] = useState('split')
  const [assetMap, setAssetMap] = useState({})
  const textareaRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    Promise.all((post.assets || []).map(async (name) => [name, await api.readAsset(post.id, name)]))
      .then((entries) => { if (!cancelled) setAssetMap(Object.fromEntries(entries)) })
      .catch(() => setAssetMap({}))
    return () => { cancelled = true }
  }, [post.id, post.assets])

  const preview = useMemo(() => {
    let markdown = post.body || ''
    for (const [name, data] of Object.entries(assetMap)) markdown = markdown.replaceAll(`](${name})`, `](${data})`)
    return DOMPurify.sanitize(marked.parse(markdown, { breaks: true }))
  }, [assetMap, post.body])

  function format(before, after, fallback) {
    const textarea = textareaRef.current
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = post.body.slice(start, end) || fallback
    const value = `${post.body.slice(0, start)}${before}${selected}${after}${post.body.slice(end)}`
    onChange({ body: value })
    requestAnimationFrame(() => { textarea.focus(); textarea.setSelectionRange(start + before.length, start + before.length + selected.length) })
  }

  return (
    <section className="editor">
      <div className="editor-title-row">
        <input className="title-input" value={post.title} onChange={(event) => onChange({ title: event.target.value })} placeholder="Título do post" />
        <div className="save-state">{saving ? <><LoaderCircle className="spin" size={14} /> Salvando</> : <><Check size={14} /> Salvo localmente</>}</div>
      </div>
      <input className="description-input" value={post.description} onChange={(event) => onChange({ description: event.target.value })} placeholder="Uma descrição curta para buscadores e redes sociais..." />
      <div className="metadata-row">
        <label>Data<input type="date" value={post.date} onChange={(event) => onChange({ date: event.target.value })} /></label>
        <label>Tags<input value={post.tags.join(', ')} onChange={(event) => onChange({ tags: event.target.value.split(',').map((tag) => tag.trim()) })} placeholder="arte, processo" /></label>
        <label className="draft-toggle"><input type="checkbox" checked={!post.draft} onChange={(event) => onChange({ draft: !event.target.checked })} /><span /> Publicado</label>
      </div>
      <div className="editor-controls">
        <MarkdownToolbar onFormat={format} onImages={onImages} />
        <div className="view-toggle"><button className={mode === 'write' ? 'active' : ''} onClick={() => setMode('write')}>Escrever</button><button className={mode === 'split' ? 'active' : ''} onClick={() => setMode('split')}>Lado a lado</button><button className={mode === 'preview' ? 'active' : ''} onClick={() => setMode('preview')}>Preview</button></div>
      </div>
      <div className={`editor-workspace mode-${mode}`}>
        {mode !== 'preview' && <textarea ref={textareaRef} value={post.body || ''} onChange={(event) => onChange({ body: event.target.value })} placeholder="Comece a escrever em Markdown..." spellCheck="true" />}
        {mode !== 'write' && <article className="markdown-preview" dangerouslySetInnerHTML={{ __html: preview }} />}
      </div>
      <footer className="editor-footer"><span>Markdown</span><span>{post.body?.trim() ? post.body.trim().split(/\s+/).length : 0} palavras</span><button className="button primary compact" onClick={onSave} disabled={saving}><Check size={15} /> Salvar</button></footer>
    </section>
  )
}

export default function App() {
  const [context, setContext] = useState(emptyContext)
  const [ready, setReady] = useState(false)
  const [posts, setPosts] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [post, setPost] = useState(null)
  const [savedPost, setSavedPost] = useState(null)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newPostOpen, setNewPostOpen] = useState(false)
  const [syncOpen, setSyncOpen] = useState(false)
  const [gitStatus, setGitStatus] = useState(null)
  const [toast, setToast] = useState(null)

  const notify = useCallback((message, kind = 'success') => {
    setToast({ message, kind })
    setTimeout(() => setToast(null), 4200)
  }, [])

  const refreshPosts = useCallback(async (preferredId) => {
    const result = await api.listPosts()
    setPosts(result)
    const id = preferredId || activeId || result[0]?.id
    if (id) {
      const loaded = await api.readPost(id)
      setActiveId(id); setPost(loaded); setSavedPost(JSON.stringify(loaded))
    }
  }, [activeId])

  useEffect(() => {
    api.getContext().then(async (value) => {
      if (value) { setContext(value); const result = await api.listPosts(); setPosts(result); if (result[0]) { const loaded = await api.readPost(result[0].id); setActiveId(result[0].id); setPost(loaded); setSavedPost(JSON.stringify(loaded)) } }
    }).catch((error) => notify(friendlyError(error), 'error')).finally(() => setReady(true))
  }, [notify])

  async function chooseBlog() {
    setBusy(true)
    try {
      const value = await api.chooseBlog()
      if (value) { setContext(value); await refreshPosts(); notify('Blog conectado ao Plum.') }
    } catch (error) { notify(friendlyError(error), 'error') } finally { setBusy(false); setReady(true) }
  }

  async function selectPost(id) {
    if (post && JSON.stringify(post) !== savedPost && !window.confirm('Descartar as alterações não salvas deste post?')) return
    try { const loaded = await api.readPost(id); setActiveId(id); setPost(loaded); setSavedPost(JSON.stringify(loaded)) } catch (error) { notify(friendlyError(error), 'error') }
  }

  async function save() {
    if (!post) return
    setSaving(true)
    try { const saved = await api.savePost(post); setPost(saved); setSavedPost(JSON.stringify(saved)); await refreshPosts(saved.id); notify('Post salvo no blog.') } catch (error) { notify(friendlyError(error), 'error') } finally { setSaving(false) }
  }

  async function create(input) {
    setBusy(true)
    try { const created = await api.createPost(input); setNewPostOpen(false); await refreshPosts(created.id); notify('Rascunho criado pelo Hugo.') } catch (error) { notify(friendlyError(error), 'error') } finally { setBusy(false) }
  }

  async function addImages() {
    try {
      const imported = await api.importImages(post.id)
      if (imported.length) {
        const markdown = imported.map((item) => item.markdown).join('\n\n')
        setPost((current) => ({ ...current, body: `${current.body}${current.body.endsWith('\n') ? '' : '\n\n'}${markdown}`, assets: [...current.assets, ...imported.map((item) => item.name)] }))
        notify(`${imported.length} ${imported.length === 1 ? 'imagem adicionada' : 'imagens adicionadas'}.`)
      }
    } catch (error) { notify(friendlyError(error), 'error') }
  }

  async function showSync() {
    try { setGitStatus(await api.gitStatus()); setSyncOpen(true) } catch (error) { notify(friendlyError(error), 'error') }
  }

  async function sync(message) {
    setBusy(true)
    try { const result = await api.syncGit(message); setGitStatus(result.status); setSyncOpen(false); notify('Blog sincronizado com sucesso.') } catch (error) { notify(friendlyError(error), 'error') } finally { setBusy(false) }
  }

  if (!ready) return <div className="app-loading"><div className="welcome-mark"><span>p</span></div><LoaderCircle className="spin" /></div>
  if (!context.root) return <><Welcome onChoose={chooseBlog} busy={busy} />{toast && <div className={`toast ${toast.kind}`}>{toast.message}</div>}</>

  return (
    <div className="app-shell">
      <Sidebar context={context} onChooseBlog={chooseBlog} />
      <PostList posts={posts} activeId={activeId} onSelect={selectPost} onNew={() => setNewPostOpen(true)} />
      <main className="content-area">
        <header className="topbar">
          <button className="icon-button ghost"><PanelLeftClose size={19} /></button>
          <div className="breadcrumbs"><span>{context.root.split(/[\\/]/).filter(Boolean).at(-1)}</span><b>/</b><strong>{post?.title || 'Posts'}</strong></div>
          <div className="topbar-actions"><button className="button quiet" onClick={() => api.openPreview().catch((error) => notify(friendlyError(error), 'error'))}><Eye size={17} /> Ver site <ArrowUpRight size={14} /></button><button className="button primary" onClick={showSync}><UploadCloud size={17} /> Sincronizar</button><button className="icon-button"><Menu size={18} /></button></div>
        </header>
        {post ? <Editor post={post} onChange={(change) => setPost((current) => ({ ...current, ...change }))} onSave={save} onImages={addImages} saving={saving} /> : <div className="empty-editor"><FileText size={34} /><h2>Crie seu primeiro post</h2><p>O Hugo cuidará da estrutura; você só precisa começar a escrever.</p><button className="button primary" onClick={() => setNewPostOpen(true)}><Plus size={17} /> Novo post</button></div>}
      </main>
      {newPostOpen && <NewPostModal onClose={() => setNewPostOpen(false)} onCreate={create} busy={busy} />}
      {syncOpen && <SyncModal status={gitStatus} busy={busy} onClose={() => setSyncOpen(false)} onSync={sync} />}
      {toast && <div className={`toast ${toast.kind}`}>{toast.kind === 'success' && <Check size={17} />}{toast.message}</div>}
    </div>
  )
}
