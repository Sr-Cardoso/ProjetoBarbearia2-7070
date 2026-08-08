/**
 * Aba Equipe do painel: cadastro completo dos barbeiros com foto, função,
 * bio, ordem de exibição e ativação.
 */
import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, UserRound, X } from "lucide-react";
import { ImageField } from "./image-field";
import { useAllBarbers, useRemoveBarber, useSaveBarber } from "../queries/admin";

interface BarberForm {
  id?: number;
  name: string;
  role: string;
  bio: string;
  photoUrl: string;
  active: boolean;
  sortOrder: string;
}

const EMPTY_FORM: BarberForm = {
  name: "",
  role: "Barbeiro",
  bio: "",
  photoUrl: "",
  active: true,
  sortOrder: "0",
};

export function AdminBarbersTab() {
  const barbers = useAllBarbers();
  const save = useSaveBarber();
  const remove = useRemoveBarber();

  const [form, setForm] = useState<BarberForm | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const list = barbers.data ?? [];

  function patch(values: Partial<BarberForm>) {
    setForm((current) => (current ? { ...current, ...values } : current));
  }

  function edit(barber: (typeof list)[number]) {
    setForm({
      id: barber.id,
      name: barber.name,
      role: barber.role ?? "Barbeiro",
      bio: barber.bio ?? "",
      photoUrl: barber.photoUrl ?? "",
      active: barber.active,
      sortOrder: String(barber.sortOrder ?? 0),
    });
  }

  /** Salva um barbeiro existente mantendo os demais campos. */
  function quickSave(barber: (typeof list)[number], values: Partial<BarberForm>) {
    save.mutate({
      id: barber.id,
      name: barber.name,
      role: barber.role ?? "Barbeiro",
      bio: barber.bio ?? "",
      photoUrl: barber.photoUrl ?? undefined,
      active: values.active ?? barber.active,
      sortOrder:
        values.sortOrder !== undefined ? Number(values.sortOrder) : (barber.sortOrder ?? 0),
    });
  }

  async function submit() {
    if (!form) return;
    await save.mutateAsync({
      id: form.id,
      name: form.name.trim(),
      role: form.role.trim() || "Barbeiro",
      bio: form.bio.trim(),
      photoUrl: form.photoUrl.trim(),
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
            <h2 className="font-display text-xl">Equipe</h2>
            <p className="text-sm text-muted-foreground">
              Fotos e textos aparecem na seção Equipe e na escolha do profissional.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setForm({ ...EMPTY_FORM, sortOrder: String(list.length + 1) })}
            className="inline-flex items-center gap-2 bg-primary px-5 py-3 text-[11px] font-semibold tracking-[0.16em] text-white uppercase transition-colors hover:bg-primary-dark"
          >
            <Plus className="size-4" /> Novo barbeiro
          </button>
        </div>

        {barbers.isLoading ? (
          <p className="px-6 py-10 text-sm text-muted-foreground">Carregando…</p>
        ) : list.length > 0 ? (
          <ul className="divide-y divide-border">
            {list.map((barber, index) => (
              <li key={barber.id} className="flex flex-wrap items-center gap-5 px-6 py-4">
                <div className="grid size-16 shrink-0 place-items-center overflow-hidden border border-border bg-surface">
                  {barber.photoUrl ? (
                    <img
                      src={barber.photoUrl}
                      alt={barber.name}
                      className="size-full object-cover"
                    />
                  ) : (
                    <UserRound className="size-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-52 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                    {barber.name}
                    {!barber.active && (
                      <span className="bg-secondary px-2 py-0.5 text-[9px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                        Inativo
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-sm text-primary">{barber.role}</p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{barber.bio}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <RowButton
                    onClick={() =>
                      quickSave(barber, { sortOrder: String((barber.sortOrder ?? 0) - 1) })
                    }
                    disabled={index === 0}
                    title="Subir"
                  >
                    <ArrowUp className="size-3.5" />
                  </RowButton>
                  <RowButton
                    onClick={() =>
                      quickSave(barber, { sortOrder: String((barber.sortOrder ?? 0) + 1) })
                    }
                    disabled={index === list.length - 1}
                    title="Descer"
                  >
                    <ArrowDown className="size-3.5" />
                  </RowButton>
                  <RowButton onClick={() => quickSave(barber, { active: !barber.active })}>
                    {barber.active ? "Desativar" : "Ativar"}
                  </RowButton>
                  <RowButton onClick={() => edit(barber)}>
                    <Pencil className="size-3.5" /> Editar
                  </RowButton>
                  {confirmDelete === barber.id ? (
                    <RowButton
                      danger
                      onClick={() => {
                        remove.mutate({ id: barber.id });
                        setConfirmDelete(null);
                      }}
                    >
                      <Check className="size-3.5" /> Confirmar
                    </RowButton>
                  ) : (
                    <RowButton danger onClick={() => setConfirmDelete(barber.id)}>
                      <Trash2 className="size-3.5" />
                    </RowButton>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-6 py-10 text-sm text-muted-foreground">Nenhum barbeiro cadastrado.</p>
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
                {form.id ? "Editar barbeiro" : "Novo barbeiro"}
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
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nome" value={form.name} onChange={(v) => patch({ name: v })} />
                <Field label="Função" value={form.role} onChange={(v) => patch({ role: v })} />
              </div>
              <label className="block">
                <span className="eyebrow mb-2 block text-[10px] text-muted-foreground">Bio</span>
                <textarea
                  value={form.bio}
                  onChange={(e) => patch({ bio: e.target.value })}
                  rows={3}
                  className="w-full border border-input px-4 py-3 text-sm outline-none focus:border-primary"
                />
              </label>

              <ImageField
                label="Foto"
                value={form.photoUrl}
                onChange={(v) => patch({ photoUrl: v })}
                hint="Recomendado: foto vertical, rosto centralizado."
              />

              <div className="flex flex-wrap items-center gap-6">
                <Toggle
                  label="Ativo no site"
                  checked={form.active}
                  onChange={(v) => patch({ active: v })}
                />
                <label className="flex items-center gap-3">
                  <span className="eyebrow text-[10px] text-muted-foreground">Ordem</span>
                  <input
                    value={form.sortOrder}
                    onChange={(e) => patch({ sortOrder: e.target.value.replace(/[^\d-]/g, "") })}
                    className="w-16 border border-input px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </label>
              </div>

              {save.error && <p className="text-sm text-destructive">{save.error.message}</p>}

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={submit}
                  disabled={save.isPending || form.name.trim().length < 2}
                  className="inline-flex items-center gap-2 bg-primary px-6 py-3 text-[11px] font-semibold tracking-[0.18em] text-white uppercase transition-colors hover:bg-primary-dark disabled:opacity-40"
                >
                  <Check className="size-4" /> Salvar barbeiro
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
