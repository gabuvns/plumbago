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
  let context = { root: '/home/voce/meu-blog', config: 'hugo.toml', runtime: { kind: 'wsl', distro: 'Ubuntu' }, hugo: 'hugo v0.123.7', hugoExecutable: '/usr/bin/hugo', git: 'git version 2.43.0', theme: 'hugo-papermod' }
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
    deletePost: async (id) => { posts = posts.filter((item) => item.id !== id); return { id, preservedAssets: [] } },
    hugoReadiness: async () => ({ ready: true, environment: { kind: 'wsl', distro: 'Ubuntu', label: 'WSL · Ubuntu' }, hugo: { status: 'ready', version: context.hugo, executable: context.hugoExecutable, extended: true, details: '' }, assistance: { mode: 'command', command: 'sudo apt update && sudo apt install -y hugo', url: 'https://gohugo.io/installation/linux/', repositoryMayLag: true }, wslDistributions: [] }),
    installHugo: async () => ({ ready: true, environment: { kind: 'native', platform: 'win32', label: 'win32' }, hugo: { status: 'ready', version: 'hugo v0.164.0+extended', executable: 'C:\\Program Files\\Hugo\\bin\\hugo.exe', extended: true, details: '' }, assistance: { mode: 'automatic', command: 'winget upgrade --id Hugo.Hugo.Extended -e --source winget', url: 'https://gohugo.io/installation/windows/' }, wslDistributions: ['Ubuntu'] }),
    useWslForBlog: async (distro) => { context = { ...context, root: `\\\\wsl.localhost\\${distro}\\home\\voce\\meu-blog`, runtime: { kind: 'wsl', distro }, hugoExecutable: '/usr/bin/hugo' }; return context },
    importImages: async () => [{ name: 'nova-imagem.svg', markdown: '![Descrição da imagem](nova-imagem.svg)' }],
    importDroppedImages: async () => [{ name: 'imagem-arrastada.svg', markdown: '![Descrição da imagem](imagem-arrastada.svg)' }],
    readAsset: async (_postId, name) => `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#524DE1"/><stop offset="1" stop-color="#558B6E"/></linearGradient></defs><rect width="800" height="500" fill="url(#g)"/><text x="400" y="270" text-anchor="middle" fill="#FFC759" font-size="42" font-family="sans-serif">${name}</text></svg>`)}`,
    readAssetInfo: async (_postId, name) => ({ name, size: 18432, dataUrl: `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="#558B6E"/><text x="400" y="270" text-anchor="middle" fill="#FFC759" font-size="42">${name}</text></svg>`)}` }),
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
    githubStatus: async () => ({ configured: true, connected: true, persistent: true, account: { login: 'voce', name: 'Você', avatarUrl: 'https://github.com/identicons/voce.png', profileUrl: 'https://github.com/voce' } }),
    beginGitHubSignIn: async () => ({ deviceCode: 'demo-device', userCode: 'PLUM-BAGO', verificationUri: 'https://github.com/login/device', expiresIn: 900, interval: 5 }),
    completeGitHubSignIn: async () => ({ state: 'complete', persistent: true, account: { login: 'voce', name: 'Você', avatarUrl: 'https://github.com/identicons/voce.png', profileUrl: 'https://github.com/voce' } }),
    connectGitHubToken: async () => ({ persistent: true, account: { login: 'voce', name: 'Você', avatarUrl: 'https://github.com/identicons/voce.png', profileUrl: 'https://github.com/voce' } }),
    disconnectGitHub: async () => true,
    listGitHubRepositories: async () => [{ fullName: 'voce/blog', name: 'blog', owner: 'voce', private: false, url: 'https://github.com/voce/blog', sshUrl: 'git@github.com:voce/blog.git', cloneUrl: 'https://github.com/voce/blog.git', permissions: { push: true } }],
    createGitHubRepository: async (input) => ({ repository: { fullName: `voce/${input.name}`, name: input.name, owner: 'voce', private: input.private, url: `https://github.com/voce/${input.name}` }, config: { branch: 'main', remote: `git@github.com:voce/${input.name}.git` } }),
    connectGitHubRepository: async (fullName) => ({ repository: { fullName, url: `https://github.com/${fullName}` }, config: { branch: 'main', remote: `git@github.com:${fullName}.git` } }),
    configureGitHubPages: async () => ({ branch: 'main', hugoVersion: '0.148.2', liveUrl: 'https://voce.github.io/blog/', repository: { fullName: 'voce/blog' }, warning: '', workflow: '.github/workflows/plumbago-pages.yml' }),
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
