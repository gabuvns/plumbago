import { Activity, Download, FileText, ImagePlus, MoreHorizontal, Palette, Settings } from 'lucide-react'
import { useI18n } from '../../i18n'

export function Sidebar({ context, onChooseBlog, onImages, onThemes, onHealth, onImport, onSettings }) {
  const { t, locale } = useI18n()
  return (
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">p</div><div><strong>Plumbago</strong><span>Hugo UI manager</span></div></div>
      <nav>
        <button className="nav-item active"><FileText size={18} /><span>{t('sidebar.posts')}</span><small>⌘ 1</small></button>
        <button className="nav-item" onClick={onImages}><ImagePlus size={18} /><span>{t('sidebar.images')}</span></button>
        <button className="nav-item" onClick={onThemes}><Palette size={18} /><span>{t('sidebar.themes')}</span>{context.theme && <small>✓</small>}</button>
        <button className="nav-item" onClick={onHealth}><Activity size={18} /><span>{t('sidebar.publishing')}</span></button>
        <button className="nav-item" onClick={onImport}><Download size={18} /><span>{t('sidebar.import')}</span></button>
      </nav>
      <div className="sidebar-spacer" />
      <div className="site-card">
        <div className="site-icon">H</div>
        <div><strong>{context.root.split(/[\\/]/).filter(Boolean).at(-1)}</strong><span>{context.runtime.kind === 'wsl' ? `WSL · ${context.runtime.distro}` : t('sidebar.localFolder')}</span></div>
        <button className="icon-button small" onClick={onChooseBlog} title={t('sidebar.changeBlog')}><MoreHorizontal size={17} /></button>
      </div>
      <button className="nav-item muted" onClick={onSettings}><Settings size={18} /><span>{t('sidebar.settings')}</span><small>{locale === 'en-US' ? 'EN' : 'PT'}</small></button>
    </aside>
  )
}
