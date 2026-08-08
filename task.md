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

## Notas
- `oxlint` (parte do `bun run lint`) aborta neste sandbox — `oxc_allocator/src/pool/fixed_size.rs`
  panic também no template intocado, ou seja, é limitação do ambiente e não do código. A checagem de
  convenções (`konsistent`) passa.
- Sem credenciais WhatsApp/Twilio → canal `manual`: mensagem fica na fila com link `wa.me`.
- Toda query filtra `tenantId`. Não editar arquivos `__`.
