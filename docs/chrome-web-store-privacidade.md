# Chrome Web Store — textos da aba "Privacidade"

Textos para colar no Developer Dashboard → Lumi Ofertas Sync → **Privacidade**.
Mantenha-os coerentes com `docs/politica-de-privacidade-extensao.md` e com `chrome/manifest.json`.

## Finalidade única

> Conectar as contas de afiliado do usuário nos marketplaces (Mercado Livre, Amazon, Magalu, Shein e TikTok Shop) à plataforma Lumi Ofertas. A extensão envia à plataforma os cookies de sessão das lojas em que o usuário está logado, para que a Lumi gere links de afiliado e capture e divulgue ofertas em nome do usuário.

## Justificativa das permissões

**cookies**

> Necessária para ler os cookies de sessão do Mercado Livre, Amazon, Magalu, Shein e TikTok Shop, verificar se o usuário está logado em cada loja e enviar esses cookies à plataforma Lumi Ofertas, que os usa para acessar as contas de afiliado do usuário em seu nome. Apenas os domínios dessas lojas são lidos.

**alarms**

> Usada para sincronizar os cookies automaticamente a cada 30 minutos e renovar periodicamente o token de login da conta Lumi, mantendo a conexão com a plataforma ativa sem ação manual do usuário.

**storage**

> Usada para guardar localmente o token de sessão da conta Lumi, o e-mail do usuário, o status de cada loja e a data da última sincronização. Esses dados são apagados quando o usuário clica em "Sair".

**Permissões de host**

> mercadolivre.com.br, mercadolibre.com, amazon.com.br, amazon.com, magazinevoce.com.br, magazineluiza.com.br, shein.com e tiktok.com: necessárias para que a API de cookies leia os cookies de sessão dessas lojas, que é a finalidade única da extensão. pvsnmibmagkdyqewzwdg.supabase.co: servidor da plataforma Lumi Ofertas, usado para login e para receber os cookies sincronizados.

**Content script (app.lumiofertasinteligentes.com.br e localhost)**

> Insere um marcador invisível nas páginas do painel da Lumi para que o painel saiba que a extensão está instalada. Não lê nenhum dado da página.

## Uso de código remoto

> **Não**, não estou usando código remoto.

## Uso de dados — marcar

- [x] **Informações de identificação pessoal** — e-mail da conta Lumi.
- [x] **Informações de autenticação** — senha da conta Lumi (enviada no login, não armazenada), tokens de sessão e cookies de autenticação dos marketplaces.
- [ ] Todas as outras categorias ficam **desmarcadas** (saúde, financeiras, comunicações pessoais, localização, histórico da Web, atividade do usuário, conteúdo do site).

## Certificações — marcar as três

- [x] Não vendo nem transfiro dados do usuário para terceiros, exceto nos casos de uso aprovados.
- [x] Não uso nem transfiro dados do usuário para fins não relacionados à finalidade única do meu item.
- [x] Não uso nem transfiro dados do usuário para determinar a capacidade de crédito ou para fins de empréstimo.

## URL da política de privacidade

> https://tiagomonteiroia.github.io/extensaolumi/privacidade/

(Publicada via GitHub Pages a partir de `docs/privacidade/index.html`.)
