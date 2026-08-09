const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')
const service = require('../electron/plumbago-service.cjs')

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
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), 'plumbago-new-site-'))
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
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'plumbago-test-'))
  t.after(() => fs.rm(temporaryRoot, { recursive: true, force: true }))
  await execFileAsync('hugo', ['new', 'site', temporaryRoot, '--force'])
  await execFileAsync('git', ['init', '-b', 'main'], { cwd: temporaryRoot })

  const context = await service.validateBlog(temporaryRoot)
  assert.match(context.hugo, /^hugo v/)

  const gitConfig = await service.saveGitConfig(temporaryRoot, {
    name: 'Autora Plumbago',
    email: 'autora@example.com',
    remote: 'https://github.com/example/plumbago-blog.git',
  })
  assert.equal(gitConfig.name, 'Autora Plumbago')
  assert.equal(gitConfig.email, 'autora@example.com')
  assert.equal(gitConfig.remote, 'https://github.com/example/plumbago-blog.git')

  const created = await service.createPost(temporaryRoot, { title: 'Meu Primeiro Post', language: 'pt-br' })
  assert.equal(created.id, 'content/posts/meu-primeiro-post/index.pt-br.md')
  assert.equal(created.title, 'Meu Primeiro Post')
  assert.equal(created.draft, true)

  const saved = await service.savePost(temporaryRoot, {
    ...created,
    description: 'Uma descrição curta.',
    body: '# Olá\n\nEste é o conteúdo.',
    tags: ['Hugo', 'Plumbago'],
  })
  assert.equal(saved.description, 'Uma descrição curta.')
  assert.equal(saved.body, '# Olá\n\nEste é o conteúdo.')

  const imageSource = path.join(temporaryRoot, 'Café com Plumbago.PNG')
  await fs.writeFile(imageSource, Buffer.from([0x89, 0x50, 0x4e, 0x47]))
  const imported = await service.importImages(temporaryRoot, saved.id, [imageSource])
  assert.equal(imported[0].name, 'cafe-com-plumbago.png')
  assert.match(imported[0].markdown, /cafe-com-plumbago\.png/)

  const listed = await service.listPosts(temporaryRoot)
  assert.equal(listed.length, 1)
  assert.equal(listed[0].date, new Date().toISOString().slice(0, 10))
})

test('sincroniza commits com um remoto Git e reutiliza o upstream', async (t) => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'plumbago-sync-'))
  t.after(() => fs.rm(temporaryRoot, { recursive: true, force: true }))
  const blogRoot = path.join(temporaryRoot, 'blog')
  const remoteRoot = path.join(temporaryRoot, 'remote.git')

  await execFileAsync('hugo', ['new', 'site', blogRoot])
  await execFileAsync('git', ['init', '-b', 'main'], { cwd: blogRoot })
  await execFileAsync('git', ['config', 'user.name', 'Plumbago Tests'], { cwd: blogRoot })
  await execFileAsync('git', ['config', 'user.email', 'tests@plumbago.local'], { cwd: blogRoot })
  await execFileAsync('git', ['init', '--bare', remoteRoot])
  await execFileAsync('git', ['remote', 'add', 'origin', remoteRoot], { cwd: blogRoot })

  const first = await service.syncGit(blogRoot, 'Primeira sincronização')
  assert.equal(first.status.branch, 'main')
  assert.deepEqual(first.status.changes, [])
  assert.match(first.log.join('\n'), /Conteúdo enviado/)

  await fs.writeFile(path.join(blogRoot, 'README.md'), '# Blog Plumbago\n', 'utf8')
  const second = await service.syncGit(blogRoot, 'Segunda sincronização')
  assert.deepEqual(second.status.changes, [])
  assert.match(second.log.join('\n'), /Novidades remotas aplicadas/)

  const remoteHead = await execFileAsync('git', ['rev-parse', 'refs/heads/main'], { cwd: remoteRoot })
  const localHead = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: blogRoot })
  assert.equal(remoteHead.stdout.trim(), localHead.stdout.trim())
})
