const translations = {
  'en-US': {
    'nav.features':'Features','nav.downloads':'Downloads','nav.how':'How it works','hero.eyebrow':'OPEN SOURCE · HUGO DESKTOP APP','hero.title':'Your Hugo blog,<br />without the friction.','hero.copy':'Write in Markdown, drop in images, preview your site, and sync with Git from one calm desktop workspace.','hero.download':'Download Plumbago','hero.source':'View source','hero.free':'Free and open source','hero.files':'Your files stay local','features.eyebrow':'EVERYTHING IN ONE PLACE','features.title':'Made for writing, not configuration.','features.copy':'Plumbago keeps Hugo and Git underneath while giving everyday publishing a visual home.','features.editor':'Markdown editor','features.editorCopy':'Write with a live, sanitized preview and automatic saving.','features.images':'Image library','features.imagesCopy':'Drag images into page bundles, reuse them, and choose a featured image.','features.git':'Git sync','features.gitCopy':'Commit, rebase, and push through one clear synchronization flow.','features.themes':'Blogs & themes','features.themesCopy':'Create a Hugo site and install themes from the official gallery.','features.wsl':'Windows + WSL','features.wslCopy':'Run Hugo and Git inside the same WSL distribution where your blog lives.','downloads.eyebrow':'LATEST RELEASE','downloads.title':'Choose your platform.','downloads.copy':'Downloads come directly from GitHub Releases.','downloads.windows':'Windows 10/11 · x64 installer','downloads.linux':'x64 · AppImage','downloads.macArm':'Apple Silicon · DMG','downloads.macIntel':'Intel · DMG','downloads.button':'Download','downloads.loading':'Looking for the latest release…','downloads.ready':'Latest release ready to download.','downloads.empty':'No packaged release yet. Follow the project on GitHub for the first download.','how.eyebrow':'A QUIET WORKFLOW','how.title':'From idea to published post.','how.connect':'Create or connect your blog','how.connectCopy':'Start a new Hugo site or choose an existing project, including one stored inside WSL.','how.write':'Write and add images','how.writeCopy':'Plumbago works with your existing Markdown, front matter, and page bundles.','how.publish':'Preview and sync','how.publishCopy':'Open Hugo’s real preview, then commit and push when you are ready.','footer.copy':'A friendly Hugo UI manager. Licensed under GPL-3.0.','footer.releases':'All releases'
  },
  'pt-BR': {
    'nav.features':'Recursos','nav.downloads':'Downloads','nav.how':'Como funciona','hero.eyebrow':'CÓDIGO ABERTO · APLICATIVO HUGO','hero.title':'Seu blog Hugo,<br />sem atrito.','hero.copy':'Escreva em Markdown, arraste imagens, visualize o site e sincronize com Git em um espaço de trabalho tranquilo.','hero.download':'Baixar o Plumbago','hero.source':'Ver código','hero.free':'Gratuito e código aberto','hero.files':'Seus arquivos ficam locais','features.eyebrow':'TUDO EM UM SÓ LUGAR','features.title':'Feito para escrever, não configurar.','features.copy':'O Plumbago mantém Hugo e Git por baixo enquanto dá uma interface visual à publicação cotidiana.','features.editor':'Editor Markdown','features.editorCopy':'Escreva com preview seguro em tempo real e salvamento automático.','features.images':'Biblioteca de imagens','features.imagesCopy':'Arraste imagens para page bundles, reutilize-as e escolha uma imagem de destaque.','features.git':'Sincronização Git','features.gitCopy':'Faça commit, rebase e push em um fluxo claro de sincronização.','features.themes':'Blogs e temas','features.themesCopy':'Crie um site Hugo e instale temas da galeria oficial.','features.wsl':'Windows + WSL','features.wslCopy':'Execute Hugo e Git na mesma distribuição WSL onde seu blog está.','downloads.eyebrow':'VERSÃO MAIS RECENTE','downloads.title':'Escolha sua plataforma.','downloads.copy':'Os downloads vêm diretamente dos Releases do GitHub.','downloads.windows':'Windows 10/11 · instalador x64','downloads.linux':'x64 · AppImage','downloads.macArm':'Apple Silicon · DMG','downloads.macIntel':'Intel · DMG','downloads.button':'Baixar','downloads.loading':'Procurando a versão mais recente…','downloads.ready':'Versão mais recente pronta para baixar.','downloads.empty':'Ainda não há uma versão empacotada. Acompanhe o projeto no GitHub para o primeiro download.','how.eyebrow':'UM FLUXO TRANQUILO','how.title':'Da ideia ao post publicado.','how.connect':'Crie ou conecte seu blog','how.connectCopy':'Comece um novo site Hugo ou escolha um projeto existente, inclusive armazenado no WSL.','how.write':'Escreva e adicione imagens','how.writeCopy':'O Plumbago trabalha com seu Markdown, front matter e page bundles existentes.','how.publish':'Visualize e sincronize','how.publishCopy':'Abra o preview real do Hugo e faça commit e push quando estiver pronto.','footer.copy':'Um gerenciador Hugo amigável. Licenciado sob GPL-3.0.','footer.releases':'Todos os releases'
  }
}

let locale = localStorage.getItem('plumbago-site-language') || localStorage.getItem('plum-site-language') || 'en-US'
const translate = (key) => translations[locale][key] || translations['en-US'][key] || key

function renderLanguage() {
  document.documentElement.lang = locale
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const value = translate(element.dataset.i18n)
    if (value.includes('<br')) element.innerHTML = value
    else element.textContent = value
  })
  document.querySelector('[data-language-toggle]').textContent = locale === 'en-US' ? 'PT-BR' : 'EN-US'
}

document.querySelector('[data-language-toggle]').addEventListener('click', () => {
  locale = locale === 'en-US' ? 'pt-BR' : 'en-US'
  localStorage.setItem('plumbago-site-language', locale)
  renderLanguage()
  if (window.latestReleaseAvailable !== undefined) updateReleaseStatus(window.latestReleaseAvailable)
})

function updateReleaseStatus(available) {
  document.querySelector('[data-release-status]').textContent = translate(available ? 'downloads.ready' : 'downloads.empty')
}

async function loadRelease() {
  try {
    const response = await fetch('https://api.github.com/repos/gabuvns/plumbago/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })
    if (!response.ok) throw new Error('No release')
    const release = await response.json()
    const matchers = {
      windows: (name) => name.includes('-windows-') && name.endsWith('.exe'),
      linux: (name) => name.includes('-linux-') && name.endsWith('.AppImage'),
      'mac-arm64': (name) => name.includes('-macos-arm64.') && name.endsWith('.dmg'),
      'mac-x64': (name) => name.includes('-macos-x64.') && name.endsWith('.dmg'),
    }
    Object.entries(matchers).forEach(([platform, matcher]) => {
      const asset = release.assets.find(({ name }) => matcher(name))
      const link = document.querySelector(`[data-download="${platform}"]`)
      if (asset) link.href = asset.browser_download_url
      else link.classList.add('unavailable')
    })
    document.querySelector('[data-release-version]').textContent = release.tag_name
    window.latestReleaseAvailable = true
    updateReleaseStatus(true)
  } catch {
    document.querySelectorAll('[data-download]').forEach((link) => { link.href = 'https://github.com/gabuvns/plumbago/releases' })
    window.latestReleaseAvailable = false
    updateReleaseStatus(false)
  }
}

renderLanguage()
loadRelease()
