import { useState } from 'react'
import { FolderOpen, LoaderCircle, Sparkles } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { useI18n } from '../../i18n'
import { ThemeBrowser } from '../themes/ThemeBrowser'

export function CreateBlogModal({ onClose, onCreate, busy }) {
  const { t } = useI18n()
  const [title, setTitle] = useState('')
  const [folder, setFolder] = useState('')
  const [folderEdited, setFolderEdited] = useState(false)
  const [languageCode, setLanguageCode] = useState('en-US')
  const [theme, setTheme] = useState('')

  function changeTitle(value) {
    setTitle(value)
    if (!folderEdited) setFolder(value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
  }

  return (
    <Modal title={t('createBlog.title')} onClose={onClose} width="920px">
      <form className="create-blog-form" onSubmit={(event) => { event.preventDefault(); onCreate({ title, folder, languageCode, theme }) }}>
        <div className="create-blog-fields">
          <label>{t('createBlog.siteTitle')}<input autoFocus value={title} onChange={(event) => changeTitle(event.target.value)} placeholder={t('createBlog.siteTitlePlaceholder')} /></label>
          <label>{t('createBlog.folder')}<input value={folder} onChange={(event) => { setFolderEdited(true); setFolder(event.target.value) }} placeholder="my-hugo-blog" /></label>
          <label>{t('createBlog.language')}<select value={languageCode} onChange={(event) => setLanguageCode(event.target.value)}><option value="en-US">English (US)</option><option value="pt-BR">Português (Brasil)</option></select></label>
        </div>
        <div className="create-blog-theme"><div><h3>{t('createBlog.theme')}</h3><p>{t('createBlog.themeCopy')}</p></div><ThemeBrowser selected={theme} onSelect={setTheme} /></div>
        <footer className="create-blog-footer"><p><FolderOpen size={15} /> {t('createBlog.destinationHint')}</p><button type="button" className="button quiet" onClick={onClose}>{t('common.cancel')}</button><button className="button primary" disabled={busy || !title.trim() || !folder.trim()}>{busy ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />} {t('createBlog.create')}</button></footer>
      </form>
    </Modal>
  )
}
