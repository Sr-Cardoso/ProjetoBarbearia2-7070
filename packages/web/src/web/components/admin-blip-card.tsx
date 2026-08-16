/**
 * Card "Integração BlipBeauty" — aparece em duas abas do painel:
 * Mensagens (junto das mensagens automáticas) e Configurações.
 *
 * Guarda a URL da API e a API key do serviço. A chave é gravada no servidor e
 * **nunca** volta inteira para o navegador: o painel recebe só uma máscara
 * (`••••••••3f9a`). Deixar o campo da chave em branco mantém a chave atual.
 */

import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Plug,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useBlipAccess,
  useGenerateBlipToken,
  useMessagingConfig,
  useRevokeBlipToken,
  useSaveBlipIntegration,
  useTestBlipIntegration,
  useSyncBlipAgenda,
} from "../queries/store";

/** Copia texto funcionando também fora de HTTPS (fallback com textarea). */
async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // cai no fallback abaixo
  }
  try {
    const area = document.createElement("textarea");
    area.value = value;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/** Botão de copiar com confirmação visual. */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await copyText(value);
        setDone(ok);
        setTimeout(() => setDone(false), 1800);
      }}
      className="inline-flex shrink-0 items-center gap-1.5 border border-border px-3 py-2 text-[10px] font-semibold tracking-[0.14em] uppercase transition-colors hover:bg-secondary"
    >
      {done ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
      {done ? "Copiado" : label}
    </button>
  );
}

function isValidUrl(raw: string): boolean {
  const value = raw.trim();
  if (!value) return false;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname.length > 2;
  } catch {
    return false;
  }
}

export function AdminBlipCard() {
  const config = useMessagingConfig();
  const save = useSaveBlipIntegration();
  const test = useTestBlipIntegration();
  const sync = useSyncBlipAgenda();

  const saved = useMemo(
    () => ({
      apiUrl: config.data?.blipApiUrl ?? "",
      keyMasked: config.data?.blipApiKeyMasked ?? "",
      keySet: config.data?.blipApiKeySet ?? false,
      ready: config.data?.blipReady ?? false,
    }),
    [config.data],
  );

  const access = useBlipAccess();
  const generateToken = useGenerateBlipToken();
  const revokeToken = useRevokeBlipToken();
  const [freshToken, setFreshToken] = useState("");

  const [apiUrl, setApiUrl] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  const url = apiUrl ?? saved.apiUrl;
  const urlError = url.trim().length > 0 && !isValidUrl(url);
  const keyError = apiKey.trim().length > 0 && (apiKey.trim().length < 12 || /\s/.test(apiKey.trim()));
  const dirty = url.trim() !== saved.apiUrl.trim() || apiKey.trim().length > 0;

  async function submit(clearKey = false) {
    await save.mutateAsync({ apiUrl: url.trim(), apiKey: apiKey.trim(), clearKey });
    setApiKey("");
    setApiUrl(null);
    setShowKey(false);
  }

  const testResult = test.data;

  return (
    <section className="max-w-2xl bg-card p-6 md:p-8">
      <h2 className="flex items-center gap-2 font-display text-xl">
        <Plug className="size-5 text-primary" /> Integração BlipBeauty
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Cadastre a API do BlipBeauty para ele cuidar dos lembretes e das mensagens de reativação. O
        site manda a agenda e os clientes; quem dispara no WhatsApp é o BlipBeauty. A API key fica
        guardada no servidor e nunca aparece no site nem volta inteira para esta tela.
      </p>

      <div
        className={cn(
          "mt-6 inline-flex items-center gap-2 border px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] uppercase",
          saved.ready
            ? "border-success/40 text-success"
            : "border-border text-muted-foreground",
        )}
      >
        <span
          className={cn("size-2 rounded-full", saved.ready ? "bg-success" : "bg-muted-foreground")}
        />
        {saved.ready ? "Integração pronta" : "Não configurada"}
      </div>

      <div className="mt-6 space-y-5">
        <label className="block">
          <span className="eyebrow mb-2 block text-[10px] text-muted-foreground">
            URL da API do BlipBeauty
          </span>
          <input
            value={url}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="https://seu-blipbeauty.com/api/v1"
            className={cn(
              "w-full border px-4 py-3 text-sm outline-none",
              urlError ? "border-destructive" : "border-input focus:border-primary",
            )}
          />
          <span
            className={cn(
              "mt-2 block text-xs",
              urlError ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {urlError
              ? "Endereço inválido. Use a URL completa, começando com https://"
              : "URL base da API do BlipBeauty (termina em /api/v1). O site chama /ping, /clients e /appointments nela."}
          </span>
        </label>

        <label className="block">
          <span className="eyebrow mb-2 block text-[10px] text-muted-foreground">
            <KeyRound className="mr-1 inline size-3" /> API key do BlipBeauty
          </span>
          <div className="flex items-stretch gap-2">
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              type={showKey ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              placeholder={saved.keySet ? `Chave salva: ${saved.keyMasked}` : "Cole a API key aqui"}
              className={cn(
                "w-full border px-4 py-3 text-sm outline-none",
                keyError ? "border-destructive" : "border-input focus:border-primary",
              )}
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              title={showKey ? "Esconder" : "Mostrar"}
              className="border border-border px-3 text-muted-foreground transition-colors hover:bg-secondary"
            >
              {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <span
            className={cn(
              "mt-2 block text-xs",
              keyError ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {keyError
              ? "A chave precisa ter ao menos 12 caracteres e nenhum espaço."
              : saved.keySet
                ? "Já existe uma chave salva. Deixe em branco para mantê-la ou cole uma nova para substituir."
                : "Ainda não tem a chave? Deixe em branco — nada é disparado automaticamente até você cadastrá-la."}
          </span>
        </label>
      </div>

      {save.error && <p className="mt-4 text-xs text-destructive">{save.error.message}</p>}

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={!dirty || save.isPending || urlError || keyError}
          onClick={() => submit(false)}
          className="inline-flex items-center gap-2 bg-primary px-8 py-3.5 text-[11px] font-semibold tracking-[0.18em] text-white uppercase transition-colors hover:bg-primary-dark disabled:opacity-40"
        >
          {save.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
          Salvar integração
        </button>
        {dirty && (
          <button
            type="button"
            onClick={() => {
              setApiUrl(null);
              setApiKey("");
            }}
            className="text-xs text-muted-foreground underline underline-offset-4"
          >
            Desfazer
          </button>
        )}
        {saved.keySet && (
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => submit(true)}
            className="inline-flex items-center gap-2 text-xs text-destructive underline underline-offset-4 disabled:opacity-40"
          >
            <Trash2 className="size-3" /> Apagar a chave salva
          </button>
        )}
        {!dirty && save.isSuccess && <span className="text-sm text-success">Salvo.</span>}
      </div>

      <div className="mt-8 border-t border-border pt-7">
        <h3 className="font-display text-lg">Conexão e sincronização</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          O teste confere a chave no BlipBeauty. A sincronização manda os clientes e os horários dos
          últimos 6 meses e dos próximos 3 — pode repetir quantas vezes quiser, nada duplica.
        </p>
        <div className="mt-4 flex flex-wrap items-stretch gap-3">
          <button
            type="button"
            disabled={!saved.ready || test.isPending}
            onClick={() => test.mutate({})}
            className="inline-flex items-center gap-2 border border-border px-6 py-3 text-[11px] font-semibold tracking-[0.16em] uppercase transition-colors hover:bg-secondary disabled:opacity-40"
          >
            {test.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plug className="size-4" />
            )}
            Testar conexão
          </button>
          <button
            type="button"
            disabled={!saved.ready || sync.isPending}
            onClick={() => sync.mutate({})}
            className="inline-flex items-center gap-2 border border-primary/50 px-6 py-3 text-[11px] font-semibold tracking-[0.16em] text-primary uppercase transition-colors hover:bg-primary/10 disabled:opacity-40"
          >
            {sync.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Sincronizar agenda agora
          </button>
        </div>
        {test.error && <p className="mt-3 text-xs text-destructive">{test.error.message}</p>}
        {testResult?.ok && (
          <div className="mt-4 border border-success/40 bg-secondary/40 p-4 text-xs">
            <p className="text-sm text-success">Conectado ao BlipBeauty.</p>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              <li>Negócio: {testResult.info?.businessName ?? "—"}</li>
              <li>
                Provedor do WhatsApp: {testResult.info?.providerLabel ?? "—"}{" "}
                {testResult.info?.providerReady ? (
                  <span className="text-success">(pronto)</span>
                ) : (
                  <span className="text-destructive">(sem credencial no BlipBeauty)</span>
                )}
              </li>
              <li>
                Lembrete: {testResult.info?.reminderEnabled ? "ligado" : "desligado"} (
                {testResult.info?.reminderMinutesBefore ?? 60} min antes) · Reativação:{" "}
                {testResult.info?.reactivationEnabled ? "ligada" : "desligada"} (
                {testResult.info?.inactiveDays ?? 30} dias)
              </li>
              {testResult.info?.inQuietHours && (
                <li className="text-warning">
                  Agora está no horário de silêncio do BlipBeauty — nada é disparado até passar.
                </li>
              )}
            </ul>
          </div>
        )}
        {testResult && !testResult.ok && (
          <p className="mt-3 text-xs text-destructive">
            O BlipBeauty recusou a conexão: {testResult.error}
          </p>
        )}
        {sync.error && <p className="mt-3 text-xs text-destructive">{sync.error.message}</p>}
        {sync.data && (
          <p className="mt-3 text-sm text-success">
            Enviados {sync.data.agendamentos} horários de {sync.data.clientes} clientes
            {sync.data.falhas > 0 ? ` · ${sync.data.falhas} falharam (${sync.data.erro ?? ""})` : ""}.
          </p>
        )}
        {!saved.ready && (
          <p className="mt-3 text-xs text-muted-foreground">
            Salve a URL e a API key para liberar o teste e a sincronização.
          </p>
        )}
      </div>

      <div className="mt-8 border-t border-border pt-7">
        <h3 className="flex items-center gap-2 font-display text-lg">
          <ShieldCheck className="size-4 text-primary" /> Acesso do BlipBeauty à agenda
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Gere um token e cole no BlipBeauty. Com ele o app lê a agenda, os telefones dos clientes e
          a fila de mensagens deste site. O token não aparece em nenhuma página pública e pode ser
          revogado a qualquer momento.
        </p>

        <div
          className={cn(
            "mt-5 inline-flex items-center gap-2 border px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] uppercase",
            access.data?.tokenSet
              ? "border-success/40 text-success"
              : "border-border text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "size-2 rounded-full",
              access.data?.tokenSet ? "bg-success" : "bg-muted-foreground",
            )}
          />
          {access.data?.tokenSet ? `Liberado — ${access.data.tokenMasked}` : "Acesso bloqueado"}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button
            type="button"
            disabled={generateToken.isPending}
            onClick={async () => {
              const result = await generateToken.mutateAsync({});
              setFreshToken(result.token);
            }}
            className="inline-flex items-center gap-2 bg-primary px-7 py-3 text-[11px] font-semibold tracking-[0.18em] text-white uppercase transition-colors hover:bg-primary-dark disabled:opacity-40"
          >
            {generateToken.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            {access.data?.tokenSet ? "Gerar token novo" : "Gerar token"}
          </button>
          {access.data?.tokenSet && (
            <button
              type="button"
              disabled={revokeToken.isPending}
              onClick={async () => {
                await revokeToken.mutateAsync({});
                setFreshToken("");
              }}
              className="inline-flex items-center gap-2 text-xs text-destructive underline underline-offset-4 disabled:opacity-40"
            >
              <Trash2 className="size-3" /> Revogar acesso
            </button>
          )}
        </div>

        {freshToken && (
          <div className="mt-5 border border-primary/40 bg-secondary/40 p-4">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">
              Copie agora — o token completo não é mostrado outra vez
            </p>
            <div className="mt-3 flex items-stretch gap-2">
              <code className="min-w-0 flex-1 truncate border border-border bg-background px-3 py-2 text-xs">
                {freshToken}
              </code>
              <CopyButton value={freshToken} label="Copiar token" />
            </div>
          </div>
        )}

        {access.data && (
          <div className="mt-6 space-y-3">
            <div className="flex items-stretch gap-2">
              <code className="min-w-0 flex-1 truncate border border-border bg-secondary/40 px-3 py-2 text-xs">
                {access.data.baseUrl}
              </code>
              <CopyButton value={access.data.baseUrl} label="Copiar URL base" />
            </div>
            <ul className="space-y-2 text-xs text-muted-foreground">
              {access.data.endpoints.map((endpoint) => (
                <li key={endpoint.path} className="flex flex-wrap items-baseline gap-x-2">
                  <code className="text-foreground">{endpoint.path}</code>
                  <span>— {endpoint.desc}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              No BlipBeauty, envie o token no cabeçalho{" "}
              <code className="text-foreground">Authorization: Bearer SEU_TOKEN</code> (também
              aceita <code className="text-foreground">x-api-key</code> ou{" "}
              <code className="text-foreground">?token=</code> na URL).
            </p>
          </div>
        )}
      </div>

      <p className="mt-7 text-xs text-muted-foreground">
        Depois de salvar, escolha <strong>BlipBeauty</strong> como canal das mensagens automáticas na
        aba Mensagens: a partir daí o site espelha cada horário novo lá e não gera fila própria (quem
        lembra e reativa é o BlipBeauty). Sem chave válida o canal volta para manual e as mensagens
        voltam para a fila do painel.
      </p>
    </section>
  );
}
