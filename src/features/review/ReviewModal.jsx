import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowRight, Check, CheckCircle2, FileSearch, FileText, Info, Lightbulb, ListChecks, LoaderCircle, RefreshCw, ShieldCheck, Sparkles, TriangleAlert, Wrench } from 'lucide-react'
import { api } from '../../app/api'
import { Modal } from '../../components/ui/Modal'
import { useI18n } from '../../i18n'
import { friendlyError } from '../../lib/errors'

const emptyReview = { findings: [], summary: { total: 0, errors: 0, warnings: 0, recommendations: 0, fixable: 0, postsChecked: 0, ready: false, score: 0 }, checkedAt: '' }
const filters = ['all', 'error', 'warning', 'recommendation', 'fixable']

export function ReviewModal({ onClose, onOpenPost, onChanged, notify }) {
  const { t, locale } = useI18n()
  const [review, setReview] = useState(emptyReview)
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try { setReview(await api.siteReview()) } catch (error) { notify(friendlyError(error, t), 'error') } finally { setLoading(false) }
  }, [notify, t])

  useEffect(() => { load() }, [load])
  const visible = useMemo(() => review.findings.filter((finding) => {
    if (filter === 'all') return true
    if (filter === 'fixable') return Boolean(finding.fix)
    return finding.severity === filter
  }), [filter, review.findings])

  async function applyFix(finding, value) {
    setWorking(finding.id)
    try {
      await api.applyReviewFix({ findingId: finding.id, value })
      notify(t('review.notice.fixed'))
      await onChanged(finding.postId)
      await load()
    } catch (error) { notify(friendlyError(error, t), 'error') } finally { setWorking('') }
  }

  function openPost(id) {
    if (!id) return
    onOpenPost(id)
    onClose()
  }

  const state = review.summary.errors > 0 ? 'error' : review.summary.warnings > 0 ? 'warning' : 'ready'
  return (
    <Modal title={t('review.title')} onClose={onClose} width="960px">
      <div className="review-workspace">
        <header className={`review-hero ${state}`}>
          <span><ListChecks size={23} /></span>
          <div><h3>{t(`review.hero.${state}`)}</h3><p>{t(`review.hero.${state}Copy`)}</p><small><ShieldCheck size={13} /> {t('review.deterministic')}</small></div>
          <div className="review-score"><strong>{review.summary.score}</strong><span>{t('review.score')}</span></div>
          <button className="button quiet" onClick={load} disabled={loading || Boolean(working)}><RefreshCw className={loading ? 'spin' : ''} size={14} /> {t('review.runAgain')}</button>
        </header>
        <div className="review-summary">
          <Summary icon={<FileSearch size={16} />} value={review.summary.postsChecked} label={t('review.summary.posts')} />
          <Summary tone="error" icon={<AlertCircle size={16} />} value={review.summary.errors} label={t('review.summary.errors')} />
          <Summary tone="warning" icon={<TriangleAlert size={16} />} value={review.summary.warnings} label={t('review.summary.warnings')} />
          <Summary tone="recommendation" icon={<Lightbulb size={16} />} value={review.summary.recommendations} label={t('review.summary.recommendations')} />
          <Summary tone="fix" icon={<Wrench size={16} />} value={review.summary.fixable} label={t('review.summary.safeFixes')} />
        </div>
        <nav className="review-filters">{filters.map((name) => <button key={name} className={filter === name ? 'active' : ''} onClick={() => setFilter(name)}>{t(`review.filter.${name}`)}<small>{countFor(review, name)}</small></button>)}</nav>
        <main className="review-results">
          {loading && <div className="review-empty"><LoaderCircle className="spin" size={28} /><strong>{t('review.loading')}</strong><span>{t('review.loadingCopy')}</span></div>}
          {!loading && visible.length === 0 && <div className="review-empty success"><CheckCircle2 size={31} /><strong>{t(filter === 'all' ? 'review.clean' : 'review.filterEmpty')}</strong><span>{t(filter === 'all' ? 'review.cleanCopy' : 'review.filterEmptyCopy')}</span></div>}
          {!loading && visible.map((finding) => <FindingCard key={finding.id} finding={finding} locale={locale} working={working === finding.id} onApply={applyFix} onOpenPost={openPost} t={t} />)}
        </main>
        <footer className="review-footer"><small><Info size={13} /> {review.checkedAt ? t('review.checkedAt', { date: new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(review.checkedAt)) }) : t('review.notChecked')}</small><button className="button quiet" onClick={onClose}>{t('common.close')}</button></footer>
      </div>
    </Modal>
  )
}

function Summary({ icon, value, label, tone = '' }) {
  return <div className={tone}><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div></div>
}

function countFor(review, filter) {
  if (filter === 'all') return review.summary.total
  if (filter === 'fixable') return review.summary.fixable
  return review.summary[filter === 'error' ? 'errors' : filter === 'warning' ? 'warnings' : 'recommendations']
}

function FindingCard({ finding, working, onApply, onOpenPost, t }) {
  const [value, setValue] = useState('')
  const [confirming, setConfirming] = useState(false)
  useEffect(() => { setValue(''); setConfirming(false) }, [finding.id])
  const icon = finding.severity === 'error' ? <AlertCircle size={17} /> : finding.severity === 'warning' ? <TriangleAlert size={17} /> : <Lightbulb size={17} />
  const after = finding.fix?.kind === 'exact' ? finding.fix.after : value.trim()
  return <article className={`review-finding ${finding.severity}`}>
    <span className="review-finding-icon">{icon}</span>
    <div className="review-finding-content">
      <header><div><strong>{t(`review.rule.${finding.rule}.title`, finding.values)}</strong><p>{t(`review.rule.${finding.rule}.copy`, finding.values)}</p></div><b>{t(`review.severity.${finding.severity}`)}</b></header>
      {(finding.postTitle || finding.path) && <div className="review-location"><FileText size={13} /><span>{finding.postTitle || t('review.siteOutput')}</span>{finding.path && <code>{finding.path}</code>}</div>}
      {finding.detail && <details><summary>{t('review.technicalDetails')}</summary><code>{finding.detail}</code></details>}
      {finding.fix && <div className="review-fix">
        <div><Sparkles size={14} /><span><strong>{t('review.safeFix')}</strong><small>{t('review.safeFixCopy')}</small></span></div>
        {finding.fix.kind === 'text' && <label>{t(`review.fix.${finding.fix.field}`)}<input value={value} onChange={(event) => { setValue(event.target.value); setConfirming(false) }} placeholder={t(finding.fix.placeholder)} maxLength={finding.fix.field === 'description' ? 160 : finding.fix.field === 'siteTitle' ? 100 : 300} /></label>}
        {confirming && <div className="review-impact"><span><small>{t('review.before')}</small><code>{finding.fix.before || t('review.emptyValue')}</code></span><ArrowRight size={15} /><span><small>{t('review.after')}</small><code>{after || t('review.emptyValue')}</code></span></div>}
        <button className={confirming ? 'button primary' : 'button quiet'} disabled={working || !after} onClick={() => confirming ? onApply(finding, value) : setConfirming(true)}>{working ? <LoaderCircle className="spin" size={14} /> : confirming ? <Check size={14} /> : <ArrowRight size={14} />} {t(confirming ? 'review.applyFix' : 'review.previewFix')}</button>
      </div>}
      {!finding.fix && finding.postId && <button className="button quiet review-open-post" onClick={() => onOpenPost(finding.postId)}><FileText size={14} /> {t('review.openPost')}</button>}
    </div>
  </article>
}
