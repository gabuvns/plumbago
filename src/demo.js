const samplePosts = [
  { id: 'content/posts/cultivando-ideias/index.pt-br.md', title: 'Cultivando ideias com calma', description: 'Notas sobre processo criativo, referências e espaço para experimentar.', date: '2026-08-07', draft: false, language: 'pt-br', featuredImage: '' },
  { id: 'content/posts/cores-do-inverno/index.pt-br.md', title: 'As cores do inverno', description: 'Uma pequena coleção de estudos de cor.', date: '2026-08-04', draft: true, language: 'pt-br', featuredImage: '' },
  { id: 'content/posts/primeiro-caderno/index.en-us.md', title: 'Notes from the first sketchbook', description: 'A look back at the first pages.', date: '2026-07-28', draft: false, language: 'en-us', featuredImage: '' },
]

const bodies = {
  [samplePosts[0].id]: `A criatividade nem sempre chega fazendo barulho. Às vezes ela começa como uma pergunta pequena, anotada no canto de uma página.\n\n## Um espaço para experimentar\n\nMeu processo ficou mais leve quando parei de exigir que toda ideia nascesse pronta. Hoje, guardo referências, testo combinações e deixo que cada trabalho encontre seu próprio ritmo.\n\n> Criar também é aprender a observar.\n\nSe você quiser acompanhar os próximos estudos, visite [meu portfólio](https://example.com).`,
  [samplePosts[1].id]: 'Ainda estou organizando os estudos desta série.\n\n## Paleta\n\nAzuis profundos, verdes acinzentados e pequenos pontos de calor.',
  [samplePosts[2].id]: 'A few pages, loose lines, and the beginning of a visual language.',
}

function fullPost(summary) {
  return { ...summary, tags: ['Processo', 'Arte'], translationKey: summary.id.split('/')[2], body: bodies[summary.id] || '', assets: [] }
}

export function createDemoBridge() {
  let posts = [...samplePosts]
  return {
    getContext: async () => ({ root: '/home/voce/meu-blog', config: 'hugo.toml', runtime: { kind: 'wsl', distro: 'Ubuntu' }, hugo: 'hugo v0.123.7', git: 'git version 2.43.0' }),
    chooseBlog: async () => ({ root: '/home/voce/meu-blog', config: 'hugo.toml', runtime: { kind: 'wsl', distro: 'Ubuntu' }, hugo: 'hugo v0.123.7', git: 'git version 2.43.0' }),
    listPosts: async () => posts,
    readPost: async (id) => fullPost(posts.find((post) => post.id === id)),
    savePost: async (post) => { posts = posts.map((item) => item.id === post.id ? { ...item, ...post } : item); return post },
    createPost: async (input) => { const summary = { id: `content/posts/novo-post/index.${input.language}.md`, title: input.title, description: '', date: '2026-08-08', draft: true, language: input.language, featuredImage: '' }; posts.unshift(summary); return fullPost(summary) },
    importImages: async () => [],
    readAsset: async () => '',
    gitStatus: async () => ({ branch: 'main', remote: 'git@github.com:voce/blog.git', changes: [' M content/posts/cores-do-inverno/index.pt-br.md'] }),
    syncGit: async () => ({ log: ['Alterações salvas em um commit.', 'Conteúdo enviado ao repositório remoto.'], status: { branch: 'main', remote: 'git@github.com:voce/blog.git', changes: [] } }),
    openPreview: async () => true,
  }
}
