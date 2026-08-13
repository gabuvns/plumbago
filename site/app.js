const translations = {
  'en-US': {
    'nav.features':'Features','nav.downloads':'Downloads','nav.how':'How it works','hero.eyebrow':'OPEN SOURCE · HUGO DESKTOP APP','hero.title':'Your Hugo blog,<br />without the friction.','hero.copy':'Write in Markdown, drop in images, preview your site, and sync with Git from one calm desktop workspace.','hero.download':'Download Plumbago','hero.source':'View source','hero.free':'Free and open source','hero.files':'Your files stay local','features.eyebrow':'EVERYTHING IN ONE PLACE','features.title':'Made for writing, not configuration.','features.copy':'Plumbago keeps Hugo and Git underneath while giving everyday publishing a visual home.','features.editor':'Markdown & visual editor','features.editorCopy':'Write visually or in Markdown, with automatic saving and a safe live preview.','features.images':'Image library','features.imagesCopy':'Drop in images, edit alternative text and captions, and choose a featured image.','features.git':'Guided GitHub publishing','features.gitCopy':'Connect a repository, check the build, publish, and follow the deployment from one screen.','features.themes':'Blogs & visual themes','features.themesCopy':'Install a theme, customize its supported look, and preview it safely before applying.','features.pages':'Free website hosting','features.pagesCopy':'Configure GitHub Pages and its deployment workflow without writing YAML.','features.schedule':'Scheduled posts','features.scheduleCopy':'Prepare posts ahead of time and let the hourly website build publish them.','features.routes':'Pages & routes','features.routesCopy':'Create About, Gallery, and other pages with safe routes, redirects, and recovery.','features.blogger':'Blogger import','features.bloggerCopy':'Bring posts, drafts, labels, dates, redirects, and images from a Blogger backup.','features.health':'Publishing health','features.healthCopy':'See whether Hugo, Git, GitHub, and your website build are ready before publishing.','features.wsl':'Windows + WSL','features.wslCopy':'Run Hugo and Git inside the same WSL distribution where your blog lives.','downloads.eyebrow':'LATEST RELEASE','downloads.title':'Choose your platform.','downloads.copy':'Downloads come directly from GitHub Releases.','downloads.windows':'Windows 10/11 · x64 installer','downloads.linux':'x64 · AppImage','downloads.macArm':'Apple Silicon · DMG','downloads.macIntel':'Intel · DMG','downloads.button':'Download','downloads.loading':'Looking for the latest release…','downloads.ready':'Latest release ready to download.','downloads.empty':'No packaged release yet. Follow the project on GitHub for the first download.','how.eyebrow':'A QUIET WORKFLOW','how.title':'From idea to published post.','how.connect':'Create or connect your blog','how.connectCopy':'Start a new Hugo site or choose an existing project, including one stored inside WSL.','how.write':'Write and add images','how.writeCopy':'Plumbago works with your existing Markdown, front matter, and page bundles.','how.publish':'Preview and publish','how.publishCopy':'Validate the Hugo build, push your work, and follow the website deployment.','footer.copy':'A friendly Hugo UI manager. Licensed under GPL-3.0.','footer.releases':'All releases'
  },
  'pt-BR': {
    'nav.features':'Recursos','nav.downloads':'Downloads','nav.how':'Como funciona','hero.eyebrow':'CÓDIGO ABERTO · APLICATIVO HUGO','hero.title':'Seu blog Hugo,<br />sem atrito.','hero.copy':'Escreva em Markdown, arraste imagens, visualize seu site e publique com GitHub em um espaço de trabalho tranquilo.','hero.download':'Baixar o Plumbago','hero.source':'Ver código','hero.free':'Gratuito e código aberto','hero.files':'Seus arquivos ficam locais','features.eyebrow':'TUDO EM UM SÓ LUGAR','features.title':'Feito para escrever, não configurar.','features.copy':'O Plumbago mantém Hugo e Git por baixo enquanto dá uma interface visual à publicação cotidiana.','features.editor':'Editor Markdown e visual','features.editorCopy':'Escreva visualmente ou em Markdown, com salvamento automático e preview seguro.','features.images':'Biblioteca de imagens','features.imagesCopy':'Arraste imagens, edite texto alternativo e legendas e escolha a imagem de destaque.','features.git':'Publicação guiada no GitHub','features.gitCopy':'Conecte um repositório, valide o build, publique e acompanhe o deploy em uma tela.','features.themes':'Blogs e temas visuais','features.themesCopy':'Instale um tema, personalize o visual compatível e faça uma prévia segura antes de aplicar.','features.pages':'Hospedagem gratuita','features.pagesCopy':'Configure GitHub Pages e o fluxo de deploy sem escrever YAML.','features.schedule':'Posts agendados','features.scheduleCopy':'Prepare posts e deixe o build horário do site publicá-los no momento certo.','features.routes':'Páginas e rotas','features.routesCopy':'Crie páginas Sobre, Galeria e outras com rotas, redirecionamentos e recuperação seguros.','features.blogger':'Importação do Blogger','features.bloggerCopy':'Traga posts, rascunhos, marcadores, datas, redirecionamentos e imagens de um backup.','features.health':'Saúde da publicação','features.healthCopy':'Confira Hugo, Git, GitHub e o build do site antes de publicar.','features.wsl':'Windows + WSL','features.wslCopy':'Execute Hugo e Git na mesma distribuição WSL onde seu blog está.','downloads.eyebrow':'VERSÃO MAIS RECENTE','downloads.title':'Escolha sua plataforma.','downloads.copy':'Os downloads vêm diretamente dos Releases do GitHub.','downloads.windows':'Windows 10/11 · instalador x64','downloads.linux':'x64 · AppImage','downloads.macArm':'Apple Silicon · DMG','downloads.macIntel':'Intel · DMG','downloads.button':'Baixar','downloads.loading':'Procurando a versão mais recente…','downloads.ready':'Versão mais recente pronta para baixar.','downloads.empty':'Ainda não há uma versão empacotada. Acompanhe o projeto no GitHub para o primeiro download.','how.eyebrow':'UM FLUXO TRANQUILO','how.title':'Da ideia ao post publicado.','how.connect':'Crie ou conecte seu blog','how.connectCopy':'Comece um novo site Hugo ou escolha um projeto existente, inclusive armazenado no WSL.','how.write':'Escreva e adicione imagens','how.writeCopy':'O Plumbago trabalha com seu Markdown, front matter e page bundles existentes.','how.publish':'Visualize e publique','how.publishCopy':'Valide o build do Hugo, envie seu trabalho e acompanhe o deploy do site.','footer.copy':'Um gerenciador Hugo amigável. Licenciado sob GPL-3.0.','footer.releases':'Todos os releases'
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
