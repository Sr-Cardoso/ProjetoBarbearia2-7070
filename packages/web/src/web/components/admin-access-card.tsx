import { useState } from "react";
import { BadgeCheck, Check, Loader2, Mail, Plug, Plus, ShieldCheck, X } from "lucide-react";
import {
  INTEGRATION_PLATFORM_LABELS,
  SECTION_LABELS,
  SECTIONS,
  DEFAULT_SECTIONS,
  type IntegrationPlatform,
  type Section,
} from "../../api/lib/permissions";
import {
  useAddTenantAdmin,
  useClearTenantIntegrationRequest,
  useRemoveTenantAdmin,
  useSetAdminAccess,
} from "../queries/admin";

/**
 * Liberação de acesso ao painel por usuário — mesmo lugar em que o domínio da
 * unidade é cadastrado.
 *
 * O dono autoriza um e-mail Google e marca quais abas aquele usuário abre
 * (Agenda, Serviços, Barbeiros, Bloqueios, Produtos, Pedidos, Mensagens, Site,
 * Configurações). A integração de plataforma de mensagens fica de fora dessas
 * abas: é o interruptor separado "Integração de plataforma", desligado por
 * padrão — quem não tem só vê um botão para pedir a liberação.
 */

export type AccessAdmin = {
  id: number;
  email: string;
  name: string;
  superAdmin: boolean;
  sections: Section[];
  canIntegrations: boolean;
};

export type AccessRequest = {
  platform: IntegrationPlatform;
  note: string;
  email: string;
  at: string;
} | null;

export function AdminAccessCard({
  tenantId,
  admins,
  integrationRequest,
}: {
  tenantId: number;
  admins: AccessAdmin[];
  integrationRequest: AccessRequest;
}) {
  const add = useAddTenantAdmin();
  const remove = useRemoveTenantAdmin();
  const setAccess = useSetAdminAccess();
  const clearRequest = useClearTenantIntegrationRequest();
  const [form, setForm] = useState<{
    email: string;
    name: string;
    sections: Section[];
    canIntegrations: boolean;
  }>({ email: "", name: "", sections: [...DEFAULT_SECTIONS], canIntegrations: false });

  const guests = admins.filter((a) => !a.superAdmin);
  const owners = admins.filter((a) => a.superAdmin);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const email = form.email.trim();
    if (!email) return;
    add.mutate(
      {
        tenantId,
        email,
        name: form.name.trim(),
        sections: form.sections,
        canIntegrations: form.canIntegrations,
      },
      {
        onSuccess: () =>
          setForm({
            email: "",
            name: "",
            sections: [...DEFAULT_SECTIONS],
            canIntegrations: false,
          }),
      },
    );
  }

  return (
    <div className="mt-4 border border-border p-4">
      <p className="eyebrow flex items-center gap-2 text-[10px] text-muted-foreground">
        <ShieldCheck className="size-3.5 text-primary" /> Acesso ao painel
      </p>

      {integrationRequest && (
        <div className="mt-3 border-l-2 border-primary bg-primary/5 px-4 py-3">
          <p className="eyebrow flex items-center gap-1.5 text-[9px] text-primary">
            <Plug className="size-3" /> Pedido de integração
          </p>
          <p className="mt-1.5 text-sm text-foreground">
            {integrationRequest.email} quer usar{" "}
            <strong>{INTEGRATION_PLATFORM_LABELS[integrationRequest.platform]}</strong>.
          </p>
          {integrationRequest.note && (
            <p className="mt-1 text-[13px] text-muted-foreground">“{integrationRequest.note}”</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {guests.some((g) => g.email === integrationRequest.email) && (
              <button
                type="button"
                onClick={() => {
                  const guest = guests.find((g) => g.email === integrationRequest.email);
                  if (!guest) return;
                  setAccess.mutate({
                    id: guest.id,
                    sections: guest.sections,
                    canIntegrations: true,
                  });
                }}
                className="inline-flex items-center gap-2 bg-primary px-4 py-2 text-[10px] font-semibold tracking-[0.14em] text-white uppercase hover:bg-primary-dark"
              >
                <Check className="size-3.5" /> Liberar integração
              </button>
            )}
            <button
              type="button"
              onClick={() => clearRequest.mutate({ tenantId })}
              className="inline-flex items-center gap-2 border border-border px-4 py-2 text-[10px] font-semibold tracking-[0.14em] uppercase hover:bg-secondary"
            >
              <X className="size-3.5" /> Descartar
            </button>
          </div>
        </div>
      )}

      {owners.length > 0 && (
        <ul className="mt-3 space-y-2">
          {owners.map((owner) => (
            <li key={owner.id} className="flex flex-wrap items-center gap-3 text-sm">
              <Mail className="size-3.5 text-muted-foreground" />
              <span className="flex-1 text-foreground">{owner.email}</span>
              <span className="inline-flex items-center gap-1 bg-primary/15 px-2 py-1 text-[10px] font-semibold tracking-[0.14em] text-primary uppercase">
                <BadgeCheck className="size-3" /> super · acesso total
              </span>
              <MiniButton danger onClick={() => remove.mutate({ id: owner.id })}>
                <X className="size-3.5" />
              </MiniButton>
            </li>
          ))}
        </ul>
      )}

      {guests.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {guests.map((guest) => (
            <GuestRow
              key={guest.id}
              guest={guest}
              saving={setAccess.isPending}
              onSave={(sections, canIntegrations) =>
                setAccess.mutate({ id: guest.id, sections, canIntegrations })
              }
              onRemove={() => {
                if (confirm(`Remover o acesso de ${guest.email}?`)) remove.mutate({ id: guest.id });
              }}
            />
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Nenhum usuário convidado ainda — só o super admin entra nesta unidade.
        </p>
      )}

      <form onSubmit={submit} className="mt-5 border-t border-border pt-5">
        <p className="eyebrow text-[10px] text-muted-foreground">Liberar novo usuário</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="email@gmail.com"
            className="min-w-56 flex-1 border border-input px-4 py-2.5 text-sm outline-none focus:border-primary"
          />
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nome (opcional)"
            className="min-w-40 flex-1 border border-input px-4 py-2.5 text-sm outline-none focus:border-primary"
          />
        </div>
        <SectionPicker
          sections={form.sections}
          canIntegrations={form.canIntegrations}
          onSections={(sections) => setForm({ ...form, sections })}
          onIntegrations={(canIntegrations) => setForm({ ...form, canIntegrations })}
        />
        <button
          type="submit"
          disabled={add.isPending}
          className="mt-4 inline-flex items-center gap-2 bg-primary px-5 py-2.5 text-[10px] font-semibold tracking-[0.16em] text-white uppercase transition-colors hover:bg-primary-dark disabled:opacity-40"
        >
          {add.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          Liberar acesso
        </button>
        {add.error && <p className="mt-3 text-sm text-destructive">{add.error.message}</p>}
      </form>
      {setAccess.error && <p className="mt-3 text-sm text-destructive">{setAccess.error.message}</p>}
    </div>
  );
}

/** Linha de um convidado: áreas marcáveis e salvamento só quando muda algo. */
function GuestRow({
  guest,
  saving,
  onSave,
  onRemove,
}: {
  guest: AccessAdmin;
  saving: boolean;
  onSave: (sections: Section[], canIntegrations: boolean) => void;
  onRemove: () => void;
}) {
  const [sections, setSections] = useState<Section[]>(guest.sections);
  const [canIntegrations, setCanIntegrations] = useState(guest.canIntegrations);

  const dirty =
    canIntegrations !== guest.canIntegrations ||
    sections.length !== guest.sections.length ||
    sections.some((s) => !guest.sections.includes(s));

  return (
    <li className="border border-border p-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Mail className="size-3.5 text-muted-foreground" />
        <span className="flex-1 text-foreground">
          {guest.name ? `${guest.name} · ` : ""}
          {guest.email}
        </span>
        <span className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
          {sections.length} de {SECTIONS.length} áreas
        </span>
        <MiniButton danger onClick={onRemove}>
          <X className="size-3.5" />
        </MiniButton>
      </div>
      <SectionPicker
        sections={sections}
        canIntegrations={canIntegrations}
        onSections={setSections}
        onIntegrations={setCanIntegrations}
      />
      <button
        type="button"
        disabled={!dirty || saving}
        onClick={() => onSave(sections, canIntegrations)}
        className="mt-3 inline-flex items-center gap-2 border border-border px-4 py-2 text-[10px] font-semibold tracking-[0.14em] uppercase transition-colors hover:bg-secondary disabled:opacity-40"
      >
        {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
        Salvar acessos
      </button>
    </li>
  );
}

/** Grade de áreas + o interruptor da integração de plataforma. */
function SectionPicker({
  sections,
  canIntegrations,
  onSections,
  onIntegrations,
}: {
  sections: Section[];
  canIntegrations: boolean;
  onSections: (sections: Section[]) => void;
  onIntegrations: (value: boolean) => void;
}) {
  function toggle(section: Section) {
    onSections(
      sections.includes(section) ? sections.filter((s) => s !== section) : [...sections, section],
    );
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        {SECTIONS.map((section) => {
          const active = sections.includes(section);
          return (
            <button
              key={section}
              type="button"
              onClick={() => toggle(section)}
              aria-pressed={active}
              className={
                active
                  ? "inline-flex items-center gap-1.5 bg-primary px-3 py-1.5 text-[10px] font-semibold tracking-[0.12em] text-white uppercase"
                  : "inline-flex items-center gap-1.5 border border-border px-3 py-1.5 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase hover:bg-secondary"
              }
            >
              {active && <Check className="size-3" />}
              {SECTION_LABELS[section]}
            </button>
          );
        })}
      </div>
      <label className="mt-3 flex items-center gap-2 text-[13px] text-muted-foreground">
        <input
          type="checkbox"
          checked={canIntegrations}
          onChange={(e) => onIntegrations(e.target.checked)}
          className="size-4 accent-[var(--color-primary)]"
        />
        Pode configurar integração de plataforma (BlipBeauty ou outra) — inclui a API key
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSections([...SECTIONS])}
          className="text-[11px] tracking-[0.12em] text-primary uppercase hover:underline"
        >
          Marcar todas
        </button>
        <span className="text-muted-foreground">·</span>
        <button
          type="button"
          onClick={() => onSections([])}
          className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase hover:underline"
        >
          Limpar
        </button>
      </div>
    </div>
  );
}

function MiniButton({
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
      className={
        danger
          ? "inline-flex items-center gap-2 border border-destructive/40 px-3 py-2 text-[10px] font-semibold tracking-[0.14em] text-destructive uppercase transition-colors hover:bg-destructive/10"
          : "inline-flex items-center gap-2 border border-border px-3 py-2 text-[10px] font-semibold tracking-[0.14em] uppercase transition-colors hover:bg-secondary"
      }
    >
      {children}
    </button>
  );
}
