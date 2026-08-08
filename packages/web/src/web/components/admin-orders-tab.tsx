import { useMemo, useState } from "react";
import { BadgeCheck, CalendarDays, Check, ShoppingBag, Wallet, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SLOT_LABELS, formatDateBr, formatPrice, waNumber } from "../lib/format";
import { useSetOrderStatus, useStoreOrders } from "../queries/store";

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Aguardando",
  confirmed: "Confirmado",
  paid: "Pago",
  cancelled: "Cancelado",
};

const ORDER_STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-300",
  confirmed: "bg-emerald-500/15 text-emerald-300",
  paid: "bg-primary/15 text-primary",
  cancelled: "bg-red-500/15 text-red-300",
};

const FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "pending", label: "Aguardando" },
  { key: "confirmed", label: "Confirmados" },
  { key: "paid", label: "Pagos" },
  { key: "cancelled", label: "Cancelados" },
] as const;

/** Aba Pedidos: acompanha os pedidos da loja e marca o pagamento. */
export function AdminOrdersTab() {
  const orders = useStoreOrders();
  const setStatus = useSetOrderStatus();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("todos");

  const list = useMemo(() => {
    const all = orders.data ?? [];
    return filter === "todos" ? all : all.filter((order) => order.status === filter);
  }, [orders.data, filter]);

  return (
    <section className="bg-card">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-5">
        <div>
          <h2 className="font-display text-xl">Pedidos da loja</h2>
          <p className="text-sm text-muted-foreground">
            Pagamento combinado no WhatsApp ou feito no salão. Pedidos ligados a um horário entram
            na comanda do agendamento.
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={cn(
                "border px-3 py-1.5 text-[10px] font-semibold tracking-[0.14em] uppercase transition-colors",
                filter === item.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-secondary",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {orders.isLoading ? (
        <p className="px-6 py-10 text-sm text-muted-foreground">Carregando…</p>
      ) : list.length > 0 ? (
        <ul className="divide-y divide-border">
          {list.map((order) => (
            <li key={order.id} className="px-6 py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-52">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                    #{order.id} · {order.customerName}
                    <span
                      className={cn(
                        "px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] uppercase",
                        ORDER_STATUS_STYLES[order.status],
                      )}
                    >
                      {ORDER_STATUS_LABELS[order.status] ?? order.status}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <a
                      href={`https://wa.me/${waNumber(order.customerPhone)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-primary"
                    >
                      {order.customerPhone}
                    </a>
                    {" · "}
                    {order.createdAt
                      ? new Date(order.createdAt).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : ""}
                  </p>
                  {order.appointmentDate && (
                    <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-primary">
                      <CalendarDays className="size-3.5" />
                      Na comanda de {formatDateBr(order.appointmentDate)}
                      {order.appointmentSlot
                        ? ` · ${SLOT_LABELS[order.appointmentSlot] ?? order.appointmentSlot}`
                        : ""}
                    </p>
                  )}
                  {order.notes && (
                    <p className="mt-1 text-sm text-muted-foreground italic">“{order.notes}”</p>
                  )}
                </div>

                <div className="text-right">
                  <p className="font-display text-2xl">{formatPrice(order.totalCents)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {order.items.length} {order.items.length === 1 ? "item" : "itens"}
                  </p>
                </div>
              </div>

              <ul className="mt-4 space-y-1 border-l-2 border-border pl-4">
                {order.items.map((item) => (
                  <li key={item.id} className="flex justify-between text-sm text-muted-foreground">
                    <span>
                      {item.quantity}× {item.name}
                    </span>
                    <span>{formatPrice(item.unitPriceCents * item.quantity)}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex flex-wrap gap-2">
                {order.status === "pending" && (
                  <ActionButton
                    onClick={() => setStatus.mutate({ id: order.id, status: "confirmed" })}
                  >
                    <Check className="size-3.5" /> Confirmar
                  </ActionButton>
                )}
                {order.status !== "paid" && order.status !== "cancelled" && (
                  <ActionButton onClick={() => setStatus.mutate({ id: order.id, status: "paid" })}>
                    <Wallet className="size-3.5" /> Marcar como pago
                  </ActionButton>
                )}
                {order.status !== "cancelled" && (
                  <ActionButton
                    danger
                    onClick={() => setStatus.mutate({ id: order.id, status: "cancelled" })}
                  >
                    <X className="size-3.5" /> Cancelar
                  </ActionButton>
                )}
                {order.status === "cancelled" && (
                  <ActionButton
                    onClick={() => setStatus.mutate({ id: order.id, status: "pending" })}
                  >
                    <BadgeCheck className="size-3.5" /> Reabrir
                  </ActionButton>
                )}
                <a
                  href={`https://wa.me/${waNumber(order.customerPhone)}?text=${encodeURIComponent(
                    `Olá ${order.customerName}! Sobre o seu pedido #${order.id} na Barbearia Cardoso (${formatPrice(order.totalCents)}).`,
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 border border-border px-3 py-1.5 text-[10px] font-semibold tracking-[0.14em] uppercase transition-colors hover:bg-secondary"
                >
                  <ShoppingBag className="size-3.5" /> Falar no WhatsApp
                </a>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-6 py-10 text-sm text-muted-foreground">Nenhum pedido por aqui ainda.</p>
      )}
    </section>
  );
}

function ActionButton({
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
