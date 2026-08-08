# Barbearia Cardoso — Design

Sistema da Barbearia Cardoso (web + mobile): agendamento online, **loja de produtos** e
**mensagens automáticas** (lembrete de horário e reativação de cliente inativo). Visual escuro de
barbearia moderna — preto profundo com vermelho de marca, tipografia serifada editorial nos títulos
e sans geométrica no corpo, cantos quase retos.

Trabalho central do produto:

1. O cliente escolhe serviço → barbeiro → dia → horário livre (bloqueio real no banco), confirma e
   dispara a mensagem no WhatsApp.
2. O cliente monta um carrinho na loja e envia o pedido; se tiver horário marcado, os produtos
   entram na **comanda do agendamento** (corte + produtos = total a pagar no salão).
3. O sistema avisa o cliente sozinho: lembrete 1h antes do horário e convite de volta depois de 30
   dias sem agendar.
4. O dono gerencia tudo num painel admin (agenda, serviços, barbeiros, bloqueios, produtos,
   pedidos, mensagens, site e configurações).

## Brand & Colors

- **Web & desktop**: variáveis CSS em `packages/web/src/web/styles.css`.
- **Mobile**: `Colors.light` / `Colors.dark` em `packages/mobile/constants/theme.ts` via `useColors()`.

| Token | Valor | Uso |
|-------|-------|-----|
| primary (vermelho) | #E50914 | Botões principais, preços, destaques, eyebrow |
| primary-dark | #B00610 | Hover dos botões |
| background | #000000 | Fundo de página |
| surface | #141414 | Faixas alternadas, fundo do painel |
| card | #141414 | Cards e superfícies |
| secondary | #1F1F1F | Chips, fundos de apoio |
| foreground | #FFFFFF | Texto principal |
| mutedForeground | #A3A3A3 | Texto secundário |
| border | #2A2A2A | Hairlines, divisórias |
| success | #22C55E | Confirmado / pago |
| warning | #F59E0B | Pendente / sem estoque |
| destructive | #E50914 | Cancelar / erro |

Sem gradientes chamativos: profundidade vem de sobreposição de preto/`#141414`, fotos em preto e
branco e um filete vermelho nos elementos ativos.

## Typography

- **Display**: `"Playfair Display", serif` — títulos de seção, hero, preços. Peso 600/700, tracking apertado.
- **Body/UI**: `"Jost", sans-serif` — parágrafos, labels, botões. 400/500/600, line-height 1.7.
- Eyebrow labels (`.eyebrow`): Jost 600, uppercase, tracking ~0.22em, 10–12px, vermelho.
- Carregadas via Google Fonts no `packages/web/index.html`; no mobile via `useFonts`
  (`@expo-google-fonts/playfair-display` + `jost`).

## Pages & Screens

- **Web — Home** (`src/web/pages/index.tsx`): hero, sobre, serviços (preço/duração do banco),
  galeria, barbeiros, tabela de preços, **vitrine de produtos em destaque**
  (`components/featured-products.tsx`), depoimentos, CTA e footer. Conteúdo editável pelo CMS
  (`api/lib/site-content.ts`).
- **Web — Agendar** (`src/web/pages/agendar.tsx`): fluxo em 4 passos (serviço → barbeiro →
  data+horário → dados) com resumo fixo e tela de sucesso com botão WhatsApp.
- **Web — Loja** (`src/web/pages/loja.tsx`): catálogo com filtro por categoria, foto principal +
  galeria, preço promocional, estoque; carrinho lateral no desktop e gaveta no mobile
  (`lib/cart.ts`, localStorage); checkout com nome + WhatsApp, observação e opção de **somar o
  pedido na comanda** de um horário já marcado; tela de sucesso com link do WhatsApp.
- **Web — Conta** (`src/web/pages/conta.tsx`): agendamentos e pedidos do cliente logado.
- **Web — Admin** (`src/web/pages/admin.tsx`): login por senha mestra ou Google; abas Agenda,
  Serviços, Barbeiros, Bloqueios, **Produtos**, **Pedidos**, **Mensagens**, Site, Configurações e
  Unidades (super admin).
- **Mobile — Início** (`app/(tabs)/index.tsx`): hero, serviços, equipe, horário de funcionamento.
- **Mobile — Agendar** (`app/(tabs)/agendar.tsx`): mesmo fluxo em passos, otimizado para toque.
- **Mobile — Loja** (`app/(tabs)/loja.tsx`): catálogo com filtro, +/- de quantidade, resumo do
  pedido, checkout e vínculo com a comanda de um horário.
- **Mobile — Contato** (`app/(tabs)/contato.tsx`): endereço, horários, botão WhatsApp/ligar.

## Key User Flows

1. **Agendar**: serviço → barbeiro (ou "primeiro disponível") → data no calendário (fds e passado
   desabilitados) → horário livre (ocupados riscados) → nome + WhatsApp → confirma → tela de
   sucesso com botão "Confirmar no WhatsApp" (`wa.me` pré-preenchido).
2. **Comprar na loja**: adiciona produtos ao carrinho → checkout com nome/WhatsApp → opcionalmente
   escolhe o horário marcado para receber os produtos → pedido criado com status `pending`, estoque
   baixado, preço congelado no item → WhatsApp abre com o resumo para combinar o pagamento.
3. **Comanda do horário**: na aba Agenda, cada agendamento mostra os produtos vinculados e o
   **total a pagar no salão** (serviço + produtos), vindo de `store.agendaTotals`.
4. **Admin — produtos**: cadastra nome, descrição, categoria, preço, preço promocional, estoque,
   foto principal + fotos extras, destaque na home, ativo e ordem.
5. **Admin — pedidos**: filtra por status, vê itens e o horário vinculado, confirma, marca como
   pago, cancela/reabre e fala com o cliente no WhatsApp.
6. **Mensagens automáticas**: o worker (`api/lib/messenger.ts`, ciclo de 5 min) gera lembretes 1h
   antes do horário e reativação para quem não agenda há 30 dias (com sugestão de horários livres),
   sempre com chave de deduplicação. Cancelar o agendamento cancela as mensagens pendentes.
7. **Admin — mensagens**: escolhe o canal (manual / WhatsApp Cloud API / SMS Twilio), liga cada
   aviso, ajusta antecedência, dias de inatividade e os textos com marcadores; a fila permite
   "Enviar no WhatsApp" em um clique, marcar como enviada, reenviar, cancelar e "Rodar agora".

## Componentes & padrões

- Cards com cantos 2px–4px (quase retos), borda hairline `--border`, hover elevando 2px.
- Botão primário: vermelho cheio, uppercase, tracking largo (0.18em), raio mínimo.
- Botões de linha no admin: borda hairline, texto 10px uppercase tracking 0.14em; variante
  `danger` em vermelho.
- Badges de status: fundo translúcido da cor + texto claro (pendente âmbar, confirmado verde, pago
  vermelho de marca, cancelado vermelho translúcido).
- Slots de horário: grid 2 colunas (mobile) / 3 (desktop); livre (borda), selecionado (vermelho
  cheio), ocupado (cinza, riscado, desabilitado).
- Comanda: bloco em `secondary/40` com filete vermelho à esquerda, itens em lista e total em
  display.
- Reveal na carga da página: animação `rise` com delays escalonados (`d1`…`d5`).

## Architecture

- **API**: oRPC em `packages/web/src/api/routes/` — `booking.ts`, `admin.ts`, `account.ts`,
  `content.ts`, `shop.ts` (loja pública), `store.ts` (painel da loja + mensagens).
- **Banco**: Drizzle/Turso (SQLite). Tabelas: `tenants`, `services`, `barbers`, `appointments`,
  `blocks`, `settings`, `products`, `orders`, `order_items`, `messages`.
- **Multi-tenant**: toda query filtra `tenantId`, resolvido pelo domínio nos middlewares
  `tenantBase` / `adminBase` / `customerBase` / `withUser` (`api/middleware/auth.ts`).
- **Disponibilidade**: os 6 blocos fixos de 1h30 são gerados no servidor (seg–sex, fuso -03:00);
  ocupado = existe `appointment` (pending/confirmed) ou `block` para aquele barbeiro/data/slot.
- **Loja**: preço cobrado = promocional quando houver; itens do pedido guardam nome e preço
  congelados; estoque é baixado no fechamento do pedido; pagamento é combinado fora do site.
- **Mensagens**: `api/lib/messaging.ts` (config em `settings`, templates com `{{marcadores}}`,
  canais WhatsApp Cloud API / Twilio SMS / manual) + `api/lib/messenger.ts` (worker, fila,
  deduplicação por `dedupeKey` única por unidade). Sem credencial no `.env` o canal cai para
  `manual` e a mensagem fica pronta na fila com link `wa.me`.
- **Admin auth**: token HMAC derivado de `ADMIN_PASSWORD` (`.env` da raiz) no localStorage, ou
  login Google para admins da unidade.
- **State/sync**: TanStack Query + invalidação de `orpc.store.key()` / `orpc.admin.key()` após cada
  mutação; carrinho do site em localStorage.
