# [Lumi Ofertas Sync](https://app.lumiofertasinteligentes.com.br/) - Extensão de Navegador

Extensão que sincroniza automaticamente os cookies do **Mercado Livre**, **Amazon**, **Magalu**, **Shein** e **TikTok Shop** com o painel Lumi Ofertas, mantendo a sessão sempre atualizada para automações.

**Desenvolvido por:** [Agência Taruga](https://www.agenciataruga.com)  
**Autor:** Leandro Oliveira Nunes (leandro@agenciataruga.com)  
**Cliente:** [Lumi Ofertas](https://app.lumiofertasinteligentes.com.br/)

---

## Funcionalidades

- 🔐 **Login integrado**: Autenticação direta com o sistema Lumi Ofertas via Supabase.
- 🔄 **Sincronização Multi-Plataforma**: 
  - Captura cookies do **Mercado Livre** (`.mercadolivre.com.br`)
  - Captura cookies da **Amazon** (`.amazon.com.br` / `.amazon.com`)
  - Captura cookies do **Magalu** (`.magazinevoce.com.br`)
  - Captura cookies da **Shein** (`br.shein.com`)
  - Captura cookies do **TikTok Shop** (`affiliate.tiktok.com`)
- ⏱️ **Automático**: Sincroniza em segundo plano a cada 30 minutos.
- 📡 **API Segura**: Comunicação direta com Supabase Functions.
- 🖱️ **Interface Intuitiva**:
  - Botão de sincronização manual.
  - Alternância de Tema (Claro/Escuro).
  - Status visual individual por plataforma (com a quantidade de cookies sincronizados quando conectado).
  - Visual com a identidade da Lumi; fonte embutida para abrir o popup sem depender da internet.
- 🎨 **Indicadores de Status (Badge)**:
  - 🟢 **Verde**: Conectado e sincronizado.
  - 🟠 **Laranja**: Sem cookies encontrados (Desconectado da loja).
  - 🔴 **Vermelho**: Erro de conexão ou login expirado.

---

## Compatibilidade

| Navegador | Versão | Pasta |
|-----------|--------|-------|
| Google Chrome | Manifest V3 | `chrome/` |
| Microsoft Edge | Manifest V3 | `chrome/` |
| Opera | Manifest V3 | `chrome/` |
| Mozilla Firefox | Manifest V3 | `firefox/` |

---

## Instalação em Modo Desenvolvedor

Esta é a forma de instalar a extensão localmente para testes ou desenvolvimento antes de ela estar na loja oficial.

### Google Chrome / Edge / Opera / Brave

1. **Baixe o projeto**: Faça o download do código ou clone este repositório.
2. **Acesse as extensões**:
   - **Chrome**: Digite `chrome://extensions/` na barra de endereços.
   - **Edge**: Digite `edge://extensions/`.
   - **Opera**: Digite `opera://extensions`.
3. **Ative o Modo Desenvolvedor**:
   - No canto superior direito da página de extensões, ative a chave **"Modo do desenvolvedor"** (Developer mode).
4. **Carregue a extensão**:
   - Clique no botão **"Carregar sem compactação"** (Load unpacked).
   - Navegue até a pasta do projeto baixado e selecione a pasta `chrome`.
5. **Pronto**: A extensão aparecerá na sua barra de ferramentas e estará ativa.

### Mozilla Firefox

1. **Acesse a depuração**:
   - Digite `about:debugging#/runtime/this-firefox` na barra de endereços.
2. **Carregue o manifesto**:
   - Clique no botão **"Carregar extensão temporária..."** (Load Temporary Add-on...).
   - Navegue até a pasta `firefox/` deste projeto e selecione o arquivo `manifest.json`.
3. **Pronto**: A extensão estará ativa.

> **Nota Importante:** No Firefox padrão, esta instalação é temporária e será removida ao fechar o navegador. Para uso permanente sem publicar na loja, você deve usar o **Firefox Developer Edition** e definir `xpinstall.signatures.required` como `false` em `about:config`.

---

## Guia de Publicação

### 1. Gerando Chaves de Acesso (Store Keys)

Para publicar ou atualizar a extensão, você precisará configurar contas de desenvolvedor nas respectivas lojas.

#### Google Chrome Web Store
1. Acesse o [Google Cloud Console](https://console.cloud.google.com/).
2. Crie um novo projeto (ex: `lumi-extension-prod`).
3. Vá em **APIs e Serviços** > **Biblioteca**.
4. Pesquise por **"Chrome Web Store API"** e ative-a.
5. Vá em **Tela de permissão OAuth**:
   - Escolha "Externo".
   - Preencha os dados obrigatórios (Nome, E-mail de suporte).
6. Vá em **Credenciais** > **Criar Credenciais** > **ID do cliente OAuth**.
   - Tipo de aplicativo: **App para computador** (Desktop App).
   - Isso gerará seu `Client ID` e `Client Secret`. Salve-os em local seguro.

#### Firefox Add-ons (AMO)
1. Acesse o [Firefox Developer Hub](https://addons.mozilla.org/developers/).
2. Faça login na sua conta Mozilla.
3. No menu, vá em **"Gerenciar minhas chaves de API"** (Manage API Keys) ou acesse direto pelas configurações da conta.
4. Clique em **Generate new credentials**.
5. Copie o `JWT issuer` (sua chave de identificação) e o `JWT secret`.
   - **Atenção**: O segredo é exibido apenas uma vez. Guarde-o com segurança.

### 2. Publicando Oficialmente

#### Google Chrome Web Store
1. Acesse o [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/developer/dashboard).
2. É necessário pagar uma **taxa única de registro** ($5 USD) se for sua primeira vez.
3. Clique em **"Novo item"** (+).
4. **Prepare o arquivo**: Compacte o conteúdo da pasta `chrome/` em um arquivo `.zip`. **Importante:** O `manifest.json` deve ficar na raiz do ZIP, não dentro de uma subpasta.
5. Faça o upload do arquivo ZIP.
6. Preencha as informações da loja (Metadados):
   - **Descrição**: Detalhe o que a extensão faz.
   - **Privacidade**: Declare que a extensão usa permissões de "Host" para sincronizar cookies.
   - **Imagens**: Adicione pelo menos um ícone (128x128) e uma captura de tela (1280x800).
7. Clique em **"Enviar para análise"**. A revisão pode levar alguns dias.

#### Firefox Add-ons (AMO)
1. Acesse o [Hub de Envio do Firefox](https://addons.mozilla.org/developers/addon/submit/upload-unlisted).
2. Clique em **"Submit a New Add-on"**.
3. Escolha a opção **"On this site"** (para distribuir publicamente para todos os usuários).
4. **Prepare o arquivo**: Compacte o conteúdo da pasta `firefox/` em um arquivo `.zip` ou `.xpi`.
5. Faça o upload do arquivo. O sistema fará validações automáticas de segurança.
6. Se passar na validação, clique em **"Continue"**.
7. Preencha as informações (Versão, Notas de lançamento).
8. Envie para revisão. A aprovação no Firefox costuma ser rápida (às vezes em minutos).

---

## Como Usar

### 1. Login
1. Clique no ícone da extensão (Lumi Ofertas) na barra do navegador.
2. Insira seu e-mail e senha do painel Lumi Ofertas.
3. Clique em **Entrar**.

### 2. Sincronização
- A extensão tentará sincronizar automaticamente após o login.
- Certifique-se de estar logado nas lojas (**Mercado Livre**, **Amazon**, **Magalu**, **Shein**, **TikTok Shop**) no mesmo navegador onde a extensão está instalada.
- O card de status mostrará:
    - **Mercado Livre**: 🟢 Conectado / 🟠 Desconectado
    - **Amazon**: 🟢 Conectado / 🟠 Desconectado
    - **Magalu**: 🟢 Conectado / 🟠 Desconectado
    - **Shein**: 🟢 Conectado / 🟠 Desconectado
    - **TikTok Shop**: 🟢 Conectado / 🟠 Desconectado

### 3. Solução de Problemas
- **Laranja (🟠)**: Significa que a extensão não encontrou os cookies de sessão. Abra o site da loja (ex: amazon.com.br), faça login na sua conta, e clique em **"Sincronizar Agora"** na extensão.
- **Vermelho (🔴)**: Indica erro de conexão com o servidor ou login expirado no painel Lumi. Faça login novamente na extensão.

---

## Licença

Este projeto está licenciado sob a licença [MIT](LICENSE).

**Copyright (c) 2026 Agência Taruga**

Permissão é concedida, gratuitamente, a qualquer pessoa para usar, copiar, modificar, fundir, publicar, distribuir, sublicenciar e/ou vender cópias do Software, sujeito às condições da Licença MIT.
