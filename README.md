# Plum

**A Hugo UI manager.** Um aplicativo desktop para escrever, organizar e publicar blogs Hugo sem depender da linha de comando no dia a dia.

O Plum foi desenhado primeiro para Windows + WSL. O app abre a pasta do blog pela integração de arquivos do Windows e executa Hugo e Git dentro da distribuição WSL correspondente. Em Linux, executa essas ferramentas diretamente.

## O que o MVP já faz

- abre um site Hugo existente sem alterar sua estrutura;
- encontra posts Markdown dentro de `content/posts`;
- cria page bundles com o comando `hugo new content`;
- edita título, descrição, data, tags, estado de rascunho e conteúdo Markdown;
- mostra preview seguro de Markdown lado a lado;
- importa imagens para a pasta do post, evita colisões de nomes e insere o Markdown;
- inicia `hugo server` para abrir o preview real do site;
- mostra branch, remoto e arquivos alterados;
- sincroniza com qualquer remoto Git: commit, pull com rebase e push;
- preserva campos de front matter que o Plum ainda não conhece.

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

Os testes criam um site Hugo temporário e exercitam o fluxo de criação, edição, listagem e importação de imagens. Nenhum blog do usuário é modificado pelos testes.

## Gerar o instalador do Windows

Em um terminal do Windows com Node.js instalado:

```powershell
npm install
npm run package:win
```

O instalador será criado em `release/`. A primeira versão usa a autenticação Git já configurada no WSL; o Plum não armazena tokens ou senhas.

## Como a integração com WSL funciona

Quando a pasta selecionada começa com `\\wsl.localhost\<distro>\...`, o Plum extrai a distribuição e o caminho Linux. Hugo e Git são executados por `wsl.exe -d <distro> --cd <pasta> -- <programa> <argumentos>`. Os argumentos não passam por um shell intermediário.

## Próximos passos

1. biblioteca visual de imagens, texto alternativo e redimensionamento;
2. suporte configurável a seções, idiomas e formatos de front matter;
3. histórico de versões e resolução guiada de conflitos;
4. instalador assinado, atualizações automáticas e onboarding de Hugo/Git;
5. integração opcional com a API do GitHub para criar repositórios e pull requests.

## Licença

MIT
