const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const YAML = require('yaml')

const root = path.join(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

function extractObject(file, declaration, nextDeclaration) {
  const source = read(file)
  const start = source.indexOf(declaration)
  const end = source.indexOf(nextDeclaration, start)
  assert.notEqual(start, -1, `${declaration} não encontrado em ${file}`)
  assert.notEqual(end, -1, `${nextDeclaration} não encontrado em ${file}`)
  return vm.runInNewContext(`(${source.slice(start + declaration.length, end).trim()})`)
}

test('mantém as mesmas chaves em EN-US e PT-BR', () => {
  const appMessages = extractObject('src/i18n.jsx', 'const messages =', 'const I18nContext')
  const siteMessages = extractObject('site/app.js', 'const translations =', 'let locale')

  assert.deepEqual(Object.keys(appMessages['pt-BR']).sort(), Object.keys(appMessages['en-US']).sort())
  assert.deepEqual(Object.keys(siteMessages['pt-BR']).sort(), Object.keys(siteMessages['en-US']).sort())
})

test('mantém os canais do preload alinhados com o processo principal', () => {
  const mainChannels = [...read('electron/main.cjs').matchAll(/ipcMain\.handle\('([^']+)'/g)].map((match) => match[1]).sort()
  const preloadChannels = [...read('electron/preload.cjs').matchAll(/ipcRenderer\.invoke\('([^']+)'/g)].map((match) => match[1]).sort()

  assert.deepEqual(preloadChannels, mainChannels)
  assert.ok(mainChannels.every((channel) => channel.startsWith('plumbago:')))
})

test('protege a identidade e os metadados do produto', () => {
  const packageJson = JSON.parse(read('package.json'))
  assert.equal(packageJson.name, 'plumbago-hugo-ui')
  assert.equal(packageJson.build.productName, 'Plumbago')
  assert.equal(packageJson.build.appId, 'dev.gabu.plumbago')
  assert.equal(packageJson.homepage, 'https://gabuvns.github.io/plumbago/')

  for (const file of ['README.md', 'index.html', 'src/App.jsx', 'src/i18n.jsx', 'site/index.html', 'site/app.js']) {
    assert.doesNotMatch(read(file), /\bPlum\b/, `marca antiga encontrada em ${file}`)
    assert.match(read(file), /Plumbago/, `marca Plumbago ausente em ${file}`)
  }
})

test('protege a paleta oficial na aplicação, no site e no ícone', () => {
  const palette = ['#558B6E', '#524DE1', '#FFC759', '#D8D4F2', '#C4B2BC']
  for (const file of ['src/styles.css', 'site/styles.css', 'build/icon.svg', 'site/icon.svg']) {
    const source = read(file).toUpperCase()
    for (const color of palette) assert.match(source, new RegExp(color), `${color} ausente em ${file}`)
  }
})

test('mantém contraste legível nas principais combinações da marca', () => {
  const luminance = (hex) => {
    const channels = [1, 3, 5]
      .map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
      .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
  }
  const contrast = (foreground, background) => {
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
    return (values[0] + 0.05) / (values[1] + 0.05)
  }

  assert.ok(contrast('#FFFFFF', '#524DE1') >= 4.5, 'texto branco no índigo')
  assert.ok(contrast('#292644', '#FFC759') >= 4.5, 'texto escuro no amarelo')
  assert.ok(contrast('#3F6D55', '#F7F6FB') >= 4.5, 'verde textual no fundo claro')
})

test('executa o CI em todo push e pull request', () => {
  const workflow = YAML.parse(read('.github/workflows/ci.yml'))
  assert.ok(Object.hasOwn(workflow.on, 'push'))
  assert.equal(workflow.on.push, null)
  assert.ok(Object.hasOwn(workflow.on, 'pull_request'))
  assert.match(workflow.jobs.test.steps.at(-1).run, /npm test/)
})

test('publica os metadados necessários para atualizações automáticas', () => {
  const packageJson = JSON.parse(read('package.json'))
  const workflow = YAML.parse(read('.github/workflows/release.yml'))
  const targets = workflow.jobs.build.strategy.matrix.include
  const linux = targets.find((target) => target.artifact === 'linux-x64')
  const windows = targets.find((target) => target.artifact === 'windows-x64')
  assert.equal(packageJson.build.publish.provider, 'github')
  assert.equal(packageJson.build.publish.owner, 'gabuvns')
  assert.equal(packageJson.build.publish.repo, 'plumbago')
  assert.match(windows.files, /latest\.yml/)
  assert.match(windows.files, /\.exe\.blockmap/)
  assert.match(linux.files, /latest-linux\.yml/)
})

test('empacota a identidade OAuth pública usada pelo login do GitHub', () => {
  const packageJson = JSON.parse(read('package.json'))
  const workflow = read('.github/workflows/release.yml')
  const main = read('electron/main.cjs')
  assert.equal(packageJson.plumbago.githubOAuthClientId, '')
  assert.match(workflow, /PLUMBAGO_GITHUB_CLIENT_ID/)
  assert.match(workflow, /extraMetadata\.plumbago\.githubOAuthClientId/)
  assert.match(main, /packageMetadata\.plumbago\?\.githubOAuthClientId/)
})

test('mantém as entradas principais como fachadas modulares', () => {
  const rendererEntry = read('src/App.jsx')
  const electronEntry = read('electron/plumbago-service.cjs')
  const expectedModules = [
    'src/app/App.jsx',
    'src/components/ui/Modal.jsx',
    'src/features/editor/Editor.jsx',
    'src/features/publishing/GitHubSetupModal.jsx',
    'src/features/publishing/DeploymentSetupModal.jsx',
    'src/features/history/HistoryModal.jsx',
    'src/features/media/MediaLibrary.jsx',
    'src/features/review/ReviewModal.jsx',
    'src/features/calendar/EditorialCalendar.jsx',
    'src/features/taxonomies/TaxonomyManager.jsx',
    'src/features/pages/PageManager.jsx',
    'src/features/themes/ThemeConfigurator.jsx',
    'src/features/setup/GitSetupModal.jsx',
    'electron/core/runtime.cjs',
    'electron/services/content.cjs',
    'electron/services/cloudflare.cjs',
    'electron/services/deployments.cjs',
    'electron/services/git.cjs',
    'electron/services/github.cjs',
    'electron/services/hugo.cjs',
    'electron/services/history.cjs',
    'electron/services/languages.cjs',
    'electron/services/media.cjs',
    'electron/services/media/index.cjs',
    'electron/services/media/operations.cjs',
    'electron/services/media/paths.cjs',
    'electron/services/media/references.cjs',
    'electron/services/media/trash.cjs',
    'electron/services/publishing.cjs',
    'electron/services/review.cjs',
    'electron/services/review/content.cjs',
    'electron/services/review/index.cjs',
    'electron/services/review/output.cjs',
    'electron/services/calendar.cjs',
    'electron/services/calendar/index.cjs',
    'electron/services/calendar/content.cjs',
    'electron/services/calendar/automation.cjs',
    'electron/services/calendar/time.cjs',
    'electron/services/calendar/workflow-time.cjs',
    'electron/services/taxonomies.cjs',
    'electron/services/pages.cjs',
    'electron/services/theme-configurator/index.cjs',
    'electron/services/theme-configurator/config-files.cjs',
    'electron/services/theme-configurator/discovery.cjs',
    'electron/services/theme-configurator/mutations.cjs',
    'electron/services/site.cjs',
    'electron/services/trash.cjs',
    'electron/services/updates.cjs',
    'src/features/settings/UpdatePanel.jsx',
    'src/features/setup/HugoSetupModal.jsx',
    'src/features/posts/DeletePostModal.jsx',
  ]

  assert.match(rendererEntry, /export \{ default \} from '.\/app\/App'/)
  assert.ok(rendererEntry.split('\n').length <= 5, 'src/App.jsx deve continuar sendo apenas uma entrada estável')
  assert.match(electronEntry, /services\/content\.cjs/)
  assert.ok(electronEntry.split('\n').length <= 30, 'o serviço Electron deve continuar sendo apenas uma fachada')
  for (const file of expectedModules) assert.ok(fs.existsSync(path.join(root, file)), `${file} não encontrado`)
})

test('mantém a sincronização externa, exclusão e atalhos local/público visíveis no produto', () => {
  const app = read('src/app/App.jsx')
  const preload = read('electron/preload.cjs')
  const messages = read('src/i18n.jsx')
  assert.match(app, /setInterval\(checkForExternalPosts, 5000\)/)
  assert.match(app, /site\?\.publicUrl/)
  assert.match(preload, /deletePost:/)
  assert.match(messages, /'top\.preview': 'View local site'/)
  assert.match(messages, /'top\.publicSite': 'View public site'/)
})

test('mantém o GitHub Device Flow como caminho principal e envia o primeiro commit por HTTPS', () => {
  const setup = read('src/features/publishing/GitHubSetupModal.jsx')
  const main = read('electron/main.cjs')
  const publishing = read('electron/services/publishing.cjs')
  assert.match(setup, /useState\('https'\)/)
  assert.match(setup, /api\.beginGitHubSignIn\(\)/)
  assert.match(setup, /api\.publishBlog\(t\('github\.initialCommitMessage'\)\)/)
  assert.match(setup, /<details className="github-token-option">/)
  assert.match(read('electron/services/github.cjs'), /scope: 'repo workflow read:user'/)
  assert.doesNotMatch(read('electron/services/github.cjs'), /scope: '[^']*user:email/)
  assert.match(main, /clipboard\.writeText\(flow\.userCode\)/)
  assert.match(main, /shell\.openExternal\(flow\.verificationUri\)/)
  assert.doesNotMatch(main, /flow\.(?:user_code|verification_uri|device_code)/)
  assert.match(publishing, /GIT_CONFIG_VALUE_0/)
  assert.doesNotMatch(publishing, /remote.*x-access-token/i)
})

test('keeps one-click deployment secure, resumable, and visible in the product', () => {
  const app = read('src/app/App.jsx')
  const modal = read('src/features/publishing/DeploymentSetupModal.jsx')
  const main = read('electron/main.cjs')
  const site = read('electron/services/site.cjs')
  const cloudflare = read('electron/services/cloudflare.cjs')
  assert.match(app, /DeploymentSetupModal/)
  assert.match(modal, /api\.deploySite\(\{ provider, accountId, projectName \}\)/)
  assert.match(modal, /deploy\.changeProvider/)
  assert.match(main, /safeStorage\.encryptString/)
  assert.match(main, /safeStorage\.decryptString/)
  assert.doesNotMatch(site, /cloudflareToken|githubToken/)
  assert.match(cloudflare, /\/pages\/assets\/check-missing/)
  assert.match(cloudflare, /\/pages\/assets\/upload/)
  assert.match(cloudflare, /\/deployments/)
})

test('keeps post history, automatic recovery points, and recoverable deletion visible in the product', () => {
  const app = read('src/app/App.jsx')
  const sidebar = read('src/components/layout/Sidebar.jsx')
  const modal = read('src/features/history/HistoryModal.jsx')
  const site = read('electron/services/site.cjs')
  const service = read('electron/plumbago-service.cjs')

  assert.match(app, /<HistoryModal/)
  assert.match(sidebar, /sidebar\.history/)
  assert.match(modal, /api\.comparePostRevision/)
  assert.match(modal, /api\.restorePostRevision/)
  assert.match(modal, /api\.restoreRecoveryPoint/)
  assert.match(modal, /api\.restoreTrashItem/)
  assert.match(modal, /api\.deleteTrashItem/)
  assert.match(service, /services\/history\.cjs/)
  assert.match(service, /services\/trash\.cjs/)
  assert.match(service, /before-import/)
  assert.match(site, /before-theme-change/)
  assert.match(site, /before-settings-change/)
})

test('keeps blog-wide media reusable, diagnosable, optimized, and recoverable', () => {
  const app = read('src/app/App.jsx')
  const library = read('src/features/media/MediaLibrary.jsx')
  const preload = read('electron/preload.cjs')
  const operations = read('electron/services/media/operations.cjs')
  const trash = read('electron/services/media/trash.cjs')
  const packageJson = JSON.parse(read('package.json'))

  assert.match(app, /<MediaLibrary/)
  assert.match(app, /prepareMediaMutation/)
  assert.match(library, /api\.mediaLibrary\(\)/)
  assert.match(library, /api\.mediaPreview\(/)
  assert.match(library, /api\.reuseMedia\(/)
  assert.match(library, /api\.updateMediaReference\(/)
  assert.match(library, /api\.createMediaDerivative\(/)
  assert.match(library, /api\.restoreMediaTrashItem\(/)
  assert.match(preload, /replaceMedia:/)
  assert.match(operations, /before-media-change/)
  assert.match(operations, /withoutEnlargement/)
  assert.match(trash, /item\.usageCount > 0/)
  assert.equal(packageJson.dependencies.sharp, '0.35.3')
})

test('keeps deterministic site review and previewable safe fixes in the publish path', () => {
  const app = read('src/app/App.jsx')
  const sidebar = read('src/components/layout/Sidebar.jsx')
  const modal = read('src/features/review/ReviewModal.jsx')
  const publishing = read('electron/services/publishing.cjs')
  const review = read('electron/services/review/index.cjs')
  const content = read('electron/services/review/content.cjs')
  const output = read('electron/services/review/output.cjs')

  assert.match(app, /api\.siteReview\(\)/)
  assert.match(app, /<ReviewModal/)
  assert.match(sidebar, /sidebar\.review/)
  assert.match(modal, /review-impact/)
  assert.match(modal, /api\.applyReviewFix/)
  assert.match(publishing, /review\.summary\.errors > 0/)
  assert.match(review, /before-review-fix/)
  assert.match(content, /internal-link-broken/)
  assert.match(content, /post-slug-collision/)
  assert.match(content, /image-alt-missing/)
  assert.match(output, /output-sitemap-missing/)
  assert.match(output, /\.plumbago\/review-cache/)
  assert.doesNotMatch(modal, /rewrite|generate.*prose/i)
})

test('keeps the editorial calendar portable, recoverable, timezone-aware, and runnable while the app is closed', () => {
  const app = read('src/app/App.jsx')
  const sidebar = read('src/components/layout/Sidebar.jsx')
  const modal = read('src/features/calendar/EditorialCalendar.jsx')
  const preload = read('electron/preload.cjs')
  const content = read('electron/services/calendar/content.cjs')
  const automation = read('electron/services/calendar/automation.cjs')
  const time = read('electron/services/calendar/time.cjs')
  const site = read('electron/services/site.cjs')

  assert.match(app, /<EditorialCalendar/)
  assert.match(sidebar, /sidebar\.calendar/)
  assert.match(modal, /api\.previewCalendarChange/)
  assert.match(modal, /api\.applyCalendarChange/)
  assert.match(modal, /api\.syncCalendarChanges/)
  assert.match(modal, /api\.enableCalendarAutomation/)
  assert.match(preload, /editorialCalendar:/)
  assert.match(content, /before-calendar-change/)
  assert.match(content, /const effectiveAt = publishAt \|\| contentAt/)
  assert.match(content, /expiryDate/)
  assert.match(time, /This local time does not exist/)
  assert.match(automation, /saveGitHubActionsSecret/)
  assert.match(automation, /CLOUDFLARE_API_TOKEN/)
  assert.doesNotMatch(site, /CLOUDFLARE_API_TOKEN/)
})

test('keeps Hugo taxonomies searchable, filterable, previewable, and recoverable', () => {
  const app = read('src/app/App.jsx')
  const sidebar = read('src/components/layout/Sidebar.jsx')
  const postList = read('src/features/posts/PostList.jsx')
  const manager = read('src/features/taxonomies/TaxonomyManager.jsx')
  const preload = read('electron/preload.cjs')
  const main = read('electron/main.cjs')
  const service = read('electron/services/taxonomies.cjs')
  const demo = read('src/demo.js')

  assert.match(app, /<TaxonomyManager/)
  assert.match(sidebar, /sidebar\.taxonomies/)
  assert.match(postList, /post\.taxonomies/)
  assert.match(postList, /onRemoveTaxonomyFilter/)
  assert.match(manager, /api\.taxonomyIndex\(\)/)
  assert.match(manager, /api\.previewTaxonomyChange/)
  assert.match(manager, /api\.applyTaxonomyChange/)
  assert.match(manager, /taxonomy\.aliasWarningTitle/)
  assert.match(manager, /taxonomy-term-select[\s\S]*<\/button>\s*<button type="button" className=\{`taxonomy-term-filter/, 'term selection and filtering must use sibling buttons')
  assert.match(preload, /taxonomyIndex:/)
  assert.match(main, /plumbago:taxonomy-index/)
  assert.match(service, /before-taxonomy-change/)
  assert.match(service, /serializePostSource/)
  assert.match(service, /restoreRecoveryPoint/)
  assert.match(demo, /taxonomyIndex: async/)
  assert.match(demo, /applyTaxonomyChange: async/)
})

test('keeps Hugo pages and routes discoverable, collision-aware, previewable, and recoverable', () => {
  const app = read('src/app/App.jsx')
  const sidebar = read('src/components/layout/Sidebar.jsx')
  const manager = read('src/features/pages/PageManager.jsx')
  const preload = read('electron/preload.cjs')
  const main = read('electron/main.cjs')
  const service = read('electron/services/pages.cjs')
  const facade = read('electron/plumbago-service.cjs')
  const demo = read('src/demo.js')

  assert.match(app, /<PageManager/)
  assert.match(sidebar, /sidebar\.pages/)
  assert.match(manager, /api\.pageInventory\(\)/)
  assert.match(manager, /api\.previewPageChange/)
  assert.match(manager, /api\.applyPageChange/)
  assert.match(manager, /pages\.routeCollisionTitle/)
  assert.match(manager, /pages\.preservedFields/)
  assert.match(manager, /pages\.removeResources/)
  assert.match(preload, /pageInventory:/)
  assert.match(main, /plumbago:page-inventory/)
  assert.match(service, /before-page-change/)
  assert.match(service, /createRecoveryPoint/)
  assert.match(service, /restoreRecoveryPoint/)
  assert.match(service, /serializePostSource/)
  assert.match(service, /virtualRouteRecords/)
  assert.match(facade, /services\/pages\.cjs/)
  assert.match(demo, /pageInventory: async/)
  assert.match(demo, /applyPageChange: async/)
})

test('keeps visual theme customization discoverable, preview-first, portable, and recoverable', () => {
  const app = read('src/app/App.jsx')
  const manager = read('src/features/themes/ThemeManagerModal.jsx')
  const configurator = read('src/features/themes/ThemeConfigurator.jsx')
  const preload = read('electron/preload.cjs')
  const main = read('electron/main.cjs')
  const facade = read('electron/plumbago-service.cjs')
  const configuration = read('electron/services/theme-configurator/config-files.cjs')
  const discovery = read('electron/services/theme-configurator/discovery.cjs')
  const mutations = read('electron/services/theme-configurator/mutations.cjs')
  const demo = read('src/demo.js')

  assert.match(app, /<ThemeManagerModal/)
  assert.match(manager, /<ThemeConfigurator/)
  assert.match(manager, /themes\.tabs\.customize/)
  assert.match(configurator, /api\.themeConfiguration\(\)/)
  assert.match(configurator, /api\.previewThemeConfiguration/)
  assert.match(configurator, /api\.applyThemeConfiguration/)
  assert.match(configurator, /api\.saveThemePreset/)
  assert.match(configurator, /themeConfig\.unsupported\.title/)
  assert.match(configurator, /themeConfig\.recovery/)
  assert.match(preload, /themeConfiguration:/)
  assert.match(preload, /openThemePreview:/)
  assert.match(main, /plumbago:theme-configuration/)
  assert.match(main, /plumbago:theme-apply-configuration/)
  assert.match(main, /previewConfiguration/)
  assert.match(facade, /services\/theme-configurator\/index\.cjs/)
  assert.match(configuration, /componentLocation/)
  assert.match(configuration, /languages.*language.*rootKey/)
  assert.match(discovery, /defaultLanguage/)
  assert.match(mutations, /before-theme-configuration/)
  assert.match(mutations, /restoreRecoveryPoint/)
  assert.match(mutations, /--renderToMemory/)
  assert.match(mutations, /\.plumbago\/theme-configurator/)
  assert.match(demo, /themeConfiguration: async/)
  assert.match(demo, /previewThemeConfiguration: async/)
  assert.match(demo, /applyThemeConfiguration: async/)
})

test('protects published posts and keeps accessibility and Markdown hierarchy visible in the editor', () => {
  const app = read('src/app/App.jsx')
  const editor = read('src/features/editor/Editor.jsx')
  const settings = read('src/features/settings/SettingsModal.jsx')
  const styles = read('src/styles.css')
  const preferences = read('src/lib/accessibility.js')

  assert.match(app, /isPostPublished\(persistedPost/)
  assert.match(app, /postPublicationTime\(persistedPost\)/)
  assert.match(app, /publishedLocked\) return undefined/)
  assert.match(editor, /editor\.startRevision/)
  assert.match(editor, /readOnly=\{locked\}/)
  assert.match(editor, /contentEditable=\{!readOnly\}/)
  assert.match(settings, /type="range"/)
  assert.match(settings, /aria-live="polite"/)
  assert.match(preferences, /plumbago\.accessibility\.v1/)
  assert.match(styles, /\.markdown-preview h1 \{ font-size: 2\.15em; \}/)
  assert.match(styles, /\.markdown-preview h2 \{ font-size: 1\.65em; \}/)
  assert.match(styles, /\.markdown-preview h3 \{ font-size: 1\.28em; \}/)
})

test('keeps native Windows and WSL Hugo selection persistent, isolated, and routed through one service', () => {
  const main = read('electron/main.cjs')
  const preload = read('electron/preload.cjs')
  const runtime = read('electron/core/runtime.cjs')
  const hugo = read('electron/services/hugo.cjs')
  const setup = read('src/features/setup/HugoSetupModal.jsx')
  const demo = read('src/demo.js')

  assert.match(main, /hugoRuntimeSelections/)
  assert.match(main, /defaultHugoRuntime/)
  assert.match(main, /plumbago:select-hugo-runtime/)
  assert.match(main, /service\.spawnHugo/)
  assert.match(main, /function stopPreview\(\)/)
  assert.match(preload, /selectHugoRuntime:/)
  assert.match(runtime, /nativeWorkingDirectory/)
  assert.match(runtime, /wslWorkingDirectory/)
  assert.match(hugo, /hugoRuntimeInventory/)
  assert.match(hugo, /inspectHugoBuild/)
  assert.match(hugo, /runHugo/)
  assert.match(setup, /status\?\.runtimes/)
  assert.match(setup, /api\.selectHugoRuntime\(runtime\.id\)/)
  assert.match(setup, /hugoSetup\.confirmAutomaticCopy/)
  assert.match(demo, /native:win32/)
  assert.match(demo, /wsl:Ubuntu/)

  for (const file of ['content.cjs', 'deployments.cjs', 'publishing.cjs', 'site.cjs']) {
    const source = read(`electron/services/${file}`)
    assert.match(source, /runHugo/)
    assert.doesNotMatch(source, /run\([^\n]+, 'hugo'/)
  }
  assert.match(read('electron/services/review/output.cjs'), /runHugo/)
})
