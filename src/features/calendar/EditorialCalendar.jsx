import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle, ArrowLeft, ArrowRight, CalendarClock, Check, ChevronLeft, ChevronRight,
  CircleOff, Clock3, Cloud, FileText, LayoutGrid, List, LoaderCircle, Play, RefreshCw,
  Rocket, Save, Send, Settings2, ShieldCheck, Sparkles, TriangleAlert, X,
} from 'lucide-react'
import { api } from '../../app/api'
import { Modal } from '../../components/ui/Modal'
import { useI18n } from '../../i18n'
import { friendlyError } from '../../lib/errors'

const emptyCalendar = {
  timeZone: 'Etc/UTC', timeZoneConfigured: false, now: '', items: [], next: null,
  summary: { total: 0, published: 0, scheduled: 0, unscheduled: 0, draft: 0, 'scheduled-draft': 0, expired: 0 },
  automation: { supported: false, enabled: false, provider: 'none', workflow: '', lastRun: { state: 'unavailable' } },
}
const views = ['month', 'week', 'agenda', 'unscheduled']

export function EditorialCalendar({ onClose, onOpenPost, onChanged, onDeploy, notify }) {
  const { t, locale } = useI18n()
  const [calendar, setCalendar] = useState(emptyCalendar)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState('')
  const [view, setView] = useState('month')
  const [cursor, setCursor] = useState(() => startMonth(new Date()))
  const [selectedId, setSelectedId] = useState('')
  const [dropRequest, setDropRequest] = useState(null)
  const [timeZone, setTimeZone] = useState('Etc/UTC')
  const [automationConfirm, setAutomationConfirm] = useState('')
  const cursorInitialized = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await api.editorialCalendar()
      setCalendar(result)
      setTimeZone(result.timeZone)
      if (!cursorInitialized.current) {
        setCursor(startMonth(calendarDate(result.now || new Date().toISOString(), result.timeZone)))
        cursorInitialized.current = true
      }
      setSelectedId((current) => result.items.some((item) => item.id === current) ? current : '')
    } catch (error) { notify(friendlyError(error, t), 'error') } finally { setLoading(false) }
  }, [notify, t])

  useEffect(() => { load() }, [load])
  const selected = calendar.items.find((item) => item.id === selectedId) || null
  const datedItems = useMemo(() => calendar.items.filter((item) => item.effectiveAt), [calendar.items])
  const monthDays = useMemo(() => gridDays(cursor, view === 'week' ? 7 : 42), [cursor, view])
  const timeZones = useMemo(() => typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : ['Etc/UTC', 'America/Sao_Paulo', 'America/New_York', 'Europe/London'], [])

  async function saveTimeZone() {
    setWorking('timezone')
    try {
      await api.saveCalendarTimeZone(timeZone)
      notify(t('calendar.notice.timeZoneSaved'))
      await load()
    } catch (error) { notify(friendlyError(error, t), 'error') } finally { setWorking('') }
  }

  async function changeAutomation(action) {
    if (automationConfirm !== action) { setAutomationConfirm(action); return }
    setWorking(action)
    try {
      const result = action === 'enable'
        ? await api.enableCalendarAutomation({ provider: calendar.automation.provider, timeZone: calendar.timeZone })
        : await api.disableCalendarAutomation()
      notify(result?.warning || t(action === 'enable' ? 'calendar.notice.automationEnabled' : 'calendar.notice.automationDisabled'), result?.warning ? 'error' : 'success')
      setAutomationConfirm('')
      await load()
    } catch (error) { notify(friendlyError(error, t), 'error') } finally { setWorking('') }
  }

  async function runNow() {
    setWorking('run')
    try {
      await api.runCalendarAutomationNow()
      notify(t('calendar.notice.runRequested'))
      await load()
    } catch (error) { notify(friendlyError(error, t), 'error') } finally { setWorking('') }
  }

  async function syncChanges() {
    setWorking('sync')
    try {
      await api.syncCalendarChanges()
      notify(t('calendar.notice.syncCompleted'))
      await load()
    } catch (error) { notify(friendlyError(error, t), 'error') } finally { setWorking('') }
  }

  function openAutomationRun() {
    if (!calendar.automation.lastRun?.runUrl) return
    api.openPublishingUrl(calendar.automation.lastRun.runUrl).catch((error) => notify(friendlyError(error, t), 'error'))
  }

  function navigate(direction) {
    setCursor((current) => view === 'week' ? addDays(current, direction * 7) : addMonths(current, direction))
  }

  function changeView(name) {
    if (name === 'week' && view !== 'week') setCursor(startWeek(calendarDate(calendar.now || new Date().toISOString(), calendar.timeZone)))
    if (name === 'month' && view === 'week') setCursor((current) => startMonth(current))
    setView(name)
  }

  function openPost(id) {
    onOpenPost(id)
    onClose()
  }

  function droppedOn(day, item) {
    const currentWall = wallInput(item.publishDate || item.effectiveAt || new Date().toISOString(), calendar.timeZone)
    const time = currentWall.slice(11) || '09:00'
    setDropRequest({ id: item.id, publishLocal: `${dayKey(day)}T${time}`, nonce: Date.now() })
    setSelectedId(item.id)
  }

  return <Modal title={t('calendar.title')} onClose={onClose} width="1120px">
    <div className="calendar-workspace">
      <header className="calendar-toolbar">
        <div><CalendarClock size={22} /><span><strong>{t('calendar.heading')}</strong><small>{t('calendar.copy')}</small></span></div>
        <label>{t('calendar.timeZone')}<input list="plumbago-time-zones" value={timeZone} onChange={(event) => setTimeZone(event.target.value)} /><datalist id="plumbago-time-zones">{timeZones.map((zone) => <option key={zone} value={zone} />)}</datalist></label>
        <button className="button quiet" onClick={saveTimeZone} disabled={working === 'timezone' || (timeZone === calendar.timeZone && calendar.timeZoneConfigured)}>{working === 'timezone' ? <LoaderCircle className="spin" size={14} /> : <Save size={14} />} {t('calendar.saveTimeZone')}</button>
        <button className="icon-button" onClick={load} title={t('calendar.refresh')} disabled={loading}><RefreshCw className={loading ? 'spin' : ''} size={16} /></button>
      </header>

      <section className="calendar-summary">
        <Summary icon={<Send size={16} />} value={calendar.summary.scheduled} label={t('calendar.summary.scheduled')} tone="scheduled" />
        <Summary icon={<FileText size={16} />} value={calendar.summary.unscheduled + calendar.summary.draft} label={t('calendar.summary.drafts')} />
        <Summary icon={<Check size={16} />} value={calendar.summary.published} label={t('calendar.summary.published')} tone="published" />
        <Summary icon={<CircleOff size={16} />} value={calendar.summary.expired} label={t('calendar.summary.expired')} tone="expired" />
        <div className="calendar-next"><small>{t('calendar.next')}</small><strong>{calendar.next ? calendar.next.title : t('calendar.noNext')}</strong><span>{calendar.next ? formatMoment(calendar.next.effectiveAt, locale, calendar.timeZone) : t('calendar.noNextCopy')}</span></div>
      </section>

      <AutomationCard calendar={calendar} working={working} confirming={automationConfirm} onChange={changeAutomation} onRun={runNow} onSync={syncChanges} onOpenRun={openAutomationRun} onDeploy={onDeploy} t={t} locale={locale} />

      <div className="calendar-viewbar">
        <nav>{views.map((name) => <button key={name} className={view === name ? 'active' : ''} onClick={() => changeView(name)}>{name === 'month' ? <LayoutGrid size={14} /> : name === 'week' ? <CalendarClock size={14} /> : <List size={14} />} {t(`calendar.view.${name}`)}</button>)}</nav>
        {!['agenda', 'unscheduled'].includes(view) && <div><button className="icon-button small" onClick={() => navigate(-1)} title={t('calendar.previous')}><ChevronLeft size={16} /></button><strong>{rangeTitle(cursor, view, locale)}</strong><button className="icon-button small" onClick={() => navigate(1)} title={t('calendar.nextPeriod')}><ChevronRight size={16} /></button><button className="button quiet compact" onClick={() => { const today = calendarDate(calendar.now || new Date().toISOString(), calendar.timeZone); setCursor(view === 'week' ? startWeek(today) : startMonth(today)) }}>{t('calendar.today')}</button></div>}
      </div>

      <main className={`calendar-main view-${view}`}>
        {loading && <div className="calendar-empty"><LoaderCircle className="spin" size={28} /><strong>{t('calendar.loading')}</strong></div>}
        {!loading && ['month', 'week'].includes(view) && <CalendarGrid days={monthDays} items={datedItems} selectedId={selectedId} timeZone={calendar.timeZone} locale={locale} today={calendar.now} onSelect={setSelectedId} onDrop={droppedOn} t={t} />}
        {!loading && view === 'agenda' && <Agenda items={datedItems} timeZone={calendar.timeZone} locale={locale} onSelect={setSelectedId} t={t} />}
        {!loading && view === 'unscheduled' && <Unscheduled items={calendar.items.filter((item) => ['unscheduled', 'draft', 'scheduled-draft'].includes(item.state))} onSelect={setSelectedId} t={t} />}
      </main>

      {selected && <SchedulePanel key={selected.id} item={selected} dropRequest={dropRequest?.id === selected.id ? dropRequest : null} timeZone={calendar.timeZone} locale={locale} syncRequired={calendar.automation.enabled} onClose={() => { setSelectedId(''); setDropRequest(null) }} onOpenPost={openPost} onApplied={async (result) => { await onChanged(result.post.id); await load(); setCalendar((current) => mergeChangedPost(current, result.post)) }} onReload={load} notify={notify} t={t} />}
      <footer className="calendar-footer"><small><ShieldCheck size={13} /> {t('calendar.portable')}</small><button className="button quiet" onClick={onClose}>{t('common.close')}</button></footer>
    </div>
  </Modal>
}

function Summary({ icon, value, label, tone = '' }) {
  return <div className={tone}><span>{icon}</span><strong>{value}</strong><small>{label}</small></div>
}

function AutomationCard({ calendar, working, confirming, onChange, onRun, onSync, onOpenRun, onDeploy, t, locale }) {
  const automation = calendar.automation
  const state = !automation.supported ? 'unsupported' : automation.enabled ? automation.pendingSync ? 'syncPending' : automation.overdue ? 'overdue' : automation.lastRun?.state === 'failed' ? 'failed' : 'enabled' : 'disabled'
  return <section className={`calendar-automation ${state}`}>
    <span>{['failed', 'overdue', 'syncPending'].includes(state) ? <AlertCircle size={20} /> : automation.enabled ? <Cloud size={20} /> : <Settings2 size={20} />}</span>
    <div><strong>{t(`calendar.automation.${state}`)}</strong><p>{t(`calendar.automation.${state}Copy`, { provider: providerName(automation.provider, t), minutes: automation.intervalMinutes || 30 })}</p>{automation.lastRun?.updatedAt && <small>{t('calendar.automation.lastRun', { date: formatMoment(automation.lastRun.updatedAt, locale, calendar.timeZone) })}</small>}</div>
    {!automation.supported && <button className="button quiet" onClick={onDeploy}><Rocket size={14} /> {t('calendar.automation.chooseProvider')}</button>}
    {automation.supported && !automation.enabled && <button className={confirming === 'enable' ? 'button primary' : 'button quiet'} onClick={() => onChange('enable')} disabled={Boolean(working)}>{working === 'enable' ? <LoaderCircle className="spin" size={14} /> : confirming === 'enable' ? <Check size={14} /> : <Sparkles size={14} />} {t(confirming === 'enable' ? 'calendar.automation.confirmEnable' : 'calendar.automation.enable')}</button>}
    {automation.enabled && <div className="calendar-automation-actions">{automation.pendingSync && <button className="button primary" onClick={onSync} disabled={Boolean(working)}>{working === 'sync' ? <LoaderCircle className="spin" size={14} /> : <RefreshCw size={14} />} {t('calendar.automation.syncNow')}</button>}{automation.lastRun?.runUrl && <button className="button quiet" onClick={onOpenRun}><ArrowRight size={14} /> {t('calendar.automation.openRun')}</button>}<button className="button quiet" onClick={onRun} disabled={Boolean(working)}>{working === 'run' ? <LoaderCircle className="spin" size={14} /> : <Play size={14} />} {t('calendar.automation.runNow')}</button><button className={confirming === 'disable' ? 'button danger' : 'button quiet'} onClick={() => onChange('disable')} disabled={Boolean(working)}>{working === 'disable' ? <LoaderCircle className="spin" size={14} /> : confirming === 'disable' ? <Check size={14} /> : <CircleOff size={14} />} {t(confirming === 'disable' ? 'calendar.automation.confirmDisable' : 'calendar.automation.disable')}</button></div>}
    {confirming === 'enable' && <div className="calendar-automation-impact"><TriangleAlert size={14} /><span>{t(`calendar.automation.consent.${automation.provider}`)}</span></div>}
  </section>
}

function CalendarGrid({ days, items, selectedId, timeZone, locale, today, onSelect, onDrop, t }) {
  const currentMonth = days[Math.floor(days.length / 2)]?.getUTCMonth()
  const selectedItem = items.find((item) => item.id === selectedId)
  return <div className={`calendar-grid count-${days.length}`}>
    {days.slice(0, 7).map((day) => <div className="calendar-weekday" key={`weekday-${day.getUTCDay()}`}>{new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(day)}</div>)}
    {days.map((day) => {
      const key = dayKey(day)
      const events = items.filter((item) => momentDay(item.effectiveAt, timeZone) === key)
      const isToday = momentDay(today, timeZone) === key
      return <section key={key} className={`${day.getUTCMonth() !== currentMonth && days.length > 7 ? 'outside' : ''} ${isToday ? 'today' : ''}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const item = items.find((candidate) => candidate.id === event.dataTransfer.getData('text/plumbago-post')); if (item) onDrop(day, item) }}>
        <header>{selectedItem && momentDay(selectedItem.effectiveAt, timeZone) !== key ? <button className="calendar-day-target" onClick={() => onDrop(day, selectedItem)} aria-label={t('calendar.moveToDay', { date: formatCalendarDay(day, locale) })}><time>{day.getUTCDate()}</time></button> : <time>{day.getUTCDate()}</time>}{isToday && <small>{t('calendar.today')}</small>}</header>
        <div>{events.map((item) => <button key={item.id} draggable onDragStart={(event) => event.dataTransfer.setData('text/plumbago-post', item.id)} className={`calendar-event ${item.state} ${selectedId === item.id ? 'active' : ''}`} onClick={() => onSelect(item.id)} title={`${item.title} · ${formatMoment(item.effectiveAt, locale, timeZone)}`}><span>{formatTime(item.effectiveAt, locale, timeZone)}</span><strong>{item.title}</strong></button>)}</div>
      </section>
    })}
  </div>
}

function Agenda({ items, timeZone, locale, onSelect, t }) {
  const sorted = [...items].sort((left, right) => left.effectiveAt.localeCompare(right.effectiveAt))
  if (!sorted.length) return <div className="calendar-empty"><CalendarClock size={28} /><strong>{t('calendar.emptyAgenda')}</strong><span>{t('calendar.emptyAgendaCopy')}</span></div>
  return <div className="calendar-agenda">{sorted.map((item) => <button key={item.id} onClick={() => onSelect(item.id)}><time><strong>{formatDay(item.effectiveAt, locale, timeZone)}</strong><span>{formatTime(item.effectiveAt, locale, timeZone)}</span></time><span className={`calendar-state ${item.state}`}>{t(`calendar.state.${item.state}`)}</span><div><strong>{item.title}</strong><small>{item.description || t('posts.noDescription')}</small></div><ChevronRight size={16} /></button>)}</div>
}

function Unscheduled({ items, onSelect, t }) {
  if (!items.length) return <div className="calendar-empty"><Check size={28} /><strong>{t('calendar.emptyUnscheduled')}</strong><span>{t('calendar.emptyUnscheduledCopy')}</span></div>
  return <div className="calendar-unscheduled">{items.map((item) => <button key={item.id} onClick={() => onSelect(item.id)}><FileText size={18} /><div><strong>{item.title}</strong><small>{item.description || t('posts.noDescription')}</small></div><span className={`calendar-state ${item.state}`}>{t(`calendar.state.${item.state}`)}</span><ChevronRight size={16} /></button>)}</div>
}

function SchedulePanel({ item, dropRequest, timeZone, locale, syncRequired, onClose, onOpenPost, onApplied, onReload, notify, t }) {
  const initial = item.publishDate ? wallInput(item.publishDate, timeZone) : defaultFutureWall(timeZone)
  const [publishLocal, setPublishLocal] = useState(initial)
  const [expiryLocal, setExpiryLocal] = useState(item.expiryDate ? wallInput(item.expiryDate, timeZone) : '')
  const [preview, setPreview] = useState(null)
  const [working, setWorking] = useState(false)
  const [syncFailure, setSyncFailure] = useState('')

  useEffect(() => {
    if (!dropRequest) return
    let active = true
    const nextExpiry = item.expiryDate ? wallInput(item.expiryDate, timeZone) : ''
    setPublishLocal(dropRequest.publishLocal)
    setExpiryLocal(nextExpiry)
    setPreview(null)
    setWorking(true)
    api.previewCalendarChange({ postId: item.id, action: 'schedule', timeZone, publishLocal: dropRequest.publishLocal, expiryLocal: nextExpiry })
      .then((result) => { if (active) setPreview(result) })
      .catch((error) => { if (active) notify(friendlyError(error, t), 'error') })
      .finally(() => { if (active) setWorking(false) })
    return () => { active = false }
  }, [dropRequest, item.expiryDate, item.id, notify, t, timeZone])

  async function requestPreview(action, nextPublish = publishLocal, nextExpiry = expiryLocal) {
    setWorking(true)
    try { setPreview(await api.previewCalendarChange({ postId: item.id, action, timeZone, publishLocal: nextPublish, expiryLocal: nextExpiry })) } catch (error) { notify(friendlyError(error, t), 'error') } finally { setWorking(false) }
  }

  async function apply() {
    setWorking(true)
    try {
      const result = await api.applyCalendarChange({ postId: item.id, action: preview.action, timeZone, publishLocal, expiryLocal, publishInstant: preview.action === 'publish-now' ? preview.next.publishDate : undefined })
      setPreview(null)
      await onApplied(result)
      if (result.sync?.state === 'failed') {
        setSyncFailure(result.sync.message || t('calendar.sync.unknownError'))
        notify(t('calendar.notice.savedLocally'), 'error')
        return
      }
      notify(t(result.sync?.state === 'synced' ? 'calendar.notice.scheduleSynced' : `calendar.notice.${preview.action === 'publish-now' ? 'publishedNow' : preview.action === 'cancel' ? 'cancelled' : 'scheduled'}`))
      onClose()
    } catch (error) { notify(friendlyError(error, t), 'error') } finally { setWorking(false) }
  }

  async function retrySync() {
    setWorking(true)
    try {
      await api.syncCalendarChanges()
      setSyncFailure('')
      notify(t('calendar.notice.syncCompleted'))
      await onReload()
      onClose()
    } catch (error) { setSyncFailure(friendlyError(error, t)); notify(t('calendar.notice.savedLocally'), 'error') } finally { setWorking(false) }
  }

  return <aside className="calendar-panel">
    <header><div><span className={`calendar-state ${item.state}`}>{t(`calendar.state.${item.state}`)}</span><h3>{item.title}</h3><p>{item.description || t('posts.noDescription')}</p></div><button className="icon-button" onClick={onClose} title={t('common.close')}><X size={16} /></button></header>
    <div className="calendar-current"><small>{t('calendar.panel.current')}</small><strong>{item.publishDate ? formatMoment(item.publishDate, locale, timeZone) : t('calendar.panel.notScheduled')}</strong>{item.expiryDate && <span>{t('calendar.panel.expires', { date: formatMoment(item.expiryDate, locale, timeZone) })}</span>}</div>
    <label>{t('calendar.panel.publishAt')}<input type="datetime-local" value={publishLocal} onChange={(event) => { setPublishLocal(event.target.value); setPreview(null) }} /></label>
    <label>{t('calendar.panel.expiryAt')}<input type="datetime-local" value={expiryLocal} min={publishLocal} onChange={(event) => { setExpiryLocal(event.target.value); setPreview(null) }} /><small>{t('calendar.panel.expiryHint')}</small></label>
    <div className="calendar-panel-actions"><button className="button primary" onClick={() => requestPreview('schedule')} disabled={working || !publishLocal}>{working ? <LoaderCircle className="spin" size={14} /> : <Clock3 size={14} />} {t(item.publishDate ? 'calendar.panel.reschedule' : 'calendar.panel.schedule')}</button><button className="button quiet" onClick={() => requestPreview('publish-now')} disabled={working}><Send size={14} /> {t('calendar.panel.publishNow')}</button>{item.publishDate && <button className="button quiet" onClick={() => requestPreview('cancel')} disabled={working}><CircleOff size={14} /> {t('calendar.panel.cancel')}</button>}</div>
    {preview && <div className="calendar-preview"><div><Sparkles size={14} /><span><strong>{t('calendar.preview.title')}</strong><small>{t(syncRequired ? 'calendar.preview.syncCopy' : 'calendar.preview.copy')}</small></span></div>{preview.changes.map((change) => <div key={change.field}><small>{t(`calendar.field.${change.field}`)}</small><code>{previewValue(change.before, change.field, locale, timeZone, t)}</code><ArrowRight size={14} /><code>{previewValue(change.after, change.field, locale, timeZone, t)}</code></div>)}{preview.ambiguous && <p><TriangleAlert size={13} /> {t('calendar.preview.ambiguous')}</p>}<button className="button primary" onClick={apply} disabled={working}>{working ? <LoaderCircle className="spin" size={14} /> : <Check size={14} />} {t(syncRequired ? 'calendar.preview.applyAndSync' : 'calendar.preview.apply')}</button></div>}
    {syncFailure && <div className="calendar-sync-failure" role="alert"><TriangleAlert size={16} /><div><strong>{t('calendar.sync.failed')}</strong><p>{t('calendar.sync.failedCopy')}</p><small>{syncFailure}</small></div><button className="button primary" onClick={retrySync} disabled={working}>{working ? <LoaderCircle className="spin" size={14} /> : <RefreshCw size={14} />} {t('calendar.sync.retry')}</button></div>}
    <button className="button quiet calendar-open-post" onClick={() => onOpenPost(item.id)}><FileText size={14} /> {t('calendar.panel.openPost')}</button>
  </aside>
}

function providerName(provider, t) { return ['github-pages', 'cloudflare-pages'].includes(provider) ? t(`hosting.${provider}`) : t('hosting.none') }
function mergeChangedPost(calendar, post) {
  const previous = calendar.items.find((item) => item.id === post.id)
  if (!previous) return calendar
  const now = new Date(calendar.now)
  const publishAt = post.publishDate ? new Date(post.publishDate) : null
  const expiryAt = post.expiryDate ? new Date(post.expiryDate) : null
  let state = previous.state
  let effectiveAt = previous.effectiveAt
  let source = previous.source
  if (expiryAt && expiryAt <= now) {
    state = 'expired'; effectiveAt = post.expiryDate; source = 'expiryDate'
  } else if (post.draft) {
    state = publishAt ? publishAt > now ? 'scheduled-draft' : 'draft' : 'unscheduled'
    effectiveAt = publishAt ? post.publishDate : ''
    source = publishAt ? 'publishDate' : ''
  } else if (publishAt) {
    state = publishAt > now ? 'scheduled' : 'published'
    effectiveAt = post.publishDate
    source = 'publishDate'
  }
  const items = calendar.items.map((item) => item.id === post.id ? { ...item, ...post, state, effectiveAt, source } : item)
  const states = ['published', 'scheduled', 'unscheduled', 'draft', 'scheduled-draft', 'expired']
  const summary = { total: items.length, ...Object.fromEntries(states.map((name) => [name, items.filter((item) => item.state === name).length])) }
  const next = items.filter((item) => item.state === 'scheduled').sort((left, right) => left.effectiveAt.localeCompare(right.effectiveAt))[0] || null
  return { ...calendar, items, summary, next }
}
function pad(value) { return String(value).padStart(2, '0') }
function startMonth(value) { return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1)) }
function startWeek(value) { const date = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())); date.setUTCDate(date.getUTCDate() - date.getUTCDay()); return date }
function addDays(value, count) { const next = new Date(value); next.setUTCDate(next.getUTCDate() + count); return next }
function addMonths(value, count) { return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + count, 1)) }
function gridDays(cursor, count) { const start = count === 7 ? startWeek(cursor) : addDays(cursor, -cursor.getUTCDay()); return Array.from({ length: count }, (_, index) => addDays(start, index)) }
function dayKey(value) { return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}` }
function momentParts(value, timeZone) { if (!value) return null; const date = new Date(value); if (Number.isNaN(date.valueOf())) return null; return Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])) }
function momentDay(value, timeZone) { const parts = momentParts(value, timeZone); return parts ? `${parts.year}-${parts.month}-${parts.day}` : '' }
function wallInput(value, timeZone) { const parts = momentParts(value, timeZone); return parts ? `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}` : '' }
function calendarDate(value, timeZone) { const parts = momentParts(value, timeZone); return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day))) }
function defaultFutureWall(timeZone) { const date = new Date(Date.now() + 86_400_000); const parts = momentParts(date, timeZone); return `${parts.year}-${parts.month}-${parts.day}T09:00` }
function formatMoment(value, locale, timeZone) { return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(new Date(value)) }
function formatDay(value, locale, timeZone) { return new Intl.DateTimeFormat(locale, { month: 'short', day: '2-digit', timeZone }).format(new Date(value)) }
function formatCalendarDay(value, locale) { return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(value) }
function formatTime(value, locale, timeZone) { return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(value)) }
function rangeTitle(cursor, view, locale) { if (view === 'week') { const end = addDays(startWeek(cursor), 6); return `${new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(startWeek(cursor))} – ${new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(end)}` } return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(cursor) }
function previewValue(value, field, locale, timeZone, t) { if (field === 'draft') return value ? t('calendar.value.draft') : t('calendar.value.publishable'); if (!value) return t('calendar.value.empty'); return formatMoment(value, locale, timeZone) }
