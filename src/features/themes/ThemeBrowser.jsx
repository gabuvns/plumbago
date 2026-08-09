import { useEffect, useState } from 'react'
import { AlertCircle, ArrowUpRight, Check, LoaderCircle, Palette, Search } from 'lucide-react'
import { api } from '../../app/api'
import { useI18n } from '../../i18n'
import { friendlyError } from '../../lib/errors'

export function ThemeBrowser({ selected, onSelect, allowNone = true }) {
  const { t } = useI18n()
  const [themes, setThemes] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    api.listThemes()
      .then((items) => { if (!cancelled) setThemes(items) })
      .catch((reason) => { if (!cancelled) setError(friendlyError(reason, t)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [t])

  const matches = themes.filter((theme) => `${theme.name} ${theme.slug}`.toLowerCase().includes(query.toLowerCase())).slice(0, 60)
  return (
    <div className="theme-browser">
      <div className={`theme-browser-toolbar ${allowNone ? '' : 'without-none'}`}>
        <div className="search theme-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('themes.search')} /></div>
        {allowNone && <button type="button" className={`theme-none ${selected ? '' : 'selected'}`} onClick={() => onSelect('')}><span><Palette size={17} /></span><strong>{t('themes.none')}</strong><small>{t('themes.noneCopy')}</small></button>}
      </div>
      {loading && <div className="themes-state"><LoaderCircle className="spin" size={22} /> {t('themes.loading')}</div>}
      {error && <div className="themes-state error"><AlertCircle size={21} /> {error}</div>}
      {!loading && !error && (
        <div className="theme-grid">
          {matches.map((theme) => (
            <article className={`theme-card ${selected === theme.slug ? 'selected' : ''}`} key={theme.slug}>
              <button type="button" className="theme-select" onClick={() => onSelect(theme.slug)} aria-pressed={selected === theme.slug}>
                <span className="theme-preview"><img src={theme.image} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none' }} />{selected === theme.slug && <b><Check size={14} /></b>}</span>
                <span className="theme-card-copy"><strong>{theme.name}</strong><small>{theme.slug}</small></span>
              </button>
              <button type="button" className="theme-details" onClick={() => api.openTheme(theme.slug)} title={t('themes.details')}><ArrowUpRight size={14} /></button>
            </article>
          ))}
          {!matches.length && <div className="themes-state"><Search size={21} /> {t('themes.empty')}</div>}
        </div>
      )}
      <p className="theme-source">{t('themes.source')}</p>
    </div>
  )
}
