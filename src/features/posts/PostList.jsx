import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { useI18n } from '../../i18n'
import { formatDate, formatDateTime } from '../../lib/dates'

export function PostList({ posts, activeId, onSelect, onNew }) {
  const { t, locale } = useI18n()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('todos')
  const visible = posts.filter((post) => {
    const scheduled = !post.draft && post.publishDate && new Date(post.publishDate) > new Date()
    const matchesQuery = `${post.title} ${post.description} ${(post.tags || []).join(' ')}`.toLowerCase().includes(query.toLowerCase())
    return matchesQuery && (filter === 'todos' || (filter === 'rascunhos' ? post.draft : filter === 'agendados' ? scheduled : !post.draft && !scheduled))
  })
  return (
    <section className="post-panel">
      <header className="panel-header"><div><p className="eyebrow">{t('posts.content')}</p><h2>{t('posts.title')} <span>{posts.length}</span></h2></div><button className="icon-button brand-action" onClick={onNew} title={t('posts.new')}><Plus size={20} /></button></header>
      <div className="search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('posts.search')} /></div>
      <div className="filters"><button className={filter === 'todos' ? 'active' : ''} onClick={() => setFilter('todos')}>{t('posts.all')}</button><button className={filter === 'publicados' ? 'active' : ''} onClick={() => setFilter('publicados')}>{t('posts.published')}</button><button className={filter === 'agendados' ? 'active' : ''} onClick={() => setFilter('agendados')}>{t('posts.scheduled')}</button><button className={filter === 'rascunhos' ? 'active' : ''} onClick={() => setFilter('rascunhos')}>{t('posts.drafts')}</button></div>
      <div className="post-list">
        {visible.map((post) => (
          <button key={post.id} className={`post-row ${post.id === activeId ? 'active' : ''}`} onClick={() => onSelect(post.id)}>
            <div className="post-row-top"><strong>{post.title || t('posts.noTitle')}</strong>{post.draft ? <span className="post-status draft">{t('posts.draft')}</span> : post.publishDate && new Date(post.publishDate) > new Date() ? <span className="post-status scheduled">{t('posts.scheduled')}</span> : <span className="post-status live">{t('posts.live')}</span>}</div>
            <p>{post.description || t('posts.noDescription')}</p>
            <div><span>{post.publishDate && new Date(post.publishDate) > new Date() ? formatDateTime(post.publishDate, locale, t) : formatDate(post.date, locale, t)}</span><span className="lang">{post.language}</span></div>
          </button>
        ))}
        {!visible.length && <div className="empty-list"><Search size={24} /><p>{t('posts.empty')}</p></div>}
      </div>
    </section>
  )
}
