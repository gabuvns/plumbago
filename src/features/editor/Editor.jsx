import { useEffect, useMemo, useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import TurndownService from 'turndown'
import {
  AlertCircle, Bold, Check, Clock3, Code2, Heading2, ImagePlus, Italic, Link,
  List, LoaderCircle, LockKeyhole, PencilLine, Save, UploadCloud,
} from 'lucide-react'
import { api } from '../../app/api'
import { useI18n } from '../../i18n'
import { dateTimeInputValue } from '../../lib/dates'

const visualTurndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', codeBlockStyle: 'fenced' })

function MarkdownToolbar({ onFormat, onImages, disabled }) {
  const { t } = useI18n()
  return (
    <div className="markdown-toolbar" onMouseDown={(event) => { if (event.target.closest('button')) event.preventDefault() }}>
      <button disabled={disabled} onClick={() => onFormat('bold', '**', '**', t('toolbar.boldText'))} title={t('toolbar.bold')}><Bold size={16} /></button>
      <button disabled={disabled} onClick={() => onFormat('italic', '_', '_', t('toolbar.italicText'))} title={t('toolbar.italic')}><Italic size={16} /></button>
      <span />
      <button disabled={disabled} onClick={() => onFormat('formatBlock', '## ', '', t('toolbar.headingText'), 'h2')} title={t('toolbar.heading')}><Heading2 size={16} /></button>
      <button disabled={disabled} onClick={() => onFormat('insertUnorderedList', '- ', '', t('toolbar.listText'))} title={t('toolbar.list')}><List size={16} /></button>
      <button disabled={disabled} onClick={() => onFormat('createLink', '[', '](https://)', t('toolbar.linkText'), 'https://')} title={t('toolbar.link')}><Link size={16} /></button>
      <button disabled={disabled} onClick={onImages} title={t('toolbar.images')}><ImagePlus size={16} /></button>
      <span />
      <button disabled={disabled} onClick={() => onFormat('formatBlock', '`', '`', t('toolbar.codeText'), 'pre')} title={t('toolbar.code')}><Code2 size={16} /></button>
    </div>
  )
}

function VisualEditor({ html, assetMap, onChange, placeholder, readOnly }) {
  const editorRef = useRef(null)

  useEffect(() => {
    if (editorRef.current && document.activeElement !== editorRef.current && editorRef.current.innerHTML !== html) editorRef.current.innerHTML = html
  }, [html])

  function update(event) {
    if (readOnly) return
    let nextHtml = DOMPurify.sanitize(event.currentTarget.innerHTML)
    for (const [name, data] of Object.entries(assetMap)) nextHtml = nextHtml.replaceAll(data, name)
    onChange(visualTurndown.turndown(nextHtml))
  }

  return <div ref={editorRef} className="visual-editor" contentEditable={!readOnly} suppressContentEditableWarning data-placeholder={placeholder} onInput={update} spellCheck="true" aria-readonly={readOnly} />
}

export function Editor({ post, locked = false, onUnlock, onChange, onSave, onOpenImages, onDropImages, saveState }) {
  const { t } = useI18n()
  const [mode, setMode] = useState('split')
  const [assetMap, setAssetMap] = useState({})
  const [dragging, setDragging] = useState(false)
  const textareaRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    Promise.all((post.assets || []).map(async (name) => [name, await api.readAsset(post.id, name)]))
      .then((entries) => { if (!cancelled) setAssetMap(Object.fromEntries(entries)) })
      .catch(() => setAssetMap({}))
    return () => { cancelled = true }
  }, [post.id, post.assets])

  const preview = useMemo(() => {
    let markdown = post.body || ''
    for (const [name, data] of Object.entries(assetMap)) markdown = markdown.replaceAll(`](${name})`, `](${data})`)
    return DOMPurify.sanitize(marked.parse(markdown, { breaks: true }))
  }, [assetMap, post.body])

  function format(command, before, after, fallback, commandValue) {
    if (locked) return
    if (mode === 'visual') {
      document.execCommand(command, false, commandValue)
      return
    }
    const textarea = textareaRef.current
    if (!textarea) return
    const body = post.body || ''
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = body.slice(start, end) || fallback
    const value = `${body.slice(0, start)}${before}${selected}${after}${body.slice(end)}`
    onChange({ body: value })
    requestAnimationFrame(() => { textarea.focus(); textarea.setSelectionRange(start + before.length, start + before.length + selected.length) })
  }

  function drop(event) {
    event.preventDefault()
    setDragging(false)
    if (locked) return
    const files = Array.from(event.dataTransfer.files || [])
    if (files.length) onDropImages(files)
  }

  const status = locked
    ? { icon: <LockKeyhole size={14} />, label: t('editor.protected'), className: 'protected' }
    : saveState.saving
    ? { icon: <LoaderCircle className="spin" size={14} />, label: t('editor.saving'), className: 'saving' }
    : saveState.error
      ? { icon: <AlertCircle size={14} />, label: t('editor.saveError'), className: 'error' }
      : saveState.dirty
        ? { icon: <Clock3 size={14} />, label: t('editor.unsaved'), className: 'dirty' }
        : { icon: <Check size={14} />, label: t('editor.saved'), className: 'saved' }

  return (
    <section
      className={`editor ${locked ? 'is-locked' : ''} ${dragging ? 'is-dragging' : ''}`}
      onDragEnter={(event) => { if (!locked && event.dataTransfer.types.includes('Files')) { event.preventDefault(); setDragging(true) } }}
      onDragOver={(event) => { if (!locked && event.dataTransfer.types.includes('Files')) event.preventDefault() }}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false) }}
      onDrop={drop}
    >
      {dragging && <div className="editor-drop-overlay"><div><UploadCloud size={34} /><strong>{t('editor.dropTitle')}</strong><span>{t('editor.dropTypes')}</span></div></div>}
      {locked && <div className="editor-protection" role="status"><LockKeyhole size={18} /><div><strong>{t('editor.protectedTitle')}</strong><span>{t('editor.protectedCopy')}</span></div><button className="button primary" type="button" onClick={onUnlock}><PencilLine size={15} /> {t('editor.startRevision')}</button></div>}
      <div className="editor-title-row">
        <input className="title-input" value={post.title} disabled={locked} onChange={(event) => onChange({ title: event.target.value })} placeholder={t('editor.title')} />
        <div className={`save-state ${status.className}`}>{status.icon} {status.label}</div>
        <button className="button quiet save-now" onClick={onSave} disabled={locked || saveState.saving || !saveState.dirty}><Save size={15} /> {t('editor.saveNow')}</button>
      </div>
      <input className="description-input" value={post.description} disabled={locked} onChange={(event) => onChange({ description: event.target.value })} placeholder={t('editor.description')} />
      <div className="metadata-row">
        <label>{t('editor.date')}<input type="date" value={post.date} disabled={locked} onChange={(event) => onChange({ date: event.target.value })} /></label>
        <label>{t('editor.schedule')}<input type="datetime-local" value={dateTimeInputValue(post.publishDate)} disabled={locked} onChange={(event) => onChange({ publishDate: event.target.value ? new Date(event.target.value).toISOString() : '' })} /></label>
        <label>{t('editor.tags')}<input value={post.tags.join(', ')} disabled={locked} onChange={(event) => onChange({ tags: event.target.value.split(',').map((tag) => tag.trim()) })} placeholder={t('editor.tagsPlaceholder')} /></label>
        <label className={`draft-toggle ${locked ? 'disabled' : ''}`}><input type="checkbox" checked={!post.draft} disabled={locked} onChange={(event) => onChange({ draft: !event.target.checked })} /><span /> {t('editor.published')}</label>
      </div>
      <div className="editor-controls">
        <MarkdownToolbar onFormat={format} onImages={onOpenImages} disabled={locked} />
        <div className="view-toggle"><button className={mode === 'visual' ? 'active' : ''} onClick={() => setMode('visual')}>{t('editor.visual')}</button><button className={mode === 'write' ? 'active' : ''} onClick={() => setMode('write')}>{t('editor.write')}</button><button className={mode === 'split' ? 'active' : ''} onClick={() => setMode('split')}>{t('editor.split')}</button><button className={mode === 'preview' ? 'active' : ''} onClick={() => setMode('preview')}>{t('editor.preview')}</button></div>
      </div>
      <div className={`editor-workspace mode-${mode}`}>
        {mode === 'visual' && <VisualEditor html={preview} assetMap={assetMap} onChange={(body) => onChange({ body })} placeholder={t('editor.visualPlaceholder')} readOnly={locked} />}
        {!['preview', 'visual'].includes(mode) && <textarea ref={textareaRef} value={post.body || ''} readOnly={locked} aria-readonly={locked} onChange={(event) => onChange({ body: event.target.value })} placeholder={t('editor.placeholder')} spellCheck="true" />}
        {!['write', 'visual'].includes(mode) && <article className="markdown-preview" dangerouslySetInnerHTML={{ __html: preview }} />}
      </div>
      <footer className="editor-footer"><span>{t('editor.markdown')}</span><span>{t('editor.words', { count: post.body?.trim() ? post.body.trim().split(/\s+/).length : 0 })}</span><span className="autosave-hint">{t(locked ? 'editor.protectedHint' : 'editor.autosaveHint')}</span><button className="button primary compact" onClick={onSave} disabled={locked || saveState.saving || !saveState.dirty}><Save size={15} /> {t('common.save')}</button></footer>
    </section>
  )
}
