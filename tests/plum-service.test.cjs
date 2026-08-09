const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')
const service = require('../electron/plum-service.cjs')

const execFileAsync = promisify(execFile)

test('identifica blogs em pastas do WSL abertas pelo Windows', () => {
  assert.deepEqual(service.runtimeFor(String.raw`\\wsl.localhost\Ubuntu-24.04\home\ana\blog`), {
    kind: 'wsl',
    distro: 'Ubuntu-24.04',
    workingDirectory: '/home/ana/blog',
  })
})

test('normaliza títulos em slugs seguros', () => {
  assert.equal(service.slugify('Dragões & Café!'), 'dragoes-cafe')
})

test('lê temas e repositórios publicados no catálogo oficial do Hugo', () => {
  const catalog = service.parseThemeCatalog(`
    <li><picture><img src=/themes/hugo-plum/tn-featured.png></picture>
    <a href=/themes/hugo-plum/ type=button><span class=sr-only>View details for Plum &amp; Paper</span></a></li>
  `)
  assert.deepEqual(catalog, [{
    slug: 'hugo-plum',
    name: 'Plum & Paper',
    image: 'https://themes.gohugo.io/themes/hugo-plum/tn-featured.png',
    details: 'https://themes.gohugo.io/themes/hugo-plum/',
  }])
  assert.equal(
    service.parseThemeRepository('<a href="https://github.com/example/hugo-plum" rel="nofollow external">Download</a>'),
    'https://github.com/example/hugo-plum.git',
  )
})

test('cria um novo site Hugo com configuração e repositório Git', async (t) => {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), 'plum-new-site-'))
  t.after(() => fs.rm(parent, { recursive: true, force: true }))
  const context = await service.createSite(parent, {
    title: 'Caderno de Ideias',
    folder: 'caderno-de-ideias',
    languageCode: 'pt-BR',
  })
  assert.equal(context.root, path.join(parent, 'caderno-de-ideias'))
  assert.equal(context.theme, '')
  assert.match(await fs.readFile(path.join(context.root, 'hugo.toml'), 'utf8'), /title = "Caderno de Ideias"/)
  assert.ok(await fs.stat(path.join(context.root, '.git')))
})

test('cria, edita, lista e adiciona imagens a um page bundle Hugo', async (t) => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'plum-test-'))
  t.after(() => fs.rm(temporaryRoot, { recursive: true, force: true }))
  await execFileAsync('hugo', ['new', 'site', temporaryRoot, '--force'])
  await execFileAsync('git', ['init', '-b', 'main'], { cwd: temporaryRoot })

  const context = await service.validateBlog(temporaryRoot)
  assert.match(context.hugo, /^hugo v/)

  const gitConfig = await service.saveGitConfig(temporaryRoot, {
    name: 'Autora Plum',
    email: 'autora@example.com',
    remote: 'https://github.com/example/plum-blog.git',
  })
  assert.equal(gitConfig.name, 'Autora Plum')
  assert.equal(gitConfig.email, 'autora@example.com')
  assert.equal(gitConfig.remote, 'https://github.com/example/plum-blog.git')

  const created = await service.createPost(temporaryRoot, { title: 'Meu Primeiro Post', language: 'pt-br' })
  assert.equal(created.id, 'content/posts/meu-primeiro-post/index.pt-br.md')
  assert.equal(created.title, 'Meu Primeiro Post')
  assert.equal(created.draft, true)

  const saved = await service.savePost(temporaryRoot, {
    ...created,
    description: 'Uma descrição curta.',
    body: '# Olá\n\nEste é o conteúdo.',
    tags: ['Hugo', 'Plum'],
  })
  assert.equal(saved.description, 'Uma descrição curta.')
  assert.equal(saved.body, '# Olá\n\nEste é o conteúdo.')

  const imageSource = path.join(temporaryRoot, 'Café com Plum.PNG')
  await fs.writeFile(imageSource, Buffer.from([0x89, 0x50, 0x4e, 0x47]))
  const imported = await service.importImages(temporaryRoot, saved.id, [imageSource])
  assert.equal(imported[0].name, 'cafe-com-plum.png')
  assert.match(imported[0].markdown, /cafe-com-plum\.png/)

  const listed = await service.listPosts(temporaryRoot)
  assert.equal(listed.length, 1)
  assert.equal(listed[0].date, new Date().toISOString().slice(0, 10))
})
