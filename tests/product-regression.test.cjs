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

test('mantém as entradas principais como fachadas modulares', () => {
  const rendererEntry = read('src/App.jsx')
  const electronEntry = read('electron/plumbago-service.cjs')
  const expectedModules = [
    'src/app/App.jsx',
    'src/components/ui/Modal.jsx',
    'src/features/editor/Editor.jsx',
    'src/features/publishing/GitHubSetupModal.jsx',
    'src/features/setup/GitSetupModal.jsx',
    'electron/core/runtime.cjs',
    'electron/services/content.cjs',
    'electron/services/git.cjs',
    'electron/services/github.cjs',
    'electron/services/publishing.cjs',
    'electron/services/site.cjs',
    'electron/services/updates.cjs',
    'src/features/settings/UpdatePanel.jsx',
  ]

  assert.match(rendererEntry, /export \{ default \} from '.\/app\/App'/)
  assert.ok(rendererEntry.split('\n').length <= 5, 'src/App.jsx deve continuar sendo apenas uma entrada estável')
  assert.match(electronEntry, /services\/content\.cjs/)
  assert.ok(electronEntry.split('\n').length <= 30, 'o serviço Electron deve continuar sendo apenas uma fachada')
  for (const file of expectedModules) assert.ok(fs.existsSync(path.join(root, file)), `${file} não encontrado`)
})
