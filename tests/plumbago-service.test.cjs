const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')
const TOML = require('@iarna/toml')
const YAML = require('yaml')
const service = require('../electron/plumbago-service.cjs')
const runtimeService = require('../electron/core/runtime.cjs')
const httpService = require('../electron/core/http.cjs')
const themeCompatibility = require('../electron/services/theme-compatibility.cjs')
const themeConfigFiles = require('../electron/services/theme-configurator/config-files.cjs')
const themeConfigMutations = require('../electron/services/theme-configurator/mutations.cjs')

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

test('separa o caminho do blog da escolha do Hugo nativo ou WSL', () => {
  assert.deepEqual(runtimeService.runtimeFor(String.raw`C:\Users\Ana\Sites\Meu blog`, { kind: 'wsl', distro: 'Ubuntu-24.04' }), {
    kind: 'wsl',
    distro: 'Ubuntu-24.04',
    workingDirectory: '/mnt/c/Users/Ana/Sites/Meu blog',
  })
  assert.deepEqual(runtimeService.runtimeFor(String.raw`\\wsl.localhost\Ubuntu-24.04\mnt\c\Users\Ana\Sites\Meu blog`, { kind: 'wsl', distro: 'Debian' }), {
    kind: 'wsl',
    distro: 'Debian',
    workingDirectory: '/mnt/c/Users/Ana/Sites/Meu blog',
  })
  assert.deepEqual(runtimeService.runtimeFor(String.raw`\\wsl.localhost\Ubuntu-24.04\mnt\c\Users\Ana\Sites\Meu blog`, { kind: 'native', platform: 'win32' }), {
    kind: 'native',
    platform: 'win32',
    workingDirectory: String.raw`C:\Users\Ana\Sites\Meu blog`,
  })
  assert.throws(
    () => runtimeService.runtimeFor(String.raw`\\wsl.localhost\Ubuntu-24.04\home\ana\blog`, { kind: 'wsl', distro: 'Debian' }),
    /stored inside Ubuntu-24\.04/,
  )
  assert.deepEqual(service.hugoRuntimeAccess(String.raw`\\wsl.localhost\Ubuntu-24.04\home\ana\blog`, { kind: 'native', platform: 'win32' }), {
    blogAccessible: false,
    code: 'windows-wsl-filesystem',
    values: { distro: 'Ubuntu-24.04' },
    details: 'Windows Hugo cannot build safely inside the Linux filesystem of Ubuntu-24.04. Choose Hugo from that WSL distribution, or move the blog to a Windows drive.',
  })
  assert.deepEqual(service.hugoRuntimeAccess(String.raw`\\wsl.localhost\Ubuntu-24.04\mnt\c\Users\Ana\Sites\Meu blog`, { kind: 'native', platform: 'win32' }), {
    blogAccessible: true,
    code: '',
    values: {},
    details: '',
  })

  const candidates = service.hugoRuntimeCandidates(String.raw`C:\Users\Ana\Sites\Meu blog`, {
    platform: 'win32',
    selected: { kind: 'wsl', distro: 'Ubuntu-24.04' },
    wslDistributions: ['Ubuntu-24.04', 'Debian'],
  })
  assert.deepEqual(candidates, [
    { kind: 'native', platform: 'win32' },
    { kind: 'wsl', distro: 'Ubuntu-24.04' },
    { kind: 'wsl', distro: 'Debian' },
  ])
})

test('mantém a escolha do runtime do Hugo fora do projeto e reconhece instalações Snap', () => {
  const root = String.raw`C:\Users\Ana\Sites\Meu blog`
  assert.deepEqual(service.setHugoRuntimeSelection(root, { kind: 'wsl', distro: 'Ubuntu-24.04' }), { kind: 'wsl', distro: 'Ubuntu-24.04' })
  assert.deepEqual(service.hugoRuntimeSelection(root), { kind: 'wsl', distro: 'Ubuntu-24.04' })
  service.clearHugoRuntimeSelection(root)
  assert.deepEqual(service.hugoInstallAssistance({ kind: 'wsl', distro: 'Ubuntu-24.04' }, true, '/snap/bin/hugo'), {
    mode: 'command',
    command: 'sudo snap refresh hugo',
    url: 'https://gohugo.io/installation/linux/',
    repositoryMayLag: false,
  })
  assert.equal(service.isNoHugoUpgradeAvailable('No applicable upgrade found.'), true)
  assert.equal(service.isNoHugoUpgradeAvailable('The source could not be reached.'), false)
})

test('indexa e reorganiza taxonomias Hugo em YAML, TOML e JSON com recuperação', async (t) => {
  const root = await makeTemporaryDirectory('plumbago-taxonomies')
  t.after(async () => fs.rm(root, { recursive: true, force: true }))
  await fs.mkdir(path.join(root, 'content', 'posts', 'yaml-post'), { recursive: true })
  await fs.mkdir(path.join(root, 'content', 'posts', 'toml-post'), { recursive: true })
  await fs.mkdir(path.join(root, 'content', 'posts', 'json-post'), { recursive: true })
  await fs.mkdir(path.join(root, 'content', 'posts', 'custom-post'), { recursive: true })
  await fs.mkdir(path.join(root, 'content', 'tags', 'orphan'), { recursive: true })
  await fs.writeFile(path.join(root, 'hugo.toml'), `title = "Taxonomy test"
disableKinds = ["taxonomy"]

[taxonomies]
tag = "tags"
category = "categories"
author = "authors"
`, 'utf8')
  const yamlId = 'content/posts/yaml-post/index.en-us.md'
  const tomlId = 'content/posts/toml-post/index.pt-br.md'
  const jsonId = 'content/posts/json-post/index.en-us.md'
  const customId = 'content/posts/custom-post/index.en-us.md'
  await fs.writeFile(path.join(root, yamlId), `---
title: YAML post
draft: false
tags: [JavaScript]
categories: Tech
authors: [Ana]
params:
  accent: indigo
---

YAML body
`, 'utf8')
  await fs.writeFile(path.join(root, tomlId), `+++
title = "TOML post"
draft = true
tags = ["Javascript"]
categories = ["Tech"]
authors = "Bruno"
[params]
accent = "green"
+++

TOML body
`, 'utf8')
  await fs.writeFile(path.join(root, jsonId), `${JSON.stringify({ title: 'JSON post', draft: false, tags: ['Web Design'], categories: [], authors: ['Ana'], params: { accent: 'yellow' } }, null, 2)}

JSON body
`, 'utf8')
  await fs.writeFile(path.join(root, customId), `---
title: Theme-specific post
draft: true
authors:
  primary: Carla
params:
  keep: true
---

Custom body
`, 'utf8')
  await fs.writeFile(path.join(root, 'content', 'tags', 'orphan', '_index.md'), '---\ntitle: Orphan\n---\n', 'utf8')

  const indexed = await service.taxonomyIndex(root)
  assert.deepEqual(indexed.taxonomies.map((item) => item.id), ['tags', 'categories', 'authors'])
  assert.equal(indexed.routesEnabled, false)
  assert.equal(indexed.summary.posts, 4)
  assert.equal(indexed.summary.unclassified, 1)
  assert.equal(indexed.unsupported.length, 1)
  assert.equal(indexed.summary.variants, 1)
  assert.equal(indexed.summary.emptyTerms, 1)
  assert.deepEqual(new Set(indexed.taxonomies.find((item) => item.id === 'tags').variants[0].names), new Set(['JavaScript', 'Javascript']))
  assert.equal(indexed.taxonomies.find((item) => item.id === 'tags').terms.find((item) => item.name === 'Orphan').empty, true)

  const preview = await service.previewTaxonomyChange(root, { action: 'rename', taxonomy: 'tags', sourceTerm: 'JavaScript', targetTerm: 'JavaScript & Web' })
  assert.equal(preview.changes.length, 2)
  assert.equal(preview.impact.published, 1)
  assert.deepEqual(preview.impact.languages, ['en-us', 'pt-br'])
  assert.equal(preview.impact.routeBefore, '/tags/javascript/')
  assert.equal(preview.impact.aliasesPreserved, false)

  await fs.appendFile(path.join(root, yamlId), '\nExternal edit\n')
  await assert.rejects(service.applyTaxonomyChange(root, { action: 'rename', taxonomy: 'tags', sourceTerm: 'JavaScript', targetTerm: 'JavaScript & Web', expectedRevisions: preview.revisions }), /changed after the preview/)

  const refreshed = await service.previewTaxonomyChange(root, { action: 'rename', taxonomy: 'tags', sourceTerm: 'JavaScript', targetTerm: 'JavaScript & Web' })
  const applied = await service.applyTaxonomyChange(root, { action: 'rename', taxonomy: 'tags', sourceTerm: 'JavaScript', targetTerm: 'JavaScript & Web', expectedRevisions: refreshed.revisions })
  assert.equal(applied.recoveryPoint.reason, 'before-taxonomy-change')
  assert.equal(applied.index.taxonomies.find((item) => item.id === 'tags').terms.find((item) => item.name === 'JavaScript & Web').count, 2)

  const assignment = await service.previewTaxonomyChange(root, { action: 'assign', taxonomy: 'authors', postIds: [yamlId, jsonId, customId], addTerms: ['Editor'], removeTerms: ['Ana'] })
  assert.equal(assignment.changes.length, 2)
  assert.deepEqual(assignment.skipped.map((item) => item.postId), [customId])
  await service.applyTaxonomyChange(root, { action: 'assign', taxonomy: 'authors', postIds: [yamlId, jsonId, customId], addTerms: ['Editor'], removeTerms: ['Ana'], expectedRevisions: assignment.revisions })

  const yamlSource = await fs.readFile(path.join(root, yamlId), 'utf8')
  const tomlSource = await fs.readFile(path.join(root, tomlId), 'utf8')
  const jsonSource = await fs.readFile(path.join(root, jsonId), 'utf8')
  const customSource = await fs.readFile(path.join(root, customId), 'utf8')
  assert.match(yamlSource, /^---/)
  assert.match(yamlSource, /accent: indigo/)
  assert.match(yamlSource, /External edit/)
  assert.match(tomlSource, /^\+\+\+/)
  assert.match(tomlSource, /accent = "green"/)
  assert.equal(service.parsePostSource(jsonSource).format, 'json')
  assert.deepEqual(service.parsePostSource(jsonSource).data.params, { accent: 'yellow' })
  assert.deepEqual(service.parsePostSource(jsonSource).data.authors, ['Editor'])
  assert.match(service.parsePostSource(jsonSource).content, /JSON body/)
  assert.match(customSource, /primary: Carla/)
  assert.match(customSource, /keep: true/)
})

test('gerencia páginas e rotas Hugo sem confundir bundles, recursos ou traduções', async (t) => {
  const root = await makeTemporaryDirectory('plumbago-pages')
  t.after(async () => fs.rm(root, { recursive: true, force: true }))
  await fs.mkdir(path.join(root, 'content', 'about', 'images'), { recursive: true })
  await fs.mkdir(path.join(root, 'content', 'docs'), { recursive: true })
  await fs.mkdir(path.join(root, 'content', 'foreign'), { recursive: true })
  await fs.mkdir(path.join(root, 'content', 'posts', 'route-clash'), { recursive: true })
  await fs.writeFile(path.join(root, 'hugo.toml'), `title = "Page test"
defaultContentLanguage = "en-us"

[taxonomies]
tag = "tags"

[languages.en-us]
weight = 1

[languages.fr]
weight = 2
`, 'utf8')
  const aboutEn = 'content/about/index.en-us.md'
  const aboutPt = 'content/about/index.pt-br.md'
  const docs = 'content/docs/_index.en-us.md'
  const contact = 'content/contact.en-us.md'
  const home = 'content/_index.en-us.md'
  await fs.writeFile(path.join(root, home), '---\ntitle: Home\ndraft: false\n---\n\nWelcome home\n', 'utf8')
  await fs.writeFile(path.join(root, aboutEn), `---
title: About
draft: false
aliases: [old-about, /shared-old/]
menu:
  main:
    weight: 20
layout: company
translationKey: about-page
params:
  accent: indigo
---

English about body
`, 'utf8')
  await fs.writeFile(path.join(root, aboutPt), `---
title: Sobre
draft: true
aliases: [/shared-old/]
translationKey: about-page
---

Corpo em português
`, 'utf8')
  await fs.writeFile(path.join(root, 'content', 'about', 'notes.md'), '# Leaf resource, not a public page\n', 'utf8')
  await fs.writeFile(path.join(root, 'content', 'about', 'images', 'portrait.jpg'), 'image', 'utf8')
  await fs.writeFile(path.join(root, docs), `+++
title = "Documentation"
draft = false
slug = "ignored-on-sections"
type = "docs"
[params]
accent = "green"
+++

Documentation body
`, 'utf8')
  await fs.writeFile(path.join(root, 'content', 'docs', 'guide.md'), '---\ntitle: Guide\n---\n\nGuide body\n', 'utf8')
  await fs.writeFile(path.join(root, 'content', 'docs', 'hero.png'), 'hero', 'utf8')
  await fs.writeFile(path.join(root, 'content', 'legacy.html'), '<h1>Legacy page</h1>\n', 'utf8')
  await fs.writeFile(path.join(root, 'content', 'foreign', 'index.html'), '<h1>Foreign bundle</h1>\n', 'utf8')
  await fs.writeFile(path.join(root, 'content', 'foreign', 'resource.md'), '# Leaf resource\n', 'utf8')
  await fs.writeFile(path.join(root, contact), `${JSON.stringify({ title: 'Contact', draft: false, aliases: ['/write-us/'], params: { form: true } }, null, 2)}

Contact body
`, 'utf8')
  await fs.writeFile(path.join(root, 'content', 'posts', 'route-clash', 'index.en-us.md'), `---
title: Route clash post
draft: false
url: /contact/
---

Post body
`, 'utf8')

  const indexed = await service.pageInventory(root)
  assert.deepEqual(indexed.pages.map((page) => page.id), [home, aboutEn, aboutPt, contact, docs, 'content/docs/guide.md'])
  assert.equal(indexed.pages.some((page) => page.id.endsWith('notes.md')), false)
  assert.equal(indexed.pages.some((page) => page.id.endsWith('resource.md')), false)
  assert.deepEqual(indexed.unsupported.map((page) => page.id), ['content/foreign/index.html', 'content/legacy.html'])
  assert.equal(indexed.summary.pages, 6)
  assert.equal(indexed.summary.published, 4)
  assert.equal(indexed.summary.menuPages, 1)
  assert.equal(indexed.summary.themeDependent, 2)
  assert.equal(indexed.summary.collisions, 1)
  assert.deepEqual(indexed.languages, ['en-us', 'fr', 'pt-br'])
  assert.equal(indexed.collisions[0].route, '/contact/')
  assert.equal(indexed.pages.find((page) => page.id === contact).collision, true)
  assert.deepEqual(indexed.pages.find((page) => page.id === aboutEn).resources, ['images/portrait.jpg', 'notes.md'])
  assert.deepEqual(indexed.pages.find((page) => page.id === aboutEn).translations, [aboutEn, aboutPt])
  assert.equal(indexed.pages.find((page) => page.id === aboutEn).sharedBundle, true)
  assert.equal(indexed.pages.find((page) => page.id === aboutEn).canRemoveBundle, false)
  assert.deepEqual(indexed.pages.find((page) => page.id === docs).descendants, ['guide.md'])
  assert.equal(indexed.pages.find((page) => page.id === docs).canRemoveBundle, false)
  assert.equal(indexed.pages.find((page) => page.id === home).isHome, true)
  assert.ok(indexed.virtualRoutes.some((route) => route.kind === 'taxonomy' && route.route === '/tags/'))

  await assert.rejects(service.previewPageChange(root, { action: 'create', title: 'Tags', route: '/tags/' }), /already used/)
  await assert.rejects(service.previewPageChange(root, { action: 'rename', id: home, route: '/welcome/' }), /homepage/)
  const createPreview = await service.previewPageChange(root, { action: 'create', title: 'Gallery', route: '/Gallery Space/', language: 'pt-br', kind: 'leaf', menu: 'main', body: '# Gallery' })
  assert.equal(createPreview.page.id, 'content/gallery-space/index.pt-br.md')
  assert.equal(createPreview.page.route, '/gallery-space/')
  assert.deepEqual(createPreview.impact.menus, ['main'])
  const created = await service.applyPageChange(root, { action: 'create', title: 'Gallery', route: '/Gallery Space/', language: 'pt-br', kind: 'leaf', menu: 'main', body: '# Gallery', expectedRevisions: createPreview.revisions })
  assert.equal(created.recoveryPoint.reason, 'before-page-change')
  assert.match(await fs.readFile(path.join(root, createPreview.page.id), 'utf8'), /# Gallery/)

  const staleRename = await service.previewPageChange(root, { action: 'rename', id: aboutEn, route: '/our-story/', preserveAlias: true })
  await fs.appendFile(path.join(root, aboutEn), '\nExternal edit\n')
  await assert.rejects(service.applyPageChange(root, { action: 'rename', id: aboutEn, route: '/our-story/', preserveAlias: true, expectedRevisions: staleRename.revisions }), /changed after the preview/)
  const renamePreview = await service.previewPageChange(root, { action: 'rename', id: aboutEn, route: '/our-story/', preserveAlias: true })
  assert.deepEqual(renamePreview.impact.aliasesAdded, ['/about/'])
  await service.applyPageChange(root, { action: 'rename', id: aboutEn, route: '/our-story/', preserveAlias: true, expectedRevisions: renamePreview.revisions })
  const renamedYaml = await fs.readFile(path.join(root, aboutEn), 'utf8')
  assert.match(renamedYaml, /^---/)
  assert.deepEqual(service.parsePostSource(renamedYaml).data.aliases, ['old-about', '/shared-old/', '/about/'])
  assert.equal(service.parsePostSource(renamedYaml).data.url, 'our-story/')
  assert.deepEqual(service.parsePostSource(renamedYaml).data.params, { accent: 'indigo' })
  assert.match(service.parsePostSource(renamedYaml).content, /English about body[\s\S]*External edit/)

  const jsonRename = await service.previewPageChange(root, { action: 'rename', id: contact, route: '/reach-us/', preserveAlias: false })
  await service.applyPageChange(root, { action: 'rename', id: contact, route: '/reach-us/', preserveAlias: false, expectedRevisions: jsonRename.revisions })
  const renamedJson = service.parsePostSource(await fs.readFile(path.join(root, contact), 'utf8'))
  assert.equal(renamedJson.format, 'json')
  assert.deepEqual(renamedJson.data.params, { form: true })
  assert.deepEqual(renamedJson.data.aliases, ['/write-us/'])
  assert.match(renamedJson.content, /Contact body/)

  const tomlRename = await service.previewPageChange(root, { action: 'rename', id: docs, route: '/manual/', preserveAlias: true })
  await service.applyPageChange(root, { action: 'rename', id: docs, route: '/manual/', preserveAlias: true, expectedRevisions: tomlRename.revisions })
  const renamedToml = await fs.readFile(path.join(root, docs), 'utf8')
  assert.match(renamedToml, /^\+\+\+/)
  assert.match(renamedToml, /accent = "green"/)
  assert.match(renamedToml, /Documentation body/)

  await assert.rejects(service.previewPageChange(root, { action: 'delete', id: docs, includeResources: true }), /original Hugo files/)
  const sharedDelete = await service.previewPageChange(root, { action: 'delete', id: aboutPt, includeResources: true })
  assert.equal(sharedDelete.impact.removeBundle, false)
  await service.applyPageChange(root, { action: 'delete', id: aboutPt, includeResources: true, expectedRevisions: sharedDelete.revisions })
  assert.equal(await fs.readFile(path.join(root, 'content', 'about', 'images', 'portrait.jpg'), 'utf8'), 'image')
  const fullDelete = await service.previewPageChange(root, { action: 'delete', id: aboutEn, includeResources: true })
  assert.equal(fullDelete.impact.removeBundle, true)
  assert.equal(fullDelete.impact.files, 3)
  const removed = await service.applyPageChange(root, { action: 'delete', id: aboutEn, includeResources: true, expectedRevisions: fullDelete.revisions })
  assert.equal(await fs.lstat(path.join(root, 'content', 'about')).catch(() => null), null)
  await service.restoreRecoveryPoint(root, removed.recoveryPoint.id)
  assert.match(await fs.readFile(path.join(root, aboutEn), 'utf8'), /English about body/)
})

test('inventaria e testa o Hugo selecionado sem escrever preferências no blog', async (t) => {
  const root = await makeTemporaryDirectory('plumbago-hugo-runtime')
  t.after(async () => {
    service.clearHugoRuntimeSelection(root)
    await fs.rm(root, { recursive: true, force: true })
  })
  await fs.mkdir(path.join(root, 'content'))
  await fs.writeFile(path.join(root, 'hugo.toml'), 'title = "Runtime test"\n', 'utf8')
  service.setHugoRuntimeSelection(root, { kind: 'native', platform: process.platform })
  const inventory = await service.hugoRuntimeInventory(root)
  assert.equal(inventory.selectedId, `native:${process.platform}`)
  assert.equal(inventory.runtimes.length, 1)
  assert.equal(inventory.runtimes[0].selected, true)
  assert.equal(inventory.runtimes[0].blogAccessible, true)
  assert.equal(inventory.runtimes[0].hugo.status, 'ready')
  assert.equal(inventory.runtimes[0].build.status, 'ready')
  assert.match(inventory.runtimes[0].hugo.versionNumber, /^\d+\.\d+\.\d+$/)
  assert.equal((await service.testHugoRuntime(root, inventory.selectedId)).id, inventory.selectedId)
  assert.deepEqual((await fs.readdir(root)).sort(), ['content', 'hugo.toml'])

  await fs.mkdir(path.join(root, 'layouts'))
  await fs.writeFile(path.join(root, 'layouts', 'index.html'), '{{ with }}', 'utf8')
  const broken = await service.hugoRuntimeInventory(root)
  assert.equal(broken.runtimes[0].hugo.status, 'ready')
  assert.equal(broken.runtimes[0].build.status, 'error')
  assert.equal(broken.runtimes[0].ready, false)
  await assert.rejects(service.testHugoRuntime(root, broken.selectedId), /could not build this blog/)
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

test('reads GitHub OAuth scopes without changing regular API responses', async (t) => {
  const originalFetch = global.fetch
  t.after(() => { global.fetch = originalFetch })
  global.fetch = async () => ({
    ok: true,
    status: 200,
    headers: new Headers({ 'x-oauth-scopes': 'repo, workflow, read:user' }),
    json: async () => ({ login: 'writer' }),
  })
  const regular = await httpService.githubRequest('test-token', '/user')
  const inspected = await httpService.githubRequest('test-token', '/user', { includeHeaders: true })
  assert.deepEqual(regular, { login: 'writer' })
  assert.deepEqual(inspected, {
    data: { login: 'writer' },
    headers: { oauthScopes: 'repo, workflow, read:user' },
  })
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

test('encrypts Cloudflare credentials before sending a GitHub Actions secret', async (t) => {
  const sodium = require('libsodium-wrappers')
  await sodium.ready
  const pair = sodium.crypto_box_keypair()
  const originalFetch = global.fetch
  t.after(() => { global.fetch = originalFetch })
  let encryptedValue = ''
  global.fetch = async (url, options = {}) => {
    if (String(url).endsWith('/actions/secrets/public-key')) return {
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ key_id: 'test-key', key: sodium.to_base64(pair.publicKey, sodium.base64_variants.ORIGINAL) }),
    }
    const body = JSON.parse(options.body)
    encryptedValue = body.encrypted_value
    assert.equal(body.key_id, 'test-key')
    return { ok: true, status: 204, headers: new Headers(), json: async () => null }
  }
  const secret = 'api-token-used-by-the-test'
  await service.saveGitHubActionsSecret('github-token', { fullName: 'writer/blog' }, 'CLOUDFLARE_API_TOKEN', secret)
  assert.ok(encryptedValue)
  assert.doesNotMatch(encryptedValue, new RegExp(secret))
  const opened = sodium.crypto_box_seal_open(sodium.from_base64(encryptedValue, sodium.base64_variants.ORIGINAL), pair.publicKey, pair.privateKey)
  assert.equal(sodium.to_string(opened), secret)
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
    command: 'winget install --id Hugo.Hugo.Extended -e --source winget --accept-package-agreements --accept-source-agreements',
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
  assert.equal(result.recoveryPoint.reason, 'before-theme-change')
  assert.equal((await service.listRecoveryPoints(blogRoot))[0].id, result.recoveryPoint.id)
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
  assert.equal(result.recoveryPoint.reason, 'before-theme-change')
  assert.equal(await fs.readFile(configPath, 'utf8'), originalConfig)
  assert.equal(await fs.stat(path.join(blogRoot, 'themes', 'broken-theme')).catch(() => null), null)
})

test('preserva configurações desconhecidas ao editar TOML, YAML e JSON por caminho', () => {
  const fixtures = [
    {
      file: 'hugo.toml',
      source: 'title = "Before"\n[params]\nknown = "old"\n[params.unknown]\nkept = 42\n',
      expectedRoot: ['params', 'known'],
      unknown: ['params', 'unknown', 'kept'],
    },
    {
      file: 'hugo.yaml',
      source: 'title: Before\nparams:\n  known: old\n  unknown:\n    kept: 42\n',
      expectedRoot: ['params', 'known'],
      unknown: ['params', 'unknown', 'kept'],
    },
    {
      file: 'hugo.json',
      source: '{"title":"Before","params":{"known":"old","unknown":{"kept":42}}}\n',
      expectedRoot: ['params', 'known'],
      unknown: ['params', 'unknown', 'kept'],
    },
    {
      file: 'config/_default/params.yaml',
      source: 'known: old\nunknown:\n  kept: 42\n',
      expectedRoot: ['known'],
      unknown: ['unknown', 'kept'],
      operationPath: ['params', 'known'],
    },
    {
      file: 'config/_default/params.pt-br.yaml',
      source: 'known: old\nunknown:\n  kept: 42\n',
      expectedRoot: ['known'],
      unknown: ['unknown', 'kept'],
      operationPath: ['languages', 'pt-br', 'params', 'known'],
      globalPath: ['languages', 'pt-br', 'params', 'known'],
    },
  ]
  for (const fixture of fixtures) {
    const record = themeConfigFiles.configRecord(fixture.file, fixture.source)
    if (fixture.globalPath) assert.equal(themeConfigFiles.getIn(record.globalData, fixture.globalPath), 'old')
    const next = themeConfigFiles.mutateConfigRecord(record, [{ path: fixture.operationPath || fixture.expectedRoot, value: 'new' }])
    const parsed = themeConfigFiles.parseConfigSource(next, fixture.file)
    assert.equal(themeConfigFiles.getIn(parsed, fixture.expectedRoot), 'new')
    assert.equal(themeConfigFiles.getIn(parsed, fixture.unknown), 42)
  }
})

test('não bloqueia uma alteração visual por coleções existentes que permanecem intactas', () => {
  const inventory = {
    revision: 'revision-1',
    controls: [{ id: 'setting:title', label: 'Title', type: 'text', options: [], value: 'Before' }],
    navigation: { support: 'configured', items: [{ _id: '111111111111', name: 'Group', pageRef: '', url: '', weight: 10, identifier: 'group', parent: '' }] },
    social: { support: 'configured', items: [{ _id: '222222222222', network: '', url: '' }] },
  }
  const input = {
    expectedRevision: inventory.revision,
    values: { 'setting:title': 'After' },
    navigation: [{ _id: '111111111111', name: 'Group', pageRef: '', url: '', weight: 10, identifier: 'group', parent: '' }],
    social: [{ _id: '222222222222', network: '', url: '' }],
  }
  assert.deepEqual(themeConfigMutations.normalizePayload(inventory, input), {
    expectedRevision: inventory.revision,
    values: { 'setting:title': 'After' },
  })
})

test('descobre, pré-visualiza, salva presets e aplica configuração visual com recuperação', async (t) => {
  const root = await makeTemporaryDirectory('plumbago-theme-configurator')
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  await fs.mkdir(path.join(root, 'content'), { recursive: true })
  await fs.mkdir(path.join(root, 'themes', 'studio', 'layouts', '_default'), { recursive: true })
  await fs.mkdir(path.join(root, 'themes', 'studio', 'exampleSite'), { recursive: true })
  await fs.writeFile(path.join(root, 'hugo.toml'), `baseURL = "https://example.com/"
title = "Studio journal"
theme = "studio"
copyright = "Original copyright"

[params]
description = "Current description"
primaryColor = "#558B6E"
bodyFont = "Georgia"

[params.homepage]
showRecent = false

[params.unknown]
preserveMe = "yes"

[[menus.main]]
name = "Home"
pageRef = "/"
weight = 10
custom = "preserved"

[[params.socialIcons]]
name = "github"
url = "https://github.com/example"
rel = "me"
`, 'utf8')
  await fs.writeFile(path.join(root, 'themes', 'studio', 'theme.toml'), 'name = "Studio Theme"\nmin_version = "0.100.0"\n', 'utf8')
  await fs.writeFile(path.join(root, 'themes', 'studio', 'exampleSite', 'hugo.toml'), `[params]
description = "Theme description"
primaryColor = "#112233"
bodyFont = "system-ui"

[params.homepage]
showRecent = true

[[menus.main]]
name = "About"
pageRef = "/about/"
weight = 20

[[params.socialIcons]]
name = "mastodon"
url = "https://social.example/@studio"
`, 'utf8')
  const validLayout = '<!doctype html><html><body style="color: {{ site.Params.primaryColor }}"><h1>{{ site.Title }}</h1>{{ .Content }}</body></html>'
  await fs.writeFile(path.join(root, 'themes', 'studio', 'layouts', 'index.html'), validLayout, 'utf8')
  await fs.writeFile(path.join(root, 'themes', 'studio', 'layouts', '_default', 'list.html'), validLayout, 'utf8')
  await fs.writeFile(path.join(root, 'themes', 'studio', 'layouts', '_default', 'single.html'), validLayout, 'utf8')

  const inventory = await service.themeConfiguration(root)
  assert.equal(inventory.theme.name, 'Studio Theme')
  assert.equal(inventory.theme.supportLevel, 'supported')
  assert.equal(inventory.navigation.support, 'configured')
  assert.equal(inventory.navigation.items[0].name, 'Home')
  assert.ok(inventory.configFiles.includes('hugo.toml'))
  assert.equal(inventory.social.shape, 'array-pairs')
  assert.ok(inventory.categories.find((category) => category.id === 'colors').controls.length)
  assert.ok(inventory.categories.find((category) => category.id === 'typography').controls.length)
  assert.ok(inventory.categories.find((category) => category.id === 'homepage').controls.length)
  assert.ok(inventory.unsupported.some((item) => item.path.toLowerCase() === 'params.unknown.preserveme'))

  const controls = new Map(inventory.categories.flatMap((category) => category.controls).map((control) => [control.path.toLowerCase(), control]))
  const payload = {
    expectedRevision: inventory.revision,
    values: {
      [controls.get('title').id]: 'A visual studio',
      [controls.get('params.primarycolor').id]: '#524DE1',
      [controls.get('params.bodyfont').id]: 'Inter',
      [controls.get('params.homepage.showrecent').id]: true,
    },
    navigation: [{ ...inventory.navigation.items[0], name: 'Start' }, { name: 'About', pageRef: '/about/', url: '', weight: 20, identifier: 'about', parent: '' }],
    social: [{ ...inventory.social.items[0], url: 'https://github.com/studio' }, { network: 'mastodon', url: 'https://social.example/@studio' }],
  }
  const originalConfig = await fs.readFile(path.join(root, 'hugo.toml'), 'utf8')
  const preview = await service.previewThemeConfiguration(root, payload)
  assert.equal(preview.build.ok, true)
  assert.equal(preview.impact.files, 1)
  assert.equal(await fs.readFile(path.join(root, 'hugo.toml'), 'utf8'), originalConfig)
  assert.match((await service.themePreviewLaunch(root, preview.previewId)).args.join(' '), /--config hugo\.toml,\.plumbago\/theme-configurator\/preview\.toml/)

  const preset = await service.saveThemePreset(root, { name: 'Studio violet', ...payload })
  assert.equal(preset.theme, 'studio')
  const currentPreset = await service.saveThemePreset(root, {
    name: 'Current studio look',
    expectedRevision: inventory.revision,
    values: Object.fromEntries(inventory.categories.flatMap((category) => category.controls).map((control) => [control.id, control.value])),
    navigation: inventory.navigation.items,
    social: inventory.social.items,
  })
  assert.equal(currentPreset.summary.settings, inventory.summary.controls)
  assert.equal((await service.themeConfiguration(root)).presets.length, 2)

  await fs.writeFile(path.join(root, 'themes', 'studio', 'layouts', 'index.html'), '{{ if }}', 'utf8')
  await assert.rejects(
    service.applyThemeConfiguration(root, { previewId: preview.previewId, expectedRevision: inventory.revision }),
    /previous configuration was restored/,
  )
  assert.equal(await fs.readFile(path.join(root, 'hugo.toml'), 'utf8'), originalConfig)
  assert.ok((await service.listRecoveryPoints(root)).some((point) => point.reason === 'before-theme-configuration'))

  await fs.writeFile(path.join(root, 'themes', 'studio', 'layouts', 'index.html'), validLayout, 'utf8')
  const refreshed = await service.themeConfiguration(root)
  const refreshedControls = new Map(refreshed.categories.flatMap((category) => category.controls).map((control) => [control.path.toLowerCase(), control]))
  const successfulPayload = {
    ...payload,
    expectedRevision: refreshed.revision,
    values: {
      [refreshedControls.get('title').id]: 'A visual studio',
      [refreshedControls.get('params.primarycolor').id]: '#524DE1',
      [refreshedControls.get('params.bodyfont').id]: 'Inter',
      [refreshedControls.get('params.homepage.showrecent').id]: true,
    },
  }
  const successfulPreview = await service.previewThemeConfiguration(root, successfulPayload)
  const applied = await service.applyThemeConfiguration(root, { previewId: successfulPreview.previewId, expectedRevision: refreshed.revision })
  assert.equal(applied.inventory.theme.id, 'studio')
  assert.equal(applied.recoveryPoint.reason, 'before-theme-configuration')
  const appliedConfig = TOML.parse(await fs.readFile(path.join(root, 'hugo.toml'), 'utf8'))
  assert.equal(appliedConfig.title, 'A visual studio')
  assert.equal(appliedConfig.params.primaryColor, '#524DE1')
  assert.equal(appliedConfig.params.bodyFont, 'Inter')
  assert.equal(appliedConfig.params.homepage.showRecent, true)
  assert.equal(appliedConfig.params.unknown.preserveMe, 'yes')
  assert.equal(appliedConfig.menus.main[0].custom, 'preserved')
  assert.equal(appliedConfig.params.socialIcons[0].rel, 'me')
  await service.deleteThemePreset(root, preset.id)
  await service.deleteThemePreset(root, currentPreset.id)
  assert.equal((await service.themeConfiguration(root)).presets.length, 0)
  await assert.rejects(service.previewThemeConfiguration(root, payload), /changed outside Plumbago/)
})

test('edita componentes de configuração do idioma padrão sem misturar outros idiomas', async (t) => {
  const root = await makeTemporaryDirectory('plumbago-theme-configurator-i18n')
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  await fs.mkdir(path.join(root, 'content'), { recursive: true })
  await fs.mkdir(path.join(root, 'config', '_default'), { recursive: true })
  await fs.mkdir(path.join(root, 'themes', 'studio', 'layouts', '_default'), { recursive: true })
  await fs.writeFile(path.join(root, 'config', '_default', 'hugo.toml'), `baseURL = "https://example.com/"
theme = "studio"
defaultContentLanguage = "en"

[languages.en]
languageName = "English"
weight = 1

[languages.pt-br]
languageName = "Português"
weight = 2
`, 'utf8')
  await fs.writeFile(path.join(root, 'config', '_default', 'params.en.toml'), `description = "English journal"
primaryColor = "#558B6E"
bodyFont = "Georgia"

[homepage]
showRecent = false

[unknown]
preserveMe = 42

[[socialIcons]]
name = "github"
url = "https://github.com/example"
rel = "me"
`, 'utf8')
  await fs.writeFile(path.join(root, 'config', '_default', 'params.pt-br.toml'), `description = "Diário em português"
primaryColor = "#ffc759"

[unknown]
preserveMe = 84
`, 'utf8')
  await fs.writeFile(path.join(root, 'config', '_default', 'menus.en.toml'), `[[main]]
name = "Home"
pageRef = "/"
weight = 10
custom = "preserved"
`, 'utf8')
  await fs.writeFile(path.join(root, 'config', '_default', 'menus.pt-br.toml'), `[[main]]
name = "Início"
pageRef = "/"
weight = 10
`, 'utf8')
  await fs.writeFile(path.join(root, 'themes', 'studio', 'theme.toml'), 'name = "Studio Theme"\n', 'utf8')
  const layout = '<!doctype html><html><body style="color: {{ site.Params.primaryColor }}"><h1>{{ site.Title }}</h1>{{ .Content }}</body></html>'
  await fs.writeFile(path.join(root, 'themes', 'studio', 'layouts', 'index.html'), layout, 'utf8')
  await fs.writeFile(path.join(root, 'themes', 'studio', 'layouts', '_default', 'list.html'), layout, 'utf8')
  await fs.writeFile(path.join(root, 'themes', 'studio', 'layouts', '_default', 'single.html'), layout, 'utf8')

  const inventory = await service.themeConfiguration(root)
  const controls = new Map(inventory.categories.flatMap((category) => category.controls).map((control) => [control.path.toLowerCase(), control]))
  assert.equal(inventory.navigation.path.toLowerCase(), 'languages.en.menus.main')
  assert.equal(inventory.navigation.sourceRelative, 'config/_default/menus.en.toml')
  assert.equal(inventory.navigation.items[0].name, 'Home')
  assert.ok(inventory.configFiles.includes('config/_default/hugo.toml'))
  assert.equal(inventory.social.path.toLowerCase(), 'languages.en.params.socialicons')
  assert.equal(controls.get('languages.en.params.primarycolor').sourceFile, 'config/_default/params.en.toml')
  assert.equal(controls.get('languages.en.params.bodyfont').value, 'Georgia')
  assert.ok(inventory.unsupported.some((item) => item.path.toLowerCase() === 'languages.en.params.unknown.preserveme'))

  await assert.rejects(service.previewThemeConfiguration(root, {
    expectedRevision: inventory.revision,
    values: { [controls.get('languages.en.params.primarycolor').id]: '#524DE1' },
    social: [{ network: 'github', url: 'javascript:alert(1)' }],
  }), /safe web address|must use HTTP/i)

  const EnglishParamsBefore = await fs.readFile(path.join(root, 'config', '_default', 'params.en.toml'), 'utf8')
  const PortugueseParamsBefore = await fs.readFile(path.join(root, 'config', '_default', 'params.pt-br.toml'), 'utf8')
  const PortugueseMenusBefore = await fs.readFile(path.join(root, 'config', '_default', 'menus.pt-br.toml'), 'utf8')
  const preview = await service.previewThemeConfiguration(root, {
    expectedRevision: inventory.revision,
    values: {
      [controls.get('languages.en.params.primarycolor').id]: '#524DE1',
      [controls.get('languages.en.params.bodyfont').id]: 'Inter',
    },
    navigation: [{ ...inventory.navigation.items[0], name: 'Start' }],
    social: [{ ...inventory.social.items[0], url: 'https://github.com/studio' }],
  })
  assert.deepEqual(preview.impact.targets.sort(), ['config/_default/menus.en.toml', 'config/_default/params.en.toml'])
  assert.equal(await fs.readFile(path.join(root, 'config', '_default', 'params.en.toml'), 'utf8'), EnglishParamsBefore)
  const applied = await service.applyThemeConfiguration(root, { previewId: preview.previewId, expectedRevision: inventory.revision })
  assert.equal(applied.changes.length, 4)

  const EnglishParams = TOML.parse(await fs.readFile(path.join(root, 'config', '_default', 'params.en.toml'), 'utf8'))
  const EnglishMenus = TOML.parse(await fs.readFile(path.join(root, 'config', '_default', 'menus.en.toml'), 'utf8'))
  assert.equal(EnglishParams.primaryColor, '#524DE1')
  assert.equal(EnglishParams.bodyFont, 'Inter')
  assert.equal(EnglishParams.unknown.preserveMe, 42)
  assert.equal(EnglishParams.socialIcons[0].rel, 'me')
  assert.equal(EnglishMenus.main[0].name, 'Start')
  assert.equal(EnglishMenus.main[0].custom, 'preserved')
  assert.equal(await fs.readFile(path.join(root, 'config', '_default', 'params.pt-br.toml'), 'utf8'), PortugueseParamsBefore)
  assert.equal(await fs.readFile(path.join(root, 'config', '_default', 'menus.pt-br.toml'), 'utf8'), PortugueseMenusBefore)
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
  assert.match(workflow, /cron: "13,43 \* \* \* \*"/)
  assert.match(workflow, /timezone: "Etc\/UTC"/)
  assert.doesNotMatch(workflow, /--buildFuture|buildFuture/)
  assert.deepEqual(YAML.parse(workflow).on.push.branches, ['main', 'master', 'feature/draft'])
  assert.equal(YAML.parse(service.githubPagesWorkflow('main', '0.148.2', { scheduled: false })).on.schedule, undefined)
})

test('prepara assets portáveis para o Direct Upload do Cloudflare', async (t) => {
  const root = await makeTemporaryDirectory('plumbago-cloudflare-assets')
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  await fs.mkdir(path.join(root, 'css'))
  await fs.writeFile(path.join(root, 'index.html'), '<h1>Hello</h1>')
  await fs.writeFile(path.join(root, 'css', 'site.css'), 'body { color: #558B6E; }')
  await fs.writeFile(path.join(root, '_headers'), '/*\n  X-Frame-Options: DENY')

  const assets = await service.collectPagesAssets(root)
  assert.deepEqual(assets.map((asset) => asset.name).sort(), ['css/site.css', 'index.html'])
  assert.equal(assets.find((asset) => asset.name === 'index.html').contentType, 'text/html')
  assert.equal(service.cloudflareFileHash(Buffer.from('hello'), 'index.html'), 'a2b82584e50075886b08927390f2f573')
  assert.equal(service.buildUploadBuckets(assets).flat().length, 2)
})

test('creates, reuses, and uploads a Cloudflare Pages project through the official API', async (t) => {
  const temporaryRoot = await makeTemporaryDirectory('plumbago-cloudflare')
  t.after(() => fs.rm(temporaryRoot, { recursive: true, force: true }))
  await fs.writeFile(path.join(temporaryRoot, 'index.html'), '<h1>Plumbago</h1>\n', 'utf8')
  await fs.writeFile(path.join(temporaryRoot, 'styles.css'), 'body { color: #558B6E; }\n', 'utf8')

  const accountId = 'a'.repeat(32)
  const token = 'cloudflare-test-token-never-persisted'
  const calls = []
  let projectExists = false
  const originalFetch = global.fetch
  t.after(() => { global.fetch = originalFetch })
  global.fetch = async (url, options = {}) => {
    const route = String(url).replace('https://api.cloudflare.com/client/v4', '')
    calls.push({ route, method: options.method || 'GET', authorization: options.headers?.Authorization, body: options.body })
    const reply = (status, result, errors = []) => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => ({ success: status >= 200 && status < 300, result, errors }),
    })
    if (route.endsWith('/pages/projects/my-blog') && options.method !== 'POST') {
      return projectExists
        ? reply(200, { id: 'my-blog', name: 'my-blog', subdomain: 'my-blog.pages.dev', production_branch: 'main' })
        : reply(404, null, [{ code: 8000007, message: 'Project not found' }])
    }
    if (route.endsWith('/pages/projects') && options.method === 'POST') {
      projectExists = true
      return reply(200, { id: 'my-blog', name: 'my-blog', subdomain: 'my-blog.pages.dev', production_branch: 'main' })
    }
    if (route.endsWith('/upload-token')) return reply(200, { jwt: 'asset-upload-token' })
    if (route === '/pages/assets/check-missing') return reply(200, JSON.parse(options.body).hashes)
    if (route === '/pages/assets/upload' || route === '/pages/assets/upsert-hashes') return reply(200, true)
    if (route.endsWith('/deployments') && options.method === 'POST') {
      return reply(200, { id: 'deployment-1', aliases: ['my-blog.pages.dev'], latest_stage: { name: 'deploy', status: 'success' } })
    }
    throw new Error(`Unexpected Cloudflare request: ${options.method || 'GET'} ${route}`)
  }

  const first = await service.ensureCloudflareProject(token, accountId, 'my-blog')
  const second = await service.ensureCloudflareProject(token, accountId, 'my-blog')
  assert.equal(first.created, true)
  assert.equal(second.created, false)
  assert.equal(calls.filter((call) => call.route.endsWith('/pages/projects') && call.method === 'POST').length, 1)

  const progress = []
  const result = await service.createCloudflareDeployment(token, {
    accountId,
    projectName: 'my-blog',
    directory: temporaryRoot,
    branch: 'main',
    onProgress: (entry) => progress.push(entry),
  })
  assert.equal(result.totalFiles, 2)
  assert.equal(result.deployment.id, 'deployment-1')
  assert.equal(progress.at(-1).uploaded, 2)
  assert.ok(calls.every((call) => call.authorization === `Bearer ${token}` || call.authorization === 'Bearer asset-upload-token'))
  assert.ok(calls.some((call) => call.route === '/pages/assets/upload'))
  assert.ok(calls.some((call) => call.route.endsWith('/deployments') && call.body instanceof FormData))
})

test('mantém o estado de deploy retomável sem persistir credenciais', async (t) => {
  const root = await makeTemporaryDirectory('plumbago-deployment-state')
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const saved = await service.saveDeploymentSettings(root, {
    provider: 'cloudflare-pages',
    state: 'uploading',
    progress: 43,
    accountId: 'a'.repeat(32),
    projectName: 'my-blog',
    token: 'must-never-be-written',
    log: ['Prepared the production build.'],
  })
  assert.equal(saved.state, 'uploading')
  assert.equal(saved.progress, 43)
  assert.equal(service.safeBuildDirectory(root), path.join(root, '.plumbago-build'))
  const raw = await fs.readFile(path.join(root, '.plumbago', 'deployment.json'), 'utf8')
  assert.doesNotMatch(raw, /must-never-be-written|token/i)
  assert.equal(await fs.readFile(path.join(root, '.plumbago', '.gitignore'), 'utf8'), '*\n!.gitignore\n')
  assert.deepEqual(await service.deploymentSettings(root), saved)
  const interrupted = await service.deploymentStatus(root)
  assert.equal(interrupted.state, 'failed')
  assert.match(interrupted.error, /interrupted/i)
})

test('does not present a manually entered host as a verified deployment', async (t) => {
  const root = await makeTemporaryDirectory('plumbago-manual-host')
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  await service.saveHostingSettings(root, { hostingProvider: 'other', publicUrl: 'https://blog.example.com/' })
  const status = await service.deploymentStatus(root)
  assert.equal(status.state, 'idle')
  assert.equal(status.provider, '')
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
  assert.deepEqual(removed.movedAssets, [`content/posts/meu-primeiro-post/${imported[0].name}`])
  assert.equal(await fs.stat(path.join(temporaryRoot, published.id)).catch(() => null), null)
  assert.equal(await fs.stat(path.join(temporaryRoot, 'content', 'posts', 'meu-primeiro-post', imported[0].name)).catch(() => null), null)
  assert.equal((await service.listTrash(temporaryRoot)).length, 1)
  await service.restoreTrashItem(temporaryRoot, removed.trashId)
  assert.ok(await fs.stat(path.join(temporaryRoot, published.id)))
  assert.ok(await fs.stat(path.join(temporaryRoot, 'content', 'posts', 'meu-primeiro-post', imported[0].name)))
})

test('agenda, reagenda, cancela e publica conteúdo Hugo no fuso do blog sem perder front matter', async (t) => {
  const root = await makeTemporaryDirectory('plumbago-calendar')
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  await execFileAsync('hugo', ['new', 'site', root, '--force'])
  await execFileAsync('git', ['init', '-b', 'main'], { cwd: root })
  const created = await service.createPost(root, { title: 'Post no calendário', language: 'pt-br' })
  const absolute = path.join(root, created.id)
  const original = await fs.readFile(absolute, 'utf8')
  const withUnknown = original.startsWith('+++')
    ? original.replace('+++', '+++\ncustomFlag = "keep-me"')
    : original.replace('---', '---\ncustomFlag: keep-me')
  await fs.writeFile(absolute, withUnknown, 'utf8')

  const timezone = await service.saveCalendarTimeZone(root, 'America/Sao_Paulo')
  assert.equal(timezone.changed, true)
  assert.match(await fs.readFile(path.join(root, 'hugo.toml'), 'utf8'), /timeZone\s*=\s*"America\/Sao_Paulo"/)

  const preview = await service.previewCalendarChange(root, {
    postId: created.id,
    action: 'schedule',
    timeZone: 'America/Sao_Paulo',
    publishLocal: '2030-06-15T09:30',
    expiryLocal: '2030-06-16T09:30',
  })
  assert.equal(preview.next.publishDate, '2030-06-15T12:30:00.000Z')
  assert.equal(preview.next.expiryDate, '2030-06-16T12:30:00.000Z')
  assert.equal(preview.next.draft, false)
  assert.deepEqual(preview.changes.map((change) => change.field), ['draft', 'publishDate', 'expiryDate'])

  const scheduled = await service.applyCalendarChange(root, {
    postId: created.id,
    action: 'schedule',
    timeZone: 'America/Sao_Paulo',
    publishLocal: '2030-06-15T09:30',
    expiryLocal: '2030-06-16T09:30',
  })
  assert.equal(scheduled.post.draft, false)
  assert.equal(scheduled.recoveryPoint.reason, 'before-calendar-change')
  assert.match(await fs.readFile(absolute, 'utf8'), /customFlag\s*(?:=|:)\s*["']?keep-me/)

  const calendar = await service.editorialCalendar(root, {}, { now: '2026-08-11T12:00:00.000Z' })
  assert.equal(calendar.timeZone, 'America/Sao_Paulo')
  assert.equal(calendar.summary.scheduled, 1)
  assert.equal(calendar.next.id, created.id)

  const dateAfterSchedule = await service.savePost(root, { ...scheduled.post, date: '2030-06-16' })
  const calendarWithLaterEditorialDate = await service.editorialCalendar(root, {}, { now: '2026-08-11T12:00:00.000Z' })
  assert.equal(calendarWithLaterEditorialDate.items[0].effectiveAt, dateAfterSchedule.publishDate)
  assert.equal(service.wallDateTimeFromIso(calendarWithLaterEditorialDate.items[0].effectiveAt, calendarWithLaterEditorialDate.timeZone), '2030-06-15T09:30')

  const cancelled = await service.applyCalendarChange(root, { postId: created.id, action: 'cancel', timeZone: 'America/Sao_Paulo' })
  assert.equal(cancelled.post.draft, true)
  assert.equal(cancelled.post.publishDate, '')
  assert.equal(cancelled.post.expiryDate, '2030-06-16T12:30:00.000Z')

  const publishPreview = await service.previewCalendarChange(root, { postId: created.id, action: 'publish-now', timeZone: 'America/Sao_Paulo' })
  const published = await service.applyCalendarChange(root, { postId: created.id, action: 'publish-now', timeZone: 'America/Sao_Paulo', publishInstant: publishPreview.next.publishDate })
  assert.equal(published.post.draft, false)
  assert.equal(published.post.publishDate, publishPreview.next.publishDate)

  assert.throws(() => service.zonedDateTimeToIso('2026-03-08T02:30', 'America/New_York'), /does not exist/i)
  assert.equal(service.zonedDateTimeToIso('2026-11-01T01:30', 'America/New_York').ambiguous, true)
})

test('sincroniza mudanças de agenda quando o relógio remoto está ativo e mantém retry seguro quando o push falha', async (t) => {
  const root = await makeTemporaryDirectory('plumbago-calendar-sync')
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  await execFileAsync('hugo', ['new', 'site', root, '--force'])
  await execFileAsync('git', ['init', '-b', 'main'], { cwd: root })
  const created = await service.createPost(root, { title: 'Agenda sincronizada', language: 'pt-br' })
  const calls = []
  const automationStatus = async () => ({ enabled: true, pendingSync: calls.length === 0 })
  const syncGit = async (_root, message, options) => {
    calls.push({ message, options })
    return { log: ['sent'] }
  }

  const applied = await service.applyEditorialCalendarChange(root, {
    postId: created.id,
    action: 'schedule',
    timeZone: 'America/Sao_Paulo',
    publishLocal: '2030-06-11T23:30',
  }, { githubToken: 'test-token' }, { automationStatus, syncGit })

  assert.equal(applied.sync.state, 'synced')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].message, 'Update editorial schedule with Plumbago')
  assert.equal(calls[0].options.githubToken, 'test-token')
  assert.equal(service.wallDateTimeFromIso(applied.post.publishDate, 'America/Sao_Paulo'), '2030-06-11T23:30')

  const failed = await service.applyEditorialCalendarChange(root, {
    postId: created.id,
    action: 'schedule',
    timeZone: 'America/Sao_Paulo',
    publishLocal: '2030-06-12T23:30',
  }, {}, {
    automationStatus: async () => ({ enabled: true }),
    syncGit: async () => { throw new Error('network unavailable') },
  })
  assert.equal(failed.sync.state, 'failed')
  assert.match(failed.sync.message, /network unavailable/)
  assert.equal(service.wallDateTimeFromIso((await service.readPost(root, created.id)).publishDate, 'America/Sao_Paulo'), '2030-06-12T23:30')

  const retried = await service.syncCalendarChanges(root, {}, { automationStatus: async () => ({ enabled: true }), syncGit })
  assert.equal(retried.state, 'synced')
  assert.equal(calls.length, 2)
})

test('gera um relógio Cloudflare portátil sem gravar credenciais no workflow', () => {
  const workflow = service.calendarCloudflareWorkflow({
    branch: 'feature/calendar',
    projectName: 'meu-blog',
    liveUrl: 'https://meu-blog.pages.dev/',
    hugoVersion: '0.158.0',
    timeZone: 'America/Sao_Paulo',
  })
  const parsed = YAML.parse(workflow)
  assert.deepEqual(parsed.on.push.branches, ['main', 'master', 'feature/calendar'])
  assert.equal(parsed.on.schedule[0].cron, '13,43 * * * *')
  assert.equal(parsed.on.schedule[0].timezone, 'America/Sao_Paulo')
  assert.match(workflow, /secrets\.CLOUDFLARE_API_TOKEN/)
  assert.match(workflow, /cloudflare\/wrangler-action@v3/)
  assert.doesNotMatch(workflow, /--buildFuture|buildFuture/)
  assert.doesNotMatch(workflow, /api-token-used-by-the-test/)
})

test('keeps shared page-bundle assets when only one translation goes to trash', async (t) => {
  const root = await makeTemporaryDirectory('plumbago-trash-translations')
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const directory = path.join(root, 'content', 'posts', 'shared')
  await fs.mkdir(directory, { recursive: true })
  await fs.writeFile(path.join(directory, 'index.en-us.md'), '---\ntitle: English\n---\n\nHello\n')
  await fs.writeFile(path.join(directory, 'index.pt-br.md'), '---\ntitle: Português\n---\n\nOlá\n')
  await fs.writeFile(path.join(directory, 'cover.png'), Buffer.from([1, 2, 3]))

  const removed = await service.deletePost(root, 'content/posts/shared/index.en-us.md')
  assert.deepEqual(removed.movedAssets, [])
  assert.ok(await fs.stat(path.join(directory, 'cover.png')))
  assert.ok(await fs.stat(path.join(directory, 'index.pt-br.md')))
  await service.restoreTrashItem(root, removed.trashId)
  assert.ok(await fs.stat(path.join(directory, 'index.en-us.md')))
})

test('moves only a standalone Markdown post and never neighboring content to trash', async (t) => {
  const root = await makeTemporaryDirectory('plumbago-trash-standalone')
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const posts = path.join(root, 'content', 'posts')
  await fs.mkdir(path.join(posts, 'neighbor'), { recursive: true })
  await fs.writeFile(path.join(posts, 'remove-me.md'), '---\ntitle: Remove me\n---\n')
  await fs.writeFile(path.join(posts, 'unrelated.png'), Buffer.from([1, 2, 3]))
  await fs.writeFile(path.join(posts, 'neighbor', 'index.en-us.md'), '---\ntitle: Neighbor\n---\n')

  const removed = await service.deletePost(root, 'content/posts/remove-me.md')
  assert.deepEqual(removed.movedAssets, [])
  assert.ok(await fs.stat(path.join(posts, 'unrelated.png')))
  assert.ok(await fs.stat(path.join(posts, 'neighbor', 'index.en-us.md')))
  assert.deepEqual((await service.listTrash(root))[0].files, ['content/posts/remove-me.md'])
  await service.deleteTrashItem(root, removed.trashId)
  assert.deepEqual(await service.listTrash(root), [])
})

test('indexes, reuses, edits, optimizes, replaces, and recovers blog-wide media safely', async (t) => {
  const root = await makeTemporaryDirectory('plumbago-media-library')
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const bundle = path.join(root, 'content', 'posts', 'garden')
  await fs.mkdir(bundle, { recursive: true })
  await fs.mkdir(path.join(root, 'static', 'images'), { recursive: true })
  await fs.mkdir(path.join(root, 'assets', 'brand'), { recursive: true })
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="#558B6E"/></svg>'
  await fs.writeFile(path.join(bundle, 'hero.svg'), svg)
  await fs.writeFile(path.join(root, 'static', 'images', 'shared.svg'), svg)
  await fs.writeFile(path.join(root, 'assets', 'brand', 'logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="20" fill="#524DE1"/></svg>')
  const postId = 'content/posts/garden/index.en-us.md'
  await fs.writeFile(path.join(root, postId), `---
title: Garden notes
featuredImage: hero.svg
---

![A green study](hero.svg "First caption")

![](/images/shared.svg)

![Missing](missing.png)
`)
  await fs.writeFile(path.join(bundle, 'index.pt-br.md'), '---\ntitle: Notas do jardim\n---\n')

  let library = await service.buildMediaLibrary(root)
  assert.equal(library.summary.total, 3)
  assert.equal(library.summary.missing, 1)
  assert.equal(library.summary.missingAlt, 1)
  assert.equal(library.summary.duplicates, 1)
  const hero = library.items.find((item) => item.id.endsWith('/hero.svg'))
  assert.equal(hero.scope, 'bundle')
  assert.equal(hero.ownerPostIds.length, 2)
  assert.equal(hero.usageCount, 2)
  assert.equal(hero.width, 120)
  const preview = await service.mediaPreview(root, hero.id, { width: 240 })
  assert.match(preview.dataUrl, /^data:image\/webp;base64,/)

  const reference = hero.references.find((item) => item.kind === 'markdown')
  const updated = await service.updateMediaReference(root, { mediaId: hero.id, postId, referenceId: reference.id, alt: 'A calmer hero', caption: 'A thoughtful caption' })
  assert.match(updated.post.body, /!\[A calmer hero\]\(hero\.svg "A thoughtful caption"\)/)
  assert.equal(updated.recoveryPoint.reason, 'before-media-change')

  const reused = await service.reuseMedia(root, 'assets/brand/logo.svg', postId, { alt: 'Plumbago logo' })
  assert.equal(reused.copiedId, 'content/posts/garden/logo.svg')
  assert.equal(reused.markdown, '![Plumbago logo](logo.svg)')
  assert.ok(await fs.stat(path.join(root, reused.copiedId)))

  const derivative = await service.createMediaDerivative(root, hero.id, { width: 64, height: 32, format: 'webp', fit: 'inside' })
  assert.equal(derivative.format, 'webp')
  assert.ok(derivative.width <= 64)
  assert.ok(derivative.height <= 32)

  const replacement = path.join(root, 'replacement.svg')
  await fs.writeFile(replacement, '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="#FFC759"/></svg>')
  const replaced = await service.replaceMedia(root, hero.id, replacement)
  assert.equal(replaced.width, 200)
  assert.equal(replaced.height, 100)

  library = await service.buildMediaLibrary(root)
  const generated = library.items.find((item) => item.id === derivative.id)
  assert.equal(generated.usageCount, 0)
  const removed = await service.removeMedia(root, generated.id)
  assert.equal((await service.listMediaTrash(root))[0].id, removed.id)
  assert.equal(await fs.stat(path.join(root, generated.id)).catch(() => null), null)
  await service.restoreMediaTrashItem(root, removed.id)
  assert.ok(await fs.stat(path.join(root, generated.id)))

  const removedAgain = await service.removeMedia(root, generated.id)
  await service.deleteMediaTrashItem(root, removedAgain.id)
  assert.deepEqual(await service.listMediaTrash(root), [])
  await assert.rejects(service.removeMedia(root, hero.id), /reference/i)
  await assert.rejects(service.mediaPreview(root, '../../outside.png'), /valid image/i)
})

test('reviews SEO and quality deterministically and applies only previewable safe fixes', async (t) => {
  const root = await makeTemporaryDirectory('plumbago-site-review')
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  await execFileAsync('hugo', ['new', 'site', root, '--force', '--format', 'toml'])
  await fs.writeFile(path.join(root, 'hugo.toml'), 'baseURL = "http://localhost:1313/"\nlanguageCode = "en-US"\ntitle = "Review garden"\n')
  await service.saveHostingSettings(root, { hostingProvider: 'other', publicUrl: 'https://garden.example/blog/' })
  const bundle = path.join(root, 'content', 'posts', 'winter')
  await fs.mkdir(bundle, { recursive: true })
  const postId = 'content/posts/winter/index.en-us.md'
  await fs.writeFile(path.join(root, postId), `---
title: Winter Notes
date: 2026-08-11
draft: false
---

#### A skipped heading

[A missing page](/missing-page/)

[This post through the configured subpath](/blog/posts/winter/)

![](hero.svg "Kept caption")
`)
  await fs.writeFile(path.join(bundle, 'hero.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="#558B6E"/></svg>')
  await fs.writeFile(path.join(root, 'content', 'posts', 'winter.en-us.md'), '---\ntitle: Winter Notes\ndate: 2026-08-10\ndraft: true\n---\n')

  let review = await service.siteReview(root)
  const rules = new Set(review.findings.map((item) => item.rule))
  assert.equal(review.summary.ready, false)
  assert.ok(review.summary.postsChecked >= 2)
  assert.ok(rules.has('internal-link-broken'))
  assert.deepEqual(review.findings.filter((item) => item.rule === 'internal-link-broken').map((item) => item.values.destination), ['/missing-page/'])
  assert.ok(rules.has('post-slug-collision'))
  assert.ok(rules.has('post-title-duplicate'))
  assert.ok(rules.has('heading-level-skipped'))
  assert.ok(rules.has('image-alt-missing'))
  assert.ok(rules.has('site-base-url-mismatch'))
  assert.equal(await fs.stat(path.join(root, '.plumbago', 'review-output')).catch(() => null), null)
  assert.equal(await fs.stat(path.join(root, '.plumbago', 'review-cache')).catch(() => null), null)

  const description = review.findings.find((item) => item.rule === 'post-description-missing' && item.postId === postId)
  assert.equal(description.fix.field, 'description')
  await service.applyReviewFix(root, { findingId: description.id, value: 'A concise guide to winter colors, materials, and observations from the garden.' })
  assert.match((await service.readPost(root, postId)).description, /winter colors/)

  review = await service.siteReview(root)
  const alt = review.findings.find((item) => item.rule === 'image-alt-missing' && item.postId === postId)
  await service.applyReviewFix(root, { findingId: alt.id, value: 'A green rectangle used as a winter color study' })
  assert.match((await service.readPost(root, postId)).body, /!\[A green rectangle used as a winter color study\]\(hero\.svg "Kept caption"\)/)

  review = await service.siteReview(root)
  const address = review.findings.find((item) => item.rule === 'site-base-url-mismatch')
  assert.deepEqual(address.fix, { kind: 'exact', field: 'baseURL', before: 'http://localhost:1313/', after: 'https://garden.example/blog/' })
  await service.applyReviewFix(root, { findingId: address.id })
  assert.equal((await service.siteSettings(root)).baseURL, 'https://garden.example/blog/')
  await assert.rejects(service.applyReviewFix(root, { findingId: 'not-a-current-finding', value: 'unsafe' }), /changed|safe fix/i)
  await assert.rejects(service.publishBlog(root, 'Should not publish'), /blocking site review/i)
})

test('compares and restores one post version without changing unrelated work', async (t) => {
  const root = await makeTemporaryDirectory('plumbago-history')
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const id = 'content/posts/history/index.en-us.md'
  const target = path.join(root, id)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await execFileAsync('git', ['init', '-b', 'main'], { cwd: root })
  await execFileAsync('git', ['config', 'user.name', 'Plumbago Tests'], { cwd: root })
  await execFileAsync('git', ['config', 'user.email', 'tests@plumbago.local'], { cwd: root })
  const firstSource = '---\ntitle: First version\ndraft: true\n---\n\nFirst paragraph.\n\n'
  await fs.writeFile(target, firstSource)
  await execFileAsync('git', ['add', '.'], { cwd: root })
  await execFileAsync('git', ['commit', '-m', 'Create the first version'], { cwd: root })
  await fs.writeFile(target, '---\ntitle: Second version\ndraft: true\n---\n\nSecond paragraph.\n')
  await fs.writeFile(path.join(root, 'notes.txt'), 'unrelated\n')
  await execFileAsync('git', ['add', '.'], { cwd: root })
  await execFileAsync('git', ['commit', '-m', 'Improve the post'], { cwd: root })
  await fs.writeFile(target, '---\ntitle: Current draft\ndraft: true\n---\n\nUnsaved local paragraph.\n')
  await fs.writeFile(path.join(root, 'notes.txt'), 'unrelated local work\n')

  const history = await service.listPostHistory(root, id)
  assert.equal(history.currentChanged, true)
  assert.equal(history.revisions.length, 2)
  const oldest = history.revisions.at(-1)
  const comparison = await service.comparePostRevision(root, id, oldest.hash)
  assert.ok(comparison.changes.some((change) => change.type === 'removed' && change.value.includes('First paragraph')))
  assert.ok(comparison.changes.some((change) => change.type === 'added' && change.value.includes('Unsaved local paragraph')))
  const siteHistory = await service.listSiteHistory(root)
  assert.equal(siteHistory.hasLocalChanges, true)
  assert.equal(siteHistory.localChangeCount, 2)
  assert.equal(siteHistory.entries[0].kind, 'site')
  assert.equal(siteHistory.entries[1].kind, 'content')

  const restored = await service.restorePostRevision(root, id, oldest.hash)
  assert.equal(await fs.readFile(target, 'utf8'), firstSource)
  assert.equal(restored.post.title, 'First version')
  assert.equal(await fs.readFile(path.join(root, 'notes.txt'), 'utf8'), 'unrelated local work\n')
  assert.equal((await service.listRecoveryPoints(root))[0].reason, 'before-post-restore')
})

test('creates and restores local recovery points without adding state to Git', async (t) => {
  const root = await makeTemporaryDirectory('plumbago-recovery')
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  await fs.mkdir(path.join(root, 'content', 'posts'), { recursive: true })
  await fs.writeFile(path.join(root, 'hugo.toml'), 'title = "Before"\n')
  await fs.writeFile(path.join(root, 'content', 'posts', 'before.md'), 'before\n')
  const point = await service.createRecoveryPoint(root, { reason: 'before-test', label: 'Before a risky change', paths: ['hugo.toml', 'content'] })
  await fs.writeFile(path.join(root, 'hugo.toml'), 'title = "After"\n')
  await fs.rm(path.join(root, 'content', 'posts', 'before.md'))
  await fs.writeFile(path.join(root, 'content', 'posts', 'after.md'), 'after\n')

  await service.restoreRecoveryPoint(root, point.id, { createUndo: false })
  assert.equal(await fs.readFile(path.join(root, 'hugo.toml'), 'utf8'), 'title = "Before"\n')
  assert.equal(await fs.readFile(path.join(root, 'content', 'posts', 'before.md'), 'utf8'), 'before\n')
  assert.equal(await fs.stat(path.join(root, 'content', 'posts', 'after.md')).catch(() => null), null)
  assert.equal(await fs.readFile(path.join(root, '.plumbago', '.gitignore'), 'utf8'), '*\n!.gitignore\n')

  const damaged = await service.createRecoveryPoint(root, { reason: 'before-test', label: 'Damaged point', paths: ['hugo.toml'] })
  await fs.writeFile(path.join(root, 'hugo.toml'), 'title = "Keep this"\n')
  await fs.rm(path.join(root, '.plumbago', 'recovery', damaged.id, 'files', 'hugo.toml'))
  await assert.rejects(service.restoreRecoveryPoint(root, damaged.id, { createUndo: false }))
  assert.equal(await fs.readFile(path.join(root, 'hugo.toml'), 'utf8'), 'title = "Keep this"\n')
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
  assert.equal(first.status.hasUpstream, true)
  assert.equal(first.status.ahead, 0)
  assert.match(first.log.join('\n'), /Conteúdo enviado/)

  await fs.writeFile(path.join(blogRoot, 'README.md'), '# Blog Plumbago\n', 'utf8')
  await execFileAsync('git', ['add', 'README.md'], { cwd: blogRoot })
  await execFileAsync('git', ['commit', '-m', 'Local scheduled change'], { cwd: blogRoot })
  const pending = await service.gitStatus(blogRoot)
  assert.equal(pending.ahead, 1)
  assert.equal(pending.hasUpstream, true)
  const prePublishReview = await service.siteReview(blogRoot)
  assert.equal(prePublishReview.summary.errors, 0, JSON.stringify(prePublishReview.findings, null, 2))
  const second = await service.publishBlog(blogRoot, 'Segunda sincronização')
  assert.deepEqual(second.status.changes, [])
  assert.match(second.log.join('\n'), /Novidades remotas aplicadas/)
  assert.match(second.log.join('\n'), /Hugo build completed successfully/)
  assert.equal(second.status.deployment.state, 'unavailable')

  const remoteHead = await execFileAsync('git', ['rev-parse', 'refs/heads/main'], { cwd: remoteRoot })
  const localHead = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: blogRoot })
  assert.equal(remoteHead.stdout.trim(), localHead.stdout.trim())
})
