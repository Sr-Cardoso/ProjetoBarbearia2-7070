import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Check,
  Loader2,
  MessageCircle,
  RefreshCw,
  RotateCcw,
  Send,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useCancelMessage,
  useMarkMessageSent,
  useMessages,
  useMessagingConfig,
  useRetryMessage,
  useRunMessages,
  useSaveMessagingConfig,
} from "../queries/store";

const KIND_LABELS: Record<string, string> = {
  reminder: "Lembrete 1h antes",
  reactivation: "Reativação",
};

const MSG_STATUS_LABELS: Record<string, string> = {
  queued: "Na fila",
  sent: "Enviada",
  failed: "Falhou",
  cancelled: "Cancelada",
};

const MSG_STATUS_STYLES: Record<string, string> = {
  queued: "bg-amber-500/15 text-amber-300",
  sent: "bg-emerald-500/15 text-emerald-300",
  failed: "bg-red-500/15 text-red-300",
  cancelled: "bg-secondary text-muted-foreground",
};

const PROVIDERS = [
  {
    key: "manual",
    label: "Manual (WhatsApp Web)",
    hint: "A mensagem fica pronta na fila e você envia com um clique.",
  },
  {
    key: "whatsapp",
    label: "WhatsApp Cloud API",
    hint: "Envio automático pela API oficial da Meta.",
  },
  { key: "sms", label: "SMS (Twilio)", hint: "Envio automático por SMS." },
] as const;

type Provider = (typeof PROVIDERS)[number]["key"];

interface ConfigForm {
  provider: Provider;
  reminderEnabled: boolean;
  reminderLeadMinutes: string;
  reactivationEnabled: boolean;
  reactivationDays: string;
  reminderTemplate: string;
  reactivationTemplate: string;
}

/** Aba Mensagens: configuração dos avisos automáticos e fila de envio. */
export function AdminMessagesTab() {
  const config = useMessagingConfig();
  const messages = useMessages();
  const saveConfig = useSaveMessagingConfig();
  const markSent = useMarkMessageSent();
  const cancel = useCancelMessage();
  const retry = useRetryMessage();
  const run = useRunMessages();

  const [form, setForm] = useState<ConfigForm | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const data = config.data;
    if (!data || form) return;
    setForm({
      provider: data.provider,
      reminderEnabled: data.reminderEnabled,
      reminderLeadMinutes: String(data.reminderLeadMinutes),
      reactivationEnabled: data.reactivationEnabled,
      reactivationDays: String(data.reactivationDays),
      reminderTemplate: data.reminderTemplate,
      reactivationTemplate: data.reactivationTemplate,
    });
  }, [config.data, form]);

  function patch(values: Partial<ConfigForm>) {
    setSaved(false);
    setForm((current) => (current ? { ...current, ...values } : current));
  }

  async function submit() {
    if (!form) return;
    await saveConfig.mutateAsync({
      provider: form.provider,
      reminderEnabled: form.reminderEnabled,
      reminderLeadMinutes: Math.min(
        1440,
        Math.max(10, Number.parseInt(form.reminderLeadMinutes || "60", 10) || 60),
      ),
      reactivationEnabled: form.reactivationEnabled,
      reactivationDays: Math.min(
        365,
        Math.max(7, Number.parseInt(form.reactivationDays || "30", 10) || 30),
      ),
      reminderTemplate: form.reminderTemplate.trim(),
      reactivationTemplate: form.reactivationTemplate.trim(),
    });
    setSaved(true);
  }

  const info = config.data;
  const fallback = info && info.provider !== "manual" && info.effectiveChannel === "manual";

  return (
    <div className="space-y-8">
      <section className="bg-card">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <h2 className="font-display text-xl">Mensagens automáticas</h2>
            <p className="text-sm text-muted-foreground">
              Lembrete antes do horário e reativação de quem não aparece há um tempo.
            </p>
          </div>
          <button
            type="button"
            onClick={() => run.mutate({})}
            disabled={run.isPending}
            className="inline-flex items-center gap-2 border border-border px-4 py-2.5 text-[10px] font-semibold tracking-[0.14em] uppercase transition-colors hover:bg-secondary disabled:opacity-40"
          >
            {run.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Rodar agora
          </button>
        </div>

        {run.data && (
          <p className="border-b border-border bg-secondary/40 px-6 py-3 text-sm text-muted-foreground">
            Ciclo concluído: {run.data.reminders} lembrete(s) e {run.data.reactivations} reativação(ões)
            na fila · {run.data.sent} enviada(s) · {run.data.failed} falha(s).
          </p>
        )}

        {!form ? (
          <p className="px-6 py-10 text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <div className="space-y-7 px-6 py-6">
            <div>
              <span className="eyebrow text-[10px] text-muted-foreground">Como enviar</span>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {PROVIDERS.map((provider) => {
                  const ready =
                    provider.key === "manual" ||
                    (provider.key === "whatsapp" ? info?.whatsappReady : info?.smsReady);
                  return (
                    <button
                      key={provider.key}
                      type="button"
                      onClick={() => patch({ provider: provider.key })}
                      className={cn(
                        "border p-4 text-left transition-colors",
                        form.provider === provider.key
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-secondary",
                      )}
                    >
                      <p className="text-sm font-medium text-foreground">{provider.label}</p>
                      <p className="mt-1 text-[12px] text-muted-foreground">{provider.hint}</p>
                      {!ready && (
                        <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-amber-300">
                          <AlertTriangle className="size-3" /> sem credencial no servidor
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
              {fallback && (
                <p className="mt-3 inline-flex items-center gap-2 text-sm text-amber-300">
                  <AlertTriangle className="size-4" />
                  Faltam credenciais para envio automático — por enquanto as mensagens ficam na fila
                  para envio manual.
                </p>
              )}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="border border-border p-5">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.reminderEnabled}
                    onChange={(e) => patch({ reminderEnabled: e.target.checked })}
                    className="size-4 accent-primary"
                  />
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                    <Bell className="size-4 text-primary" /> Lembrete antes do horário
                  </span>
                </label>
                <label className="mt-4 block">
                  <span className="eyebrow mb-2 block text-[10px] text-muted-foreground">
                    Antecedência (minutos)
                  </span>
                  <input
                    value={form.reminderLeadMinutes}
                    onChange={(e) =>
                      patch({ reminderLeadMinutes: e.target.value.replace(/\D/g, "") })
                    }
                    className="w-24 border border-input px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </label>
                <label className="mt-4 block">
                  <span className="eyebrow mb-2 block text-[10px] text-muted-foreground">
                    Texto do lembrete
                  </span>
                  <textarea
                    value={form.reminderTemplate}
                    onChange={(e) => patch({ reminderTemplate: e.target.value })}
                    rows={5}
                    className="w-full border border-input px-4 py-3 text-sm outline-none focus:border-primary"
                  />
                </label>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Marcadores: {"{{cliente}} {{barbearia}} {{horario}} {{data}} {{servico}} {{barbeiro}}"}
                </p>
                {info && (
                  <button
                    type="button"
                    onClick={() => patch({ reminderTemplate: info.defaults.reminderTemplate })}
                    className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="size-3" /> Restaurar texto padrão
                  </button>
                )}
              </div>

              <div className="border border-border p-5">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.reactivationEnabled}
                    onChange={(e) => patch({ reactivationEnabled: e.target.checked })}
                    className="size-4 accent-primary"
                  />
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                    <MessageCircle className="size-4 text-primary" /> Reativar cliente inativo
                  </span>
                </label>
                <label className="mt-4 block">
                  <span className="eyebrow mb-2 block text-[10px] text-muted-foreground">
                    Dias sem agendar
                  </span>
                  <input
                    value={form.reactivationDays}
                    onChange={(e) => patch({ reactivationDays: e.target.value.replace(/\D/g, "") })}
                    className="w-24 border border-input px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </label>
                <label className="mt-4 block">
                  <span className="eyebrow mb-2 block text-[10px] text-muted-foreground">
                    Texto da reativação
                  </span>
                  <textarea
                    value={form.reactivationTemplate}
                    onChange={(e) => patch({ reactivationTemplate: e.target.value })}
                    rows={5}
                    className="w-full border border-input px-4 py-3 text-sm outline-none focus:border-primary"
                  />
                </label>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Marcadores: {"{{cliente}} {{barbearia}} {{dias}} {{horarios}} {{link}}"}
                </p>
                {info && (
                  <button
                    type="button"
                    onClick={() =>
                      patch({ reactivationTemplate: info.defaults.reactivationTemplate })
                    }
                    className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="size-3" /> Restaurar texto padrão
                  </button>
                )}
              </div>
            </div>

            {saveConfig.error && (
              <p className="text-sm text-destructive">{saveConfig.error.message}</p>
            )}

            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={submit}
                disabled={saveConfig.isPending}
                className="inline-flex items-center gap-2 bg-primary px-6 py-3 text-[11px] font-semibold tracking-[0.18em] text-white uppercase transition-colors hover:bg-primary-dark disabled:opacity-40"
              >
                <Check className="size-4" /> Salvar configuração
              </button>
              {saved && <span className="text-sm text-emerald-400">Configuração salva.</span>}
            </div>
          </div>
        )}
      </section>

      <section className="bg-card">
        <div className="border-b border-border px-6 py-5">
          <h2 className="font-display text-xl">Fila de mensagens</h2>
          <p className="text-sm text-muted-foreground">
            As últimas 100 mensagens geradas. No modo manual, clique em “Enviar no WhatsApp”, mande a
            mensagem e marque como enviada.
          </p>
        </div>

        {messages.isLoading ? (
          <p className="px-6 py-10 text-sm text-muted-foreground">Carregando…</p>
        ) : messages.data && messages.data.length > 0 ? (
          <ul className="divide-y divide-border">
            {messages.data.map((message) => (
              <li key={message.id} className="px-6 py-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={cn(
                      "px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] uppercase",
                      MSG_STATUS_STYLES[message.status],
                    )}
                  >
                    {MSG_STATUS_LABELS[message.status] ?? message.status}
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {KIND_LABELS[message.kind] ?? message.kind}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {message.toName || "cliente"} · {message.toPhone}
                  </span>
                  <span className="text-[12px] text-muted-foreground">
                    {new Date(message.scheduledFor).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" · via "}
                    {message.channel}
                  </span>
                </div>

                <p className="mt-3 text-sm whitespace-pre-line text-muted-foreground">
                  {message.body}
                </p>
                {message.error && (
                  <p className="mt-2 text-sm text-destructive">Erro: {message.error}</p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {message.status !== "sent" && (
                    <a
                      href={message.whatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 border border-primary/40 px-3 py-1.5 text-[10px] font-semibold tracking-[0.14em] text-primary uppercase transition-colors hover:bg-primary/10"
                    >
                      <Send className="size-3.5" /> Enviar no WhatsApp
                    </a>
                  )}
                  {message.status !== "sent" && (
                    <QueueButton onClick={() => markSent.mutate({ id: message.id })}>
                      <Check className="size-3.5" /> Marcar enviada
                    </QueueButton>
                  )}
                  {message.status === "failed" && (
                    <QueueButton onClick={() => retry.mutate({ id: message.id })}>
                      <RefreshCw className="size-3.5" /> Tentar de novo
                    </QueueButton>
                  )}
                  {message.status === "queued" && (
                    <QueueButton danger onClick={() => cancel.mutate({ id: message.id })}>
                      <X className="size-3.5" /> Cancelar
                    </QueueButton>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-6 py-10 text-sm text-muted-foreground">
            Nada na fila. Use “Rodar agora” para gerar os lembretes das próximas horas.
          </p>
        )}
      </section>
    </div>
  );
}

function QueueButton({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 border px-3 py-1.5 text-[10px] font-semibold tracking-[0.14em] uppercase transition-colors",
        danger
          ? "border-destructive/30 text-destructive hover:bg-destructive/10"
          : "border-border text-foreground hover:bg-secondary",
      )}
    >
      {children}
    </button>
  );
}
