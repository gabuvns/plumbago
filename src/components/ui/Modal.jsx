import { X } from 'lucide-react'
import { useI18n } from '../../i18n'

export function Modal({ title, onClose, children, width = '520px' }) {
  const { t } = useI18n()
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal" style={{ width }}>
        <header>
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} title={t('common.close')}><X size={19} /></button>
        </header>
        {children}
      </section>
    </div>
  )
}
