import { AlertTriangle, LoaderCircle, Trash2 } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { useI18n } from '../../i18n'

export function DeletePostModal({ post, busy, onClose, onDelete }) {
  const { t } = useI18n()
  return (
    <Modal title={t('delete.title')} onClose={onClose} width="500px">
      <div className="delete-post-copy">
        <span><AlertTriangle size={22} /></span>
        <div>
          <h3>{t('delete.confirm', { title: post.title || t('posts.noTitle') })}</h3>
          <p>{t('delete.copy')}</p>
          {post.assets?.length > 0 && <small>{t('delete.assets', { count: post.assets.length })}</small>}
        </div>
      </div>
      <footer className="delete-post-actions">
        <button className="button quiet" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
        <button className="button danger" onClick={onDelete} disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <Trash2 size={16} />} {t('delete.action')}</button>
      </footer>
    </Modal>
  )
}
