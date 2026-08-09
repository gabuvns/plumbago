import { useEffect, useState } from 'react'
import { Check, Eye, ImagePlus, Images, LoaderCircle, Plus, Sparkles, UploadCloud } from 'lucide-react'
import { api } from '../../app/api'
import { Modal } from '../../components/ui/Modal'
import { useI18n } from '../../i18n'

export function ImageLibrary({ post, onClose, onAdd, onDrop, onInsert, onFeatured }) {
  const { t } = useI18n()
  const [assets, setAssets] = useState({})
  const [dragging, setDragging] = useState(false)
  const [selectedName, setSelectedName] = useState('')
  const [altText, setAltText] = useState('')
  const [caption, setCaption] = useState('')
  const [dimensions, setDimensions] = useState({})

  useEffect(() => {
    let cancelled = false
    Promise.all((post.assets || []).map(async (name) => [name, await api.readAssetInfo(post.id, name)]))
      .then((entries) => { if (!cancelled) setAssets(Object.fromEntries(entries)) })
      .catch(() => setAssets({}))
    return () => { cancelled = true }
  }, [post.assets, post.id])

  function drop(event) {
    event.preventDefault()
    setDragging(false)
    const files = Array.from(event.dataTransfer.files || [])
    if (files.length) onDrop(files)
  }

  function selectAsset(name) {
    setSelectedName(name)
    setAltText(pathToAlt(name))
    setCaption('')
  }

  function pathToAlt(name) {
    return name.replace(/\.[^.]+$/, '').replaceAll('-', ' ')
  }

  function fileSize(bytes) {
    if (!Number.isFinite(bytes)) return ''
    return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  function recordDimensions(name, image) {
    const value = `${image.naturalWidth} × ${image.naturalHeight}`
    setDimensions((current) => ({ ...current, [name]: value }))
  }

  return (
    <Modal title={t('images.title', { title: post.title })} onClose={onClose} width="780px">
      <div className="image-library-actions">
        <div><strong>{t(post.assets.length === 1 ? 'images.attached.one' : 'images.attached.other', { count: post.assets.length })}</strong><span>{t('images.location')}</span></div>
        <button className="button primary" onClick={onAdd}><ImagePlus size={16} /> {t('images.add')}</button>
      </div>
      <div
        className={`image-drop-zone compact ${dragging ? 'dragging' : ''}`}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false) }}
        onDrop={drop}
      >
        <UploadCloud size={20} /> {t('images.drop')}
      </div>
      {selectedName && assets[selectedName] && <section className="image-detail"><div className="image-detail-preview"><img src={assets[selectedName].dataUrl} alt={altText} onLoad={(event) => recordDimensions(selectedName, event.currentTarget)} /></div><div className="image-detail-fields"><div><strong>{selectedName}</strong><span>{[dimensions[selectedName], fileSize(assets[selectedName].size)].filter(Boolean).join(' · ')}</span></div><label>{t('images.altText')}<input value={altText} onChange={(event) => setAltText(event.target.value)} /></label><label>{t('images.caption')}<input value={caption} onChange={(event) => setCaption(event.target.value)} placeholder={t('images.captionPlaceholder')} /></label><footer><button className="button quiet" onClick={() => onFeatured(selectedName)}><Sparkles size={14} /> {t('images.useFeatured')}</button><button className="button primary" onClick={() => onInsert(selectedName, { alt: altText, caption })}><Plus size={14} /> {t('images.insert')}</button></footer></div></section>}
      {post.assets.length ? (
        <div className={`image-grid ${selectedName ? 'with-detail' : ''}`}>
          {post.assets.map((name) => (
            <article className={`image-card ${selectedName === name ? 'selected' : ''}`} key={name}>
              <button className="image-thumb" onClick={() => selectAsset(name)}>{assets[name] ? <img src={assets[name].dataUrl} alt={name} onLoad={(event) => recordDimensions(name, event.currentTarget)} /> : <LoaderCircle className="spin" size={20} />}</button>
              <div className="image-card-info"><strong title={name}>{name}</strong>{post.featuredImage === name && <span>{t('images.featured')}</span>}<small>{assets[name] ? fileSize(assets[name].size) : ''}</small></div>
              <div className="image-card-actions">
                <button className="button quiet" onClick={() => onFeatured(name)}>{post.featuredImage === name ? <Check size={14} /> : <Sparkles size={14} />} {post.featuredImage === name ? t('images.featured') : t('images.useFeatured')}</button>
                <button className="button primary" onClick={() => selectAsset(name)}><Eye size={14} /> {t('images.details')}</button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="image-empty"><Images size={34} /><h3>{t('images.emptyTitle')}</h3><p>{t('images.emptyCopy')}</p></div>
      )}
    </Modal>
  )
}
