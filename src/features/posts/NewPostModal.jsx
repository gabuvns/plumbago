import { useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { useI18n } from '../../i18n'

export function NewPostModal({ onClose, onCreate, busy }) {
  const { t } = useI18n()
  const [title, setTitle] = useState('')
  const [language, setLanguage] = useState('pt-br')
  return (
    <Modal title={t('new.title')} onClose={onClose}>
      <form className="modal-form" onSubmit={(event) => { event.preventDefault(); onCreate({ title, language }) }}>
        <label>{t('new.fieldTitle')}<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t('new.placeholder')} /></label>
        <label>{t('new.language')}<select value={language} onChange={(event) => setLanguage(event.target.value)}><option value="en-us">English (US)</option><option value="pt-br">Português (Brasil)</option></select></label>
        <p className="form-hint">{t('new.hint')}</p>
        <footer><button type="button" className="button quiet" onClick={onClose}>{t('common.cancel')}</button><button className="button primary" disabled={!title.trim() || busy}>{busy && <LoaderCircle className="spin" size={16} />} {t('new.create')}</button></footer>
      </form>
    </Modal>
  )
}
