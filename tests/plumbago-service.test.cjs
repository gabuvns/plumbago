const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')
const YAML = require('yaml')
const service = require('../electron/plumbago-service.cjs')
const runtimeService = require('../electron/core/runtime.cjs')
const httpService = require('../electron/core/http.cjs')
const themeCompatibility = require('../electron/services/theme-compatibility.cjs')

const execFileAsync = promisify(execFile)

function makeTemporaryDirectory(prefix) {
  // Strictly confined Hugo Snap builds cannot access /tmp, but can work in a
  // regular (non-hidden) directory below the user's home folder.
  return fs.mkdtemp(path.join(os.homedir(), `${prefix}-`))
}

test('identifica blogs em pastas do WSL abertas pelo Windows', () => {
  const runtime = service.runtimeFor(String.raw`\\wsl.localhost\Ubuntu-24.04\home\ana\blog`)
  assert.deepEqual(runtime, {
    kind: 'wsl',
    distro: 'Ubuntu-24.04',
    workingDirectory: '/home/ana/blog',
  })
  assert.deepEqual(service.wslCommandArgs(runtime, 'hugo', ['new', "post/it's-ready.md"]), [
    '-d',
    'Ubuntu-24.04',
    '--cd',
    '/home/ana/blog',
    '--',
    '/bin/bash',
    '-lc',
    `exec 'hugo' 'new' 'post/it'"'"'s-ready.md'`,
  ])
})

test('encaminha autenticação HTTPS do GitHub sem gravar o token no remoto', () => {
  const token = 'github-token-used-only-for-this-test'
  const authentication = service.githubGitEnvironment(token)
  assert.equal(authentication.GIT_CONFIG_COUNT, '1')
  assert.equal(authentication.GIT_CONFIG_KEY_0, 'http.https://github.com/.extraheader')
  assert.equal(authentication.GIT_TERMINAL_PROMPT, '0')
  assert.equal(Buffer.from(authentication.GIT_CONFIG_VALUE_0.replace('Authorization: Basic ', ''), 'base64').toString(), `x-access-token:${token}`)

  const environment = runtimeService.commandEnvironment(authentication, true)
  assert.match(environment.WSLENV, /GIT_CONFIG_VALUE_0/)
  assert.equal(process.env.GIT_CONFIG_VALUE_0, undefined)
})

test('explica autorização expirada, permissão insuficiente e limite da API do GitHub', () => {
  assert.match(httpService.githubErrorMessage(401, { message: 'Bad credentials' }), /authorization expired/i)
  assert.match(httpService.githubErrorMessage(403, { message: 'Resource not accessible' }), /denied this action/i)
  assert.match(httpService.githubErrorMessage(403, { message: 'rate limit exceeded' }, new Headers({ 'x-ratelimit-remaining': '0' })), /limits were reached/i)
})

test('usa a identidade noreply do GitHub sem expor o email pessoal', () => {
  assert.equal(service.githubCommitEmail({ id: 123456, login: 'writer' }), '123456+writer@users.noreply.github.com')
})

test('normaliza a resposta real do Device Flow para a interface', () => {
  assert.deepEqual(service.normalizeGitHubDeviceCode({
    device_code: 'device-code',
    user_code: 'ABCD-EFGH',
    verification_uri: 'https://github.com/login/device',
    expires_in: 900,
    interval: 5,
  }), {
    deviceCode: 'device-code',
    userCode: 'ABCD-EFGH',
    verificationUri: 'https://github.com/login/device',
    expiresIn: 900,
    interval: 5,
  })
})

test('oferece instalação do Git específica para Windows, WSL e macOS', () => {
  assert.deepEqual(service.gitInstallAssistance({ kind: 'wsl', distro: 'Ubuntu-24.04' }), {
    mode: 'command',
    command: 'sudo apt update && sudo apt install -y git',
    url: 'https://git-scm.com/install/linux',
  })
  assert.deepEqual(service.gitInstallAssistance({ kind: 'native', platform: 'win32' }), {
    mode: 'automatic',
    command: 'winget install --id Git.Git -e --source winget',
    url: 'https://git-scm.com/install/windows',
  })
  assert.equal(service.gitInstallAssistance({ kind: 'native', platform: 'darwin' }).command, 'xcode-select --install')
})

test('direciona a ajuda do Hugo para o ambiente correto', async () => {
  const { hugoDiagnostics, hugoInstallUrl } = await import('../src/lib/hugo.js')
  assert.equal(hugoInstallUrl({ kind: 'wsl', distro: 'Ubuntu-24.04' }), 'https://gohugo.io/installation/linux/')
  assert.equal(hugoInstallUrl({ kind: 'native', platform: 'darwin' }), 'https://gohugo.io/installation/macos/')
  assert.equal(hugoInstallUrl({ kind: 'native', platform: 'win32' }), 'https://gohugo.io/installation/windows/')
  assert.match(hugoDiagnostics({ root: '/home/ana/blog', runtime: { kind: 'wsl', distro: 'Ubuntu-24.04' }, hugo: null, hugoExecutable: '/usr/local/bin/hugo', git: 'git version 2.43.0' }), /WSL \(Ubuntu-24\.04\)[\s\S]*Hugo: Not found[\s\S]*\/usr\/local\/bin\/hugo/)
  assert.deepEqual(service.hugoInstallAssistance({ kind: 'native', platform: 'win32' }), {
    mode: 'automatic',
    command: 'winget install --id Hugo.Hugo.Extended -e --source winget',
    url: 'https://gohugo.io/installation/windows/',
    repositoryMayLag: false,
  })
  assert.equal(service.hugoInstallAssistance({ kind: 'wsl', distro: 'Ubuntu-24.04' }).command, 'sudo apt update && sudo apt install -y hugo')
  assert.equal(service.inferHostingProvider('https://example.com/'), 'none')
  assert.equal(
    service.wslBlogRoot(String.raw`C:\Users\Ana\Sites\Meu blog`, 'Ubuntu-24.04'),
    String.raw`\\wsl.localhost\Ubuntu-24.04\mnt\c\Users\Ana\Sites\Meu blog`,
  )
})

test('compara a versão instalada com a release mais recente do Plumbago', () => {
  const release = { tag_name: 'v0.6.0', name: 'Plumbago 0.6.0', body: 'Release notes', published_at: '2026-08-09T12:00:00Z', html_url: 'https://github.com/gabuvns/plumbago/releases/tag/v0.6.0' }
  assert.equal(service.releaseSummary('0.5.0', release).state, 'available')
  assert.equal(service.releaseSummary('0.6.0', release).state, 'up-to-date')
  assert.equal(service.releaseSummary('0.7.0', release).state, 'up-to-date')
  assert.equal(service.releaseSummary('0.5.0', release).version, '0.6.0')
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

test('interpreta e compara os requisitos de versão dos temas', async (t) => {
  const themeRoot = await makeTemporaryDirectory('plumbago-theme-requirements')
  t.after(() => fs.rm(themeRoot, { recursive: true, force: true }))
  await fs.writeFile(path.join(themeRoot, 'theme.toml'), 'min_version = "0.150.0"\n')
  await fs.writeFile(path.join(themeRoot, 'hugo.toml'), '[module.hugoVersion]\nmin = "0.158.0"\nmax = "0.164.0"\nextended = true\n')

  const current = themeCompatibility.parseHugoVersion('hugo v0.123.7+extended linux/amd64')
  const requirements = await themeCompatibility.readThemeRequirements(themeRoot)
  const report = themeCompatibility.evaluateThemeCompatibility(current, requirements)

  assert.deepEqual(current, {
    version: '0.123.7',
    extended: true,
    raw: 'hugo v0.123.7+extended linux/amd64',
  })
  assert.equal(requirements.min, '0.158.0')
  assert.equal(requirements.max, '0.164.0')
  assert.equal(requirements.extended, true)
  assert.equal(report.compatible, false)
  assert.deepEqual(report.issues[0], { code: 'minimum', required: '0.158.0', current: '0.123.7' })
  assert.equal(themeCompatibility.compareVersions('0.164.1', '0.164.0'), 1)
})

test('desfaz a instalação de um tema incompatível sem quebrar o blog', async (t) => {
  const temporaryRoot = await makeTemporaryDirectory('plumbago-theme-rollback')
  const blogRoot = path.join(temporaryRoot, 'blog')
  const themeRoot = path.join(temporaryRoot, 'future-theme')
  const previousProtocol = process.env.GIT_ALLOW_PROTOCOL
  process.env.GIT_ALLOW_PROTOCOL = 'file'
  t.after(() => {
    if (previousProtocol === undefined) delete process.env.GIT_ALLOW_PROTOCOL
    else process.env.GIT_ALLOW_PROTOCOL = previousProtocol
    return fs.rm(temporaryRoot, { recursive: true, force: true })
  })

  await execFileAsync('hugo', ['new', 'site', blogRoot])
  await execFileAsync('git', ['init', '-b', 'main'], { cwd: blogRoot })
  await fs.mkdir(themeRoot)
  await fs.writeFile(path.join(themeRoot, 'theme.toml'), 'name = "Future"\nmin_version = "99.0.0"\n')
  await execFileAsync('git', ['init', '-b', 'main'], { cwd: themeRoot })
  await execFileAsync('git', ['config', 'user.name', 'Plumbago Tests'], { cwd: themeRoot })
  await execFileAsync('git', ['config', 'user.email', 'tests@plumbago.local'], { cwd: themeRoot })
  await execFileAsync('git', ['add', '.'], { cwd: themeRoot })
  await execFileAsync('git', ['commit', '-m', 'Theme fixture'], { cwd: themeRoot })
  const configPath = path.join(blogRoot, 'hugo.toml')
  const originalConfig = await fs.readFile(configPath, 'utf8')

  const result = await service.installResolvedTheme(blogRoot, {
    slug: 'future-theme',
    folder: 'future-theme',
    repository: themeRoot,
    details: '',
  })

  assert.equal(result.ok, false)
  assert.equal(result.stage, 'compatibility')
  assert.equal(result.compatibility.issues[0].code, 'minimum')
  assert.equal(await fs.readFile(configPath, 'utf8'), originalConfig)
  assert.equal(await fs.stat(path.join(blogRoot, 'themes', 'future-theme')).catch(() => null), null)
})

test('restaura o blog quando o tema falha na compilação de validação', async (t) => {
  const temporaryRoot = await makeTemporaryDirectory('plumbago-theme-build-rollback')
  const blogRoot = path.join(temporaryRoot, 'blog')
  const themeRoot = path.join(temporaryRoot, 'broken-theme')
  const previousProtocol = process.env.GIT_ALLOW_PROTOCOL
  process.env.GIT_ALLOW_PROTOCOL = 'file'
  t.after(() => {
    if (previousProtocol === undefined) delete process.env.GIT_ALLOW_PROTOCOL
    else process.env.GIT_ALLOW_PROTOCOL = previousProtocol
    return fs.rm(temporaryRoot, { recursive: true, force: true })
  })

  await execFileAsync('hugo', ['new', 'site', blogRoot])
  await execFileAsync('git', ['init', '-b', 'main'], { cwd: blogRoot })
  await fs.mkdir(path.join(themeRoot, 'layouts', 'shortcodes'), { recursive: true })
  await fs.writeFile(path.join(themeRoot, 'theme.toml'), 'name = "Broken"\nmin_version = "0.100.0"\n')
  await fs.writeFile(path.join(themeRoot, 'layouts', 'shortcodes', 'broken.html'), '{{ if }}\n')
  await fs.mkdir(path.join(blogRoot, 'content', 'posts'), { recursive: true })
  await fs.writeFile(path.join(blogRoot, 'content', 'posts', 'test.md'), '---\ntitle: Test\n---\n\n{{< broken >}}\n')
  await execFileAsync('git', ['init', '-b', 'main'], { cwd: themeRoot })
  await execFileAsync('git', ['config', 'user.name', 'Plumbago Tests'], { cwd: themeRoot })
  await execFileAsync('git', ['config', 'user.email', 'tests@plumbago.local'], { cwd: themeRoot })
  await execFileAsync('git', ['add', '.'], { cwd: themeRoot })
  await execFileAsync('git', ['commit', '-m', 'Broken theme fixture'], { cwd: themeRoot })
  const configPath = path.join(blogRoot, 'hugo.toml')
  const originalConfig = await fs.readFile(configPath, 'utf8')

  const result = await service.installResolvedTheme(blogRoot, {
    slug: 'broken-theme',
    folder: 'broken-theme',
    repository: themeRoot,
    details: '',
  })

  assert.equal(result.ok, false)
  assert.equal(result.stage, 'build')
  assert.match(result.details, /parse|template|unexpected/i)
  assert.equal(await fs.readFile(configPath, 'utf8'), originalConfig)
  assert.equal(await fs.stat(path.join(blogRoot, 'themes', 'broken-theme')).catch(() => null), null)
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
  const workflow = service.githubPagesWorkflow('feature/draft', '0.148.2')
  assert.match(workflow, /HUGO_VERSION: 0\.148\.2/)
  assert.match(workflow, /actions\/checkout@v7/)
  assert.match(workflow, /actions\/configure-pages@v6/)
  assert.match(workflow, /actions\/upload-pages-artifact@v5/)
  assert.match(workflow, /actions\/deploy-pages@v5/)
  assert.match(workflow, /dart-sass-\$\{DART_SASS_VERSION\}-linux-x64/)
  assert.match(workflow, /cron: "17 \* \* \* \*"/)
  assert.deepEqual(YAML.parse(workflow).on.push.branches, ['main', 'master'])
})

test('cria um novo site Hugo com configuração e repositório Git', async (t) => {
  const parent = await makeTemporaryDirectory('plumbago-new-site')
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
  const initialSettings = await service.siteSettings(context.root)
  assert.equal(initialSettings.hostingProvider, 'none')
  assert.equal(initialSettings.publicUrl, '')
  const settings = await service.saveSiteSettings(context.root, {
    title: 'Caderno publicado',
    baseURL: 'https://ana.github.io/caderno',
    languageCode: 'pt-BR',
    copyright: '© Ana',
  })
  assert.equal(settings.title, 'Caderno publicado')
  assert.equal(settings.baseURL, 'https://ana.github.io/caderno/')
  assert.equal(settings.copyright, '© Ana')
  assert.equal(settings.hostingProvider, 'github-pages')
  assert.equal(settings.publicUrl, 'https://ana.github.io/caderno/')

  const cloudflare = await service.saveSiteSettings(context.root, {
    ...settings,
    baseURL: 'https://caderno.pages.dev/',
    publicUrl: 'https://caderno.pages.dev/',
    hostingProvider: 'cloudflare-pages',
  })
  assert.equal(cloudflare.hostingProvider, 'cloudflare-pages')
  assert.equal(cloudflare.publicUrl, 'https://caderno.pages.dev/')
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(context.root, '.plumbago.json'), 'utf8')), {
    hostingProvider: 'cloudflare-pages',
    publicUrl: 'https://caderno.pages.dev/',
  })
})

test('detecta e inicializa com segurança um blog Hugo sem repositório Git', async (t) => {
  const temporaryRoot = await makeTemporaryDirectory('plumbago-git-readiness')
  t.after(() => fs.rm(temporaryRoot, { recursive: true, force: true }))
  await execFileAsync('hugo', ['new', 'site', temporaryRoot, '--force'])

  const before = await service.gitReadiness(temporaryRoot)
  assert.equal(before.git.status, 'ready')
  assert.equal(before.repository.status, 'uninitialized')
  assert.equal(before.ready, false)
  await assert.rejects(
    service.saveGitConfig(temporaryRoot, { name: 'Plumbago Tests' }),
    /has not been initialized as a Git repository/,
  )

  const initialized = await service.ensureGitRepository(temporaryRoot)
  assert.equal(initialized.ready, true)
  assert.equal(initialized.repository.status, 'ready')
  assert.ok(await fs.stat(path.join(temporaryRoot, '.git')))
  assert.equal((await service.ensureGitRepository(temporaryRoot)).ready, true)
})

test('reconhece um blog que faz parte de um repositório pai', async (t) => {
  const temporaryRoot = await makeTemporaryDirectory('plumbago-parent-repository')
  const blogRoot = path.join(temporaryRoot, 'sites', 'blog')
  t.after(() => fs.rm(temporaryRoot, { recursive: true, force: true }))
  await execFileAsync('git', ['init', '-b', 'main'], { cwd: temporaryRoot })
  await fs.mkdir(path.dirname(blogRoot), { recursive: true })
  await execFileAsync('hugo', ['new', 'site', blogRoot])

  const readiness = await service.gitReadiness(blogRoot)
  assert.equal(readiness.ready, true)
  assert.equal(readiness.repository.status, 'parent-repository')
  assert.equal(path.resolve(readiness.repository.topLevel), path.resolve(temporaryRoot))
})

test('cria, edita, lista e adiciona imagens a um page bundle Hugo', async (t) => {
  const temporaryRoot = await makeTemporaryDirectory('plumbago-test')
  t.after(() => fs.rm(temporaryRoot, { recursive: true, force: true }))
  await execFileAsync('hugo', ['new', 'site', temporaryRoot, '--force'])
  await execFileAsync('git', ['init', '-b', 'main'], { cwd: temporaryRoot })

  const context = await service.validateBlog(temporaryRoot)
  assert.match(context.hugo, /^hugo v/)
  assert.match(context.hugoExecutable, /hugo$/)

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
  assert.ok(['toml', 'yaml'].includes(created.frontMatterFormat))

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

  const published = await service.savePost(temporaryRoot, {
    ...saved,
    body: `${saved.body}\n\n![Café](${imported[0].name})`,
    draft: false,
    publishDate: '',
  })
  await fs.mkdir(path.join(temporaryRoot, 'layouts', '_default'), { recursive: true })
  await fs.writeFile(path.join(temporaryRoot, 'layouts', '_default', 'single.html'), '<main>{{ .Content }}</main>\n', 'utf8')
  await execFileAsync('hugo', ['--destination', 'public-test'], { cwd: temporaryRoot })
  assert.ok(await fs.stat(path.join(temporaryRoot, 'public-test', 'posts', 'meu-primeiro-post', imported[0].name)))
  assert.match(await fs.readFile(path.join(temporaryRoot, 'hugo.toml'), 'utf8'), /\[languages\.pt-br\]/)
  const raw = await fs.readFile(path.join(temporaryRoot, published.id), 'utf8')
  assert.equal([...raw.matchAll(/^(?:---|\+\+\+)$/gm)].length, 2)

  const listed = await service.listPosts(temporaryRoot)
  assert.equal(listed.length, 1)
  assert.equal(listed[0].date, new Date().toISOString().slice(0, 10))
  assert.equal(listed[0].publishDate, '')

  const removed = await service.deletePost(temporaryRoot, published.id)
  assert.deepEqual(removed.preservedAssets, [imported[0].name])
  assert.equal(await fs.stat(path.join(temporaryRoot, published.id)).catch(() => null), null)
  assert.ok(await fs.stat(path.join(temporaryRoot, 'content', 'posts', 'meu-primeiro-post', imported[0].name)))
})

test('remove front matter TOML duplicado sem perder metadados e protege edições externas', async (t) => {
  const temporaryRoot = await makeTemporaryDirectory('plumbago-front-matter')
  t.after(() => fs.rm(temporaryRoot, { recursive: true, force: true }))
  await execFileAsync('hugo', ['new', 'site', temporaryRoot, '--force'])
  const id = 'content/posts/exemplo/index.pt-br.md'
  const absolute = path.join(temporaryRoot, id)
  await fs.mkdir(path.dirname(absolute), { recursive: true })
  await fs.writeFile(absolute, `---
title: Isso é um teste
date: 2026-08-09
draft: false
customField: preservado
---

+++
date = '2026-08-09T23:06:16-03:00'
draft = true
title = 'Index.pt Br'
legacyField = 'também preservado'
+++

Esse post é um teste do Plumbago.
`, 'utf8')

  const loaded = await service.readPost(temporaryRoot, id)
  assert.equal(loaded.repairedNestedFrontMatter, true)
  assert.equal(loaded.title, 'Isso é um teste')
  assert.equal(loaded.body, 'Esse post é um teste do Plumbago.\n')

  const cleaned = await service.savePost(temporaryRoot, loaded)
  const raw = await fs.readFile(absolute, 'utf8')
  assert.doesNotMatch(raw, /^\+\+\+$/m)
  assert.match(raw, /customField: preservado/)
  assert.match(raw, /legacyField: também preservado/)
  assert.equal([...raw.matchAll(/^---$/gm)].length, 2)

  await fs.appendFile(absolute, '\nAlteração feita pelo Obsidian.\n', 'utf8')
  await assert.rejects(service.savePost(temporaryRoot, { ...cleaned, body: 'Texto antigo' }), /changed outside Plumbago/i)
})

test('inspeciona e importa um backup do Blogger como Markdown', async (t) => {
  assert.throws(
    () => service.parseBloggerExport('<!DOCTYPE feed [<!ENTITY payload "unsafe">]><feed />'),
    /DOCTYPE/,
  )
  const temporaryRoot = await makeTemporaryDirectory('plumbago-blogger')
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
  const temporaryRoot = await makeTemporaryDirectory('plumbago-sync')
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
