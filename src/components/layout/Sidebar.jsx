import { Activity, CalendarDays, Download, FileSearch, FileText, History, ImagePlus, MoreHorizontal, Palette, Settings } from 'lucide-react'
import { useI18n } from '../../i18n'

export function Sidebar({ context, onChooseBlog, onImages, onThemes, onHistory, onCalendar, onReview, onHealth, onImport, onSettings }) {
  const { t, locale } = useI18n()
  return (
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">p</div><div><strong>Plumbago</strong><span>Hugo UI manager</span></div></div>
      <nav>
        <button className="nav-item active" aria-label={t('sidebar.posts')} title={t('sidebar.posts')}><FileText size={18} /><span>{t('sidebar.posts')}</span><small>⌘ 1</small></button>
        <button className="nav-item" aria-label={t('sidebar.images')} title={t('sidebar.images')} onClick={onImages}><ImagePlus size={18} /><span>{t('sidebar.images')}</span></button>
        <button className="nav-item" aria-label={t('sidebar.themes')} title={t('sidebar.themes')} onClick={onThemes}><Palette size={18} /><span>{t('sidebar.themes')}</span>{context.theme && <small>✓</small>}</button>
        <button className="nav-item" aria-label={t('sidebar.history')} title={t('sidebar.history')} onClick={onHistory}><History size={18} /><span>{t('sidebar.history')}</span></button>
        <button className="nav-item" aria-label={t('sidebar.calendar')} title={t('sidebar.calendar')} onClick={onCalendar}><CalendarDays size={18} /><span>{t('sidebar.calendar')}</span></button>
        <button className="nav-item" aria-label={t('sidebar.review')} title={t('sidebar.review')} onClick={onReview}><FileSearch size={18} /><span>{t('sidebar.review')}</span></button>
        <button className="nav-item" aria-label={t('sidebar.publishing')} title={t('sidebar.publishing')} onClick={onHealth}><Activity size={18} /><span>{t('sidebar.publishing')}</span></button>
        <button className="nav-item" aria-label={t('sidebar.import')} title={t('sidebar.import')} onClick={onImport}><Download size={18} /><span>{t('sidebar.import')}</span></button>
      </nav>
      <div className="sidebar-spacer" />
      <div className="site-card">
        <div className="site-icon">H</div>
        <div><strong>{context.root.split(/[\\/]/).filter(Boolean).at(-1)}</strong><span>{context.runtime.kind === 'wsl' ? `WSL · ${context.runtime.distro}` : t('sidebar.localFolder')}</span></div>
        <button className="icon-button small" onClick={onChooseBlog} title={t('sidebar.changeBlog')}><MoreHorizontal size={17} /></button>
      </div>
      <button className="nav-item muted" aria-label={t('sidebar.settings')} title={t('sidebar.settings')} onClick={onSettings}><Settings size={18} /><span>{t('sidebar.settings')}</span><small>{locale === 'en-US' ? 'EN' : 'PT'}</small></button>
    </aside>
  )
}
