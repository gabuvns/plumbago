const path = require('node:path')
const { fetchText } = require('../core/http.cjs')

const THEME_CATALOG_URL = 'https://themes.gohugo.io/'
const THEME_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,100}$/
let themeCatalogCache = null
let themeCatalogCachedAt = 0

function decodeHtml(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
}

function parseThemeCatalog(html) {
  const themes = []
  const seen = new Set()
  const linkPattern = /<a\s+href=\/themes\/([^/\s]+)\/[^>]*>\s*<span[^>]*>View details for ([^<]+)<\/span>/gi
  for (const match of html.matchAll(linkPattern)) {
    const slug = match[1].toLowerCase()
    if (!THEME_SLUG_PATTERN.test(slug) || seen.has(slug)) continue
    const nearbyMarkup = html.slice(Math.max(0, match.index - 1_300), match.index)
    const images = [...nearbyMarkup.matchAll(/(?:src|srcset)=([^\s>]+)/gi)]
    const imagePath = images.at(-1)?.[1]?.replace(/^['"]|['"]$/g, '') || `/themes/${slug}/tn-featured.png`
    seen.add(slug)
    themes.push({
      slug,
      name: decodeHtml(match[2].trim()),
      image: new URL(imagePath, THEME_CATALOG_URL).href,
      details: `${THEME_CATALOG_URL}themes/${slug}/`,
    })
  }
  return themes
}

function parseThemeRepository(html) {
  for (const match of html.matchAll(/<a\b([^>]+)>/gi)) {
    const attributes = match[1]
    if (!/\brel=(?:"[^"]*nofollow[^"]*"|'[^']*nofollow[^']*'|nofollow)(?:\s|$)/i.test(attributes)) continue
    const href = attributes.match(/\bhref=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i)
    const candidate = href?.[1] || href?.[2] || href?.[3]
    if (!candidate) continue
    let url
    try { url = new URL(candidate) } catch { continue }
    if (!['github.com', 'gitlab.com', 'codeberg.org'].includes(url.hostname)) continue
    const segments = url.pathname.replace(/\.git\/?$/, '').split('/').filter(Boolean)
    if (segments.at(-1)?.match(/^v\d+$/i)) segments.pop()
    if (segments.length < 2) continue
    url.pathname = `/${segments.join('/')}.git`
    url.search = ''
    url.hash = ''
    return url.href
  }
  throw new Error('O repositório deste tema não foi encontrado no catálogo oficial do Hugo.')
}

async function listThemes() {
  if (themeCatalogCache && Date.now() - themeCatalogCachedAt < 15 * 60_000) return themeCatalogCache
  const themes = parseThemeCatalog(await fetchText(THEME_CATALOG_URL))
  if (!themes.length) throw new Error('O catálogo oficial de temas do Hugo não pôde ser lido.')
  themeCatalogCache = themes
  themeCatalogCachedAt = Date.now()
  return themes
}

async function resolveTheme(slug) {
  const safeSlug = String(slug || '').toLowerCase()
  if (!THEME_SLUG_PATTERN.test(safeSlug)) throw new Error('Tema inválido.')
  const details = `${THEME_CATALOG_URL}themes/${safeSlug}/`
  const repository = parseThemeRepository(await fetchText(details))
  const folder = path.basename(new URL(repository).pathname, '.git')
  return { slug: safeSlug, details, repository, folder }
}

module.exports = { listThemes, parseThemeCatalog, parseThemeRepository, resolveTheme }
