// Deploy-compat entrypoint: the platform's release pipeline bundles
// packages/web/src/server.ts as the production server. The real server
// lives in the protected __server.ts (which pm2 runs in the sandbox).
//
// Camada de segurança de transporte (HTTPS). O edge (Cloudflare/fly) aceitava
// requisições em `http://` e devolvia 200, então o Chrome abria o site em texto
// puro e mostrava "A conexão não é segura". Aqui embrulhamos o `fetch` do
// servidor protegido para:
//
//   1. redirecionar 301 qualquer acesso em http:// para https://
//   2. mandar HSTS, para o navegador nunca mais tentar http:// neste domínio
//   3. mandar os cabeçalhos de segurança básicos (nosniff, referrer, CSP de
//      upgrade) em toda resposta
//
// `Bun.serve` é envolvido antes de carregar `./__server` — por isso o import é
// dinâmico (imports estáticos são avaliados antes do corpo do módulo) e o
// arquivo protegido continua intocado.

const HSTS_MAX_AGE = 31_536_000; // 1 ano

/** Protocolo que o cliente realmente usou, segundo o proxy da frente. */
function clientProtocol(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (!forwarded) return null;
  // Pode vir encadeado ("https,http") quando passa por mais de um proxy.
  return forwarded.split(",")[0]!.trim().toLowerCase();
}

/** Host público da requisição (respeita o proxy). */
function publicHost(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  return forwardedHost?.split(",")[0]!.trim() || request.headers.get("host") || new URL(request.url).host;
}

/** Endereço local/interno? (sandbox, healthcheck do orquestrador) */
function isLocalHost(host: string): boolean {
  const name = host.split(":")[0]!.toLowerCase();
  return (
    name === "localhost" ||
    name === "127.0.0.1" ||
    name === "0.0.0.0" ||
    name === "[::1]" ||
    name.endsWith(".local") ||
    name.endsWith(".internal")
  );
}

function securityHeaders(isSecure: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    // Faz o navegador buscar qualquer sub-recurso em https, evitando conteúdo misto.
    "Content-Security-Policy": "upgrade-insecure-requests",
  };
  // HSTS só tem efeito (e só deve ser enviado) sobre https.
  if (isSecure) {
    headers["Strict-Transport-Security"] = `max-age=${HSTS_MAX_AGE}; includeSubDomains; preload`;
  }
  return headers;
}

const originalServe = Bun.serve.bind(Bun) as typeof Bun.serve;

Bun.serve = ((options: Parameters<typeof Bun.serve>[0]) => {
  const config = options as { fetch?: (request: Request, server: unknown) => Response | Promise<Response> };
  const inner = config.fetch;

  // Se o formato mudar (rotas declarativas, por exemplo), não mexemos em nada.
  if (typeof inner !== "function") return originalServe(options);

  return originalServe({
    ...(options as object),
    async fetch(request: Request, server: unknown) {
      const url = new URL(request.url);
      const host = publicHost(request);
      const proto = clientProtocol(request);
      const local = isLocalHost(host);

      // Healthcheck nunca é redirecionado: o orquestrador chama a porta direto
      // e um 301 marcaria a instância como fora do ar.
      const isHealthCheck = url.pathname === "/api/health";

      if (proto === "http" && !local && !isHealthCheck) {
        const target = `https://${host}${url.pathname}${url.search}`;
        return new Response(null, {
          status: 301,
          headers: {
            Location: target,
            // Não deixa proxy/CDN cachear o redirect por host errado.
            Vary: "X-Forwarded-Proto, Host",
            ...securityHeaders(true),
          },
        });
      }

      const response = await inner(request, server);

      // Sem x-forwarded-proto = acesso direto/local: não afirmamos https.
      const isSecure = proto === "https" || (proto === null && url.protocol === "https:");
      const headers = new Headers(response.headers);
      for (const [key, value] of Object.entries(securityHeaders(isSecure && !local))) {
        headers.set(key, value);
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    },
  } as Parameters<typeof Bun.serve>[0]);
}) as typeof Bun.serve;

await import("./__server");
