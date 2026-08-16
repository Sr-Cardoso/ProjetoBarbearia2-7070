# Loja de produtos + mensagens automáticas — Barbearia Cardoso

## Feito
- Schema: `products`, `orders`, `order_items`, `messages` (+ `db:push` aplicado).
- `lib/messaging.ts` (config/templates/canais), `lib/messenger.ts` (worker: lembrete 1h antes,
  reativação 30 dias, fila, envio), helpers de fuso em `lib/schedule.ts`.
- `routes/shop.ts` (público: catálogo, destaques, agendamentos vinculáveis, createOrder, myOrders).
- `routes/store.ts` (admin: CRUD produtos, pedidos, comanda `agendaTotals`, stats, config e fila de mensagens).
- Composto em `api/index.ts` + `startMessenger()`; cancelamento de agendamento cancela mensagens.
- Seed de demonstração: `packages/web/scripts/seed.ts` (`bun run db:seed`) — 4 serviços, 3 barbeiros,
  8 produtos com foto, 3 agendamentos, 1 pedido na comanda. Fotos em `public/produtos/`.
- Web: `queries/shop.ts`, `lib/cart.ts` (carrinho localStorage), `pages/loja.tsx`,
  `components/featured-products.tsx` na home, link + carrinho no header, rotas `/loja` `/entrar` `/conta`.
- Admin: `queries/store.ts` + abas `admin-products-tab.tsx`, `admin-orders-tab.tsx`,
  `admin-messages-tab.tsx` registradas em `pages/admin.tsx`; comanda (serviço + produtos = total no
  salão) dentro da `AgendaTab`.
- Mobile: `queries/shop.ts` + aba `app/(tabs)/loja.tsx` registrada em `app/(tabs)/_layout.tsx`.
- `design.md` atualizado (loja, mensagens, comanda e paleta preto/vermelho real).
- Verificado: `bun run typecheck` OK · `bun run build` OK · `konsistent` sem violações ·
  dev web em 4200 e Metro em 4300 · loja/carrinho/checkout com comanda, abas do admin, `agendaTotals`
  e worker (lembrete e reativação testados com dados temporários, já removidos).

- Edição total pelo painel:
  - `components/admin-services-tab.tsx` — CRUD de serviços com foto (`ImageField`, upload ou URL),
    descrição, preço, duração, ordem (setas ↑↓), ativar/desativar e excluir.
  - `components/admin-barbers-tab.tsx` — CRUD da equipe com foto, função, bio, ordem, ativar/excluir.
  - `pages/admin.tsx` — abas Serviços/Barbeiros passam a usar esses componentes (blocos antigos
    removidos); `SETTING_FIELDS` ganhou e-mail, link do Google Maps e Instagram (@perfil).
  - CMS: nova seção `shop` em `api/lib/site-content.ts` (vitrine na home + topo da /loja + aviso do
    carrinho) com editor "Loja" em `site-tab.tsx`; textos ligados em `featured-products.tsx` e
    `pages/loja.tsx`.
  - `site-footer.tsx` — endereço vira link do Maps quando `mapsUrl` está preenchido e o Instagram
    virou link.
  - Verificado no navegador: abas Serviços/Barbeiros/Site→Loja/Configurações renderizam, edição de
    serviço salva a foto. `typecheck`, `build` e `konsistent` OK.

## Implantação neste sandbox (projeto restaurado do zip)
- App gerenciado recriado com infra nova (`.env` com Turso + S3 + auth provisionados) e o código do
  zip restaurado por cima. Template `0.3.0` em ambos, sem conflito de arquivos `__`.
- `packages/web/scripts/seed.ts` **não veio no zip** e foi reescrito (idempotente): unidade
  `drcglobal.store`, 4 serviços, 3 barbeiros, 8 produtos com foto, 7 configurações, 3 agendamentos
  em dias úteis e 1 pedido de R$ 88,00 vinculado à comanda.
- `bun install` OK · `db:push` aplicado · `db:seed` OK · `typecheck` OK · `konsistent` sem violações
  · `bun run build` OK.
- Rodando: web em `:4200`, Metro em `:4300`.
- Conferido no navegador: home, `/loja` (catálogo + filtros + carrinho), `/agendar` (passo 1) e o
  admin logado por senha mestra — abas Agenda (3 próximos), Produtos (8), Pedidos (comanda com o
  vínculo do horário) e Mensagens (canal manual, credenciais ausentes sinalizadas).
- Admin: senha mestra `DRCGlobal#` (padrão do código; defina `ADMIN_PASSWORD` no `.env` para trocar).

## Correção: "A conexão não é segura" (drcglobal.store)
- Diagnóstico: o certificado está **válido** (Google Trust Services, CN=drcglobal.store, até
  06/11/2026) e não há conteúdo misto (zero `http://` no código). A causa era o edge responder
  `200` em `http://drcglobal.store` **sem redirecionar** — digitando o domínio, o Chrome abria em
  texto puro e marcava a página como insegura.
- Correção em `packages/web/src/server.ts` (entrypoint de produção, editável): envolve o `fetch` do
  `__server.ts` protegido — `Bun.serve` é embrulhado antes do import dinâmico, então o arquivo `__`
  segue byte a byte igual ao original.
  - `301` de `http://` → `https://` preservando path e query, com `Vary: X-Forwarded-Proto, Host`.
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` nas respostas https.
  - `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` e
    `Content-Security-Policy: upgrade-insecure-requests` em toda resposta.
  - `/api/health` **nunca** é redirecionado (o orquestrador chama a porta direto; um 301 marcaria a
    instância como fora do ar). Host local/interno também não redireciona.
- Testado com `PORT=4500 bun src/server.ts`: http→301 correto, https→200 com HSTS, healthcheck 200,
  acesso local 200 sem HSTS, RPC e assets estáticos intactos. `typecheck`, `konsistent` e `build` OK.
- **Só entra em vigor no próximo publish** — o redirect roda no servidor de produção.
- Pendências fora do código: `www.drcglobal.store` aponta para **outro site** (Hostinger Horizons,
  DNS `cdn.hstgr.net`), não para este app; e a senha mestra do admin ainda é o padrão do código
  (`ADMIN_PASSWORD` não definido no `.env`).

## Segurança do login do admin
- `ADMIN_PASSWORD` definido no `.env` da raiz (arquivo já no `.gitignore`, fora do versionamento).
- `middleware/auth.ts`: **removida a senha padrão embutida no código** (`DRCGlobal#`). Agora a senha
  vem só do ambiente; sem a variável, o login por senha é desligado (`PASSWORD_LOGIN_ENABLED`) e
  apenas o Google entra. Token passou de `sha256(senha:secret)` para HMAC-SHA256 com
  `BETTER_AUTH_SECRET`, e a conferência usa `timingSafeEqual` (`safeTokenEqual`) — `===` vazava o
  token pelo tempo de resposta. Avisa no log se a senha tiver menos de 12 caracteres.
- Novo `api/lib/login-guard.ts`: freio de força bruta por IP — 5 erros em 10 min bloqueiam, com
  backoff exponencial (5 → 10 → 20 min … teto 1h), limpeza de registros velhos e teto de 10k IPs
  monitorados. Estado em memória, sem tabela nova.
- `routes/admin.ts`: `login` consulta o bloqueio antes de conferir a senha, devolve `429` com o tempo
  restante, avisa quantas tentativas faltam e zera o contador no acerto. `session` também usa
  `safeTokenEqual`. Senha limitada a 200 caracteres na entrada.
- Testado ao vivo: senha antiga `DRCGlobal#` → 401; 5 erros seguidos → 429 "tente em 5 minutos";
  senha nova → 200 com token e sessão `via: password`; token falso → rejeitado; login negado
  conferido também no navegador. `typecheck`, `konsistent` e `build` OK.
- **Vale no site público a partir do próximo publish**, junto com a correção do HTTPS.

## Liberar dias fechados na agenda (painel)

- **Dias de atendimento** virou configuração (`settings.workDays`, ex.: `1,2,3,4,5,6`, 0 = domingo)
  em vez da regra fixa "seg–sex" espalhada pelo código. Ajustado na aba **Bloqueios → Dias de
  atendimento** (botões Seg…Dom + Salvar dias).
- **Liberação pontual**: nova tabela `open_days` (unidade + data) abre uma data específica mesmo fora
  dos dias de atendimento. Fechar um dia continua sendo bloqueio de dia inteiro em `blocks`.
- **Aba Agenda**: faixa de status do dia com o motivo ("Fechado: não atendemos domingo…", "Dia
  bloqueado…", "Aberto por liberação sua…") e ação **Liberar este dia** / **Fechar este dia**.
  Liberar apaga bloqueios de dia inteiro daquela data e registra a abertura; fechar tira a abertura e
  bloqueia o dia. Data passada não tem botão. Bloqueios de horário avulso continuam na aba Bloqueios.
- **Aba Bloqueios**: cartões "Dias de atendimento" e "Dias liberados" (com botão Fechar) acima da
  lista de bloqueios.
- Servidor: `api/lib/agenda-rules.ts` (`loadScheduleRules`, `isOpenDate`, `closedReason`,
  `fullDayClosedDates`) é a fonte única; `booking.availability`, `booking.create` e o sugestor de
  horários de `lib/messenger.ts` usam ela. Novo procedure público `booking.schedule` devolve
  `workDays`, `openDates`, `closedDates` e o rótulo ("de segunda a sábado").
- Front: calendário do site (`buildCalendar`) e a régua de dias do app (`nextOpenDays`) desabilitam
  dias pelo servidor; datas liberadas por exceção aparecem destacadas. Os textos "Atendemos de
  segunda a sexta" agora saem do rótulo do servidor.
- **Config atual alinhada ao site**: `workDays = 1,2,3,4,5,6` (segunda a sábado), porque o rodapé/CMS
  anuncia "Segunda a sábado, 08:00 às 18:00". Antes o calendário riscava sábado. Dá para voltar
  desmarcando **SÁB** no painel.
- Testado ao vivo: sábado deixou de ser bloqueado; domingo liberado pelo painel virou agendável
  (agendamento de teste criado e depois removido); domingo sem liberação recusa com "Não atendemos
  domingo."; segunda fechada pelo painel sai do calendário e volta ao liberar; `setWorkDays` sem
  nenhum dia é recusado. `typecheck`, `konsistent` e `build` OK. Dados de teste limpos.

## Notas
- `oxlint` (parte do `bun run lint`) aborta neste sandbox — `oxc_allocator/src/pool/fixed_size.rs`
  panic também no template intocado, ou seja, é limitação do ambiente e não do código. A checagem de
  convenções (`konsistent`) passa.
- Sem credenciais WhatsApp/Twilio → canal `manual`: mensagem fica na fila com link `wa.me`.
- Toda query filtra `tenantId`. Não editar arquivos `__`.

### Correção: sábado continuava riscado para o cliente
- Causa: o calendário do site e a régua de dias do app tinham um **padrão fixo `[1..5]`
  (seg–sex)** usado enquanto `booking.schedule` não respondia (ou falhava, ex.: bundle antigo em
  cache). Nesse estado a tela mostrava "Atendemos de segunda a sexta" e riscava os sábados, mesmo com
  `workDays = 1..6` salvo no painel.
- Removido o padrão: sem as regras do servidor nada é riscado por dia da semana; o site mostra
  "Carregando os dias de atendimento…" (com botão "Tentar de novo" em caso de erro) e o app mostra o
  mesmo aviso na etapa Data.
- `booking.schedule` passou a `staleTime: 0` + `refetchOnMount: "always"` (web também com
  `refetchOnWindowFocus`), então mudança no painel aparece ao recarregar.
- Textos desatualizados corrigidos no conteúdo do site (rascunho salvo e publicado no CMS):
  hero "Seg — Sáb · 08h às 18h" e CTA "de segunda a sábado". Defaults de `lib/site-content.ts`
  também atualizados.
- Testado: `/agendar` mostra "Atendemos de segunda a sábado", sábados 8/15/22/29 clicáveis, domingos
  riscados, e o sábado 15 lista os 6 horários. `typecheck`, `konsistent` e `build` OK.

### Agendamento pelo aplicativo do dono (link + QR Code no painel)
- Onde fica: painel Admin → aba **Configurações** → card "Agendamento pelo aplicativo" + card
  "QR Code do agendamento". **Nada disso aparece na home nem no rodapé do site** (exigência do dono).
- Sem mudança de schema: tudo em `settings` (por unidade/tenant), chaves `appBookingUrl`,
  `appBookingMode`, `appBookingTitle`, `appBookingText`.
- Três modos (`api/lib/app-redirect.ts`):
  - `off` — site agenda normalmente; o link continua salvo só para o QR/uso externo (é o liga/desliga
    sem apagar o link).
  - `invite` — `/agendar` mostra o convite "Agende pelo nosso aplicativo" com "ABRIR O APLICATIVO" e
    escape "PREFIRO AGENDAR AQUI NO SITE" (título e texto editáveis no painel).
  - `redirect` — `/agendar` manda direto para o app (`window.location.replace`), com escape
    "Não abriu? Agendar aqui no site".
- Decisão: os 12 botões "Agendar" do site continuam apontando para `/agendar`; o desvio acontece
  dentro da própria página, então não há link solto para o app espalhado pelo layout.
- Anti-vazamento: `booking.settings` (público, usado por rodapé/contato) filtra qualquer chave com
  prefixo `appBooking`. Esses dados só saem pelo procedure `booking.appBooking`, consumido apenas por
  `/agendar`.
- QR: gerado no navegador, no painel, com o pacote `qrcode` (`toDataURL`, 640×640) a partir do **link
  já salvo** — nunca do rascunho. Botões Baixar PNG (`qrcode-agendamento.png`), Copiar link e Testar
  link.
- Validação de URL nos dois lados (`isValidAppUrl`): aceita `http:`/`https:` com hostname e esquema de
  app (ex.: `barbearia://agenda`). `saveSettings` recusa link inválido, modo inválido e modo ≠ `off`
  sem link salvo.
- Testado: RPC (as 3 recusas + `booking/settings` sem `appBooking*` e `booking/appBooking` com), e no
  navegador: card + QR renderizando, `invite` com escape voltando ao fluxo do site, `redirect` saindo
  para o link, home sem nenhum vestígio. `typecheck`, `konsistent` e `build` OK.
- Estado final entregue: `appBookingUrl` **vazio** e `appBookingMode = "off"` (dono ainda não tem o
  app). Também corrigido o setting `hours` para "Segunda a sábado, 08:00 às 18:00".

### Integração BlipBeauty (API key no painel)
- Onde fica: card **"Integração BlipBeauty"** em **duas abas** do painel — Mensagens (abaixo das
  mensagens automáticas) e Configurações. Mesmo componente
  (`web/components/admin-blip-card.tsx`), então editar num lugar vale nos dois.
- Guarda dois campos em `settings` por unidade: `blipApiUrl` (URL da API) e `blipApiKey` (API key).
- **A chave nunca volta inteira para o navegador.** `store.messagingConfig` remove o objeto `blip` da
  resposta e devolve só `blipApiUrl`, `blipApiKeyMasked` (`••••••••3456`), `blipApiKeySet` e
  `blipReady`. `booking.settings` (rota pública) filtra tudo que começa com `blip`, igual já fazia com
  `appBooking`.
- Salvar com o campo da chave **em branco mantém a chave atual** (só a URL é atualizada); o link
  "Apagar a chave salva" (`clearKey`) apaga de propósito. Botão de olho mostra/esconde o que está
  sendo digitado.
- Validação: URL http/https com host; chave com 12+ caracteres e sem espaço. Mensagens de erro em pt-BR
  no card e no servidor (`api/lib/blip.ts`).
- Novo canal `blip` nas mensagens automáticas: `resolveChannel` agora recebe a config inteira e cai
  para `manual` se URL/chave não estiverem válidas. Escolher BlipBeauty como canal sem credencial é
  recusado, e **apagar a chave derruba o canal para `manual` automaticamente**.
- Disparo (`sendBlipMessage`): POST na URL com `Authorization: Bearer <chave>` **e** `x-api-key`,
  corpo com `phone`/`to`, `message`/`text`, `name` e `kind` (nomes duplicados para encaixar na maioria
  dos serviços sem ajuste). Timeout de 15s com mensagem clara.
- Botão **Testar conexão**: envia uma mensagem de teste para um número informado e mostra o erro exato
  devolvido pelo serviço (`store.testBlipIntegration`).
- Testado de verdade: com um servidor local fingindo ser o BlipBeauty, o teste e o **despacho da fila**
  chegaram com a chave nos dois cabeçalhos (`runMessages` → `sent: 1`); as 4 recusas de validação,
  a máscara da chave e a queda do canal ao apagar a chave também foram verificadas. `typecheck`,
  `konsistent` e `build` OK.
- Estado final entregue: URL e chave **vazias**, canal em `manual`, mensagens de teste removidas do
  banco.

### Integração real com o app BlipBeauty (mão dupla) — 09/08/2026
**Contrato real da API do BlipBeauty** (descoberto com sondas contra
`https://blipbea-ewxaqti-preview-4200.runable.site/api/v1`, autenticação `Authorization: Bearer <chave>`;
`x-api-key` **não** é aceito por ele):
- `GET /ping` → `{ok, businessName, timezone, provider, providerLabel, providerReady, sendMode,
  autoActive, inQuietHours, reminderEnabled, reminderMinutesBefore, reactivationEnabled, inactiveDays,
  quietHoursStart/End, aiEnabled}`.
- `POST /clients` — exige `name` + `phone`; aceita `email`, `notes`, `externalId`. Upsert por
  `externalId` (`created:false` no reenvio).
- `POST /appointments` — exige `startsAt` (ISO) + `clientName` + `clientPhone`; aceita `serviceName`,
  `staffName`, `durationMin`, `price` (**centavos, o campo é `price`; `priceCents` é ignorado**),
  `notes`, `externalId` (upsert), `status` ∈ `scheduled|done|canceled|noshow`.
- `GET /clients`, `GET /appointments` para leitura. **Não existe** rota de envio de mensagem
  (`/messages`, `/send`, `/queue`, `/webhook` → 404).

**Consequência de arquitetura:** o site **não manda mensagem** para o BlipBeauty — ele **espelha a
agenda** (push) e o BlipBeauty dispara sozinho (lembrete, reativação, IA, horário de silêncio).
- `api/lib/blip.ts`: `blipRequest`, `blipPing`, `pushBlipClient`, `pushBlipAppointment`,
  `toBlipStatus` (mapa `pending/confirmed → scheduled`, `completed → done`, `cancelled → canceled`,
  `noshow → noshow`), `testBlipConnection` (usa `/ping`, sem telefone de teste).
- `api/lib/blip-sync.ts` (novo): `syncAppointmentToBlip` (um agendamento, `externalId = bc-<id>`,
  cliente com `bc-cli-<telefone>`) e `syncTenantToBlip` (janela −180/+90 dias, teto 300).
- Push automático: após criar agendamento no site (`booking.create`) e ao mudar status no painel
  (`admin.setStatus`) — `void syncAppointmentToBlip(...)`, sem travar a resposta.
- `messenger.ts`: com canal `blip` o worker **só sincroniza** e **não gera fila local** (evita mensagem
  duplicada); `deliverMessage` no canal `blip` devolve `false`. Log inclui `blip:<sincronizados>`.
- Painel: seção **"Conexão e sincronização"** no card do BlipBeauty — "Testar conexão" (mostra negócio,
  provedor, lembrete/reativação e avisa se está em horário de silêncio) e "Sincronizar agenda agora"
  (`store.syncBlipAgenda`).

**Leitura pela API deste site (`/api/blip/*`)** — para o BlipBeauty puxar dados quando quiser:
- Autenticação por token **próprio de entrada** (`settings.blipInboundToken`), separado da chave de
  saída. Aceita `Authorization: Bearer`, `x-api-key` ou `?token=`. Sem token/token errado → 401.
  O token resolve a unidade sozinho (não depende do domínio).
- Rotas: `GET /ping`, `GET /agenda?from&to` (agendamentos com telefone), `GET /clientes?inativosDias=N`,
  `GET /fila?status=queued`, `POST /fila/{id}` com `{"status":"sent"|"failed"}`.
- Painel: seção **"Acesso do BlipBeauty à agenda"** — gerar token novo (mostrado uma única vez),
  revogar, copiar URL base e lista dos endpoints. Token nunca aparece em página pública.
- `booking.settings` (público) continua filtrando tudo que começa com `blip` e `appBooking`.

**Testado de verdade (09/08):** `/ping`, `/agenda`, `/clientes`, `/fila`, `POST /fila/{id}` com curl
(inclusive 400/401/404); `store.testBlipIntegration` devolvendo o ping real; `store.syncBlipAgenda` →
`{clientes:4, agendamentos:5, falhas:0}`; agendamento criado pelo site apareceu no BlipBeauty como
`externalId bc-9` no horário certo (15:00 BRT = 18:00Z) e virou `canceled` lá ao cancelar no painel
(upsert confirmado). `typecheck`, `konsistent` e `build` OK. Dados de teste removidos do banco local.

**Pendências fora do código:** o BlipBeauty está com `providerReady:false` (Evolution API sem
credencial lá) — nada dispara no WhatsApp até o dono configurar o provedor dentro do app BlipBeauty.
`www.drcglobal.store` ainda aponta para outro host (DNS). Tudo isso só vale no site público **após o
próximo publish**.

## Acessos por usuário (aba Unidades) — 13/08

**Onde fica:** no painel Admin, aba **Unidades** (mesmo lugar do domínio da unidade), card
**"Acesso ao painel"** (`web/components/admin-access-card.tsx`). O dono cadastra o e-mail Google do
convidado e marca as áreas que ele abre. Botões "Marcar todas" / "Limpar" / "Salvar acessos".

**Banco:** `tenant_admins` ganhou `name`, `sections` (CSV) e `can_integrations` (default falso).
`bun run db:push` aplicado.

**Áreas (`api/lib/permissions.ts`):** `agenda | servicos | barbeiros | bloqueios | produtos | pedidos |
mensagens | site | config`, com `SECTION_LABELS`, `DEFAULT_SECTIONS = ["agenda","pedidos"]` e
`parseSections` / `serializeSections` (CSV). Também define as plataformas do pedido de integração
(`blipbeauty | evolution | outra`) e `parseIntegrationRequest`.

**A trava é na API, não na UI.** `middleware/auth.ts` expõe `AdminContext` com `sections` e
`canIntegrations`, o helper `adminSections(...)` (403 "Sua conta não tem acesso a X.") e
`integrationsBase` (403 "Só o dono da conta configura a integração de plataformas de mensagem.").
Bases aplicadas em `admin.ts` (agenda/serviços/barbeiros/bloqueios/config + `catalogRead`),
`store.ts` (produtos/pedidos/mensagens + as 6 procedures Blip atrás de `integrationsBase`) e
`content.ts` (`siteOnly`). Esconder aba é só conveniência: `admin.session` devolve `sections` e
`canIntegrations`, e as abas são filtradas por isso com fallback para a primeira permitida.

**Credencial nunca escapa:** sem `canIntegrations`, `store.messagingConfig` devolve `blipApiUrl:""`,
`blipApiKeyMasked:""`, `blipApiKeySet:false` e `canIntegrations:false`. O direito de integração é
separado das áreas — ter "Configurações" não dá acesso à chave.

**Pedido de integração:** no lugar do card do BlipBeauty, o convidado vê
`web/components/admin-integration-card.tsx` — "Integrar plataforma" com escolha entre BlipBeauty,
Evolution API própria ou outra plataforma, mais observação e e-mail de contato. Salvo em `settings`
na chave `blipIntegrationRequest` (`{platform,note,email,at}`) por `store.requestIntegration`; lido
por `store.integrationRequest`; cancelado por `store.clearIntegrationRequest`. O dono vê o pedido no
card da aba Unidades e resolve com "Liberar integração" (`tenants.setAdminAccess`) ou "Descartar"
(`tenants.clearIntegrationRequest`).

**Senha mestra e super admin continuam com acesso total** (`allSections()`, `canIntegrations:true`).
`tenants.addAdmin` aceita `name`/`sections`/`canIntegrations` e atualiza em vez de duplicar;
`lib/tenant.ts` ganhou `tenantAdminAccess(tenantId, email)` usado no login.

**Testado de verdade (13/08):** RPC em `http://localhost:4200/api/rpc` — `tenants/addAdmin`,
`tenants/setAdminAccess`, `store/requestIntegration`, `tenants/list` com `integrationRequest`; com um
convidado simulado (patch temporário, revertido) `store/products`, `store/orders`, `content/draft` e
`store/blipAccess` devolveram 403 enquanto `admin/agenda` seguiu 200, e `store/messagingConfig` veio
sem URL/máscara. No navegador: card de acessos na aba Unidades e, como convidado, só as abas
permitidas + card "Acesso restrito → Plataforma de mensagens". `bun run typecheck`, `bunx konsistent`
e `bun run build` passando. Dados de teste removidos. Vale no site público **após o próximo publish**.
