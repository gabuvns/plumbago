import { useState } from 'react'
import { AlertCircle, Check, Download, FolderOpen, LoaderCircle } from 'lucide-react'
import { api } from '../../app/api'
import { Modal } from '../../components/ui/Modal'
import { useI18n } from '../../i18n'
import { friendlyError } from '../../lib/errors'

export function BloggerImportModal({ onClose, onImported, notify }) {
  const { t } = useI18n()
  const [inspection, setInspection] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [language, setLanguage] = useState('en-us')
  const [working, setWorking] = useState(false)
  const [result, setResult] = useState(null)

  async function chooseExport() {
    setWorking(true)
    try {
      const next = await api.chooseBloggerExport()
      if (next) {
        setInspection(next)
        setSelectedIds(new Set(next.posts.map((post) => post.id)))
        setResult(null)
      }
    } catch (error) { notify(friendlyError(error, t), 'error') } finally { setWorking(false) }
  }

  function toggle(id) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function importPosts() {
    setWorking(true)
    try {
      const imported = await api.importBloggerExport({ selectedIds: [...selectedIds], language })
      setResult(imported)
      await onImported(imported)
    } catch (error) { notify(friendlyError(error, t), 'error') } finally { setWorking(false) }
  }

  return (
    <Modal title={t('blogger.title')} onClose={onClose} width="780px">
      <div className="blogger-import">
        {!inspection && !result && <section className="blogger-start"><div><Download size={31} /></div><h3>{t('blogger.startTitle')}</h3><p>{t('blogger.startCopy')}</p><ol><li>{t('blogger.stepOne')}</li><li>{t('blogger.stepTwo')}</li><li>{t('blogger.stepThree')}</li></ol><button className="button primary large" onClick={chooseExport} disabled={working}>{working ? <LoaderCircle className="spin" size={17} /> : <FolderOpen size={17} />} {t('blogger.choose')}</button></section>}
        {inspection && !result && (
          <>
            <header className="blogger-summary"><div><strong>{inspection.posts.length}</strong><span>{t('blogger.postsFound')}</span></div><div><strong>{inspection.imageCount}</strong><span>{t('blogger.imagesFound')}</span></div><div><strong>{inspection.labels.length}</strong><span>{t('blogger.labelsFound')}</span></div><button className="button quiet" onClick={chooseExport}>{t('blogger.changeFile')}</button></header>
            <div className="blogger-toolbar"><label><input type="checkbox" checked={selectedIds.size === inspection.posts.length} onChange={(event) => setSelectedIds(event.target.checked ? new Set(inspection.posts.map((post) => post.id)) : new Set())} /> {t('blogger.selectAll')}</label><span>{t('blogger.selected', { count: selectedIds.size })}</span><label>{t('blogger.language')}<select value={language} onChange={(event) => setLanguage(event.target.value)}><option value="en-us">English (US)</option><option value="pt-br">Português (Brasil)</option></select></label></div>
            <div className="blogger-posts">
              {inspection.posts.map((item) => <label className={selectedIds.has(item.id) ? 'selected' : ''} key={item.id}><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggle(item.id)} /><div><strong>{item.title}</strong><span>{item.date || t('posts.noDate')} · {item.draft ? t('posts.draft') : t('posts.published')}</span><small>{item.labels.join(', ') || t('blogger.noLabels')}{item.imageCount ? ` · ${t('blogger.imagesCount', { count: item.imageCount })}` : ''}</small></div></label>)}
            </div>
            <footer className="blogger-footer"><p>{t('blogger.importHint')}</p><button className="button quiet" onClick={onClose}>{t('common.cancel')}</button><button className="button primary" onClick={importPosts} disabled={working || !selectedIds.size}>{working ? <LoaderCircle className="spin" size={16} /> : <Download size={16} />} {t('blogger.importSelected', { count: selectedIds.size })}</button></footer>
          </>
        )}
        {result && <section className="blogger-result"><div><Check size={28} /></div><h3>{t('blogger.completeTitle')}</h3><p>{t('blogger.completeCopy', { posts: result.posts.length, images: result.importedImages })}</p>{result.failures.length > 0 && <div className="blogger-failures"><AlertCircle size={17} /> {t('blogger.failures', { count: result.failures.length })}</div>}<button className="button primary large" onClick={onClose}>{t('blogger.viewPosts')}</button></section>}
      </div>
    </Modal>
  )
}
