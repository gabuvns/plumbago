import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowDown, ArrowRight, ArrowUp, Check, ChevronRight, Eye, FileCode2, History, LayoutTemplate, Link2, LoaderCircle, Menu, Palette, Plus, RefreshCw, Save, ShieldCheck, Sparkles, Trash2, Type } from 'lucide-react'
import { api } from '../../app/api'
import { useI18n } from '../../i18n'
import { friendlyError } from '../../lib/errors'

const CATEGORY_ICONS = { identity: Sparkles, colors: Palette, typography: Type, navigation: Menu, social: Link2, homepage: LayoutTemplate }

function CategoryIcon({ category, size = 16 }) {
  const Icon = CATEGORY_ICONS[category]
  return Icon ? <Icon size={size} /> : null
}

function controlsFrom(inventory) {
  return inventory?.categories?.flatMap((category) => category.controls) || []
}

function initialValues(inventory) {
  return Object.fromEntries(controlsFrom(inventory).map((control) => [control.id, control.value]))
}

function publicMenu(items) {
  return (items || []).map(({ _id = '', name = '', pageRef = '', url = '', weight = 10, identifier = '', parent = '' }) => ({ _id, name, pageRef, url, weight, identifier, parent }))
}

function publicSocial(items) {
  return (items || []).map(({ _id = '', network = '', url = '' }) => ({ _id, network, url }))
}

function stable(value) {
  return JSON.stringify(value)
}

function localItemId() {
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function ThemeConfigurator({ context, onChanged, notify }) {
  const { t } = useI18n()
  const [inventory, setInventory] = useState(null)
  const [values, setValues] = useState({})
  const [navigation, setNavigation] = useState([])
  const [social, setSocial] = useState([])
  const [category, setCategory] = useState('identity')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [errorTitle, setErrorTitle] = useState('themeConfig.errorTitle')
  const [details, setDetails] = useState('')
  const [presetName, setPresetName] = useState('')
  const [presetOpen, setPresetOpen] = useState(false)
  const [deletePresetId, setDeletePresetId] = useState('')
  const [retryAction, setRetryAction] = useState(null)

  function hydrate(next) {
    setInventory(next)
    setValues(initialValues(next))
    setNavigation(publicMenu(next.navigation?.items))
    setSocial(publicSocial(next.social?.items))
    setPreview(null)
    setError('')
    setErrorTitle('themeConfig.errorTitle')
    setDetails('')
    setRetryAction(null)
    const first = next.categories?.find((item) => item.controls.length || (item.id === 'navigation' && next.navigation.support !== 'unsupported') || (item.id === 'social' && next.social.support !== 'unsupported'))?.id
    if (first) setCategory(first)
  }

  async function load() {
    setLoading(true)
    try { hydrate(await api.themeConfiguration()) }
    catch (loadError) { setErrorTitle('themeConfig.errorTitle'); setError(friendlyError(loadError, t)); setDetails(loadError.details || ''); setRetryAction(() => load) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [context.theme]) // eslint-disable-line react-hooks/exhaustive-deps

  const controls = controlsFrom(inventory)
  const currentCategory = inventory?.categories?.find((item) => item.id === category)
  const changed = useMemo(() => {
    if (!inventory) return false
    return stable(values) !== stable(initialValues(inventory)) || stable(navigation) !== stable(publicMenu(inventory.navigation.items)) || stable(social) !== stable(publicSocial(inventory.social.items))
  }, [inventory, navigation, social, values])

  const previewStyle = useMemo(() => {
    const byPath = (pattern) => controls.find((control) => pattern.test(control.path))
    const color = values[byPath(/(?:primary|accent|theme)color$/i)?.id]
    const bodyFont = values[byPath(/(?:bodyfont|fontfamily)$/i)?.id]
    const headingFont = values[byPath(/(?:heading|title)font$/i)?.id]
    return {
      '--theme-preview-color': /^#[0-9a-f]{3,8}$/i.test(color || '') ? color : '#558B6E',
      '--theme-preview-body': bodyFont || 'Inter, sans-serif',
      '--theme-preview-heading': headingFont || 'Georgia, serif',
    }
  }, [controls, values])

  const previewCopy = useMemo(() => {
    const value = (pattern) => {
      const control = controls.find((item) => pattern.test(item.path))
      return control ? values[control.id] : ''
    }
    return {
      title: value(/(?:^|\.)title$/i) || t('themeConfig.preview.fallbackTitle'),
      description: value(/params\.(?:description|subtitle)$/i) || t('themeConfig.preview.fallbackCopy'),
    }
  }, [controls, t, values])

  function payload() {
    return {
      expectedRevision: inventory.revision,
      values,
      ...(inventory.navigation.support !== 'unsupported' ? { navigation } : {}),
      ...(inventory.social.support !== 'unsupported' ? { social } : {}),
    }
  }

  async function buildPreview() {
    setWorking(true); setError(''); setDetails(''); setRetryAction(null)
    try { setPreview(await api.previewThemeConfiguration(payload())) }
    catch (previewError) { setErrorTitle('themeConfig.previewErrorTitle'); setError(friendlyError(previewError, t)); setDetails(previewError.details || ''); setRetryAction(() => buildPreview) }
    finally { setWorking(false) }
  }

  async function openRealPreview() {
    setWorking(true); setError(''); setDetails(''); setRetryAction(null)
    try { await api.openThemePreview(preview.previewId) }
    catch (previewError) { setErrorTitle('themeConfig.openPreviewErrorTitle'); setError(friendlyError(previewError, t)); setDetails(previewError.details || ''); setRetryAction(() => openRealPreview) }
    finally { setWorking(false) }
  }

  async function applyPreview() {
    setWorking(true); setError(''); setDetails(''); setRetryAction(null)
    try {
      const result = await api.applyThemeConfiguration({ previewId: preview.previewId, expectedRevision: inventory.revision })
      hydrate(result.inventory)
      notify(t('themeConfig.notices.applied'))
      onChanged?.()
    } catch (applyError) { setErrorTitle('themeConfig.applyErrorTitle'); setError(friendlyError(applyError, t)); setDetails(applyError.details || ''); setRetryAction(() => buildPreview) }
    finally { setWorking(false) }
  }

  async function savePreset() {
    setWorking(true); setError(''); setDetails(''); setRetryAction(null)
    try {
      await api.saveThemePreset({ name: presetName, ...payload() })
      setPresetName(''); setPresetOpen(false)
      setInventory(await api.themeConfiguration())
      notify(t('themeConfig.notices.presetSaved'))
    } catch (presetError) { setErrorTitle('themeConfig.presetErrorTitle'); setError(friendlyError(presetError, t)); setRetryAction(() => savePreset) }
    finally { setWorking(false) }
  }

  function loadPreset(preset) {
    if (preset.theme !== inventory.theme.id) { setError(t('themeConfig.presets.wrongTheme')); return }
    setValues((current) => ({ ...current, ...(preset.payload.values || {}) }))
    if (preset.payload.navigation) setNavigation(publicMenu(preset.payload.navigation))
    if (preset.payload.social) setSocial(publicSocial(preset.payload.social))
    setPreview(null); setError('')
    notify(t('themeConfig.notices.presetLoaded'))
  }

  async function deletePreset(id) {
    setWorking(true); setError(''); setDetails(''); setRetryAction(null)
    try {
      await api.deleteThemePreset(id)
      setDeletePresetId('')
      setInventory({ ...inventory, presets: inventory.presets.filter((item) => item.id !== id), summary: { ...inventory.summary, presets: inventory.summary.presets - 1 } })
      notify(t('themeConfig.notices.presetDeleted'))
    } catch (presetError) { setErrorTitle('themeConfig.presetErrorTitle'); setError(friendlyError(presetError, t)); setRetryAction(() => deletePreset(id)) }
    finally { setWorking(false) }
  }

  function moveMenu(index, offset) {
    const target = index + offset
    if (target < 0 || target >= navigation.length) return
    const next = [...navigation]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    setNavigation(next.map((entry, position) => ({ ...entry, weight: (position + 1) * 10 })))
    setPreview(null)
  }

  if (loading) return <div className="theme-config-state"><LoaderCircle className="spin" /><strong>{t('themeConfig.loading')}</strong></div>
  if (!inventory) return <ThemeError title={errorTitle} error={error} details={details} onRetry={load} t={t} />
  if (!inventory.theme.id) return <div className="theme-config-state empty"><Palette /><strong>{t('themeConfig.noThemeTitle')}</strong><p>{t('themeConfig.noThemeCopy')}</p></div>

  return (
    <div className="theme-configurator">
      <section className={`theme-config-support ${inventory.theme.supportLevel}`}>
        <span><ShieldCheck size={19} /></span>
        <div><strong>{t(`themeConfig.support.${inventory.theme.supportLevel}.title`, { theme: inventory.theme.name })}</strong><p>{t(`themeConfig.support.${inventory.theme.supportLevel}.copy`)}</p></div>
        <dl><div><dt>{t('themeConfig.summary.controls')}</dt><dd>{inventory.summary.controls}</dd></div><div><dt>{t('themeConfig.summary.categories')}</dt><dd>{inventory.summary.categories}</dd></div><div><dt>{t('themeConfig.summary.preserved')}</dt><dd>{inventory.summary.unsupported}</dd></div></dl>
      </section>

      {error && <ThemeError title={errorTitle} error={error} details={details} onRetry={retryAction || load} t={t} compact />}

      <div className="theme-config-layout">
        <aside className="theme-config-sidebar">
          <nav aria-label={t('themeConfig.categories.label')}>
            {inventory.categories.map((item) => {
              const Icon = CATEGORY_ICONS[item.id]
              const available = item.controls.length || (item.id === 'navigation' && inventory.navigation.support !== 'unsupported') || (item.id === 'social' && inventory.social.support !== 'unsupported')
              return <button key={item.id} disabled={!available} className={category === item.id ? 'active' : ''} onClick={() => setCategory(item.id)}><Icon size={15} /><span>{t(`themeConfig.categories.${item.id}`)}</span><small>{item.controls.length || (available ? 1 : 0)}</small></button>
            })}
          </nav>
          <section className="theme-preset-list">
            <header><div><strong>{t('themeConfig.presets.title')}</strong><small>{t('themeConfig.presets.copy')}</small></div><button title={t('themeConfig.presets.save')} onClick={() => setPresetOpen(true)}><Plus size={13} /></button></header>
            {inventory.presets.filter((item) => item.theme === inventory.theme.id).map((preset) => <article key={preset.id}>
              <button onClick={() => loadPreset(preset)}><strong>{preset.name}</strong><small>{t('themeConfig.presets.summary', { count: preset.summary.settings })}</small></button>
              {deletePresetId === preset.id ? <span><button onClick={() => deletePreset(preset.id)}>{t('common.delete')}</button><button onClick={() => setDeletePresetId('')}>{t('common.cancel')}</button></span> : <button title={t('themeConfig.presets.delete')} onClick={() => setDeletePresetId(preset.id)}><Trash2 size={12} /></button>}
            </article>)}
            {!inventory.presets.some((item) => item.theme === inventory.theme.id) && <p>{t('themeConfig.presets.empty')}</p>}
          </section>
        </aside>

        <main className="theme-config-main">
          <header><div><span><CategoryIcon category={category} size={17} /></span><div><h3>{t(`themeConfig.categories.${category}`)}</h3><p>{t(`themeConfig.categories.${category}Copy`)}</p></div></div>{changed && <small>{t('themeConfig.unsaved')}</small>}</header>
          {category === 'navigation' ? <NavigationEditor items={navigation} onChange={(next) => { setNavigation(next); setPreview(null) }} onMove={moveMenu} t={t} /> : category === 'social' ? <SocialEditor items={social} supported={inventory.social.support !== 'unsupported'} onChange={(next) => { setSocial(next); setPreview(null) }} t={t} /> : <ControlEditor controls={currentCategory?.controls || []} values={values} onChange={(id, value) => { setValues({ ...values, [id]: value }); setPreview(null) }} t={t} />}
          {inventory.unsupported.length > 0 && <details className="theme-unsupported"><summary><FileCode2 size={14} /> {t('themeConfig.unsupported.title', { count: inventory.unsupported.length })}</summary><p>{t('themeConfig.unsupported.copy')}</p><div>{inventory.unsupported.slice(0, 40).map((item) => <code key={item.path}>{item.path}</code>)}</div><small>{t('themeConfig.unsupported.files', { files: inventory.configFiles.join(', ') })}</small></details>}
        </main>

        <aside className="theme-live-preview" style={previewStyle}>
          <header><div><Eye size={14} /> <strong>{t('themeConfig.preview.title')}</strong></div><small>{t('themeConfig.preview.copy')}</small></header>
          <div className="theme-preview-browser"><div><i /><i /><i /></div><nav><strong>{previewCopy.title}</strong><span>{navigation.slice(0, 3).map((item) => item.name).join(' · ') || t('themeConfig.preview.menu')}</span></nav><article><small>{t('themeConfig.preview.eyebrow')}</small><h2>{previewCopy.title}</h2><p>{previewCopy.description}</p><button>{t('themeConfig.preview.action')}</button></article><footer>{social.slice(0, 4).map((item) => item.network).join(' · ') || 'github · mastodon'}</footer></div>
          <p><AlertCircle size={13} /> {t('themeConfig.preview.hint')}</p>
        </aside>
      </div>

      <footer className="theme-config-footer"><small><History size={13} /> {t('themeConfig.recovery')}</small><button className="button quiet" onClick={load} disabled={working}><RefreshCw size={14} /> {t('common.refresh')}</button><button className="button quiet" onClick={() => setPresetOpen(true)} disabled={working}><Save size={14} /> {t('themeConfig.presets.save')}</button><button className="button primary" onClick={buildPreview} disabled={!changed || working}>{working ? <LoaderCircle className="spin" size={15} /> : <Eye size={15} />} {t('themeConfig.review')}</button></footer>

      {presetOpen && <div className="theme-preset-dialog" role="dialog" aria-modal="true" aria-labelledby="theme-preset-title"><section><h3 id="theme-preset-title">{t('themeConfig.presets.dialogTitle')}</h3><p>{t('themeConfig.presets.dialogCopy')}</p><label>{t('themeConfig.presets.name')}<input autoFocus value={presetName} onChange={(event) => setPresetName(event.target.value)} /></label><footer><button className="button quiet" onClick={() => setPresetOpen(false)}>{t('common.cancel')}</button><button className="button primary" disabled={!presetName.trim() || working} onClick={savePreset}>{t('themeConfig.presets.save')}</button></footer></section></div>}
      {preview && <ThemeChangePreview preview={preview} working={working} onClose={() => setPreview(null)} onOpen={openRealPreview} onApply={applyPreview} t={t} />}
    </div>
  )
}

function ControlEditor({ controls, values, onChange, t }) {
  if (!controls.length) return <div className="theme-config-empty"><Sparkles /><strong>{t('themeConfig.categoryEmptyTitle')}</strong><p>{t('themeConfig.categoryEmptyCopy')}</p></div>
  return <div className="theme-control-grid">{controls.map((control) => <label key={control.id} className={control.type === 'boolean' ? 'toggle' : ''}>
    <span><strong>{control.labelKey ? t(control.labelKey) : control.label}</strong><small>{t(`themeConfig.origins.${control.origin}`)} · <code>{control.path}</code></small></span>
    {control.type === 'boolean' ? <input type="checkbox" checked={Boolean(values[control.id])} onChange={(event) => onChange(control.id, event.target.checked)} /> : control.type === 'select' ? <select value={values[control.id] ?? ''} onChange={(event) => onChange(control.id, event.target.value)}>{control.options.map((option) => <option key={option} value={option}>{option}</option>)}</select> : control.type === 'color' ? <span className="theme-color-input"><input type="color" value={values[control.id] || '#558B6E'} onChange={(event) => onChange(control.id, event.target.value)} /><input value={values[control.id] || ''} onChange={(event) => onChange(control.id, event.target.value)} /></span> : <input type={control.type === 'number' ? 'number' : control.type === 'url' ? 'url' : 'text'} value={values[control.id] ?? ''} onChange={(event) => onChange(control.id, control.type === 'number' ? event.target.valueAsNumber : event.target.value)} />}
  </label>)}</div>
}

function NavigationEditor({ items, onChange, onMove, t }) {
  function update(index, patch) { onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)) }
  return <div className="theme-collection-editor"><header><strong>{t('themeConfig.navigation.title')}</strong><button className="button quiet" onClick={() => onChange([...items, { _id: localItemId(), name: '', pageRef: '/', url: '', weight: (items.length + 1) * 10, identifier: '', parent: '' }])}><Plus size={13} /> {t('themeConfig.navigation.add')}</button></header>{items.map((item, index) => <article key={item._id || index}><span className="theme-item-order"><button disabled={index === 0} title={t('themeConfig.navigation.up')} onClick={() => onMove(index, -1)}><ArrowUp size={12} /></button><button disabled={index === items.length - 1} title={t('themeConfig.navigation.down')} onClick={() => onMove(index, 1)}><ArrowDown size={12} /></button></span><label><small>{t('themeConfig.navigation.label')}</small><input value={item.name} onChange={(event) => update(index, { name: event.target.value })} /></label><label><small>{t('themeConfig.navigation.destination')}</small><input value={item.pageRef || item.url} placeholder="/about/" onChange={(event) => update(index, { pageRef: event.target.value, url: '' })} /></label><button className="theme-remove-item" title={t('common.delete')} onClick={() => onChange(items.filter((_entry, itemIndex) => itemIndex !== index))}><Trash2 size={13} /></button></article>)}{!items.length && <p>{t('themeConfig.navigation.empty')}</p>}</div>
}

function SocialEditor({ items, supported, onChange, t }) {
  if (!supported) return <div className="theme-config-empty"><Link2 /><strong>{t('themeConfig.social.unsupportedTitle')}</strong><p>{t('themeConfig.social.unsupportedCopy')}</p></div>
  function update(index, patch) { onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)) }
  return <div className="theme-collection-editor"><header><strong>{t('themeConfig.social.title')}</strong><button className="button quiet" onClick={() => onChange([...items, { _id: localItemId(), network: '', url: 'https://' }])}><Plus size={13} /> {t('themeConfig.social.add')}</button></header>{items.map((item, index) => <article key={item._id || index} className="social"><span className="theme-social-mark">@</span><label><small>{t('themeConfig.social.network')}</small><input value={item.network} placeholder="mastodon" onChange={(event) => update(index, { network: event.target.value })} /></label><label><small>{t('themeConfig.social.address')}</small><input value={item.url} placeholder="https://" onChange={(event) => update(index, { url: event.target.value })} /></label><button className="theme-remove-item" title={t('common.delete')} onClick={() => onChange(items.filter((_entry, itemIndex) => itemIndex !== index))}><Trash2 size={13} /></button></article>)}{!items.length && <p>{t('themeConfig.social.empty')}</p>}</div>
}

function ThemeError({ title, error, details, onRetry, t, compact = false }) {
  return <section className={`theme-config-error ${compact ? 'compact' : ''}`}><AlertCircle size={18} /><div><strong>{t(title)}</strong><p>{error}</p>{details && <details><summary>{t('themes.technicalDetails')}</summary><pre>{details}</pre></details>}</div><button className="button quiet" onClick={onRetry}><RefreshCw size={13} /> {t('common.retry')}</button></section>
}

function ThemeChangePreview({ preview, working, onClose, onOpen, onApply, t }) {
  return <div className="theme-change-preview" role="dialog" aria-modal="true" aria-labelledby="theme-impact-title"><section><header><div><span><Check size={18} /></span><div><h3 id="theme-impact-title">{t('themeConfig.impact.title')}</h3><p>{t('themeConfig.impact.copy')}</p></div></div><button className="icon-button" aria-label={t('common.close')} onClick={onClose}>×</button></header><dl><div><dt>{t('themeConfig.impact.settings')}</dt><dd>{preview.impact.settings}</dd></div><div><dt>{t('themeConfig.impact.files')}</dt><dd>{preview.impact.files}</dd></div><div><dt>{t('themeConfig.impact.categories')}</dt><dd>{preview.impact.categories.length}</dd></div><div><dt>{t('themeConfig.impact.build')}</dt><dd><Check size={12} /> {t('themeConfig.impact.passed')}</dd></div></dl><div className="theme-impact-list">{preview.changes.map((change) => <article key={change.id}><span><CategoryIcon category={change.category} size={13} /></span><div><strong>{change.path}</strong><small><code>{String(change.before)}</code><ChevronRight size={10} /><code>{String(change.after)}</code></small></div></article>)}</div><div className="theme-impact-safe"><ShieldCheck size={15} /><div><strong>{t('themeConfig.impact.safeTitle')}</strong><p>{t('themeConfig.impact.safeCopy', { files: preview.impact.targets.join(', ') })}</p></div></div><footer><button className="button quiet" onClick={onClose}>{t('common.cancel')}</button><button className="button quiet" onClick={onOpen} disabled={working}><Eye size={14} /> {t('themeConfig.impact.openPreview')}</button><button className="button primary" onClick={onApply} disabled={working}>{working ? <LoaderCircle className="spin" size={14} /> : <ArrowRight size={14} />} {t('themeConfig.impact.apply')}</button></footer></section></div>
}
