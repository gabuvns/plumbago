import { createElement, useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArchiveRestore, Check, Clock3, FileClock, FileText, History, LoaderCircle, Plus, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react'
import { api } from '../../app/api'
import { Modal } from '../../components/ui/Modal'
import { useI18n } from '../../i18n'
import { friendlyError } from '../../lib/errors'

const tabs = ['post', 'site', 'recovery', 'trash']

export function HistoryModal({ post, onClose, onPostRestored, onSiteRestored, notify }) {
  const { t, locale } = useI18n()
  const [tab, setTab] = useState(post ? 'post' : 'site')
  const [siteHistory, setSiteHistory] = useState(null)
  const [postHistory, setPostHistory] = useState(null)
  const [recoveryPoints, setRecoveryPoints] = useState([])
  const [trash, setTrash] = useState([])
  const [selectedRevision, setSelectedRevision] = useState(null)
  const [comparison, setComparison] = useState(null)
  const [manualLabel, setManualLabel] = useState('')
  const [confirmAction, setConfirmAction] = useState('')
  const [working, setWorking] = useState('load')

  const formatDate = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }), [locale])
  const date = (value) => {
    const parsed = new Date(value)
    return Number.isNaN(parsed.valueOf()) ? t('history.unknownDate') : formatDate.format(parsed)
  }

  const load = useCallback(async () => {
    setWorking('load')
    try {
      const [nextSite, nextPost, nextRecovery, nextTrash] = await Promise.all([
        api.siteHistory(),
        post ? api.postHistory(post.id) : Promise.resolve(null),
        api.listRecoveryPoints(),
        api.listTrash(),
      ])
      setSiteHistory(nextSite)
      setPostHistory(nextPost)
      setRecoveryPoints(nextRecovery)
      setTrash(nextTrash)
      setSelectedRevision((current) => current && nextPost?.revisions.some((revision) => revision.hash === current.hash) ? current : nextPost?.revisions[0] || null)
    } catch (error) {
      notify(friendlyError(error, t), 'error')
    } finally {
      setWorking('')
    }
  }, [notify, post, t])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!post || !selectedRevision) { setComparison(null); return undefined }
    let active = true
    setWorking('compare')
    api.comparePostRevision(post.id, selectedRevision.hash)
      .then((result) => { if (active) setComparison(result) })
      .catch((error) => notify(friendlyError(error, t), 'error'))
      .finally(() => { if (active) setWorking('') })
    return () => { active = false }
  }, [notify, post, selectedRevision, t])

  async function restoreRevision() {
    if (!selectedRevision || !post) return
    const action = `revision:${selectedRevision.hash}`
    if (confirmAction !== action) { setConfirmAction(action); return }
    setWorking(action)
    try {
      const result = await api.restorePostRevision(post.id, selectedRevision.hash)
      await onPostRestored(result.post)
      setConfirmAction('')
      notify(t('history.notice.postRestored'))
      await load()
    } catch (error) { notify(friendlyError(error, t), 'error') } finally { setWorking('') }
  }

  async function createRecovery() {
    setWorking('create-recovery')
    try {
      await api.createRecoveryPoint(manualLabel.trim() || t('history.recovery.manualLabel'))
      setManualLabel('')
      notify(t('history.notice.recoveryCreated'))
      await load()
    } catch (error) { notify(friendlyError(error, t), 'error') } finally { setWorking('') }
  }

  async function restoreRecovery(point) {
    const action = `recovery:${point.id}`
    if (confirmAction !== action) { setConfirmAction(action); return }
    setWorking(action)
    try {
      await api.restoreRecoveryPoint(point.id)
      await onSiteRestored()
      setConfirmAction('')
      notify(t('history.notice.siteRestored'))
      await load()
    } catch (error) { notify(friendlyError(error, t), 'error') } finally { setWorking('') }
  }

  async function restoreTrash(item) {
    setWorking(`trash-restore:${item.id}`)
    try {
      const restored = await api.restoreTrashItem(item.id)
      await onSiteRestored(restored.postId)
      notify(t('history.notice.trashRestored'))
      await load()
    } catch (error) { notify(friendlyError(error, t), 'error') } finally { setWorking('') }
  }

  async function permanentlyDelete(item) {
    const action = `trash-delete:${item.id}`
    if (confirmAction !== action) { setConfirmAction(action); return }
    setWorking(action)
    try {
      await api.deleteTrashItem(item.id)
      setConfirmAction('')
      notify(t('history.notice.trashDeleted'))
      await load()
    } catch (error) { notify(friendlyError(error, t), 'error') } finally { setWorking('') }
  }

  const busy = Boolean(working)
  return (
    <Modal title={t('history.title')} onClose={onClose} width="920px">
      <div className="history-manager">
        <header className="history-intro"><span><History size={22} /></span><div><h3>{t('history.hero')}</h3><p>{t('history.copy')}</p></div><small><ShieldCheck size={14} /> {t('history.local')}</small></header>
        <nav className="history-tabs">
          {tabs.map((name) => <button key={name} className={tab === name ? 'active' : ''} onClick={() => setTab(name)} disabled={name === 'post' && !post}>{name === 'post' ? <FileText size={15} /> : name === 'site' ? <Clock3 size={15} /> : name === 'recovery' ? <ArchiveRestore size={15} /> : <Trash2 size={15} />}{t(`history.tab.${name}`)}{name === 'trash' && trash.length > 0 && <small>{trash.length}</small>}</button>)}
        </nav>

        {working === 'load' && <div className="history-loading"><LoaderCircle className="spin" size={22} /> {t('history.loading')}</div>}

        {working !== 'load' && tab === 'post' && postHistory && (
          <div className="history-post-layout">
            <aside>
              <div><strong>{post?.title}</strong><small>{t('history.post.savedCount', { count: postHistory.revisions.length })}</small></div>
              {postHistory.currentChanged && <p className="history-local-change"><FileClock size={14} /> {t('history.post.localChanges')}</p>}
              <div className="history-revision-list">{postHistory.revisions.map((revision, index) => <button key={revision.hash} className={selectedRevision?.hash === revision.hash ? 'active' : ''} onClick={() => { setSelectedRevision(revision); setConfirmAction('') }}><span>{index === 0 ? t('history.post.latest') : date(revision.createdAt)}</span><strong>{revision.subject || t('history.post.savedVersion')}</strong><small>{revision.author}</small></button>)}</div>
            </aside>
            <section className="history-comparison">
              {!selectedRevision && <Empty icon={FileClock} title={t('history.post.empty')} copy={t('history.post.emptyCopy')} />}
              {selectedRevision && <><header><div><strong>{t('history.post.compareTitle')}</strong><span>{date(selectedRevision.createdAt)} · {selectedRevision.author}</span></div><button className={confirmAction === `revision:${selectedRevision.hash}` ? 'button danger' : 'button quiet'} onClick={restoreRevision} disabled={busy}>{working === `revision:${selectedRevision.hash}` ? <LoaderCircle className="spin" size={15} /> : <RotateCcw size={15} />} {confirmAction === `revision:${selectedRevision.hash}` ? t('history.confirmRestore') : t('history.post.restore')}</button></header>{confirmAction === `revision:${selectedRevision.hash}` && <p className="history-confirm"><AlertTriangle size={15} /> {t('history.post.restoreCopy')}</p>}<div className="history-diff">{working === 'compare' && <LoaderCircle className="spin" size={20} />}{comparison?.changes.map((change, index) => <pre key={`${index}-${change.type}`} className={change.type}>{change.value}</pre>)}</div></>}
            </section>
          </div>
        )}

        {working !== 'load' && tab === 'site' && siteHistory && (
          <section className="site-history-panel">
            {siteHistory.hasLocalChanges && <div className="history-current-banner"><FileClock size={18} /><div><strong>{t('history.site.localTitle')}</strong><span>{t('history.site.localCopy', { count: siteHistory.localChangeCount })}</span></div></div>}
            {siteHistory.entries.length === 0 ? <Empty icon={Clock3} title={t('history.site.empty')} copy={t('history.site.emptyCopy')} /> : <div className="site-history-list">{siteHistory.entries.map((entry) => <article key={entry.hash}><span className={`history-kind ${entry.kind}`}>{t(`history.kind.${entry.kind}`)}</span><div><strong>{entry.subject || t('history.site.savedChange')}</strong><small>{date(entry.createdAt)} · {entry.author}</small><p>{t('history.site.fileCount', { count: entry.files.length })}</p></div></article>)}</div>}
          </section>
        )}

        {working !== 'load' && tab === 'recovery' && (
          <section className="recovery-panel">
            <div className="manual-recovery"><div><ShieldCheck size={19} /><div><strong>{t('history.recovery.createTitle')}</strong><p>{t('history.recovery.createCopy')}</p></div></div><div><input value={manualLabel} onChange={(event) => setManualLabel(event.target.value)} placeholder={t('history.recovery.labelPlaceholder')} /><button className="button primary" onClick={createRecovery} disabled={busy}>{working === 'create-recovery' ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />} {t('history.recovery.create')}</button></div></div>
            {recoveryPoints.length === 0 ? <Empty icon={ArchiveRestore} title={t('history.recovery.empty')} copy={t('history.recovery.emptyCopy')} /> : <div className="recovery-list">{recoveryPoints.map((point) => <article key={point.id}><span><ArchiveRestore size={18} /></span><div><strong>{point.label || t(`history.recovery.reason.${point.reason}`)}</strong><small>{date(point.createdAt)} · {t('history.recovery.itemCount', { count: point.targets.length })}</small></div><button className={confirmAction === `recovery:${point.id}` ? 'button danger' : 'button quiet'} onClick={() => restoreRecovery(point)} disabled={busy}>{working === `recovery:${point.id}` ? <LoaderCircle className="spin" size={15} /> : <RotateCcw size={15} />} {confirmAction === `recovery:${point.id}` ? t('history.confirmRestore') : t('history.recovery.restore')}</button></article>)}</div>}
          </section>
        )}

        {working !== 'load' && tab === 'trash' && (
          <section className="trash-panel">
            {trash.length === 0 ? <Empty icon={Trash2} title={t('history.trash.empty')} copy={t('history.trash.emptyCopy')} /> : <div className="trash-list">{trash.map((item) => <article key={item.id}><span><Trash2 size={18} /></span><div><strong>{item.title}</strong><small>{date(item.deletedAt)} · {t('history.trash.assetCount', { count: item.assetCount })}</small><code>{item.postId}</code></div><div><button className="button quiet" onClick={() => restoreTrash(item)} disabled={busy}>{working === `trash-restore:${item.id}` ? <LoaderCircle className="spin" size={15} /> : <ArchiveRestore size={15} />} {t('history.trash.restore')}</button><button className={confirmAction === `trash-delete:${item.id}` ? 'button danger' : 'icon-button'} onClick={() => permanentlyDelete(item)} disabled={busy} title={t('history.trash.delete')}>{working === `trash-delete:${item.id}` ? <LoaderCircle className="spin" size={15} /> : confirmAction === `trash-delete:${item.id}` ? <><Trash2 size={14} /> {t('history.trash.confirmDelete')}</> : <Trash2 size={15} />}</button></div></article>)}</div>}
          </section>
        )}
        <footer className="history-footer"><small><Check size={13} /> {t('history.footer')}</small><button className="button quiet" onClick={onClose}>{t('common.close')}</button></footer>
      </div>
    </Modal>
  )
}

function Empty({ icon, title, copy }) {
  return <div className="history-empty">{createElement(icon, { size: 28 })}<strong>{title}</strong><p>{copy}</p></div>
}
