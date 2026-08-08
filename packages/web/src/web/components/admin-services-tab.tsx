/**
 * Aba Serviços do painel: cadastro completo com foto, descrição, preço,
 * duração, ordem de exibição e ativação. Tudo o que aparece no site.
 */
import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Scissors, Trash2, X } from "lucide-react";
import { ImageField } from "./image-field";
import { formatPrice } from "../lib/format";
import { useAllServices, useRemoveService, useSaveService } from "../queries/admin";

interface ServiceForm {
  id?: number;
  name: string;
  description: string;
  price: string;
  durationMin: string;
  imageUrl: string;
  active: boolean;
  sortOrder: string;
}

const EMPTY_FORM: ServiceForm = {
  name: "",
  description: "",
  price: "",
  durationMin: "90",
  imageUrl: "",
  active: true,
  sortOrder: "0",
};

/** "39,90" | "39.90" -> 3990 centavos. */
function toCents(raw: string): number {
  const clean = raw.replace(/[^\d,.-]/g, "").replace(",", ".");
  const value = Number.parseFloat(clean);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

function fromCents(cents: number | null | undefined): string {
  return cents && cents > 0 ? (cents / 100).toFixed(2).replace(".", ",") : "";
}

export function AdminServicesTab() {
  const services = useAllServices();
  const save = useSaveService();
  const remove = useRemoveService();

  const [form, setForm] = useState<ServiceForm | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const list = services.data ?? [];

  function patch(values: Partial<ServiceForm>) {
    setForm((current) => (current ? { ...current, ...values } : current));
  }

  function edit(service: (typeof list)[number]) {
    setForm({
      id: service.id,
      name: service.name,
      description: service.description ?? "",
      price: fromCents(service.priceCents),
      durationMin: String(service.durationMin ?? 90),
      imageUrl: service.imageUrl ?? "",
      active: service.active,
      sortOrder: String(service.sortOrder ?? 0),
    });
  }

  /** Salva um serviço existente mantendo os demais campos. */
  function quickSave(service: (typeof list)[number], values: Partial<ServiceForm>) {
    save.mutate({
      id: service.id,
      name: service.name,
      description: service.description ?? "",
      priceCents: service.priceCents,
      durationMin: service.durationMin ?? 90,
      imageUrl: service.imageUrl ?? undefined,
      active: values.active ?? service.active,
      sortOrder:
        values.sortOrder !== undefined ? Number(values.sortOrder) : (service.sortOrder ?? 0),
    });
  }

  async function submit() {
    if (!form) return;
    await save.mutateAsync({
      id: form.id,
      name: form.name.trim(),
      description: form.description.trim(),
      priceCents: toCents(form.price),
      durationMin: Number.parseInt(form.durationMin || "90", 10) || 90,
      imageUrl: form.imageUrl.trim(),
      active: form.active,
      sortOrder: Number.parseInt(form.sortOrder || "0", 10) || 0,
    });
    setForm(null);
  }

  return (
    <div className="space-y-8">
      <section className="bg-card">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <h2 className="font-display text-xl">Serviços</h2>
            <p className="text-sm text-muted-foreground">
              Aparecem na home, na tabela de preços e na tela de agendamento.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setForm({ ...EMPTY_FORM, sortOrder: String(list.length + 1) })}
            className="inline-flex items-center gap-2 bg-primary px-5 py-3 text-[11px] font-semibold tracking-[0.16em] text-white uppercase transition-colors hover:bg-primary-dark"
          >
            <Plus className="size-4" /> Novo serviço
          </button>
        </div>

        {services.isLoading ? (
          <p className="px-6 py-10 text-sm text-muted-foreground">Carregando…</p>
        ) : list.length > 0 ? (
          <ul className="divide-y divide-border">
            {list.map((service, index) => (
              <li key={service.id} className="flex flex-wrap items-center gap-5 px-6 py-4">
                <div className="grid size-16 shrink-0 place-items-center overflow-hidden border border-border bg-surface">
                  {service.imageUrl ? (
                    <img
                      src={service.imageUrl}
                      alt={service.name}
                      className="size-full object-cover"
                    />
                  ) : (
                    <Scissors className="size-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-52 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                    {service.name}
                    {!service.active && (
                      <span className="bg-secondary px-2 py-0.5 text-[9px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                        Inativo
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                    {service.description || "Sem descrição"}
                  </p>
                </div>
                <p className="w-28 shrink-0 font-display text-lg text-primary">
                  {formatPrice(service.priceCents)}
                </p>
                <p className="w-20 shrink-0 text-sm text-muted-foreground">
                  {service.durationMin} min
                </p>
                <div className="flex shrink-0 items-center gap-2">
                  <RowButton
                    onClick={() =>
                      quickSave(service, { sortOrder: String((service.sortOrder ?? 0) - 1) })
                    }
                    disabled={index === 0}
                    title="Subir"
                  >
                    <ArrowUp className="size-3.5" />
                  </RowButton>
                  <RowButton
                    onClick={() =>
                      quickSave(service, { sortOrder: String((service.sortOrder ?? 0) + 1) })
                    }
                    disabled={index === list.length - 1}
                    title="Descer"
                  >
                    <ArrowDown className="size-3.5" />
                  </RowButton>
                  <RowButton onClick={() => quickSave(service, { active: !service.active })}>
                    {service.active ? "Desativar" : "Ativar"}
                  </RowButton>
                  <RowButton onClick={() => edit(service)}>
                    <Pencil className="size-3.5" /> Editar
                  </RowButton>
                  {confirmDelete === service.id ? (
                    <RowButton
                      danger
                      onClick={() => {
                        remove.mutate({ id: service.id });
                        setConfirmDelete(null);
                      }}
                    >
                      <Check className="size-3.5" /> Confirmar
                    </RowButton>
                  ) : (
                    <RowButton danger onClick={() => setConfirmDelete(service.id)}>
                      <Trash2 className="size-3.5" />
                    </RowButton>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-6 py-10 text-sm text-muted-foreground">
            Nenhum serviço cadastrado ainda.
          </p>
        )}
        {remove.error && (
          <p className="border-t border-border px-6 py-4 text-sm text-destructive">
            {remove.error.message}
          </p>
        )}
      </section>

      {form && (
        <div className="fixed inset-0 z-50 grid place-items-start overflow-y-auto bg-black/70 p-4 sm:p-8">
          <div className="mx-auto w-full max-w-2xl bg-card">
            <div className="flex items-center justify-between border-b border-border px-6 py-5">
              <h3 className="font-display text-xl">
                {form.id ? "Editar serviço" : "Novo serviço"}
              </h3>
              <button
                type="button"
                onClick={() => setForm(null)}
                aria-label="Fechar"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-5 px-6 py-6">
              <Field label="Nome" value={form.name} onChange={(v) => patch({ name: v })} />
              <label className="block">
                <span className="eyebrow mb-2 block text-[10px] text-muted-foreground">
                  Descrição
                </span>
                <textarea
                  value={form.description}
                  onChange={(e) => patch({ description: e.target.value })}
                  rows={3}
                  className="w-full border border-input px-4 py-3 text-sm outline-none focus:border-primary"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field
                  label="Preço (R$)"
                  value={form.price}
                  onChange={(v) => patch({ price: v })}
                />
                <Field
                  label="Duração (min)"
                  value={form.durationMin}
                  onChange={(v) => patch({ durationMin: v.replace(/\D/g, "") })}
                />
                <Field
                  label="Ordem"
                  value={form.sortOrder}
                  onChange={(v) => patch({ sortOrder: v.replace(/[^\d-]/g, "") })}
                />
              </div>

              <ImageField
                label="Foto do serviço"
                value={form.imageUrl}
                onChange={(v) => patch({ imageUrl: v })}
                hint="Usada na home e na tela de agendamento."
              />

              <Toggle
                label="Ativo no site"
                checked={form.active}
                onChange={(v) => patch({ active: v })}
              />

              {save.error && <p className="text-sm text-destructive">{save.error.message}</p>}

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={submit}
                  disabled={save.isPending || form.name.trim().length < 2}
                  className="inline-flex items-center gap-2 bg-primary px-6 py-3 text-[11px] font-semibold tracking-[0.18em] text-white uppercase transition-colors hover:bg-primary-dark disabled:opacity-40"
                >
                  <Check className="size-4" /> Salvar serviço
                </button>
                <button
                  type="button"
                  onClick={() => setForm(null)}
                  className="border border-border px-6 py-3 text-[11px] font-semibold tracking-[0.18em] uppercase transition-colors hover:bg-secondary"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RowButton({
  children,
  onClick,
  danger,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={
        "inline-flex items-center gap-1.5 border px-3 py-2 text-[10px] font-semibold tracking-[0.14em] uppercase transition-colors disabled:opacity-30 " +
        (danger
          ? "border-border text-muted-foreground hover:border-destructive hover:text-destructive"
          : "border-border text-muted-foreground hover:border-primary hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="eyebrow mb-2 block text-[10px] text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-input px-4 py-3 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-[var(--primary)]"
      />
      <span className="text-sm text-foreground">{label}</span>
    </label>
  );
}
