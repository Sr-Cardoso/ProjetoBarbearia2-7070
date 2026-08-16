/**
 * Painel → Configurações → "Agendamento pelo aplicativo".
 *
 * Guarda o link do app, escolhe o que a página de agendamento faz com ele e
 * gera o QR Code para cartaz/Instagram. Nada disso aparece na home do site: o
 * link é usado apenas como destino do agendamento, e o QR só existe aqui.
 */

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Download, ExternalLink, Loader2, QrCode, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminSettings, useSaveSettings } from "../queries/admin";

type Mode = "off" | "invite" | "redirect";

const MODES: { value: Mode; label: string; hint: string }[] = [
  {
    value: "off",
    label: "Desligado",
    hint: "O cliente agenda no próprio site. O link fica salvo aqui para você usar no QR Code, no Instagram ou no WhatsApp.",
  },
  {
    value: "invite",
    label: "Convidar para o app",
    hint: "A página de agendamento mostra primeiro o convite para abrir o aplicativo, com a opção de continuar agendando no site.",
  },
  {
    value: "redirect",
    label: "Enviar direto para o app",
    hint: "Todo botão “Agendar” do site abre o aplicativo. Use quando quiser concentrar os horários só no app.",
  },
];

const DEFAULT_TITLE = "Agende pelo nosso aplicativo";
const DEFAULT_TEXT =
  "É mais rápido: seus dados ficam salvos e você acompanha seus horários pelo celular.";

function isValidAppUrl(raw: string): boolean {
  const value = raw.trim();
  if (value.length === 0) return false;
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") return Boolean(url.hostname);
    return /^[a-z][a-z0-9+.-]*:$/i.test(url.protocol);
  } catch {
    return false;
  }
}

export function AdminAppLinkCard() {
  const settings = useAdminSettings();
  const save = useSaveSettings();

  const saved = useMemo(
    () => ({
      url: settings.data?.appBookingUrl ?? "",
      mode: (settings.data?.appBookingMode as Mode | undefined) ?? "off",
      title: settings.data?.appBookingTitle ?? "",
      text: settings.data?.appBookingText ?? "",
    }),
    [settings.data],
  );

  const [draft, setDraft] = useState<typeof saved | null>(null);
  const current = draft ?? saved;
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(saved);

  const urlOk = isValidAppUrl(current.url);
  const urlError = current.url.trim().length > 0 && !urlOk;

  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // QR sempre a partir do link já salvo — é ele que o cliente vai abrir.
  useEffect(() => {
    const url = saved.url.trim();
    if (!isValidAppUrl(url)) {
      setQr(null);
      return;
    }
    let alive = true;
    QRCode.toDataURL(url, {
      width: 640,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#111111", light: "#FFFFFF" },
    })
      .then((data) => {
        if (alive) setQr(data);
      })
      .catch(() => {
        if (alive) setQr(null);
      });
    return () => {
      alive = false;
    };
  }, [saved.url]);

  function patch(next: Partial<typeof saved>) {
    setDraft({ ...current, ...next });
  }

  function submit() {
    if (!draft) return;
    save.mutate(
      {
        entries: {
          appBookingUrl: draft.url.trim(),
          appBookingMode: draft.url.trim() ? draft.mode : "off",
          appBookingTitle: draft.title.trim(),
          appBookingText: draft.text.trim(),
        },
      },
      { onSuccess: () => setDraft(null) },
    );
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(saved.url.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="max-w-2xl bg-card p-6 md:p-8">
      <h2 className="flex items-center gap-2 font-display text-xl">
        <Smartphone className="size-5 text-primary" /> Agendamento pelo aplicativo
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Aponte o agendamento para o seu app. O link e o QR Code ficam só neste painel — a home do
        site não mostra nenhum dos dois.
      </p>

      <div className="mt-7 space-y-5">
        <label className="block">
          <span className="eyebrow mb-2 block text-[10px] text-muted-foreground">
            Link do aplicativo
          </span>
          <input
            value={current.url}
            onChange={(e) => patch({ url: e.target.value })}
            placeholder="https://… (link da loja, link universal ou deep link)"
            className={cn(
              "w-full border px-4 py-3 text-sm outline-none",
              urlError ? "border-destructive" : "border-input focus:border-primary",
            )}
          />
          {urlError ? (
            <span className="mt-2 block text-xs text-destructive">
              Endereço inválido. Use algo como https://play.google.com/store/apps/… ou
              barbearia://agenda
            </span>
          ) : (
            <span className="mt-2 block text-xs text-muted-foreground">
              Ainda não tem o link? Deixe em branco agora e preencha quando o app estiver publicado —
              o redirecionamento fica desligado até lá.
            </span>
          )}
        </label>

        <div>
          <span className="eyebrow mb-2 block text-[10px] text-muted-foreground">
            O que o site faz com o agendamento
          </span>
          <div className="flex flex-wrap gap-2">
            {MODES.map((option) => {
              const on = current.mode === option.value;
              const blocked = option.value !== "off" && !urlOk;
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={blocked}
                  onClick={() => patch({ mode: option.value })}
                  className={cn(
                    "border px-4 py-2.5 text-[11px] font-semibold tracking-[0.14em] uppercase transition-colors",
                    on
                      ? "border-primary bg-primary text-white"
                      : "border-border text-muted-foreground hover:bg-secondary",
                    blocked && "cursor-not-allowed opacity-40 hover:bg-transparent",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {MODES.find((m) => m.value === current.mode)?.hint}
          </p>
        </div>

        {current.mode === "invite" && (
          <div className="space-y-4 border border-dashed border-border p-4">
            <label className="block">
              <span className="eyebrow mb-2 block text-[10px] text-muted-foreground">
                Título do convite
              </span>
              <input
                value={current.title}
                onChange={(e) => patch({ title: e.target.value })}
                placeholder={DEFAULT_TITLE}
                className="w-full border border-input px-4 py-3 text-sm outline-none focus:border-primary"
              />
            </label>
            <label className="block">
              <span className="eyebrow mb-2 block text-[10px] text-muted-foreground">
                Texto do convite
              </span>
              <textarea
                value={current.text}
                onChange={(e) => patch({ text: e.target.value })}
                placeholder={DEFAULT_TEXT}
                rows={3}
                className="w-full resize-y border border-input px-4 py-3 text-sm outline-none focus:border-primary"
              />
            </label>
          </div>
        )}
      </div>

      {save.error && <p className="mt-4 text-xs text-destructive">{save.error.message}</p>}

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={!dirty || save.isPending || urlError}
          onClick={submit}
          className="inline-flex items-center gap-2 bg-primary px-8 py-3.5 text-[11px] font-semibold tracking-[0.18em] text-white uppercase transition-colors hover:bg-primary-dark disabled:opacity-40"
        >
          {save.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
          Salvar
        </button>
        {dirty && (
          <button
            type="button"
            onClick={() => setDraft(null)}
            className="text-xs text-muted-foreground underline underline-offset-4"
          >
            Desfazer
          </button>
        )}
        {!dirty && save.isSuccess && <span className="text-sm text-success">Salvo.</span>}
      </div>

      <div className="mt-8 border-t border-border pt-7">
        <h3 className="flex items-center gap-2 font-display text-lg">
          <QrCode className="size-4 text-primary" /> QR Code do agendamento
        </h3>
        {qr ? (
          <div className="mt-5 flex flex-wrap items-start gap-6">
            <img
              src={qr}
              alt="QR Code com o link do aplicativo"
              className="size-40 border border-border bg-white p-2"
            />
            <div className="flex-1 space-y-3">
              <p className="text-sm break-all text-muted-foreground">{saved.url}</p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={qr}
                  download="qrcode-agendamento.png"
                  className="inline-flex items-center gap-2 border border-border px-4 py-2.5 text-[10px] font-semibold tracking-[0.14em] uppercase transition-colors hover:bg-secondary"
                >
                  <Download className="size-3.5" /> Baixar PNG
                </a>
                <button
                  type="button"
                  onClick={copyLink}
                  className="inline-flex items-center gap-2 border border-border px-4 py-2.5 text-[10px] font-semibold tracking-[0.14em] uppercase transition-colors hover:bg-secondary"
                >
                  {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                  {copied ? "Copiado" : "Copiar link"}
                </button>
                <a
                  href={saved.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 border border-border px-4 py-2.5 text-[10px] font-semibold tracking-[0.14em] uppercase transition-colors hover:bg-secondary"
                >
                  <ExternalLink className="size-3.5" /> Testar link
                </a>
              </div>
              <p className="text-xs text-muted-foreground">
                O QR usa o link salvo. Se você mudar o link, salve para gerar um novo — o antigo para
                de valer.
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-5 border border-dashed border-border p-6 text-sm text-muted-foreground">
            Salve um link válido para gerar o QR Code.
          </p>
        )}
      </div>
    </section>
  );
}
