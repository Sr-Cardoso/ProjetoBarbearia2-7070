import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Lock,
  LogOut,
  Phone,
  Plus,
  Scissors,
  Settings,
  Trash2,
  Users,
  X,
  Building2,
  Mail,
  ShieldCheck,
  LayoutTemplate,
  Package,
  ShoppingBag,
  MessageCircle,
  ShoppingCart,
} from "lucide-react";
import { SiteTab } from "../components/site-tab";
import { AdminProductsTab } from "../components/admin-products-tab";
import { AdminOrdersTab } from "../components/admin-orders-tab";
import { AdminMessagesTab } from "../components/admin-messages-tab";
import { AdminServicesTab } from "../components/admin-services-tab";
import { AdminBarbersTab } from "../components/admin-barbers-tab";
import { useAgendaTotals } from "../queries/store";
import { cn } from "@/lib/utils";
import { setAdminToken } from "../lib/api";
import { authClient } from "../lib/auth";
import {
  useAdminLogin,
  useAdminSession,
  useAdminSettings,
  useAgenda,
  useAllBarbers,
  useBlocks,
  useCreateBlock,
  useRemoveAppointment,
  useRemoveBlock,
  useSaveSettings,
  useSetStatus,
  useUpcoming,
  useTenants,
  useSaveTenant,
  useRemoveTenant,
  useAddTenantAdmin,
  useRemoveTenantAdmin,
} from "../queries/admin";
import { getAdminToken } from "../lib/api";
import {
  SLOT_LABELS,
  STATUS_LABELS,
  formatDateBr,
  formatDateLong,
  formatPrice,
  todayISO,
  toISODate,
} from "../lib/format";

const TABS = [
  { key: "agenda", label: "Agenda", icon: CalendarDays },
  { key: "servicos", label: "Serviços", icon: Scissors },
  { key: "barbeiros", label: "Barbeiros", icon: Users },
  { key: "bloqueios", label: "Bloqueios", icon: Lock },
  { key: "produtos", label: "Produtos", icon: Package },
  { key: "pedidos", label: "Pedidos", icon: ShoppingBag },
  { key: "mensagens", label: "Mensagens", icon: MessageCircle },
  { key: "site", label: "Site", icon: LayoutTemplate },
  { key: "config", label: "Configurações", icon: Settings },
  { key: "unidades", label: "Unidades", icon: Building2 },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-300",
  confirmed: "bg-emerald-500/15 text-emerald-300",
  done: "bg-secondary text-foreground",
  cancelled: "bg-red-500/15 text-red-300",
};

export default function Admin() {
  const [tab, setTab] = useState<TabKey>("agenda");
  const session = useAdminSession();

  if (session.isPending) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const data = session.data;
  if (!data?.ok) {
    return <Login session={data ?? null} onDone={() => session.refetch()} />;
  }

  const visibleTabs = TABS.filter((t) => t.key !== "unidades" || data.superAdmin);

  async function signOut() {
    setAdminToken(null);
    await authClient.signOut().catch(() => {});
    await session.refetch();
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-black text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5 lg:px-8">
          <div className="flex items-center gap-3">
            <img
              src="/images/logo.png"
              alt="Barbearia Cardoso"
              className="size-11 shrink-0 object-contain"
            />
            <div className="leading-tight">
              <p className="font-display text-lg">{data.tenant.name}</p>
              <p className="eyebrow text-[9px] text-white/50">{data.tenant.domain}</p>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <span className="hidden text-[12px] text-white/55 sm:inline">
              {data.via === "password" ? "senha mestra" : data.email}
              {data.superAdmin && " · super admin"}
            </span>
            <Link to="/" className="text-[13px] text-white/70 hover:text-white">
              Ver site
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex items-center gap-2 border border-white/25 px-4 py-2 text-[11px] font-semibold tracking-[0.16em] uppercase transition-colors hover:bg-primary/10"
            >
              <LogOut className="size-3.5" /> Sair
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-5 lg:px-8">
          {visibleTabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 px-4 py-3 text-[11px] font-semibold tracking-[0.16em] uppercase transition-colors",
                tab === t.key
                  ? "bg-surface text-foreground"
                  : "text-white/60 hover:bg-primary/10 hover:text-white",
              )}
            >
              <t.icon className="size-3.5" /> {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10 lg:px-8">
        {tab === "agenda" && <AgendaTab />}
        {tab === "servicos" && <AdminServicesTab />}
        {tab === "barbeiros" && <AdminBarbersTab />}
        {tab === "bloqueios" && <BlocksTab />}
        {tab === "produtos" && <AdminProductsTab />}
        {tab === "pedidos" && <AdminOrdersTab />}
        {tab === "mensagens" && <AdminMessagesTab />}
        {tab === "site" && <SiteTab />}
        {tab === "config" && <SettingsTab />}
        {tab === "unidades" && data.superAdmin && <TenantsTab />}
      </main>
    </div>
  );
}

/* ---------------------------------------------------------------- login */

type SessionData = {
  ok: boolean;
  via: "google" | "password" | null;
  email: string | null;
  superAdmin: boolean;
  tenant: { id: number; name: string; domain: string };
} | null;

function Login({ session, onDone }: { session: SessionData; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googlePending, setGooglePending] = useState(false);
  const login = useAdminLogin();

  async function signInGoogle() {
    setError(null);
    setGooglePending(true);
    const result = await authClient.managedAuth.signIn({ provider: "google" });
    setGooglePending(false);
    if (result.error && result.error.code !== "POPUP_CLOSED") {
      setError(result.error.message ?? "Não foi possível entrar com o Google.");
      return;
    }
    onDone();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    login.mutate(
      { password },
      {
        onSuccess: (res) => {
          setAdminToken(res.token);
          onDone();
        },
        onError: () => setError("Senha incorreta."),
      },
    );
  }

  const notAuthorized = Boolean(session?.email && !session.ok);

  return (
    <div className="hero-gradient noise grid min-h-screen place-items-center px-5">
      <div className="rise d1 w-full max-w-sm bg-card p-8 shadow-[0_30px_70px_-30px_rgba(0,0,0,0.7)]">
        <img
          src="/images/logo.png"
          alt="Barbearia Cardoso"
          className="size-20 object-contain"
        />
        <h1 className="mt-6 font-display text-2xl">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Painel da unidade <strong className="text-foreground">{session?.tenant.name}</strong>
          {session?.tenant.domain ? ` · ${session.tenant.domain}` : ""}.
        </p>

        {notAuthorized && (
          <p className="mt-4 border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            A conta {session?.email} não tem permissão nesta unidade.
          </p>
        )}

        <button
          type="button"
          onClick={signInGoogle}
          disabled={googlePending}
          className="mt-7 inline-flex w-full items-center justify-center gap-3 bg-primary py-3.5 text-[11px] font-semibold tracking-[0.18em] text-white uppercase transition-colors hover:bg-primary-dark disabled:opacity-40"
        >
          {googlePending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          Entrar com Google
        </button>

        {!showPassword ? (
          <button
            type="button"
            onClick={() => setShowPassword(true)}
            className="mt-5 block w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            Entrar com senha mestra
          </button>
        ) : (
          <form onSubmit={submit} className="mt-6 border-t border-border pt-6">
            <label className="block">
              <span className="eyebrow mb-2 block text-[10px] text-muted-foreground">Senha</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                className="w-full border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary"
              />
            </label>
            <button
              type="submit"
              disabled={login.isPending || password.length === 0}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 border border-border py-3 text-[11px] font-semibold tracking-[0.18em] uppercase transition-colors hover:border-primary disabled:opacity-40"
            >
              {login.isPending && <Loader2 className="size-4 animate-spin" />} Entrar
            </button>
          </form>
        )}

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

        <Link
          to="/"
          className="mt-6 block text-center text-xs text-muted-foreground hover:text-foreground"
        >
          Voltar ao site
        </Link>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- agenda */

function AgendaTab() {
  const [date, setDate] = useState(todayISO());
  const agenda = useAgenda(date);
  const totals = useAgendaTotals(date);
  const upcoming = useUpcoming();
  const setStatus = useSetStatus();
  const removeAppointment = useRemoveAppointment();

  function shiftDay(delta: number) {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + delta);
    setDate(toISODate(d));
  }

  const stats = upcoming.data?.stats;

  return (
    <div className="space-y-10">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Hoje" value={stats ? String(stats.today) : "—"} icon={CalendarDays} />
        <Stat label="Pendentes" value={stats ? String(stats.pending) : "—"} icon={Clock} />
        <Stat label="Próximos" value={stats ? String(stats.upcoming) : "—"} icon={BadgeCheck} />
        <Stat
          label="Receita de hoje"
          value={stats ? formatPrice(stats.revenueTodayCents) : "—"}
          icon={Scissors}
        />
      </div>

      <section className="bg-card">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <h2 className="font-display text-xl">Agenda do dia</h2>
            <p className="text-sm text-muted-foreground capitalize">{formatDateLong(date)}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => shiftDay(-1)}
              aria-label="Dia anterior"
              className="grid size-9 place-items-center border border-border transition-colors hover:bg-secondary"
            >
              <ChevronLeft className="size-4" />
            </button>
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="border border-input px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={() => shiftDay(1)}
              aria-label="Próximo dia"
              className="grid size-9 place-items-center border border-border transition-colors hover:bg-secondary"
            >
              <ChevronRight className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setDate(todayISO())}
              className="border border-border px-4 py-2 text-[11px] font-semibold tracking-[0.16em] uppercase transition-colors hover:bg-secondary"
            >
              Hoje
            </button>
          </div>
        </div>

        {agenda.isLoading ? (
          <Spinner />
        ) : agenda.data && agenda.data.length > 0 ? (
          <ul className="divide-y divide-border">
            {agenda.data.map(({ appointment, service, barber }) => (
              <li key={appointment.id} className="flex flex-wrap gap-5 px-6 py-5">
                <div className="w-28 shrink-0">
                  <p className="font-display text-lg">{SLOT_LABELS[appointment.slot]?.slice(0, 5) ?? appointment.slot}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {SLOT_LABELS[appointment.slot] ?? ""}
                  </p>
                </div>
                <div className="min-w-52 flex-1">
                  <p className="font-medium text-foreground">{appointment.customerName}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Phone className="size-3.5" /> {appointment.customerPhone}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {service.name} · {barber.name} · {formatPrice(service.priceCents)}
                  </p>
                  <Comanda
                    servicePriceCents={service.priceCents}
                    entry={totals.data?.[appointment.id]}
                  />
                  {appointment.notes && (
                    <p className="mt-1 text-sm text-muted-foreground italic">
                      “{appointment.notes}”
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  <span
                    className={cn(
                      "px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] uppercase",
                      STATUS_STYLES[appointment.status],
                    )}
                  >
                    {STATUS_LABELS[appointment.status]}
                  </span>
                  {appointment.status !== "confirmed" && appointment.status !== "cancelled" && (
                    <MiniButton
                      onClick={() =>
                        setStatus.mutate({ id: appointment.id, status: "confirmed" })
                      }
                    >
                      <Check className="size-3.5" /> Confirmar
                    </MiniButton>
                  )}
                  {appointment.status !== "done" && appointment.status !== "cancelled" && (
                    <MiniButton
                      onClick={() => setStatus.mutate({ id: appointment.id, status: "done" })}
                    >
                      <BadgeCheck className="size-3.5" /> Concluir
                    </MiniButton>
                  )}
                  {appointment.status !== "cancelled" && (
                    <MiniButton
                      onClick={() =>
                        setStatus.mutate({ id: appointment.id, status: "cancelled" })
                      }
                    >
                      <X className="size-3.5" /> Cancelar
                    </MiniButton>
                  )}
                  <MiniButton
                    danger
                    onClick={() => {
                      if (confirm("Excluir este agendamento?"))
                        removeAppointment.mutate({ id: appointment.id });
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </MiniButton>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Nenhum agendamento nessa data.</Empty>
        )}
      </section>

      <section className="bg-card">
        <div className="border-b border-border px-6 py-5">
          <h2 className="font-display text-xl">Próximos agendamentos</h2>
        </div>
        {upcoming.isLoading ? (
          <Spinner />
        ) : upcoming.data && upcoming.data.rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-left">
                <tr className="eyebrow text-[9px] text-muted-foreground">
                  <th className="px-6 py-3">Data</th>
                  <th className="px-6 py-3">Horário</th>
                  <th className="px-6 py-3">Cliente</th>
                  <th className="px-6 py-3">Serviço</th>
                  <th className="px-6 py-3">Barbeiro</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {upcoming.data.rows.map(({ appointment, service, barber }) => (
                  <tr key={appointment.id}>
                    <td className="px-6 py-3">{formatDateBr(appointment.date)}</td>
                    <td className="px-6 py-3">{SLOT_LABELS[appointment.slot]}</td>
                    <td className="px-6 py-3">{appointment.customerName}</td>
                    <td className="px-6 py-3">{service.name}</td>
                    <td className="px-6 py-3">{barber.name}</td>
                    <td className="px-6 py-3">
                      <span
                        className={cn(
                          "px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] uppercase",
                          STATUS_STYLES[appointment.status],
                        )}
                      >
                        {STATUS_LABELS[appointment.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Sem agendamentos futuros.</Empty>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------ bloqueios */

function BlocksTab() {
  const blocks = useBlocks();
  const barbers = useAllBarbers();
  const create = useCreateBlock();
  const remove = useRemoveBlock();
  const [form, setForm] = useState({ date: todayISO(), slot: "", barberId: "", reason: "" });

  function add(e: React.FormEvent) {
    e.preventDefault();
    create.mutate(
      {
        date: form.date,
        slot: (form.slot || null) as null,
        barberId: form.barberId ? Number(form.barberId) : null,
        reason: form.reason.trim(),
      },
      { onSuccess: () => setForm({ ...form, slot: "", reason: "" }) },
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)]">
      <section className="bg-card">
        <div className="border-b border-border px-6 py-5">
          <h2 className="font-display text-xl">Bloqueios de agenda</h2>
          <p className="text-sm text-muted-foreground">
            Use para férias, folga ou eventos. Horários bloqueados saem do site.
          </p>
        </div>
        {blocks.isLoading ? (
          <Spinner />
        ) : blocks.data && blocks.data.length > 0 ? (
          <ul className="divide-y divide-border">
            {blocks.data.map(({ block, barber }) => (
              <li key={block.id} className="flex flex-wrap items-center gap-4 px-6 py-4">
                <p className="w-28 font-medium">{formatDateBr(block.date)}</p>
                <p className="w-32 text-sm text-muted-foreground">
                  {block.slot ? SLOT_LABELS[block.slot] : "Dia inteiro"}
                </p>
                <p className="min-w-32 flex-1 text-sm text-muted-foreground">
                  {barber ? barber.name : "Todos os barbeiros"}
                  {block.reason ? ` · ${block.reason}` : ""}
                </p>
                <MiniButton danger onClick={() => remove.mutate({ id: block.id })}>
                  <Trash2 className="size-3.5" />
                </MiniButton>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Nenhum bloqueio ativo.</Empty>
        )}
      </section>

      <form onSubmit={add} className="bg-card p-6">
        <h3 className="font-display text-lg">Novo bloqueio</h3>
        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="eyebrow mb-2 block text-[10px] text-muted-foreground">Data</span>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full border border-input px-4 py-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="eyebrow mb-2 block text-[10px] text-muted-foreground">Horário</span>
            <select
              value={form.slot}
              onChange={(e) => setForm({ ...form, slot: e.target.value })}
              className="w-full border border-input bg-card px-4 py-3 text-sm outline-none focus:border-primary"
            >
              <option value="">Dia inteiro</option>
              {Object.entries(SLOT_LABELS).map(([slot, label]) => (
                <option key={slot} value={slot}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="eyebrow mb-2 block text-[10px] text-muted-foreground">Barbeiro</span>
            <select
              value={form.barberId}
              onChange={(e) => setForm({ ...form, barberId: e.target.value })}
              className="w-full border border-input bg-card px-4 py-3 text-sm outline-none focus:border-primary"
            >
              <option value="">Todos</option>
              {barbers.data?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="Motivo"
            value={form.reason}
            onChange={(v) => setForm({ ...form, reason: v })}
          />
        </div>
        <button
          type="submit"
          disabled={create.isPending}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 bg-primary py-3.5 text-[11px] font-semibold tracking-[0.18em] text-white uppercase transition-colors hover:bg-primary-dark disabled:opacity-40"
        >
          <Lock className="size-4" /> Bloquear
        </button>
      </form>
    </div>
  );
}

/* --------------------------------------------------------- configurações */

const SETTING_FIELDS = [
  { key: "whatsapp", label: "WhatsApp (com DDD)" },
  { key: "phone", label: "Telefone exibido" },
  { key: "email", label: "E-mail de contato" },
  { key: "address", label: "Endereço" },
  { key: "mapsUrl", label: "Link do Google Maps (opcional)" },
  { key: "instagram", label: "Instagram (@perfil)" },
  { key: "hours", label: "Horário de funcionamento" },
];

function SettingsTab() {
  const settings = useAdminSettings();
  const save = useSaveSettings();
  const [draft, setDraft] = useState<Record<string, string> | null>(null);

  const values = draft ?? settings.data ?? {};

  return (
    <section className="max-w-2xl bg-card p-6 md:p-8">
      <h2 className="font-display text-xl">Configurações da barbearia</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Esses dados aparecem no site e na mensagem enviada no WhatsApp.
      </p>
      {settings.isLoading ? (
        <Spinner />
      ) : (
        <>
          <div className="mt-7 space-y-4">
            {SETTING_FIELDS.map((f) => (
              <Input
                key={f.key}
                label={f.label}
                value={values[f.key] ?? ""}
                onChange={(v) => setDraft({ ...values, [f.key]: v })}
              />
            ))}
          </div>
          <button
            type="button"
            disabled={save.isPending || !draft}
            onClick={() => draft && save.mutate({ entries: draft }, { onSuccess: () => setDraft(null) })}
            className="mt-7 inline-flex items-center gap-2 bg-primary px-8 py-3.5 text-[11px] font-semibold tracking-[0.18em] text-white uppercase transition-colors hover:bg-primary-dark disabled:opacity-40"
          >
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Salvar
          </button>
          {save.isSuccess && !draft && (
            <span className="ml-4 text-sm text-success">Salvo.</span>
          )}
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------- unidades */

function TenantsTab() {
  const tenants = useTenants();
  const save = useSaveTenant();
  const remove = useRemoveTenant();
  const addAdmin = useAddTenantAdmin();
  const removeAdmin = useRemoveTenantAdmin();
  const [form, setForm] = useState({ domain: "", name: "" });
  const [adminForm, setAdminForm] = useState<Record<number, string>>({});

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.domain.trim() || !form.name.trim()) return;
    save.mutate(
      { domain: form.domain.trim(), name: form.name.trim(), active: true },
      { onSuccess: () => setForm({ domain: "", name: "" }) },
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.85fr)]">
      <section className="bg-card">
        <div className="border-b border-border px-6 py-5">
          <h2 className="font-display text-xl">Unidades</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada domínio tem agenda, serviços e barbeiros próprios.
          </p>
        </div>
        {tenants.isLoading ? (
          <Spinner />
        ) : tenants.data && tenants.data.length > 0 ? (
          <ul className="divide-y divide-border">
            {tenants.data.map((t) => (
              <li key={t.id} className="px-6 py-5">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="min-w-48 flex-1">
                    <p className="flex items-center gap-2 font-medium text-foreground">
                      <Building2 className="size-4 text-primary" />
                      {t.name}
                      {!t.active && (
                        <span className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                          inativa
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{t.domain}</p>
                  </div>
                  <MiniButton
                    onClick={() =>
                      save.mutate({
                        id: t.id,
                        domain: t.domain,
                        name: t.name,
                        active: !t.active,
                      })
                    }
                  >
                    {t.active ? "Desativar" : "Ativar"}
                  </MiniButton>
                  <MiniButton
                    danger
                    onClick={() => {
                      if (confirm(`Remover a unidade ${t.name}?`)) remove.mutate({ id: t.id });
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </MiniButton>
                </div>

                <div className="mt-4 border border-border p-4">
                  <p className="eyebrow flex items-center gap-2 text-[10px] text-muted-foreground">
                    <ShieldCheck className="size-3.5 text-primary" /> Administradores
                  </p>
                  {t.admins.length > 0 ? (
                    <ul className="mt-3 space-y-2">
                      {t.admins.map((a) => (
                        <li key={a.id} className="flex flex-wrap items-center gap-3 text-sm">
                          <Mail className="size-3.5 text-muted-foreground" />
                          <span className="flex-1 text-foreground">{a.email}</span>
                          {a.superAdmin && (
                            <span className="inline-flex items-center gap-1 bg-primary/15 px-2 py-1 text-[10px] font-semibold tracking-[0.14em] text-primary uppercase">
                              <BadgeCheck className="size-3" /> super
                            </span>
                          )}
                          <MiniButton danger onClick={() => removeAdmin.mutate({ id: a.id })}>
                            <X className="size-3.5" />
                          </MiniButton>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Nenhum e-mail autorizado ainda.
                    </p>
                  )}
                  <form
                    className="mt-4 flex flex-wrap gap-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const email = (adminForm[t.id] ?? "").trim();
                      if (!email) return;
                      addAdmin.mutate(
                        { tenantId: t.id, email, superAdmin: false },
                        { onSuccess: () => setAdminForm((prev) => ({ ...prev, [t.id]: "" })) },
                      );
                    }}
                  >
                    <input
                      value={adminForm[t.id] ?? ""}
                      onChange={(e) => setAdminForm((prev) => ({ ...prev, [t.id]: e.target.value }))}
                      placeholder="email@gmail.com"
                      className="min-w-56 flex-1 border border-input px-4 py-2.5 text-sm outline-none focus:border-primary"
                    />
                    <button
                      type="submit"
                      disabled={addAdmin.isPending}
                      className="inline-flex items-center gap-2 bg-primary px-4 py-2.5 text-[10px] font-semibold tracking-[0.16em] text-white uppercase transition-colors hover:bg-primary-dark disabled:opacity-40"
                    >
                      <Plus className="size-3.5" /> Autorizar
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Nenhuma unidade cadastrada.</Empty>
        )}
      </section>

      <form onSubmit={add} className="bg-card p-6">
        <h3 className="font-display text-lg">Nova unidade</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Aponte o domínio para este app e cadastre-o aqui.
        </p>
        <div className="mt-5 space-y-4">
          <Input
            label="Domínio"
            value={form.domain}
            onChange={(v) => setForm({ ...form, domain: v })}
          />
          <Input label="Nome" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        </div>
        <button
          type="submit"
          disabled={save.isPending}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 bg-primary py-3.5 text-[11px] font-semibold tracking-[0.18em] text-white uppercase transition-colors hover:bg-primary-dark disabled:opacity-40"
        >
          <Plus className="size-4" /> Adicionar
        </button>
        {save.error && <p className="mt-3 text-sm text-destructive">{save.error.message}</p>}
      </form>
    </div>
  );
}

/**
 * Comanda do agendamento: produtos comprados na loja somados ao serviço,
 * para o cliente pagar tudo de uma vez no salão.
 */
function Comanda({
  servicePriceCents,
  entry,
}: {
  servicePriceCents: number;
  entry?: {
    productsCents: number;
    orderIds: number[];
    items: { name: string; quantity: number; totalCents: number }[];
  };
}) {
  if (!entry || entry.items.length === 0) return null;

  return (
    <div className="mt-3 border-l-2 border-primary/60 bg-secondary/40 px-4 py-3">
      <p className="eyebrow flex items-center gap-1.5 text-[9px] text-primary">
        <ShoppingCart className="size-3" /> Comanda · pedido
        {entry.orderIds.length > 1 ? "s" : ""} #{entry.orderIds.join(", #")}
      </p>
      <ul className="mt-2 space-y-1">
        {entry.items.map((item, index) => (
          <li key={index} className="flex justify-between gap-4 text-[13px] text-muted-foreground">
            <span>
              {item.quantity}× {item.name}
            </span>
            <span>{formatPrice(item.totalCents)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex justify-between gap-4 border-t border-border pt-2 text-sm">
        <span className="text-muted-foreground">Total a pagar no salão</span>
        <span className="font-display text-base text-foreground">
          {formatPrice(servicePriceCents + entry.productsCents)}
        </span>
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- shared UI */

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Scissors;
}) {
  return (
    <div className="bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="eyebrow text-[10px] text-muted-foreground">{label}</span>
        <Icon className="size-4 text-primary" />
      </div>
      <p className="mt-3 font-display text-3xl text-foreground">{value}</p>
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

function Input({
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

function Spinner() {
  return (
    <p className="flex items-center gap-2 px-6 py-10 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> Carregando…
    </p>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-6 py-10 text-sm text-muted-foreground">{children}</p>;
}
