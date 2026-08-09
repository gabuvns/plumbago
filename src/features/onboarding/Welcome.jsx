import { Check, FolderOpen, LoaderCircle, Plus, Sparkles } from 'lucide-react'
import { useI18n } from '../../i18n'

export function Welcome({ onChoose, onCreate, busy }) {
  const { t } = useI18n()
  return (
    <main className="welcome-shell">
      <div className="welcome-card">
        <div className="welcome-mark"><span>p</span></div>
        <p className="eyebrow">{t('welcome.eyebrow')}</p>
        <h1>{t('welcome.title')}</h1>
        <p className="welcome-copy">{t('welcome.copy')}</p>
        <div className="welcome-actions">
          <button className="button primary large" onClick={onChoose} disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={18} /> : <FolderOpen size={18} />}
            {t('welcome.choose')}
          </button>
          <button className="button quiet large" onClick={onCreate} disabled={busy}><Plus size={18} /> {t('welcome.create')}</button>
        </div>
        <div className="welcome-features">
          <span><Check size={15} /> {t('welcome.wsl')}</span>
          <span><Check size={15} /> {t('welcome.ownership')}</span>
          <span><Check size={15} /> {t('welcome.git')}</span>
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
        <div className="plumbago-flower"><i /><i /><i /><i /><i /><span>p</span></div>
      </div>
    </main>
  )
}
