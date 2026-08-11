const samplePosts = [
  { id: 'content/posts/cultivando-ideias/index.pt-br.md', title: 'Cultivando ideias com calma', description: 'Notas sobre processo criativo, referências e espaço para experimentar.', date: '2026-08-07', draft: false, language: 'pt-br', featuredImage: '', revision: 'demo-1' },
  { id: 'content/posts/cores-do-inverno/index.pt-br.md', title: 'As cores do inverno', description: 'Uma pequena coleção de estudos de cor.', date: '2026-08-04', draft: true, language: 'pt-br', featuredImage: '', revision: 'demo-2' },
  { id: 'content/posts/primeiro-caderno/index.en-us.md', title: 'Notes from the first sketchbook', description: 'A look back at the first pages.', date: '2026-07-28', draft: false, language: 'en-us', featuredImage: '', revision: 'demo-3' },
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

function fullPost(summary) {
  const assets = summary.id === samplePosts[0].id ? ['estudo-plumbago.svg'] : []
  return { ...summary, tags: ['Processo', 'Arte'], translationKey: summary.id.split('/')[2], body: bodies[summary.id] || '', assets }
}

export function createDemoBridge() {
  let posts = [...samplePosts]
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
  let githubConnected = demoQuery.get('github') !== 'signin'
  let cloudflareConnected = demoQuery.get('cloudflare') !== 'signin'
  let demoDeployment = demoQuery.get('deploy') === 'progress'
    ? { provider: 'cloudflare-pages', state: 'uploading', step: 'upload', progress: 61, log: ['Hugo production build completed.', 'Uploaded 34 of 62 website files.'], error: '', warning: '', liveUrl: 'https://meu-blog.pages.dev/', accountId: 'a'.repeat(32), projectName: 'meu-blog', deploymentId: 'demo-deployment', dashboardUrl: 'https://dash.cloudflare.com/', customDomainUrl: '' }
    : demoQuery.get('deploy') === 'setup'
      ? { provider: '', state: 'idle', step: '', progress: 0, log: [], error: '', warning: '', liveUrl: '', accountId: '', projectName: '', deploymentId: '', dashboardUrl: '', customDomainUrl: '' }
      : { provider: 'github-pages', state: 'live', step: 'verified', progress: 100, log: ['GitHub Pages is live and the public address was verified.'], error: '', warning: '', liveUrl: 'https://voce.github.io/blog/', repository: 'voce/blog', dashboardUrl: 'https://github.com/voce/blog/actions', customDomainUrl: 'https://github.com/voce/blog/settings/pages' }
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
    siteSettings: async () => ({ title: 'Meu blog', baseURL: 'https://voce.github.io/blog/', languageCode: 'pt-BR', copyright: '© 2026 Você', hostingProvider: 'github-pages', publicUrl: 'https://voce.github.io/blog/', hostingConfigured: true, theme: context.theme, config: 'hugo.toml' }),
    saveSiteSettings: async (input) => ({ ...input, publicUrl: input.hostingProvider === 'none' ? '' : input.publicUrl, hostingConfigured: input.hostingProvider !== 'none' && Boolean(input.publicUrl), theme: context.theme, config: 'hugo.toml' }),
    openTheme: async () => true,
    listPosts: async () => posts,
    readPost: async (id) => fullPost(posts.find((post) => post.id === id)),
    savePost: async (post) => { const saved = { ...post, revision: `demo-${Date.now()}` }; posts = posts.map((item) => item.id === post.id ? { ...item, ...saved } : item); return saved },
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
    hugoReadiness: async () => ({ ready: true, environment: { kind: 'wsl', distro: 'Ubuntu', label: 'WSL · Ubuntu' }, hugo: { status: 'ready', version: context.hugo, executable: context.hugoExecutable, extended: true, details: '' }, assistance: { mode: 'command', command: 'sudo apt update && sudo apt install -y hugo', url: 'https://gohugo.io/installation/linux/', repositoryMayLag: true }, wslDistributions: [] }),
    installHugo: async () => ({ ready: true, environment: { kind: 'native', platform: 'win32', label: 'win32' }, hugo: { status: 'ready', version: 'hugo v0.164.0+extended', executable: 'C:\\Program Files\\Hugo\\bin\\hugo.exe', extended: true, details: '' }, assistance: { mode: 'automatic', command: 'winget upgrade --id Hugo.Hugo.Extended -e --source winget', url: 'https://gohugo.io/installation/windows/' }, wslDistributions: ['Ubuntu'] }),
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
