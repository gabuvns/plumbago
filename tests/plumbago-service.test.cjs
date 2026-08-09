const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')
const YAML = require('yaml')
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

test('identifica repositórios GitHub e calcula a URL padrão do Pages', () => {
  const ssh = service.parseGitHubRemote('git@github.com:ana/meu-blog.git')
  assert.deepEqual(ssh, {
    owner: 'ana',
    repository: 'meu-blog',
    fullName: 'ana/meu-blog',
    url: 'https://github.com/ana/meu-blog',
  })
  assert.deepEqual(service.parseGitHubRemote('https://github.com/ana/meu-blog.git'), ssh)
  assert.equal(service.parseGitHubRemote('/tmp/remote.git'), null)
  assert.equal(service.defaultGitHubPagesUrl(ssh), 'https://ana.github.io/meu-blog/')
  assert.equal(service.defaultGitHubPagesUrl({ ...ssh, repository: 'ana.github.io' }), 'https://ana.github.io/')
  const workflow = service.githubPagesWorkflow('main', '0.148.2')
  assert.match(workflow, /branches: \["main"\]/)
  assert.match(workflow, /HUGO_VERSION: 0\.148\.2/)
  assert.match(workflow, /actions\/checkout@v7/)
  assert.match(workflow, /actions\/configure-pages@v6/)
  assert.match(workflow, /actions\/upload-pages-artifact@v5/)
  assert.match(workflow, /actions\/deploy-pages@v5/)
  assert.match(workflow, /dart-sass-\$\{DART_SASS_VERSION\}-linux-x64/)
  assert.match(workflow, /cron: "17 \* \* \* \*"/)
  assert.deepEqual(YAML.parse(workflow).on.push.branches, ['main'])
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
  const settings = await service.saveSiteSettings(context.root, {
    title: 'Caderno publicado',
    baseURL: 'https://ana.github.io/caderno',
    languageCode: 'pt-BR',
    copyright: '© Ana',
  })
  assert.equal(settings.title, 'Caderno publicado')
  assert.equal(settings.baseURL, 'https://ana.github.io/caderno/')
  assert.equal(settings.copyright, '© Ana')
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
    publishDate: '2030-06-15T18:30:00.000Z',
  })
  assert.equal(saved.description, 'Uma descrição curta.')
  assert.equal(saved.body, '# Olá\n\nEste é o conteúdo.')
  assert.equal(saved.publishDate, '2030-06-15T18:30:00.000Z')

  const imageSource = path.join(temporaryRoot, 'Café com Plumbago.PNG')
  await fs.writeFile(imageSource, Buffer.from([0x89, 0x50, 0x4e, 0x47]))
  const imported = await service.importImages(temporaryRoot, saved.id, [imageSource])
  assert.equal(imported[0].name, 'cafe-com-plumbago.png')
  assert.match(imported[0].markdown, /cafe-com-plumbago\.png/)
  const assetInfo = await service.readAssetInfo(temporaryRoot, saved.id, imported[0].name)
  assert.equal(assetInfo.size, 4)
  assert.match(assetInfo.dataUrl, /^data:image\/png;base64,/)

  const listed = await service.listPosts(temporaryRoot)
  assert.equal(listed.length, 1)
  assert.equal(listed[0].date, new Date().toISOString().slice(0, 10))
  assert.equal(listed[0].publishDate, '2030-06-15T18:30:00.000Z')
})

test('inspeciona e importa um backup do Blogger como Markdown', async (t) => {
  assert.throws(
    () => service.parseBloggerExport('<!DOCTYPE feed [<!ENTITY payload "unsafe">]><feed />'),
    /DOCTYPE/,
  )
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'plumbago-blogger-'))
  t.after(() => fs.rm(temporaryRoot, { recursive: true, force: true }))
  await execFileAsync('hugo', ['new', 'site', temporaryRoot, '--force'])
  await execFileAsync('git', ['init', '-b', 'main'], { cwd: temporaryRoot })
  const exportPath = path.join(temporaryRoot, 'blogger.xml')
  await fs.writeFile(exportPath, `<?xml version="1.0" encoding="UTF-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom" xmlns:app="http://purl.org/atom/app#">
      <entry>
        <id>tag:blogger.com,1999:blog-1.post-22</id>
        <published>2020-05-04T13:00:00.000Z</published>
        <category scheme="http://schemas.google.com/g/2005#kind" term="http://schemas.google.com/blogger/2008/kind#post" />
        <category scheme="http://www.blogger.com/atom/ns#" term="Viagem" />
        <title type="text">Uma viagem antiga</title>
        <content type="html">&lt;p&gt;Olá &lt;strong&gt;mundo&lt;/strong&gt;.&lt;/p&gt;</content>
        <link rel="alternate" href="https://example.blogspot.com/2020/05/uma-viagem-antiga.html" />
      </entry>
    </feed>`, 'utf8')

  const inspection = await service.inspectBloggerExport(exportPath)
  assert.equal(inspection.posts.length, 1)
  assert.equal(inspection.posts[0].slug, 'uma-viagem-antiga')
  assert.deepEqual(inspection.labels, ['Viagem'])

  const imported = await service.importBloggerExport(temporaryRoot, exportPath, { language: 'pt-br' })
  assert.equal(imported.posts.length, 1)
  assert.equal(imported.posts[0].date, '2020-05-04')
  assert.deepEqual(imported.posts[0].tags, ['Viagem'])
  assert.match(imported.posts[0].body, /Olá \*\*mundo\*\*/)
  assert.deepEqual(imported.failures, [])
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
  const second = await service.publishBlog(blogRoot, 'Segunda sincronização')
  assert.deepEqual(second.status.changes, [])
  assert.match(second.log.join('\n'), /Novidades remotas aplicadas/)
  assert.match(second.log.join('\n'), /Hugo build completed successfully/)
  assert.equal(second.status.deployment.state, 'unavailable')

  const remoteHead = await execFileAsync('git', ['rev-parse', 'refs/heads/main'], { cwd: remoteRoot })
  const localHead = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: blogRoot })
  assert.equal(remoteHead.stdout.trim(), localHead.stdout.trim())
})
