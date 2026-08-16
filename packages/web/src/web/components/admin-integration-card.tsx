import { useState } from "react";
import { Check, Loader2, Lock, Plug } from "lucide-react";
import {
  INTEGRATION_PLATFORM_LABELS,
  INTEGRATION_PLATFORMS,
  type IntegrationPlatform,
} from "../../api/lib/permissions";
import {
  useClearIntegrationRequest,
  useIntegrationRequest,
  useRequestIntegration,
} from "../queries/store";

/**
 * Cartão que o usuário convidado vê no lugar da integração do BlipBeauty.
 *
 * Ele não recebe URL nem API key — escolhe a plataforma que pretende usar
 * (BlipBeauty, Evolution API própria ou outra) e manda o pedido para o dono, que
 * libera na aba Unidades. Depois de liberado, este cartão dá lugar ao cartão
 * completo de integração.
 */
export function AdminIntegrationCard() {
  const pending = useIntegrationRequest();
  const request = useRequestIntegration();
  const cancel = useClearIntegrationRequest();
  const [platform, setPlatform] = useState<IntegrationPlatform>("blipbeauty");
  const [note, setNote] = useState("");

  const current = pending.data?.request ?? null;

  return (
    <section className="max-w-2xl bg-card p-6 md:p-8">
      <p className="eyebrow flex items-center gap-2 text-[10px] text-muted-foreground">
        <Lock className="size-3.5 text-primary" /> Acesso restrito
      </p>
      <h2 className="mt-2 font-display text-xl">Plataforma de mensagens</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        As credenciais da plataforma (URL e API key) ficam só com o dono da conta. Você pode escolher
        a plataforma e pedir a liberação — o disparo automático passa a valer para toda a barbearia.
      </p>

      {current ? (
        <div className="mt-6 border-l-2 border-primary bg-primary/5 px-4 py-4">
          <p className="eyebrow flex items-center gap-1.5 text-[9px] text-primary">
            <Check className="size-3" /> Pedido enviado
          </p>
          <p className="mt-1.5 text-sm text-foreground">
            {INTEGRATION_PLATFORM_LABELS[current.platform]} — aguardando o dono liberar.
          </p>
          {current.note && (
            <p className="mt-1 text-[13px] text-muted-foreground">“{current.note}”</p>
          )}
          <button
            type="button"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate({}, { onSuccess: () => pending.refetch() })}
            className="mt-4 inline-flex items-center gap-2 border border-border px-4 py-2 text-[10px] font-semibold tracking-[0.14em] uppercase transition-colors hover:bg-secondary disabled:opacity-40"
          >
            {cancel.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Cancelar pedido
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div>
            <p className="eyebrow text-[10px] text-muted-foreground">Plataforma</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {INTEGRATION_PLATFORMS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setPlatform(option)}
                  aria-pressed={platform === option}
                  className={
                    platform === option
                      ? "bg-primary px-4 py-2 text-[10px] font-semibold tracking-[0.14em] text-white uppercase"
                      : "border border-border px-4 py-2 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase hover:bg-secondary"
                  }
                >
                  {INTEGRATION_PLATFORM_LABELS[option]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="eyebrow text-[10px] text-muted-foreground">Observação (opcional)</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Ex.: quero ativar o lembrete de 1h antes para os clientes."
              className="mt-2 w-full border border-input px-4 py-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <button
            type="button"
            disabled={request.isPending}
            onClick={() =>
              request.mutate(
                { platform, note: note.trim() },
                { onSuccess: () => pending.refetch() },
              )
            }
            className="inline-flex items-center gap-2 bg-primary px-6 py-3 text-[11px] font-semibold tracking-[0.16em] text-white uppercase transition-colors hover:bg-primary-dark disabled:opacity-40"
          >
            {request.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plug className="size-4" />
            )}
            Integrar plataforma
          </button>
          {request.error && <p className="text-sm text-destructive">{request.error.message}</p>}
        </div>
      )}
    </section>
  );
}
