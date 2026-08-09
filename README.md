# Plumbago

**A Hugo UI manager.** Um aplicativo desktop para escrever, organizar e publicar blogs Hugo sem depender da linha de comando no dia a dia.

Site e downloads: [gabuvns.github.io/plumbago](https://gabuvns.github.io/plumbago/)

Código e releases: [github.com/gabuvns/plumbago](https://github.com/gabuvns/plumbago)

O Plumbago foi desenhado primeiro para Windows + WSL. O app abre a pasta do blog pela integração de arquivos do Windows e executa Hugo e Git dentro da distribuição WSL correspondente. Em Linux, executa essas ferramentas diretamente.

## O que o MVP já faz

- abre um site Hugo existente sem alterar sua estrutura;
- cria um site Hugo novo, inicializa seu repositório Git e configura título e idioma;
- pesquisa a galeria oficial do Hugo e instala temas como submódulos Git;
- encontra posts Markdown dentro de `content/posts`;
- cria page bundles com o comando `hugo new content`;
- edita título, descrição, data, tags, estado de rascunho e conteúdo Markdown;
- salva automaticamente após a digitação e mantém botões de salvamento manual;
- mostra preview seguro de Markdown lado a lado;
- abre uma biblioteca com as imagens anexadas ao post;
- importa imagens pelo seletor ou por arrastar e soltar, evita colisões de nomes e insere o Markdown;
- permite inserir uma imagem existente novamente ou escolhê-la como destaque;
- inicia `hugo server` para abrir o preview real do site;
- mostra branch, remoto e arquivos alterados;
- sincroniza com qualquer remoto Git: commit, pull com rebase e push;
- configura autor, e-mail e remoto `origin` pelo menu do aplicativo;
- oferece a interface em inglês (padrão) e português do Brasil;
- preserva campos de front matter que o Plumbago ainda não conhece.

## Desenvolvimento

Pré-requisitos:

- Node.js 18 ou mais recente;
- Hugo Extended disponível no mesmo ambiente do blog;
- Git configurado, incluindo a autenticação do remoto para usar a sincronização.

```bash
npm install
npm run dev
```

Para abrir somente a interface de demonstração no navegador:

```bash
npm run dev:web
```

## Verificações

```bash
npm test
npm run check
```

Os testes criam sites e repositórios Git temporários para exercitar criação, edição, imagens, temas e sincronização. Também protegem a paridade das traduções, os canais entre Electron e a interface, a identidade Plumbago, a paleta oficial e a configuração do CI. Nenhum blog do usuário é modificado.

O workflow de CI executa esses testes e o build de produção em todo push e em todo pull request.

## Pacotes locais

Use o comando correspondente ao sistema em que a compilação será executada:

```bash
npm run package:win
npm run package:linux
npm run package:mac
```

Os arquivos serão criados em `release/`. A primeira versão usa a autenticação Git já configurada no sistema ou no WSL; o Plumbago não armazena tokens ou senhas.

## Releases automáticos

Ao publicar uma GitHub Release cujo identificador seja igual à versão do `package.json` com o prefixo `v` — por exemplo, `v0.4.0` — o workflow cria automaticamente:

- instalador NSIS para Windows x64;
- AppImage para Linux x64;
- DMGs para macOS Intel e Apple Silicon.

Os quatro pacotes são anexados à mesma release. Para publicar pela linha de comando:

```bash
gh release create v0.4.0 --generate-notes
```

Antes de criar outra release, atualize a versão no `package.json` e no `package-lock.json`.

## GitHub Pages

O conteúdo de `site/` é publicado automaticamente pelo workflow do GitHub Pages após alterações na branch `main`. A página consulta a release mais recente e direciona cada botão ao pacote correspondente.

## Como a integração com WSL funciona

Quando a pasta selecionada começa com `\\wsl.localhost\<distro>\...`, o Plumbago extrai a distribuição e o caminho Linux. Hugo e Git são executados por `wsl.exe -d <distro> --cd <pasta> -- <programa> <argumentos>`. Os argumentos não passam por um shell intermediário.

## Próximos passos

1. texto alternativo e redimensionamento de imagens;
2. suporte configurável a seções e formatos de front matter;
3. histórico de versões e resolução guiada de conflitos;
4. instalador assinado, atualizações automáticas e onboarding de Hugo/Git;
5. integração opcional com a API do GitHub para criar repositórios e pull requests.

## Licença

GNU General Public License v3.0 (`GPL-3.0-only`).
