const samplePosts = [
  { id: 'content/posts/cultivando-ideias/index.pt-br.md', title: 'Cultivando ideias com calma', description: 'Notas sobre processo criativo, referências e espaço para experimentar.', date: '2026-08-07', publishDate: '', expiryDate: '', lastmod: '', draft: false, language: 'pt-br', featuredImage: '', revision: 'demo-1', tags: ['Processo', 'Arte'], taxonomies: { tags: ['Processo', 'Arte'], categories: ['Criatividade'], authors: ['Equipe Plumbago'] } },
  { id: 'content/posts/cores-do-inverno/index.pt-br.md', title: 'As cores do inverno', description: 'Uma pequena coleção de estudos de cor.', date: '2026-08-04', publishDate: '2026-08-18T13:30:00.000Z', expiryDate: '', lastmod: '', draft: false, language: 'pt-br', featuredImage: '', revision: 'demo-2', tags: ['arte', 'Paletas'], taxonomies: { tags: ['arte', 'Paletas'], categories: ['Processo'], authors: ['Equipe Plumbago'] } },
  { id: 'content/posts/primeiro-caderno/index.en-us.md', title: 'Notes from the first sketchbook', description: 'A look back at the first pages.', date: '2026-07-28', publishDate: '', expiryDate: '', lastmod: '', draft: true, language: 'en-us', featuredImage: '', revision: 'demo-3', tags: [], taxonomies: { tags: [], categories: [], authors: [] } },
]

const samplePages = [
  { id: 'content/about/index.en-us.md', title: 'About Plumbago Studio', description: 'The people and ideas behind this journal.', route: '/about/', routeScope: 'language', explicitUrl: false, aliases: ['/our-story/'], menus: ['main'], language: 'en-us', draft: false, kind: 'leaf', section: 'about', layout: '', type: '', themeDependent: false, unknownFields: ['params'], revision: 'demo-page-about-en', resources: ['portrait.svg'], translations: ['content/about/index.en-us.md', 'content/about/index.pt-br.md'], sharedBundle: true, canRemoveBundle: false, descendants: [], translationKey: 'about', bodyExcerpt: 'A quiet studio for experiments in writing, illustration, and the spaces between them.' },
  { id: 'content/about/index.pt-br.md', title: 'Sobre o Estúdio Plumbago', description: 'As pessoas e ideias por trás deste diário.', route: '/about/', routeScope: 'language', explicitUrl: false, aliases: [], menus: [], language: 'pt-br', draft: true, kind: 'leaf', section: 'about', layout: '', type: '', themeDependent: false, unknownFields: [], revision: 'demo-page-about-pt', resources: ['portrait.svg'], translations: ['content/about/index.en-us.md', 'content/about/index.pt-br.md'], sharedBundle: true, canRemoveBundle: false, descendants: [], translationKey: 'about', bodyExcerpt: 'Um estúdio tranquilo para experiências com escrita, ilustração e tudo que existe entre elas.' },
  { id: 'content/gallery/index.en-us.md', title: 'Gallery', description: 'Selected visual studies.', route: '/gallery/', routeScope: 'language', explicitUrl: false, aliases: [], menus: ['main'], language: 'en-us', draft: false, kind: 'leaf', section: 'gallery', layout: 'masonry', type: 'gallery', themeDependent: true, unknownFields: ['params'], revision: 'demo-page-gallery', resources: ['winter.svg', 'plumbago.svg'], translations: ['content/gallery/index.en-us.md'], sharedBundle: false, canRemoveBundle: true, descendants: [], translationKey: '', bodyExcerpt: 'A growing collection of color, type, and illustration studies.' },
  { id: 'content/contact.en-us.md', title: 'Contact', description: 'A simple contact page.', route: '/contact/', routeScope: 'language', explicitUrl: false, aliases: [], menus: ['footer'], language: 'en-us', draft: true, kind: 'standalone', section: 'contact', layout: '', type: '', themeDependent: false, unknownFields: [], revision: 'demo-page-contact', resources: [], translations: ['content/contact.en-us.md'], sharedBundle: false, canRemoveBundle: false, descendants: [], translationKey: '', bodyExcerpt: 'Send a note about collaborations, workshops, or a project you would like to share.' },
  { id: 'content/work.en-us.md', title: 'Selected work', description: 'An older route kept for readers.', route: '/work/', routeScope: 'language', explicitUrl: false, aliases: ['/gallery/'], menus: [], language: 'en-us', draft: false, kind: 'standalone', section: 'work', layout: 'archive', type: '', themeDependent: true, unknownFields: [], revision: 'demo-page-work', resources: [], translations: ['content/work.en-us.md'], sharedBundle: false, canRemoveBundle: false, descendants: [], translationKey: '', bodyExcerpt: 'A compact archive that still redirects readers through its previous gallery address.' },
]

const bodies = {
  [samplePosts[0].id]: `A criatividade nem sempre chega fazendo barulho. Às vezes ela começa como uma pergunta pequena, anotada no canto de uma página.\n\n## Um espaço para experimentar\n\nMeu processo ficou mais leve quando parei de exigir que toda ideia nascesse pronta. Hoje, guardo referências, testo combinações e deixo que cada trabalho encontre seu próprio ritmo.\n\n> Criar também é aprender a observar.\n\nSe você quiser acompanhar os próximos estudos, visite [meu portfólio](https://example.com).`,
  [samplePosts[1].id]: 'Ainda estou organizando os estudos desta série.\n\n## Paleta\n\nAzuis profundos, verdes acinzentados e pequenos pontos de calor.',
  [samplePosts[2].id]: 'A few pages, loose lines, and the beginning of a visual language.',
}

const demoThemes = [
  { slug: 'hugo-book', name: 'Book', image: 'https://themes.gohugo.io/themes/hugo-book/tn-featured.png', details: 'https://themes.gohugo.io/themes/hugo-book/' },
  { slug: 'hugo-coder', name: 'Coder', image: 'https://themes.gohugo.io/themes/hugo-coder/tn-featured.png', details: 'https://themes.gohugo.io/themes/hugo-coder/' },
  { slug: 'hugo-papermod', name: 'PaperMod', image: 'https://themes.gohugo.io/themes/hugo-papermod/tn-featured.png', details: 'https://themes.gohugo.io/themes/hugo-papermod/' },
  { slug: 'ananke', name: 'Ananke', image: 'https://themes.gohugo.io/themes/ananke/tn-featured.png', details: 'https://themes.gohugo.io/themes/ananke/' },
  { slug: 'hugo-theme-stack', name: 'Stack', image: 'https://themes.gohugo.io/themes/hugo-theme-stack/tn-featured.png', details: 'https://themes.gohugo.io/themes/hugo-theme-stack/' },
  { slug: 'blowfish', name: 'Blowfish', image: 'https://themes.gohugo.io/themes/blowfish/tn-featured.png', details: 'https://themes.gohugo.io/themes/blowfish/' },
]

const demoThemeControls = [
  { id: 'setting:title', category: 'identity', path: 'title', label: 'Title', labelKey: 'themeConfig.controls.title', type: 'text', value: 'Meu blog', defaultValue: '', isSet: true, options: [], origin: 'project', sourceFile: 'hugo.toml' },
  { id: 'setting:copyright', category: 'identity', path: 'copyright', label: 'Copyright', labelKey: 'themeConfig.controls.copyright', type: 'text', value: '© 2026 Você', defaultValue: '', isSet: true, options: [], origin: 'project', sourceFile: 'hugo.toml' },
  { id: 'setting:params.description', category: 'identity', path: 'params.description', label: 'Description', labelKey: 'themeConfig.controls.description', type: 'text', value: 'Notas sobre processo criativo, cores e observação.', defaultValue: 'A personal journal.', isSet: true, options: [], origin: 'project', sourceFile: 'hugo.toml' },
  { id: 'setting:params.primarycolor', category: 'colors', path: 'params.primaryColor', label: 'Primary Color', labelKey: 'themeConfig.controls.accentColor', type: 'color', value: '#558B6E', defaultValue: '#558B6E', isSet: true, options: [], origin: 'project', sourceFile: 'config/_default/params.toml' },
  { id: 'setting:params.defaulttheme', category: 'colors', path: 'params.defaultTheme', label: 'Default Theme', labelKey: 'themeConfig.controls.appearance', type: 'select', value: 'auto', defaultValue: 'auto', isSet: true, options: ['auto', 'light', 'dark'], origin: 'adapter', sourceFile: 'config/_default/params.toml' },
  { id: 'setting:params.bodyfont', category: 'typography', path: 'params.bodyFont', label: 'Body Font', labelKey: 'themeConfig.controls.bodyFont', type: 'text', value: 'Inter', defaultValue: 'system-ui', isSet: true, options: [], origin: 'theme-example', sourceFile: 'config/_default/params.toml' },
  { id: 'setting:params.headingfont', category: 'typography', path: 'params.headingFont', label: 'Heading Font', labelKey: 'themeConfig.controls.headingFont', type: 'text', value: 'Georgia', defaultValue: 'serif', isSet: true, options: [], origin: 'theme-example', sourceFile: 'config/_default/params.toml' },
  { id: 'setting:params.profilemode.enabled', category: 'homepage', path: 'params.profileMode.enabled', label: 'Profile Mode', labelKey: 'themeConfig.controls.profileEnabled', type: 'boolean', value: true, defaultValue: false, isSet: true, options: [], origin: 'adapter', sourceFile: 'config/_default/params.toml' },
  { id: 'setting:params.profilemode.title', category: 'homepage', path: 'params.profileMode.title', label: 'Profile Title', labelKey: 'themeConfig.controls.profileTitle', type: 'text', value: 'Cultivando ideias', defaultValue: '', isSet: true, options: [], origin: 'adapter', sourceFile: 'config/_default/params.toml' },
  { id: 'setting:params.profilemode.subtitle', category: 'homepage', path: 'params.profileMode.subtitle', label: 'Profile Subtitle', labelKey: 'themeConfig.controls.profileSubtitle', type: 'text', value: 'Um diário visual e escrito.', defaultValue: '', isSet: true, options: [], origin: 'adapter', sourceFile: 'config/_default/params.toml' },
]

function demoThemeConfiguration(theme, state, presets, unsupported = false) {
  const controls = unsupported ? state.controls.filter((item) => item.category === 'identity' && ['setting:title', 'setting:copyright'].includes(item.id)) : state.controls
  const categories = ['identity', 'colors', 'typography', 'navigation', 'social', 'homepage'].map((id) => ({ id, controls: controls.filter((control) => control.category === id) }))
  return {
    revision: state.revision,
    theme: { id: theme, name: unsupported ? 'Handmade theme' : theme === 'hugo-papermod' ? 'PaperMod' : theme, adapter: unsupported ? 'generic' : theme, supportLevel: unsupported ? 'unsupported' : 'supported', installed: true, multiple: false },
    categories,
    navigation: unsupported ? { id: 'navigation:main', path: '', support: 'unsupported', items: [], suggestedCount: 0, sourceRelative: '' } : { id: 'navigation:main', path: 'menus.main', support: 'configured', items: state.navigation, suggestedCount: 0, sourceRelative: 'hugo.toml' },
    social: unsupported ? { id: 'social:links', path: '', support: 'unsupported', shape: '', items: [], suggestedCount: 0, sourceRelative: '' } : { id: 'social:links', path: 'params.socialIcons', support: 'configured', shape: 'array-pairs', items: state.social, suggestedCount: 0, sourceRelative: 'config/_default/params.toml' },
    unsupported: unsupported ? [{ path: 'params.handmade.layout', kind: 'string' }, { path: 'params.handmade.heroBlocks', kind: 'list' }, { path: 'params.experiments.motion', kind: 'boolean' }] : [{ path: 'params.cover.hidden', kind: 'boolean' }, { path: 'params.assets.disableFingerprinting', kind: 'boolean' }],
    configFiles: ['hugo.toml', 'config/_default/params.toml'],
    warnings: [],
    presets,
    summary: { controls: controls.length, categories: categories.filter((item) => item.controls.length || (item.id === 'navigation' && !unsupported) || (item.id === 'social' && !unsupported)).length, unsupported: unsupported ? 3 : 2, presets: presets.length },
  }
}

function fullPost(summary) {
  const assets = summary.id === samplePosts[0].id ? ['estudo-plumbago.svg'] : []
  return { ...summary, tags: summary.tags || summary.taxonomies?.tags || [], taxonomies: summary.taxonomies || {}, translationKey: summary.id.split('/')[2], body: bodies[summary.id] || '', assets }
}

function demoWallToIso(value, timeZone) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  if (!match) throw new Error('Choose a complete date and time.')
  const desired = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]), hour: Number(match[4]), minute: Number(match[5]) }
  const target = Date.UTC(desired.year, desired.month - 1, desired.day, desired.hour, desired.minute)
  const partsAt = (instant) => Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(instant)).filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]))
  let guess = target
  for (let index = 0; index < 4; index += 1) {
    const parts = partsAt(guess)
    guess = target - (Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) - guess)
  }
  return new Date(guess).toISOString()
}

function demoCalendarPreview(posts, input) {
  const { postId, action, publishLocal, expiryLocal, timeZone } = input
  const item = posts.find((post) => post.id === postId)
  if (!item) throw new Error('Post not found.')
  const publishDate = action === 'publish-now' ? input.publishInstant || '2026-08-11T12:00:00.000Z' : action === 'cancel' ? '' : demoWallToIso(publishLocal, timeZone)
  const next = { ...item, draft: action === 'cancel', publishDate, expiryDate: action === 'schedule' && expiryLocal ? demoWallToIso(expiryLocal, timeZone) : action === 'schedule' ? '' : item.expiryDate }
  const fields = ['draft', 'publishDate', 'expiryDate']
  return { action, timeZone, ambiguous: false, post: { id: item.id, title: item.title, revision: item.revision }, changes: fields.filter((field) => item[field] !== next[field]).map((field) => ({ field, before: item[field], after: next[field] })), next }
}

const demoTaxonomyDefinitions = [
  { id: 'tags', singular: 'tag', plural: 'tags', route: '/tags/' },
  { id: 'categories', singular: 'category', plural: 'categories', route: '/categories/' },
  { id: 'authors', singular: 'author', plural: 'authors', route: '/authors/' },
]

function demoTermIdentity(value) {
  return String(value || '').trim().toLocaleLowerCase('en-US')
}

function demoTermSlug(value) {
  return demoTermIdentity(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function demoTerms(post, taxonomy) {
  return [...(post.taxonomies?.[taxonomy] || (taxonomy === 'tags' ? post.tags : []) || [])]
}

function demoTaxonomyIndex(posts) {
  const taxonomies = demoTaxonomyDefinitions.map((definition) => {
    const terms = new Map()
    for (const post of posts) {
      for (const name of demoTerms(post, definition.id)) {
        const current = terms.get(name) || { id: name, name, posts: [], languages: new Set(), draftCount: 0, publishedCount: 0, termPage: '' }
        current.posts.push(post.id)
        current.languages.add(post.language)
        if (post.draft) current.draftCount += 1
        else current.publishedCount += 1
        terms.set(name, current)
      }
    }
    if (definition.id === 'categories') terms.set('Archive', { id: 'Archive', name: 'Archive', posts: [], languages: new Set(), draftCount: 0, publishedCount: 0, termPage: 'content/categories/archive' })
    const items = [...terms.values()].map((term) => ({ ...term, languages: [...term.languages].sort(), count: term.posts.length, empty: term.posts.length === 0, route: `/${definition.plural}/${demoTermSlug(term.name)}/` })).sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
    const groups = new Map()
    for (const term of items) groups.set(demoTermSlug(term.name), [...(groups.get(demoTermSlug(term.name)) || []), term.name])
    const variants = [...groups.entries()].filter(([, names]) => names.length > 1).map(([identity, names]) => ({ identity, names }))
    return { ...definition, terms: items, variants, emptyTerms: items.filter((term) => term.empty).map((term) => term.name) }
  })
  const publicPosts = posts.map((post) => ({ id: post.id, title: post.title, language: post.language, draft: post.draft, taxonomies: Object.fromEntries(demoTaxonomyDefinitions.map((definition) => [definition.id, demoTerms(post, definition.id)])) }))
  const unclassified = publicPosts.filter((post) => demoTaxonomyDefinitions.every((definition) => !post.taxonomies[definition.id].length))
  return { config: 'hugo.toml', definitions: demoTaxonomyDefinitions, routesEnabled: true, taxonomies, posts: publicPosts, unclassified, unsupported: [], summary: { taxonomies: taxonomies.length, terms: taxonomies.reduce((total, taxonomy) => total + taxonomy.terms.length, 0), variants: taxonomies.reduce((total, taxonomy) => total + taxonomy.variants.length, 0), emptyTerms: taxonomies.reduce((total, taxonomy) => total + taxonomy.emptyTerms.length, 0), unclassified: unclassified.length, posts: posts.length } }
}

function demoTaxonomyPreview(posts, input) {
  const definition = demoTaxonomyDefinitions.find((item) => item.id === input.taxonomy)
  if (!definition) throw new Error('Choose a configured Hugo taxonomy.')
  const sourceTerm = String(input.sourceTerm || '').trim()
  const targetTerm = String(input.targetTerm || '').trim()
  const addTerms = [...new Set((input.addTerms || []).map((term) => String(term).trim()).filter(Boolean))]
  const removeTerms = new Set((input.removeTerms || []).map(demoTermIdentity))
  const selected = new Set(input.postIds || [])
  const targetExists = posts.some((post) => demoTerms(post, definition.id).some((term) => demoTermIdentity(term) === demoTermIdentity(targetTerm) && String(term).trim().normalize('NFKC') !== sourceTerm.normalize('NFKC')))
  const action = input.action === 'rename' && targetExists ? 'merge' : input.action
  const changes = posts.flatMap((post) => {
    if (action === 'assign' && !selected.has(post.id)) return []
    const before = demoTerms(post, definition.id)
    const candidates = action === 'assign'
      ? [...before.filter((term) => !removeTerms.has(demoTermIdentity(term))), ...addTerms]
      : before.map((term) => demoTermIdentity(term) === demoTermIdentity(sourceTerm) ? targetTerm : term)
    const seen = new Set()
    const after = candidates.filter((term) => { const identity = demoTermIdentity(term); if (!identity || seen.has(identity)) return false; seen.add(identity); return true })
    if (JSON.stringify(before) === JSON.stringify(after)) return []
    return [{ postId: post.id, title: post.title, language: post.language, draft: post.draft, before, after, revision: post.revision }]
  })
  if (!changes.length) throw new Error('This change would not modify any supported post.')
  return { action, taxonomy: definition, sourceTerm, targetTerm, addTerms, removeTerms: [...removeTerms], changes, skipped: [], revisions: Object.fromEntries(changes.map((change) => [change.postId, change.revision])), impact: { files: changes.length, published: changes.filter((change) => !change.draft).length, drafts: changes.filter((change) => change.draft).length, languages: [...new Set(changes.map((change) => change.language))].sort(), routeBefore: sourceTerm ? `/${definition.plural}/${demoTermSlug(sourceTerm)}/` : '', routeAfter: targetTerm ? `/${definition.plural}/${demoTermSlug(targetTerm)}/` : '', targetExists, aliasesPreserved: false } }
}

function demoPageRoute(value) {
  const segments = String(value || '').trim().replaceAll('\\', '/').split(/[?#]/, 1)[0].split('/').filter(Boolean).map((segment) => segment.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')).filter(Boolean)
  if (!segments.length) throw new Error('Choose a page route below the site root.')
  return `/${segments.join('/')}/`
}

function demoLanguagesOverlap(left, right, leftScope = 'language', rightScope = 'language') {
  return leftScope === 'root' || rightScope === 'root' || left === right || left === 'default' || right === 'default'
}

function demoPageInventory(pages) {
  const virtualRoutes = [
    { id: 'virtual:section:posts', title: 'posts', route: '/posts/', kind: 'section', language: 'default', routeScope: 'language', virtual: true },
    ...demoTaxonomyDefinitions.map((item) => ({ id: `virtual:taxonomy:${item.id}`, title: item.plural, route: item.route, kind: 'taxonomy', language: 'default', routeScope: 'language', virtual: true })),
  ]
  const routes = pages.flatMap((page) => [
    { id: page.id, title: page.title, route: page.route, routeScope: page.routeScope || 'language', language: page.language, kind: 'page', virtual: false },
    ...page.aliases.map((route) => ({ id: page.id, title: page.title, route, routeScope: 'language', language: page.language, kind: 'alias', virtual: false })),
  ]).concat(virtualRoutes)
  const collisions = []
  for (let leftIndex = 0; leftIndex < routes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < routes.length; rightIndex += 1) {
      const left = routes[leftIndex]
      const right = routes[rightIndex]
      if (left.id === right.id || left.route.toLowerCase() !== right.route.toLowerCase() || !demoLanguagesOverlap(left.language, right.language, left.routeScope, right.routeScope)) continue
      const key = [left.id, right.id].sort().join('|')
      if (!collisions.some((item) => item.key === key && item.route.toLowerCase() === left.route.toLowerCase())) collisions.push({ key, route: left.route, language: left.language === right.language ? left.language : 'shared', entries: [left, right] })
    }
  }
  const collisionIds = new Set(collisions.flatMap((collision) => collision.entries.map((entry) => entry.id)))
  const publicPages = pages.map((page) => ({ ...page, collision: collisionIds.has(page.id) })).sort((left, right) => left.route.localeCompare(right.route) || left.language.localeCompare(right.language))
  return {
    pages: publicPages,
    routes,
    languages: [...new Set([...pages.map((page) => page.language), 'en-us', 'pt-br'])],
    virtualRoutes: virtualRoutes.map(({ id, title, route, kind }) => ({ id, title, route, kind })),
    collisions,
    unsupported: [],
    summary: { pages: pages.length, published: pages.filter((page) => !page.draft).length, drafts: pages.filter((page) => page.draft).length, menuPages: pages.filter((page) => page.menus.length).length, collisions: collisions.length, themeDependent: pages.filter((page) => page.themeDependent).length },
  }
}

function demoPagePreview(pages, input) {
  const action = String(input.action || '')
  const inventory = demoPageInventory(pages)
  if (action === 'create') {
    const title = String(input.title || '').trim()
    const route = demoPageRoute(input.route)
    const language = String(input.language || 'en-us').toLowerCase()
    const kind = ['leaf', 'branch', 'standalone'].includes(input.kind) ? input.kind : 'leaf'
    if (!title) throw new Error('Give the new page a title.')
    const conflict = inventory.routes.find((entry) => entry.route.toLowerCase() === route.toLowerCase() && demoLanguagesOverlap(entry.language, language, entry.routeScope, 'language'))
    if (conflict) throw new Error(`${route} is already used by ${conflict.title}. Choose another route.`)
    const base = route.split('/').filter(Boolean).join('/')
    const id = kind === 'standalone' ? `content/${base}.${language}.md` : `content/${base}/${kind === 'branch' ? '_index' : 'index'}.${language}.md`
    return { action, page: { id, title, language, kind, route, draft: input.draft !== false }, changes: [{ kind: 'create', path: id }], conflicts: [], revisions: { [id]: '' }, impact: { files: 1, resources: 0, translations: 1, routeBefore: '', routeAfter: route, aliasesAdded: [], menus: input.menu ? [input.menu] : [], published: input.draft === false ? 1 : 0, drafts: input.draft === false ? 0 : 1 } }
  }
  const page = pages.find((item) => item.id === input.id)
  if (!page) throw new Error('Choose a page from this blog.')
  if (action === 'rename') {
    if (page.isHome) throw new Error('The Hugo homepage always uses the site root and cannot be renamed here.')
    const route = demoPageRoute(input.route)
    const conflict = inventory.routes.find((entry) => entry.id !== page.id && entry.route.toLowerCase() === route.toLowerCase() && demoLanguagesOverlap(entry.language, page.language, entry.routeScope, 'language'))
    if (conflict) throw new Error(`${route} is already used by ${conflict.title}. Choose another route.`)
    if (route === page.route) throw new Error('Choose a different public route for this page.')
    const aliasesAdded = input.preserveAlias === false || page.aliases.includes(page.route) ? [] : [page.route]
    return { action, page, changes: [{ kind: 'update', path: page.id, field: 'url', before: page.route, after: route }], conflicts: [], revisions: { [page.id]: page.revision }, impact: { files: 1, resources: page.resources.length, translations: page.translations.length, routeBefore: page.route, routeAfter: route, routeScopeAfter: 'language', urlValue: route.replace(/^\//, ''), aliasesAdded, menus: page.menus, published: page.draft ? 0 : 1, drafts: page.draft ? 1 : 0 } }
  }
  if (action !== 'delete') throw new Error('Choose a supported page change.')
  if (page.kind === 'branch') throw new Error('Remove section pages through their original Hugo files so descendant routes are not misrepresented.')
  const removeBundle = Boolean(input.includeResources && page.canRemoveBundle)
  return { action, page, changes: [{ kind: 'delete', path: removeBundle ? page.id.slice(0, page.id.lastIndexOf('/')) : page.id }], conflicts: [], revisions: { [page.id]: page.revision }, impact: { files: removeBundle ? page.resources.length + 1 : 1, resources: page.resources.length, translations: page.translations.length, descendants: page.descendants.length, routeBefore: page.route, routeAfter: '', aliasesAdded: [], menus: page.menus, published: page.draft ? 0 : 1, drafts: page.draft ? 1 : 0, removeBundle, resourcesPreserved: !removeBundle && page.resources.length > 0, sharedBundle: page.sharedBundle, canRemoveBundle: page.canRemoveBundle } }
}

export function createDemoBridge() {
  let posts = [...samplePosts]
  let pages = samplePages.map((page) => ({ ...page, aliases: [...page.aliases], menus: [...page.menus], resources: [...page.resources], translations: [...page.translations], descendants: [...page.descendants], unknownFields: [...page.unknownFields] }))
  let recoveryPoints = [
    { id: 'demo-recovery-theme', reason: 'before-theme-change', label: '', createdAt: '2026-08-10T15:20:00.000Z', targets: ['hugo.toml', 'themes/hugo-papermod'] },
    { id: 'demo-recovery-import', reason: 'before-import', label: '', createdAt: '2026-08-09T18:45:00.000Z', targets: ['content', 'hugo.toml'] },
  ]
  let trash = [{
    id: 'demo-trash-1',
    postId: 'content/posts/rascunho-descartado/index.pt-br.md',
    title: 'Um rascunho que pode voltar',
    deletedAt: '2026-08-10T11:15:00.000Z',
    files: ['content/posts/rascunho-descartado/index.pt-br.md'],
    assetCount: 0,
    post: { id: 'content/posts/rascunho-descartado/index.pt-br.md', title: 'Um rascunho que pode voltar', description: 'Uma ideia guardada na lixeira.', date: '2026-08-03', draft: true, language: 'pt-br', featuredImage: '', revision: 'demo-trash' },
  }]
  let mediaTrash = [{ id: 'demo-media-trash', mediaId: 'static/uploads/old-sketch.svg', name: 'old-sketch.svg', deletedAt: '2026-08-09T12:15:00.000Z', size: 21340 }]
  let mediaItems = [
    { id: 'content/posts/cultivando-ideias/estudo-plumbago.svg', name: 'estudo-plumbago.svg', extension: 'svg', scope: 'bundle', size: 18432, width: 800, height: 500, ownerPostIds: [samplePosts[0].id], ownerTitles: [samplePosts[0].title], references: [{ id: 'demo-ref-1', kind: 'markdown', postId: samplePosts[0].id, postTitle: samplePosts[0].title, alt: '', caption: '', destination: 'estudo-plumbago.svg', editable: true }], usageCount: 1, missingAltCount: 1, duplicateIds: ['static/images/estudo-plumbago-copy.svg'], duplicate: true, oversized: false, removable: false },
    { id: 'static/images/estudo-plumbago-copy.svg', name: 'estudo-plumbago-copy.svg', extension: 'svg', scope: 'static', size: 18432, width: 800, height: 500, ownerPostIds: [], ownerTitles: [], references: [], usageCount: 0, missingAltCount: 0, duplicateIds: ['content/posts/cultivando-ideias/estudo-plumbago.svg'], duplicate: true, oversized: false, removable: true },
    { id: 'assets/hero-wide.svg', name: 'hero-wide.svg', extension: 'svg', scope: 'assets', size: 2384000, width: 2400, height: 1350, ownerPostIds: [], ownerTitles: [], references: [], usageCount: 0, missingAltCount: 0, duplicateIds: [], duplicate: false, oversized: true, removable: true },
  ]
  let reviewFindings = [
    { id: 'review-broken-link', rule: 'internal-link-broken', severity: 'error', scope: 'post', postId: samplePosts[1].id, postTitle: samplePosts[1].title, path: '', values: { destination: '/estudos/inverno/' }, detail: '', fix: null },
    { id: 'review-description', rule: 'post-description-missing', severity: 'warning', scope: 'post', postId: samplePosts[2].id, postTitle: samplePosts[2].title, path: '', values: {}, detail: '', fix: { kind: 'text', field: 'description', before: '', placeholder: 'review.fix.descriptionPlaceholder' } },
    { id: 'review-alt', rule: 'image-alt-missing', severity: 'warning', scope: 'post', postId: samplePosts[0].id, postTitle: samplePosts[0].title, path: 'content/posts/cultivando-ideias/estudo-plumbago.svg', values: { destination: 'estudo-plumbago.svg' }, detail: '', fix: { kind: 'text', field: 'alt', before: '', placeholder: 'review.fix.altPlaceholder' } },
    { id: 'review-social', rule: 'post-social-image-missing', severity: 'recommendation', scope: 'post', postId: samplePosts[1].id, postTitle: samplePosts[1].title, path: '', values: {}, detail: '', fix: null },
    { id: 'review-robots', rule: 'output-robots-missing', severity: 'recommendation', scope: 'output', postId: '', postTitle: '', path: '', values: {}, detail: '', fix: null },
  ]
  const demoReview = () => {
    const scenario = demoQuery.get('review') || 'issues'
    const findings = scenario === 'clean' ? [] : scenario === 'recommendations' ? reviewFindings.filter((item) => item.severity === 'recommendation') : reviewFindings
    const summary = { total: findings.length, errors: findings.filter((item) => item.severity === 'error').length, warnings: findings.filter((item) => item.severity === 'warning').length, recommendations: findings.filter((item) => item.severity === 'recommendation').length, fixable: findings.filter((item) => item.fix).length, postsChecked: posts.length }
    return { findings, summary: { ...summary, ready: summary.errors === 0, score: Math.max(0, 100 - summary.errors * 20 - summary.warnings * 6 - summary.recommendations * 2) }, checkedAt: new Date().toISOString() }
  }
  let context = { root: '/home/voce/meu-blog', config: 'hugo.toml', runtime: { kind: 'wsl', distro: 'Ubuntu' }, hugo: 'hugo v0.123.7', hugoExecutable: '/usr/bin/hugo', git: 'git version 2.43.0', theme: 'hugo-papermod' }
  const demoQuery = new URLSearchParams(window.location.search)
  const demoHugoScenario = demoQuery.get('hugo') || 'dual'
  const demoWslHome = demoHugoScenario === 'wsl-home'
  if (demoWslHome) context = { ...context, root: '\\\\wsl.localhost\\Ubuntu\\home\\voce\\meu-blog' }
  let demoSelectedHugoRuntime = ['missing', 'windows', 'update-failed'].includes(demoHugoScenario) ? 'native:win32' : 'wsl:Ubuntu'
  let demoWindowsHugoInstalled = demoHugoScenario !== 'missing'
  let demoWindowsHugoVersion = '0.165.0'
  let demoHugoUpdateFailure = demoHugoScenario === 'update-failed'

  function demoHugoRuntimeInventory() {
    const nativeHugo = demoWindowsHugoInstalled
      ? { status: 'ready', version: `hugo v${demoWindowsHugoVersion}+extended windows/amd64`, versionNumber: demoWindowsHugoVersion, executable: 'C:\\Program Files\\Hugo\\bin\\hugo.exe', extended: true, architecture: 'amd64', details: '' }
      : { status: 'missing', version: '', versionNumber: '', executable: '', extended: false, architecture: '', details: '' }
    const wslHugo = { status: 'ready', version: 'hugo v0.164.0+extended linux/amd64', versionNumber: '0.164.0', executable: '/snap/bin/hugo', extended: true, architecture: 'amd64', details: '' }
    const wslBuild = demoHugoScenario === 'build-failed'
      ? { status: 'error', details: 'Error: theme requires Hugo 0.165.0 or newer; function "try" is not defined.' }
      : { status: 'ready', details: '' }
    const runtimes = [
      { id: 'native:win32', selected: demoSelectedHugoRuntime === 'native:win32', runtime: { kind: 'native', platform: 'win32' }, environment: { kind: 'native', platform: 'win32', label: 'Windows' }, blogAccessible: !demoWslHome, accessCode: demoWslHome ? 'windows-wsl-filesystem' : '', accessValues: demoWslHome ? { distro: 'Ubuntu' } : {}, accessDetails: demoWslHome ? 'Windows Hugo cannot build safely inside the Linux filesystem of Ubuntu.' : '', ready: !demoWslHome && nativeHugo.status === 'ready', hugo: nativeHugo, build: { status: demoWslHome ? 'not-tested' : nativeHugo.status === 'ready' ? 'ready' : 'not-tested', details: '' }, assistance: { mode: 'automatic', command: `${demoWindowsHugoInstalled ? 'winget upgrade' : 'winget install'} --id Hugo.Hugo.Extended -e --source winget --accept-package-agreements --accept-source-agreements`, url: 'https://gohugo.io/installation/windows/', repositoryMayLag: false } },
      { id: 'wsl:Ubuntu', selected: demoSelectedHugoRuntime === 'wsl:Ubuntu', runtime: { kind: 'wsl', distro: 'Ubuntu' }, environment: { kind: 'wsl', distro: 'Ubuntu', label: 'WSL · Ubuntu' }, blogAccessible: true, accessCode: '', accessValues: {}, accessDetails: '', ready: wslBuild.status === 'ready', hugo: wslHugo, build: wslBuild, assistance: { mode: 'command', command: 'sudo snap refresh hugo', url: 'https://gohugo.io/installation/linux/', repositoryMayLag: false } },
    ]
    if (demoHugoScenario === 'inaccessible') runtimes.push({ id: 'wsl:Debian', selected: false, runtime: { kind: 'wsl', distro: 'Debian' }, environment: { kind: 'wsl', distro: 'Debian', label: 'WSL · Debian' }, blogAccessible: false, accessCode: 'runtime-path-unavailable', accessValues: {}, accessDetails: 'This blog is stored inside Ubuntu and cannot be opened from Debian.', ready: false, hugo: { ...wslHugo, version: 'hugo v0.163.0+extended linux/amd64', versionNumber: '0.163.0', executable: '/usr/local/bin/hugo' }, build: { status: 'not-tested', details: '' }, assistance: { mode: 'command', command: 'sudo apt update && sudo apt install -y hugo', url: 'https://gohugo.io/installation/linux/', repositoryMayLag: true } })
    const current = runtimes.find((item) => item.selected) || runtimes[0]
    return { ready: current.ready, selectedId: current.id, environment: current.environment, hugo: current.hugo, assistance: current.assistance, runtimes, wslDistributions: ['Ubuntu', ...(demoHugoScenario === 'inaccessible' ? ['Debian'] : [])] }
  }
  const initialHugoRuntime = demoHugoRuntimeInventory().runtimes.find((item) => item.selected)
  context = { ...context, runtime: initialHugoRuntime.runtime, hugo: initialHugoRuntime.hugo.version || null, hugoExecutable: initialHugoRuntime.hugo.executable }
  const demoUnsupportedTheme = demoQuery.get('theme') === 'unsupported'
  const demoThemePreviewFailure = demoQuery.get('theme') === 'preview-fail'
  if (demoUnsupportedTheme) context = { ...context, theme: 'handmade-theme' }
  if (demoQuery.get('calendar') === 'midnight') {
    posts = posts.map((item) => item.id === samplePosts[1].id ? { ...item, publishDate: '2026-08-12T02:30:00.000Z' } : item)
  }
  let demoTimeZone = 'America/Sao_Paulo'
  let demoAutomationEnabled = demoQuery.get('calendar') !== 'automation-off'
  let demoCalendarSyncPending = ['sync-pending', 'sync-failed'].includes(demoQuery.get('calendar'))
  let demoCalendarSyncFailure = demoQuery.get('calendar') === 'sync-failed'
  let githubConnected = demoQuery.get('github') !== 'signin'
  let cloudflareConnected = demoQuery.get('cloudflare') !== 'signin'
  let demoDeployment = demoQuery.get('deploy') === 'progress'
    ? { provider: 'cloudflare-pages', state: 'uploading', step: 'upload', progress: 61, log: ['Hugo production build completed.', 'Uploaded 34 of 62 website files.'], error: '', warning: '', liveUrl: 'https://meu-blog.pages.dev/', accountId: 'a'.repeat(32), projectName: 'meu-blog', deploymentId: 'demo-deployment', dashboardUrl: 'https://dash.cloudflare.com/', customDomainUrl: '' }
    : demoQuery.get('deploy') === 'setup'
      ? { provider: '', state: 'idle', step: '', progress: 0, log: [], error: '', warning: '', liveUrl: '', accountId: '', projectName: '', deploymentId: '', dashboardUrl: '', customDomainUrl: '' }
      : { provider: 'github-pages', state: 'live', step: 'verified', progress: 100, log: ['GitHub Pages is live and the public address was verified.'], error: '', warning: '', liveUrl: 'https://voce.github.io/blog/', repository: 'voce/blog', dashboardUrl: 'https://github.com/voce/blog/actions', customDomainUrl: 'https://github.com/voce/blog/settings/pages' }
  let demoThemeState = {
    revision: 'theme-demo-1',
    controls: demoThemeControls.map((item) => ({ ...item })),
    navigation: [
      { _id: 'menu-home-01', name: 'Início', pageRef: '/', url: '', weight: 10, identifier: 'home', parent: '' },
      { _id: 'menu-about-02', name: 'Sobre', pageRef: '/about/', url: '', weight: 20, identifier: 'about', parent: '' },
      { _id: 'menu-gallery3', name: 'Galeria', pageRef: '/gallery/', url: '', weight: 30, identifier: 'gallery', parent: '' },
    ],
    social: [
      { _id: 'social-git01', network: 'github', url: 'https://github.com/voce' },
      { _id: 'social-masto', network: 'mastodon', url: 'https://social.example/@voce' },
    ],
  }
  let demoThemePresets = []
  let demoThemePreviews = new Map()

  function themeInventory() {
    return demoThemeConfiguration(context.theme, demoThemeState, demoThemePresets, context.theme === 'handmade-theme')
  }

  function themePreview(input) {
    if (input.expectedRevision !== demoThemeState.revision) throw new Error('The Hugo configuration changed outside Plumbago. Refresh the theme configurator before continuing.')
    if (demoThemePreviewFailure) {
      const error = new Error('Hugo could not build the theme preview. No blog configuration was changed.')
      error.details = 'Demo: the active theme rejected one of the pending configuration values.'
      throw error
    }
    const controls = new Map(demoThemeState.controls.map((item) => [item.id, item]))
    const changes = Object.entries(input.values || {}).flatMap(([id, after]) => {
      const control = controls.get(id)
      return control && JSON.stringify(control.value) !== JSON.stringify(after) ? [{ id, category: control.category, path: control.path, before: control.value, after }] : []
    })
    if (input.navigation && JSON.stringify(input.navigation) !== JSON.stringify(demoThemeState.navigation)) changes.push({ id: 'navigation:main', category: 'navigation', path: 'menus.main', before: `${demoThemeState.navigation.length} items`, after: `${input.navigation.length} items` })
    if (input.social && JSON.stringify(input.social) !== JSON.stringify(demoThemeState.social)) changes.push({ id: 'social:links', category: 'social', path: 'params.socialIcons', before: `${demoThemeState.social.length} links`, after: `${input.social.length} links` })
    if (!changes.length) throw new Error('Change at least one supported theme option before creating a preview.')
    const previewId = `preview-${Date.now()}`
    const preview = { previewId, revision: demoThemeState.revision, theme: themeInventory().theme, changes, impact: { settings: changes.length, files: 2, categories: [...new Set(changes.map((item) => item.category))], targets: ['hugo.toml', 'config/_default/params.toml'], recoveryPoint: true }, build: { ok: true }, launchAvailable: true, payload: input }
    demoThemePreviews.set(previewId, preview)
    return preview
  }
  return {
    getContext: async () => context,
    chooseBlog: async () => context,
    createBlog: async (input) => {
      context = { ...context, root: `/home/voce/${input.folder || 'novo-blog'}`, theme: input.theme || '' }
      posts = []
      return context
    },
    listThemes: async () => demoThemes,
    installTheme: async (slug) => {
      const theme = demoThemes.find((item) => item.slug === slug)
      context = { ...context, theme: slug }
      return {
        ok: true,
        ...theme,
        folder: slug,
        context,
        compatibility: {
          current: { version: '0.158.0', extended: true, raw: 'hugo v0.158.0+extended' },
          requirements: { min: '0.120.0', max: '', extended: false, sources: ['theme.toml'] },
          compatible: true,
          issues: [],
        },
      }
    },
    deactivateTheme: async () => {
      context = { ...context, theme: '' }
      return context
    },
    themeConfiguration: async () => themeInventory(),
    previewThemeConfiguration: async (input) => themePreview(input),
    openThemePreview: async () => true,
    applyThemeConfiguration: async ({ previewId, expectedRevision }) => {
      const preview = demoThemePreviews.get(previewId)
      if (!preview || expectedRevision !== demoThemeState.revision) throw new Error('The Hugo configuration changed after this preview. Refresh and review the impact again.')
      const values = preview.payload.values || {}
      demoThemeState = {
        revision: `theme-demo-${Date.now()}`,
        controls: demoThemeState.controls.map((item) => Object.hasOwn(values, item.id) ? { ...item, value: values[item.id], isSet: true, origin: 'project' } : item),
        navigation: preview.payload.navigation || demoThemeState.navigation,
        social: preview.payload.social || demoThemeState.social,
      }
      demoThemePreviews = new Map()
      return { inventory: themeInventory(), recoveryPoint: { id: `theme-recovery-${Date.now()}`, reason: 'before-theme-configuration' }, changes: preview.changes }
    },
    saveThemePreset: async (input) => {
      const preset = { id: `preset-${Date.now()}`, name: input.name, theme: context.theme, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), payload: { values: input.values || {}, ...(input.navigation ? { navigation: input.navigation } : {}), ...(input.social ? { social: input.social } : {}) }, summary: { settings: Object.keys(input.values || {}).length, navigation: input.navigation?.length || 0, social: input.social?.length || 0 } }
      demoThemePresets = [preset, ...demoThemePresets]
      return preset
    },
    deleteThemePreset: async (id) => { demoThemePresets = demoThemePresets.filter((item) => item.id !== id); return { id } },
    siteSettings: async () => ({ title: 'Meu blog', baseURL: 'https://voce.github.io/blog/', languageCode: 'pt-BR', copyright: '© 2026 Você', timeZone: demoTimeZone, hostingProvider: 'github-pages', publicUrl: 'https://voce.github.io/blog/', hostingConfigured: true, theme: context.theme, config: 'hugo.toml' }),
    saveSiteSettings: async (input) => ({ ...input, publicUrl: input.hostingProvider === 'none' ? '' : input.publicUrl, hostingConfigured: input.hostingProvider !== 'none' && Boolean(input.publicUrl), theme: context.theme, config: 'hugo.toml' }),
    openTheme: async () => true,
    listPosts: async () => posts,
    readPost: async (id) => fullPost(posts.find((post) => post.id === id)),
    savePost: async (post) => { if (demoQuery.get('autosave') === 'slow') await new Promise((resolve) => setTimeout(resolve, 700)); const saved = { ...post, revision: `demo-${Date.now()}` }; posts = posts.map((item) => item.id === post.id ? { ...item, ...saved } : item); return saved },
    createPost: async (input) => { const summary = { id: `content/posts/novo-post/index.${input.language}.md`, title: input.title, description: '', date: '2026-08-08', draft: true, language: input.language, featuredImage: '' }; posts.unshift(summary); return fullPost(summary) },
    deletePost: async (id) => {
      const post = posts.find((item) => item.id === id)
      posts = posts.filter((item) => item.id !== id)
      const trashId = `demo-trash-${Date.now()}`
      trash.unshift({ id: trashId, postId: id, title: post?.title || id, deletedAt: new Date().toISOString(), files: [id], assetCount: 0, post })
      return { id, trashId, movedAssets: [], preservedAssets: [] }
    },
    siteHistory: async () => ({
      hasLocalChanges: true,
      localChangeCount: 2,
      entries: [
        { hash: 'a'.repeat(40), createdAt: '2026-08-10T20:12:00.000Z', author: 'Artista Plumbago', subject: 'Publish new winter color notes', kind: 'content', files: [{ status: 'M', path: samplePosts[1].id }] },
        { hash: 'b'.repeat(40), createdAt: '2026-08-09T14:30:00.000Z', author: 'Artista Plumbago', subject: 'Change the site title and theme', kind: 'theme', files: [{ status: 'M', path: 'hugo.toml' }, { status: 'A', path: 'themes/hugo-papermod' }] },
        { hash: 'c'.repeat(40), createdAt: '2026-08-08T09:10:00.000Z', author: 'Artista Plumbago', subject: 'Create the blog', kind: 'site', files: [{ status: 'A', path: 'hugo.toml' }] },
      ],
    }),
    postHistory: async (id) => ({ id, currentChanged: true, revisions: [
      { hash: 'd'.repeat(40), createdAt: '2026-08-10T20:12:00.000Z', author: 'Artista Plumbago', subject: 'Refine the introduction' },
      { hash: 'e'.repeat(40), createdAt: '2026-08-08T16:00:00.000Z', author: 'Artista Plumbago', subject: 'Create the first draft' },
    ] }),
    comparePostRevision: async () => ({ changes: [
      { type: 'same', value: '---\ntitle: Cultivando ideias com calma\n---\n\n' },
      { type: 'removed', value: 'A criatividade começa com uma ideia pronta.\n' },
      { type: 'added', value: 'A criatividade nem sempre chega fazendo barulho. Às vezes ela começa como uma pergunta pequena.\n' },
      { type: 'same', value: '\n## Um espaço para experimentar\n' },
    ] }),
    restorePostRevision: async (id) => {
      const restored = { ...fullPost(posts.find((item) => item.id === id)), body: 'A criatividade começa com uma ideia pronta.\n\n## Um espaço para experimentar\n', revision: `demo-${Date.now()}` }
      posts = posts.map((item) => item.id === id ? { ...item, ...restored } : item)
      return { post: restored, recoveryPoint: recoveryPoints[0] }
    },
    listRecoveryPoints: async () => recoveryPoints,
    createRecoveryPoint: async (label) => {
      const point = { id: `demo-recovery-${Date.now()}`, reason: 'manual', label, createdAt: new Date().toISOString(), targets: ['content', 'hugo.toml'] }
      recoveryPoints.unshift(point)
      return point
    },
    restoreRecoveryPoint: async (id) => recoveryPoints.find((point) => point.id === id),
    listTrash: async () => trash.map((entry) => ({ id: entry.id, postId: entry.postId, title: entry.title, deletedAt: entry.deletedAt, files: entry.files, assetCount: entry.assetCount })),
    restoreTrashItem: async (id) => {
      const item = trash.find((entry) => entry.id === id)
      if (item?.post && !posts.some((post) => post.id === item.postId)) posts.unshift(item.post)
      trash = trash.filter((entry) => entry.id !== id)
      return item
    },
    deleteTrashItem: async (id) => {
      const item = trash.find((entry) => entry.id === id)
      trash = trash.filter((entry) => entry.id !== id)
      return item
    },
    hugoReadiness: async () => demoHugoRuntimeInventory(),
    installHugo: async (runtimeId) => {
      if (runtimeId !== 'native:win32') throw new Error('Run the copied update command inside WSL, then test again.')
      if (demoHugoUpdateFailure) { demoHugoUpdateFailure = false; throw new Error('Windows Package Manager could not reach its source. Check the connection and try again.') }
      const installed = demoWindowsHugoInstalled
      demoWindowsHugoInstalled = true
      demoWindowsHugoVersion = '0.166.0'
      const readiness = demoHugoRuntimeInventory()
      if (demoSelectedHugoRuntime === 'native:win32') context = { ...context, hugo: readiness.hugo.version, hugoExecutable: readiness.hugo.executable }
      return { ...readiness, operation: { state: installed ? 'updated' : 'installed', runtimeId }, context }
    },
    selectHugoRuntime: async (runtimeId) => {
      const candidate = demoHugoRuntimeInventory().runtimes.find((item) => item.id === runtimeId)
      if (!candidate?.ready) throw new Error(candidate?.accessDetails || 'Install Hugo in this environment before selecting it.')
      demoSelectedHugoRuntime = runtimeId
      context = { ...context, runtime: candidate.runtime, hugo: candidate.hugo.version, hugoExecutable: candidate.hugo.executable }
      return { selection: candidate.runtime, readiness: demoHugoRuntimeInventory(), context }
    },
    useWslForBlog: async (distro) => { context = { ...context, root: `\\\\wsl.localhost\\${distro}\\home\\voce\\meu-blog`, runtime: { kind: 'wsl', distro }, hugoExecutable: '/usr/bin/hugo' }; return context },
    importImages: async () => [{ name: 'nova-imagem.svg', markdown: '![Descrição da imagem](nova-imagem.svg)' }],
    importDroppedImages: async () => [{ name: 'imagem-arrastada.svg', markdown: '![Descrição da imagem](imagem-arrastada.svg)' }],
    readAsset: async (_postId, name) => `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#524DE1"/><stop offset="1" stop-color="#558B6E"/></linearGradient></defs><rect width="800" height="500" fill="url(#g)"/><text x="400" y="270" text-anchor="middle" fill="#FFC759" font-size="42" font-family="sans-serif">${name}</text></svg>`)}`,
    readAssetInfo: async (_postId, name) => ({ name, size: 18432, dataUrl: `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="#558B6E"/><text x="400" y="270" text-anchor="middle" fill="#FFC759" font-size="42">${name}</text></svg>`)}` }),
    mediaLibrary: async () => ({
      items: mediaItems,
      missingReferences: [{ id: 'demo-missing', kind: 'markdown', postId: samplePosts[1].id, postTitle: samplePosts[1].title, alt: 'Uma imagem', caption: '', destination: 'inverno-ausente.jpg', expectedMediaId: 'content/posts/cores-do-inverno/inverno-ausente.jpg', editable: true }],
      duplicateGroups: mediaItems.some((item) => item.duplicate) ? [{ hash: 'demo-duplicate', mediaIds: mediaItems.filter((item) => item.duplicate).map((item) => item.id) }] : [],
      summary: { total: mediaItems.length, used: mediaItems.filter((item) => item.usageCount > 0).length, unused: mediaItems.filter((item) => item.usageCount === 0).length, oversized: mediaItems.filter((item) => item.oversized).length, duplicates: mediaItems.some((item) => item.duplicate) ? 1 : 0, missing: 1, missingAlt: mediaItems.reduce((sum, item) => sum + item.missingAltCount, 0), bytes: mediaItems.reduce((sum, item) => sum + item.size, 0) },
    }),
    mediaPreview: async (id) => ({ id, width: 800, height: 500, dataUrl: `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#524DE1"/><stop offset="1" stop-color="#558B6E"/></linearGradient></defs><rect width="800" height="500" rx="28" fill="url(#g)"/><circle cx="190" cy="190" r="90" fill="#FFC759" opacity=".88"/><path d="M80 430L310 230l125 110 100-85 185 175" fill="none" stroke="#D8D4F2" stroke-width="30" stroke-linejoin="round"/><text x="400" y="470" text-anchor="middle" fill="#fff" font-size="22" font-family="sans-serif">${id.split('/').at(-1)}</text></svg>`)}` }),
    reuseMedia: async (id, postId, options = {}) => ({ mediaId: id, copiedId: id.startsWith('static/') ? '' : `${postId.slice(0, postId.lastIndexOf('/') + 1)}${id.split('/').at(-1)}`, destination: id.startsWith('static/') ? `/${id.slice('static/'.length)}` : id.split('/').at(-1), markdown: `![${options.alt || 'Image'}](${id.startsWith('static/') ? `/${id.slice('static/'.length)}` : id.split('/').at(-1)}${options.caption ? ` "${options.caption}"` : ''})` }),
    updateMediaReference: async ({ mediaId, referenceId, alt, caption }) => {
      mediaItems = mediaItems.map((item) => item.id !== mediaId ? item : { ...item, references: item.references.map((reference) => reference.id === referenceId ? { ...reference, alt, caption } : reference), missingAltCount: alt.trim() ? 0 : 1 })
      return { post: fullPost(posts[0]) }
    },
    replaceMedia: async (id) => mediaItems.find((item) => item.id === id),
    createMediaDerivative: async (id, options) => {
      const source = mediaItems.find((item) => item.id === id)
      const name = `${source.name.replace(/\.[^.]+$/, '')}-${options.width || 'auto'}x${options.height || 'auto'}.${options.format}`
      const item = { ...source, id: `${source.id.slice(0, source.id.lastIndexOf('/') + 1)}${name}`, name, extension: options.format, format: options.format, size: Math.max(4200, Math.round(source.size * .42)), width: Number(options.width) || source.width, height: Number(options.height) || Math.round((Number(options.width) || source.width) * source.height / source.width), references: [], usageCount: 0, missingAltCount: 0, duplicateIds: [], duplicate: false, oversized: false, removable: true }
      mediaItems.push(item)
      return item
    },
    removeMedia: async (id) => {
      const item = mediaItems.find((entry) => entry.id === id)
      if (!item?.removable) throw new Error('This image is still used by the blog.')
      mediaItems = mediaItems.filter((entry) => entry.id !== id)
      mediaTrash.unshift({ id: `demo-media-${Date.now()}`, mediaId: item.id, name: item.name, deletedAt: new Date().toISOString(), size: item.size, item })
      return true
    },
    listMediaTrash: async () => mediaTrash,
    restoreMediaTrashItem: async (id) => {
      const item = mediaTrash.find((entry) => entry.id === id)
      if (item?.item) mediaItems.push(item.item)
      mediaTrash = mediaTrash.filter((entry) => entry.id !== id)
      return item
    },
    deleteMediaTrashItem: async (id) => { const item = mediaTrash.find((entry) => entry.id === id); mediaTrash = mediaTrash.filter((entry) => entry.id !== id); return item },
    siteReview: async () => demoReview(),
    applyReviewFix: async ({ findingId, value }) => {
      const finding = reviewFindings.find((item) => item.id === findingId)
      if (!finding?.fix || finding.fix.kind === 'text' && !String(value || '').trim()) throw new Error('Enter a value before applying this fix.')
      reviewFindings = reviewFindings.filter((item) => item.id !== findingId)
      return { findingId, rule: finding.rule, result: true }
    },
    taxonomyIndex: async () => demoTaxonomyIndex(posts),
    previewTaxonomyChange: async (input) => demoTaxonomyPreview(posts, input),
    applyTaxonomyChange: async (input) => {
      const preview = demoTaxonomyPreview(posts, input)
      for (const change of preview.changes) {
        if (input.expectedRevisions?.[change.postId] !== change.revision) throw new Error(`${change.title} changed after the preview. Review the taxonomy change again before applying it.`)
      }
      posts = posts.map((post) => {
        const change = preview.changes.find((item) => item.postId === post.id)
        if (!change) return post
        const taxonomies = { ...(post.taxonomies || {}), [preview.taxonomy.id]: change.after }
        return { ...post, taxonomies, tags: preview.taxonomy.id === 'tags' ? change.after : post.tags, revision: `demo-${Date.now()}-${post.id}` }
      })
      return { preview, recoveryPoint: { id: `demo-taxonomy-${Date.now()}`, reason: 'before-taxonomy-change' }, index: demoTaxonomyIndex(posts) }
    },
    pageInventory: async () => demoPageInventory(pages),
    previewPageChange: async (input) => demoPagePreview(pages, input),
    applyPageChange: async (input) => {
      const preview = demoPagePreview(pages, input)
      for (const [id, revision] of Object.entries(preview.revisions)) {
        const current = pages.find((page) => page.id === id)
        if (input.expectedRevisions?.[id] !== revision || (current?.revision || '') !== revision) throw new Error('This page changed after the preview. Review the page change again before applying it.')
      }
      if (preview.action === 'create') {
        const page = {
          ...preview.page,
          description: String(input.description || ''),
          routeScope: 'language',
          explicitUrl: false,
          aliases: [],
          menus: input.menu ? [String(input.menu)] : [],
          section: preview.page.route.split('/').filter(Boolean)[0],
          layout: String(input.layout || ''),
          type: String(input.type || ''),
          themeDependent: Boolean(input.layout || input.type),
          unknownFields: [],
          revision: `demo-page-${Date.now()}`,
          resources: [],
          translations: [preview.page.id],
          sharedBundle: false,
          canRemoveBundle: preview.page.kind === 'leaf',
          descendants: [],
          translationKey: '',
          bodyExcerpt: String(input.body || '').replace(/[#*_>`]/g, '').trim().slice(0, 180),
        }
        pages.push(page)
      } else if (preview.action === 'rename') {
        pages = pages.map((page) => page.id === preview.page.id ? { ...page, route: preview.impact.routeAfter, routeScope: 'language', explicitUrl: true, aliases: [...new Set([...page.aliases, ...preview.impact.aliasesAdded])], revision: `demo-page-${Date.now()}` } : page)
      } else {
        pages = pages.filter((page) => page.id !== preview.page.id)
      }
      const recoveryPoint = { id: `demo-page-${Date.now()}`, reason: 'before-page-change', label: `${preview.action} ${preview.page.route}`, createdAt: new Date().toISOString(), targets: preview.changes.map((change) => change.path) }
      recoveryPoints.unshift(recoveryPoint)
      return { preview, recoveryPoint, inventory: demoPageInventory(pages) }
    },
    editorialCalendar: async () => {
      const now = '2026-08-11T12:00:00.000Z'
      const items = posts.map((item) => {
        const expired = item.expiryDate && new Date(item.expiryDate) <= new Date(now)
        const scheduled = !item.draft && item.publishDate && new Date(item.publishDate) > new Date(now)
        const state = expired ? 'expired' : item.draft ? item.publishDate ? 'scheduled-draft' : 'unscheduled' : scheduled ? 'scheduled' : 'published'
        const effectiveAt = expired ? item.expiryDate : ['unscheduled', 'scheduled-draft'].includes(state) ? '' : item.publishDate || `${item.date}T12:00:00.000Z`
        return { ...item, state, effectiveAt, source: effectiveAt ? item.publishDate ? 'publishDate' : 'date' : '' }
      })
      if (demoQuery.get('calendar') === 'overdue') items[0] = { ...items[0], state: 'expired', expiryDate: '2026-08-10T12:00:00.000Z', effectiveAt: '2026-08-10T12:00:00.000Z', source: 'expiryDate' }
      const states = ['published', 'scheduled', 'unscheduled', 'draft', 'scheduled-draft', 'expired']
      const summary = { total: items.length, ...Object.fromEntries(states.map((state) => [state, items.filter((item) => item.state === state).length])) }
      const next = items.filter((item) => item.state === 'scheduled').sort((left, right) => left.effectiveAt.localeCompare(right.effectiveAt))[0] || null
      return { timeZone: demoTimeZone, timeZoneConfigured: true, now, items, summary, next, automation: { provider: 'github-pages', supported: true, enabled: demoAutomationEnabled, workflow: '.github/workflows/plumbago-pages.yml', repository: { fullName: 'voce/blog' }, branch: 'main', intervalMinutes: 30, overdue: demoQuery.get('calendar') === 'overdue', pendingSync: demoAutomationEnabled && demoCalendarSyncPending, localChanges: demoCalendarSyncPending ? 1 : 0, ahead: 0, lastRun: demoAutomationEnabled ? { state: demoQuery.get('calendar') === 'overdue' ? 'failed' : 'success', updatedAt: '2026-08-11T11:43:00.000Z', runUrl: 'https://github.com/voce/blog/actions' } : { state: 'not-configured', updatedAt: '' } } }
    },
    previewCalendarChange: async (input) => demoCalendarPreview(posts, input),
    applyCalendarChange: async (input) => {
      const preview = demoCalendarPreview(posts, input)
      const saved = { ...preview.next, revision: `demo-${Date.now()}` }
      posts = posts.map((item) => item.id === input.postId ? saved : item)
      if (demoAutomationEnabled && demoCalendarSyncFailure) {
        demoCalendarSyncPending = true
        demoCalendarSyncFailure = false
        return { action: input.action, changes: preview.changes, post: fullPost(saved), recoveryPoint: { id: 'demo-calendar-recovery' }, sync: { required: true, state: 'failed', message: 'The network interrupted the GitHub push.' } }
      }
      demoCalendarSyncPending = false
      return { action: input.action, changes: preview.changes, post: fullPost(saved), recoveryPoint: { id: 'demo-calendar-recovery' }, sync: demoAutomationEnabled ? { required: true, state: 'synced' } : { required: false, state: 'not-required' } }
    },
    syncCalendarChanges: async () => { demoCalendarSyncPending = false; return { required: true, state: 'synced', log: ['Conteúdo enviado ao repositório remoto.'] } },
    saveCalendarTimeZone: async (value) => { demoTimeZone = value; return { timeZone: value, changed: true } },
    enableCalendarAutomation: async () => { demoAutomationEnabled = true; return true },
    disableCalendarAutomation: async () => { demoAutomationEnabled = false; return true },
    runCalendarAutomationNow: async () => ({ requestedAt: new Date().toISOString() }),
    gitStatus: async () => ({ branch: 'main', remote: 'git@github.com:voce/blog.git', changes: [' M content/posts/cores-do-inverno/index.pt-br.md'] }),
    gitReadiness: async () => ({ ready: true, environment: { kind: 'native', platform: 'linux', label: 'linux' }, git: { status: 'ready', version: 'git version 2.43.0', executable: '/usr/bin/git', details: '' }, repository: { status: 'ready', ready: true, topLevel: '/home/voce/blog', details: '' }, assistance: { mode: 'command', command: 'sudo apt update && sudo apt install -y git', url: 'https://git-scm.com/install/linux' } }),
    installGit: async () => true,
    initializeGit: async () => true,
    gitConfig: async () => ({ branch: 'main', remote: 'git@github.com:voce/blog.git', name: 'Artista Plumbago', email: 'artista@example.com', changes: [] }),
    saveGitConfig: async (config) => ({ branch: 'main', ...config, changes: [] }),
    syncGit: async () => ({ log: ['Alterações salvas em um commit.', 'Conteúdo enviado ao repositório remoto.'], status: { branch: 'main', remote: 'git@github.com:voce/blog.git', changes: [] } }),
    publishingStatus: async () => ({ branch: 'main', remote: 'git@github.com:voce/blog.git', changes: [' M content/posts/cores-do-inverno/index.pt-br.md'], repository: { owner: 'voce', repository: 'blog', fullName: 'voce/blog', url: 'https://github.com/voce/blog' }, site: { title: 'Meu blog', baseURL: 'https://voce.github.io/blog/', hostingProvider: 'github-pages', publicUrl: 'https://voce.github.io/blog/', hostingConfigured: true }, liveUrl: 'https://voce.github.io/blog/', deployment: { state: 'live', conclusion: 'success', runUrl: 'https://github.com/voce/blog/actions', updatedAt: new Date().toISOString(), name: 'Deploy Hugo site' } }),
    publishBlog: async () => ({ log: ['Hugo build completed successfully.', 'Conteúdo enviado ao repositório remoto.'], status: { branch: 'main', remote: 'git@github.com:voce/blog.git', changes: [], repository: { owner: 'voce', repository: 'blog', fullName: 'voce/blog', url: 'https://github.com/voce/blog' }, site: { title: 'Meu blog', baseURL: 'https://voce.github.io/blog/', hostingProvider: 'github-pages', publicUrl: 'https://voce.github.io/blog/', hostingConfigured: true }, liveUrl: 'https://voce.github.io/blog/', deployment: { state: 'deploying', conclusion: '', runUrl: 'https://github.com/voce/blog/actions', updatedAt: new Date().toISOString(), name: 'Deploy Hugo site' } } }),
    openPublishingUrl: async () => true,
    copyText: async () => true,
    githubStatus: async () => ({ configured: true, connected: githubConnected, persistent: githubConnected, authorization: githubConnected ? { repository: true, workflow: true, scopes: ['repo', 'workflow', 'read:user'] } : null, account: githubConnected ? { login: 'voce', name: 'Você', avatarUrl: 'https://github.com/identicons/voce.png', profileUrl: 'https://github.com/voce' } : null }),
    beginGitHubSignIn: async () => ({ deviceCode: 'demo-device', userCode: 'PLUM-BAGO', verificationUri: 'https://github.com/login/device', expiresIn: 900, interval: 5 }),
    completeGitHubSignIn: async () => { githubConnected = true; return { state: 'complete', persistent: true, authorization: { repository: true, workflow: true, scopes: ['repo', 'workflow', 'read:user'] }, account: { login: 'voce', name: 'Você', avatarUrl: 'https://github.com/identicons/voce.png', profileUrl: 'https://github.com/voce' } } },
    connectGitHubToken: async () => ({ persistent: true, authorization: { repository: true, workflow: true, scopes: ['repo', 'workflow', 'read:user'] }, account: { login: 'voce', name: 'Você', avatarUrl: 'https://github.com/identicons/voce.png', profileUrl: 'https://github.com/voce' } }),
    disconnectGitHub: async () => { githubConnected = false; return true },
    listGitHubRepositories: async () => [{ fullName: 'voce/blog', name: 'blog', owner: 'voce', private: false, empty: true, defaultBranch: 'main', url: 'https://github.com/voce/blog', sshUrl: 'git@github.com:voce/blog.git', cloneUrl: 'https://github.com/voce/blog.git', permissions: { push: true } }],
    createGitHubRepository: async (input) => ({ repository: { fullName: `voce/${input.name}`, name: input.name, owner: 'voce', private: input.private, empty: true, defaultBranch: 'main', url: `https://github.com/voce/${input.name}` }, config: { branch: 'main', remote: `https://github.com/voce/${input.name}.git` } }),
    connectGitHubRepository: async (fullName) => ({ repository: { fullName, empty: true, defaultBranch: 'main', url: `https://github.com/${fullName}` }, config: { branch: 'main', remote: `https://github.com/${fullName}.git` } }),
    configureGitHubPages: async () => ({ branch: 'main', hugoVersion: '0.148.2', liveUrl: 'https://voce.github.io/blog/', repository: { fullName: 'voce/blog' }, warning: '', workflow: '.github/workflows/plumbago-pages.yml' }),
    cloudflareStatus: async () => ({ connected: cloudflareConnected, persistent: cloudflareConnected }),
    connectCloudflareToken: async () => { cloudflareConnected = true; return { persistent: true } },
    disconnectCloudflare: async () => { cloudflareConnected = false; return true },
    listCloudflareAccounts: async () => [{ id: 'a'.repeat(32), name: 'Personal websites' }],
    listCloudflareProjects: async () => [{ id: 'meu-blog', name: 'meu-blog', liveUrl: 'https://meu-blog.pages.dev/', subdomain: 'meu-blog.pages.dev', productionBranch: 'main', directUpload: true }],
    deploymentStatus: async () => demoDeployment,
    deploySite: async ({ provider, accountId, projectName }) => {
      const liveUrl = provider === 'github-pages' ? 'https://voce.github.io/blog/' : `https://${projectName}.pages.dev/`
      demoDeployment = { provider, state: 'preflight', step: 'preflight', progress: 5, log: ['Checking the Hugo build and deployment settings.'], error: '', warning: '', liveUrl, accountId: accountId || '', projectName: projectName || '', repository: 'voce/blog', deploymentId: '', dashboardUrl: provider === 'github-pages' ? 'https://github.com/voce/blog/actions' : 'https://dash.cloudflare.com/', customDomainUrl: provider === 'github-pages' ? 'https://github.com/voce/blog/settings/pages' : 'https://dash.cloudflare.com/' }
      await new Promise((resolve) => setTimeout(resolve, 350))
      demoDeployment = { ...demoDeployment, state: 'provisioning', step: 'provider', progress: 24, log: [...demoDeployment.log, 'The hosting project is ready.'] }
      await new Promise((resolve) => setTimeout(resolve, 350))
      demoDeployment = { ...demoDeployment, state: 'uploading', step: 'upload', progress: 66, log: [...demoDeployment.log, 'Prepared and uploaded the website files.'] }
      await new Promise((resolve) => setTimeout(resolve, 350))
      demoDeployment = { ...demoDeployment, state: 'live', step: 'verified', progress: 100, log: [...demoDeployment.log, 'The public address was verified.'] }
      return demoDeployment
    },
    publishingHealth: async () => ({ ready: true, score: 9, total: 9, publishing: { liveUrl: 'https://voce.github.io/blog/' }, checks: ['hugo', 'git', 'repository', 'identity', 'remote', 'github', 'workflow', 'build', 'deployment'].map((id) => ({ id, state: 'ok', detail: `${id} está pronto.`, action: id === 'workflow' ? 'github' : id === 'deployment' ? 'publish' : 'settings' })) }),
    updateStatus: async () => ({ state: 'idle', currentVersion: '0.5.0', version: '', releaseUrl: 'https://github.com/gabuvns/plumbago/releases/latest', canAutoUpdate: true, reason: '', progress: 0, error: '' }),
    checkForUpdates: async () => ({ state: 'available', currentVersion: '0.5.0', version: '0.6.0', name: 'Plumbago 0.6.0', notes: 'A smoother theme workflow and guided application updates.', publishedAt: '2026-08-09T12:00:00Z', releaseUrl: 'https://github.com/gabuvns/plumbago/releases/latest', canAutoUpdate: true, reason: '', progress: 0, error: '' }),
    downloadUpdate: async () => ({ state: 'downloaded', currentVersion: '0.5.0', version: '0.6.0', releaseUrl: 'https://github.com/gabuvns/plumbago/releases/latest', canAutoUpdate: true, progress: 100, error: '' }),
    installUpdate: async () => true,
    chooseBloggerExport: async () => ({ labels: ['Arte', 'Processo'], imageCount: 4, posts: [{ id: 'blogger-1', title: 'Meu primeiro post no Blogger', slug: 'meu-primeiro-post', date: '2021-04-12', draft: false, labels: ['Arte'], originalUrl: 'https://example.blogspot.com/2021/04/meu-primeiro-post.html', imageCount: 2, selected: true, contentLength: 1200 }, { id: 'blogger-2', title: 'Um rascunho antigo', slug: 'um-rascunho-antigo', date: '2022-01-08', draft: true, labels: ['Processo'], originalUrl: '', imageCount: 2, selected: true, contentLength: 600 }] }),
    importBloggerExport: async (options) => ({ posts: (options.selectedIds || []).map((id, index) => ({ id: `content/posts/importado-${index + 1}/index.${options.language}.md`, title: id, draft: false })), importedImages: 4, failures: [] }),
    openPreview: async () => true,
  }
}
