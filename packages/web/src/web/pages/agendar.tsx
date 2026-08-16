import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  MessageCircle,
  Scissors,
  Smartphone,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { SiteTheme } from "../components/site-theme";
import { useSiteContent } from "../queries/content";
import {
  useAppBooking,
  useAvailability,
  useSchedule,
  useBarbers,
  useCreateBooking,
  useServices,
} from "../queries/booking";
import {
  MONTH_NAMES,
  WEEKDAY_INITIALS,
  buildCalendar,
  formatDateLong,
  formatPrice,
  maskPhone,
} from "../lib/format";

const STEPS = ["Serviço", "Barbeiro", "Data e hora", "Seus dados"];

interface Success {
  service: string;
  barber: string;
  date: string;
  range: string;
  whatsappUrl: string | null;
}

export default function Agendar() {
  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [barberId, setBarberId] = useState<number | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<Success | null>(null);

  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });

  const content = useSiteContent();
  const appBooking = useAppBooking();
  const services = useServices();
  const barbers = useBarbers();
  const availability = useAvailability(step === 2 ? date : null, barberId ?? undefined);
  const schedule = useSchedule();
  const createBooking = useCreateBooking();

  const cells = useMemo(
    () => buildCalendar(cursor.year, cursor.month, schedule.data),
    [cursor, schedule.data],
  );
  const daysLabel = schedule.data?.label ?? "";

  // Redirecionamento para o aplicativo, configurado no painel. "redirect" manda
  // direto; "invite" mostra o convite e deixa continuar no site.
  const app = appBooking.data;
  const [stayOnSite, setStayOnSite] = useState(false);
  const showAppGate = Boolean(app && app.mode !== "off" && app.url) && !stayOnSite;
  const autoRedirect = Boolean(app && app.mode === "redirect" && app.url);

  useEffect(() => {
    if (!autoRedirect || stayOnSite || !app?.url) return;
    window.location.replace(app.url);
  }, [autoRedirect, stayOnSite, app?.url]);
  const hasReleased = cells.some((cell) => cell.released && cell.currentMonth && !cell.disabled);
  const service = services.data?.find((s) => s.id === serviceId);
  const barber = barbers.data?.find((b) => b.id === barberId);

  const canAdvance =
    (step === 0 && serviceId !== null) ||
    (step === 1 && barberId !== null) ||
    (step === 2 && Boolean(date && slot)) ||
    (step === 3 && name.trim().length >= 2 && phone.replace(/\D/g, "").length >= 10);

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  function submit() {
    if (!serviceId || !barberId || !date || !slot) return;
    setError(null);
    createBooking.mutate(
      {
        serviceId,
        barberId,
        date,
        slot: slot as "08:00",
        customerName: name.trim(),
        customerPhone: phone.trim(),
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: (res) => {
          setSuccess({
            service: res.service.name,
            barber: res.barber.name,
            date: res.appointment.date,
            range: res.range,
            whatsappUrl: res.whatsappUrl,
          });
          if (res.whatsappUrl) window.open(res.whatsappUrl, "_blank", "noopener");
        },
        onError: (err: unknown) => {
          const message =
            err instanceof Error ? err.message : "Não foi possível concluir o agendamento.";
          setError(message);
          if (/reservado|bloqueado/i.test(message)) {
            setSlot(null);
            setStep(2);
            availability.refetch();
          }
        },
      },
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-surface">
        <SiteTheme content={content} />
        <SiteHeader />
        <section className="hero-gradient noise px-5 pt-32 pb-24 lg:px-8">
          <div className="mx-auto max-w-2xl text-center text-white">
            <span className="rise d1 mx-auto grid size-16 place-items-center bg-card/15">
              <Check className="size-8" strokeWidth={2.4} />
            </span>
            <h1 className="rise d2 mt-8 font-display text-4xl md:text-5xl">
              Horário reservado
            </h1>
            <p className="rise d3 mt-4 text-white/80">
              {success.service} com {success.barber} — {formatDateLong(success.date)}, {success.range}.
            </p>
            <div className="rise d4 mt-10 bg-card/10 p-7 text-left">
              <p className="text-sm text-white/85">
                Seu horário já está bloqueado na agenda. Envie a confirmação no WhatsApp para
                a barbearia registrar seu atendimento.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                {success.whatsappUrl && (
                  <a
                    href={success.whatsappUrl}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center justify-center gap-2 bg-card px-7 py-3.5 text-[11px] font-semibold tracking-[0.18em] text-foreground uppercase transition-colors hover:bg-primary/90"
                  >
                    <MessageCircle className="size-4" />
                    Confirmar no WhatsApp
                  </a>
                )}
                <Link
                  to="/"
                  className="inline-flex items-center justify-center border border-white/35 px-7 py-3.5 text-[11px] font-semibold tracking-[0.18em] text-white uppercase transition-colors hover:bg-primary/10"
                >
                  Voltar ao início
                </Link>
              </div>
            </div>
          </div>
        </section>
        <SiteFooter />
      </div>
    );
  }

  if (showAppGate && app) {
    return (
      <div className="min-h-screen bg-surface">
        <SiteTheme content={content} />
        <SiteHeader />
        <section className="hero-gradient noise px-5 pt-32 pb-24 lg:px-8">
          <div className="mx-auto max-w-xl text-center text-white">
            <span className="rise d1 mx-auto grid size-16 place-items-center bg-card/15">
              <Smartphone className="size-8" strokeWidth={2} />
            </span>
            <h1 className="rise d2 mt-8 font-display text-4xl md:text-5xl">
              {autoRedirect ? "Abrindo o aplicativo" : app.title}
            </h1>
            <p className="rise d3 mt-4 text-white/80">
              {autoRedirect
                ? "Estamos levando você para o nosso aplicativo para escolher o horário."
                : app.text}
            </p>
            <div className="rise d4 mt-10 flex flex-col items-center gap-4">
              <a
                href={app.url}
                className="inline-flex items-center justify-center gap-2 bg-card px-8 py-4 text-[11px] font-semibold tracking-[0.18em] text-foreground uppercase transition-colors hover:bg-primary hover:text-white"
              >
                <Smartphone className="size-4" />
                {autoRedirect ? "Abrir agora" : "Abrir o aplicativo"}
              </a>
              <button
                type="button"
                onClick={() => setStayOnSite(true)}
                className="text-xs tracking-[0.14em] text-white/70 uppercase underline underline-offset-4 hover:text-white"
              >
                {autoRedirect ? "Não abriu? Agendar aqui no site" : "Prefiro agendar aqui no site"}
              </button>
            </div>
          </div>
        </section>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <SiteTheme content={content} />
      <SiteHeader />

      <section className="hero-gradient noise px-5 pt-28 pb-16 lg:px-8">
        <div className="mx-auto max-w-5xl text-white">
          <span className="eyebrow rise d1 text-white/70">Agendamento online</span>
          <h1 className="rise d2 mt-4 max-w-2xl font-display text-4xl leading-[1.05] md:text-6xl">
            Escolha o serviço e garanta seu horário
          </h1>
          <p className="rise d3 mt-4 max-w-xl text-white/80">
            Atendemos {daysLabel}, das 08:00 às 18:00, em blocos de 1h30. Horários já
            reservados desaparecem da lista automaticamente.
          </p>
        </div>
      </section>

      <section className="px-5 pb-24 lg:px-8">
        <div className="relative z-10 mx-auto -mt-10 max-w-5xl bg-card shadow-[0_24px_60px_-30px_rgba(38,36,58,0.35)]">
          {/* Passos */}
          <div className="grid grid-cols-2 border-b border-border md:grid-cols-4">
            {STEPS.map((label, i) => (
              <button
                key={label}
                type="button"
                onClick={() => i < step && setStep(i)}
                className={cn(
                  "flex items-center gap-3 px-5 py-4 text-left transition-colors",
                  i === step ? "bg-primary text-white" : "text-muted-foreground",
                  i < step && "hover:bg-secondary",
                )}
              >
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center text-[11px] font-semibold",
                    i === step
                      ? "bg-primary text-white"
                      : i < step
                        ? "bg-primary/12 text-primary"
                        : "bg-secondary text-muted-foreground",
                  )}
                >
                  {i < step ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span className="eyebrow text-[10px]">{label}</span>
              </button>
            ))}
          </div>

          <div className="p-6 md:p-10">
            {step === 0 && (
              <div>
                <h2 className="font-display text-2xl">Qual serviço você quer?</h2>
                {services.isLoading && <Loading />}
                <div className="mt-7 grid gap-4 md:grid-cols-2">
                  {services.data?.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setServiceId(s.id);
                        setStep(1);
                      }}
                      className={cn(
                        "group flex gap-4 border p-4 text-left transition-all",
                        serviceId === s.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary",
                      )}
                    >
                      {s.imageUrl && (
                        <img
                          src={s.imageUrl}
                          alt={s.name}
                          className="size-20 shrink-0 object-cover"
                        />
                      )}
                      <span className="min-w-0">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="font-display text-lg text-foreground">{s.name}</span>
                          <span className="font-semibold text-primary">
                            {formatPrice(s.priceCents)}
                          </span>
                        </span>
                        <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                          {s.description}
                        </span>
                        <span className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="size-3.5" /> {s.durationMin} min
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 1 && (
              <div>
                <h2 className="font-display text-2xl">Com quem você quer cortar?</h2>
                {barbers.isLoading && <Loading />}
                <div className="mt-7 grid gap-4 sm:grid-cols-3">
                  {barbers.data?.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        setBarberId(b.id);
                        setStep(2);
                      }}
                      className={cn(
                        "border p-4 text-left transition-all",
                        barberId === b.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary",
                      )}
                    >
                      {b.photoUrl ? (
                        <img
                          src={b.photoUrl}
                          alt={b.name}
                          className="mb-4 aspect-4/5 w-full object-cover"
                        />
                      ) : (
                        <span className="mb-4 grid aspect-4/5 w-full place-items-center bg-secondary">
                          <User className="size-8 text-muted-foreground" />
                        </span>
                      )}
                      <span className="block font-display text-lg text-foreground">{b.name}</span>
                      <span className="eyebrow block text-[10px] text-primary">{b.role}</span>
                      <span className="mt-2 block text-sm leading-relaxed text-muted-foreground">
                        {b.bio}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div>
                  <h2 className="font-display text-2xl">Escolha o dia</h2>
                  <div className="mt-6 border border-border p-4">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => shiftMonth(-1)}
                        aria-label="Mês anterior"
                        className="grid size-8 place-items-center text-foreground transition-colors hover:bg-secondary"
                      >
                        <ChevronLeft className="size-4" />
                      </button>
                      <span className="eyebrow text-[11px] text-foreground">
                        {MONTH_NAMES[cursor.month]} {cursor.year}
                      </span>
                      <button
                        type="button"
                        onClick={() => shiftMonth(1)}
                        aria-label="Próximo mês"
                        className="grid size-8 place-items-center text-foreground transition-colors hover:bg-secondary"
                      >
                        <ChevronRight className="size-4" />
                      </button>
                    </div>

                    <div
                      className={cn(
                        "mt-4 grid grid-cols-7 gap-1 text-center transition-opacity",
                        !schedule.data && "pointer-events-none opacity-40",
                      )}
                    >
                      {WEEKDAY_INITIALS.map((d, i) => (
                        <span
                          key={`${d}-${i}`}
                          className="eyebrow py-1 text-[9px] text-muted-foreground"
                        >
                          {d}
                        </span>
                      ))}
                      {cells.map((cell) => (
                        <button
                          key={cell.iso}
                          type="button"
                          disabled={cell.disabled || !cell.currentMonth}
                          onClick={() => {
                            setDate(cell.iso);
                            setSlot(null);
                          }}
                          className={cn(
                            "aspect-square text-sm transition-colors",
                            !cell.currentMonth && "invisible",
                            cell.disabled
                              ? "cursor-not-allowed text-muted-foreground/35 line-through"
                              : "text-foreground hover:bg-secondary",
                            !cell.disabled &&
                              cell.released &&
                              "font-semibold text-primary underline decoration-dotted underline-offset-4",
                            date === cell.iso && "bg-primary text-white hover:bg-primary",
                          )}
                        >
                          {cell.day}
                        </button>
                      ))}
                    </div>
                    {schedule.data ? (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Atendemos {daysLabel}, 08:00–18:00. Dias riscados estão fechados.
                        {hasReleased && " Datas em destaque são aberturas extras."}
                      </p>
                    ) : schedule.isError ? (
                      <p className="mt-3 flex flex-wrap items-center gap-3 text-xs text-destructive">
                        Não foi possível carregar os dias de atendimento.
                        <button
                          type="button"
                          onClick={() => schedule.refetch()}
                          className="border border-destructive px-3 py-1 text-[10px] font-semibold tracking-[0.14em] uppercase"
                        >
                          Tentar de novo
                        </button>
                      </p>
                    ) : (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Carregando os dias de atendimento…
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <h2 className="font-display text-2xl">Horários livres</h2>
                  {!date && (
                    <p className="mt-6 border border-dashed border-border p-6 text-sm text-muted-foreground">
                      Selecione uma data no calendário para ver os blocos de 1h30 disponíveis.
                    </p>
                  )}
                  {date && availability.isFetching && <Loading />}
                  {date && availability.data && !availability.isFetching && (
                    <>
                      <p className="mt-2 text-sm text-muted-foreground capitalize">
                        {formatDateLong(date)}
                      </p>
                      {availability.data.closed ? (
                        <p className="mt-5 border border-dashed border-border p-6 text-sm text-muted-foreground">
                          {availability.data.reason}
                        </p>
                      ) : (
                        <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                          {availability.data.slots.map((s) => (
                            <button
                              key={s.slot}
                              type="button"
                              disabled={!s.available}
                              onClick={() => setSlot(s.slot)}
                              className={cn(
                                "border px-4 py-3 text-left text-sm transition-all",
                                s.available
                                  ? "border-border text-foreground hover:border-primary"
                                  : "cursor-not-allowed border-border/60 bg-secondary/60 text-muted-foreground",
                                slot === s.slot && "border-primary bg-primary text-white",
                              )}
                            >
                              <span className="block font-semibold">{s.range}</span>
                              <span
                                className={cn(
                                  "text-[11px]",
                                  slot === s.slot ? "text-white/75" : "text-muted-foreground",
                                )}
                              >
                                {s.available ? "Disponível" : s.reason}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <div>
                  <h2 className="font-display text-2xl">Seus dados</h2>
                  <div className="mt-6 space-y-5">
                    <Field label="Nome completo">
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Como devemos te chamar"
                        className="w-full border border-input bg-card px-4 py-3 text-sm outline-none focus:border-primary"
                      />
                    </Field>
                    <Field label="WhatsApp">
                      <input
                        value={phone}
                        onChange={(e) => setPhone(maskPhone(e.target.value))}
                        placeholder="(11) 90000-0000"
                        inputMode="numeric"
                        className="w-full border border-input bg-card px-4 py-3 text-sm outline-none focus:border-primary"
                      />
                    </Field>
                    <Field label="Observações (opcional)">
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        placeholder="Alguma preferência de corte?"
                        className="w-full resize-none border border-input bg-card px-4 py-3 text-sm outline-none focus:border-primary"
                      />
                    </Field>
                  </div>
                </div>

                <aside className="bg-black p-7 text-white">
                  <span className="eyebrow text-[10px] text-white/55">Resumo</span>
                  <dl className="mt-5 space-y-4 text-sm">
                    <Row icon={Scissors} label="Serviço" value={service?.name ?? "-"} />
                    <Row icon={User} label="Barbeiro" value={barber?.name ?? "-"} />
                    <Row
                      icon={CalendarDays}
                      label="Data"
                      value={date ? formatDateLong(date) : "-"}
                    />
                    <Row
                      icon={Clock}
                      label="Horário"
                      value={
                        availability.data?.slots.find((s) => s.slot === slot)?.range ?? slot ?? "-"
                      }
                    />
                  </dl>
                  <div className="mt-6 flex items-baseline justify-between border-t border-white/15 pt-5">
                    <span className="eyebrow text-[10px] text-white/55">Total</span>
                    <span className="font-display text-2xl">
                      {service ? formatPrice(service.priceCents) : "-"}
                    </span>
                  </div>
                  <p className="mt-5 text-xs leading-relaxed text-white/55">
                    Ao confirmar, abrimos o WhatsApp da barbearia com sua mensagem pronta.
                  </p>
                </aside>
              </div>
            )}

            {error && (
              <p className="mt-7 border-l-2 border-destructive bg-destructive/8 px-4 py-3 text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="mt-10 flex items-center justify-between gap-4 border-t border-border pt-7">
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase transition-colors hover:text-white disabled:opacity-40"
              >
                <ArrowLeft className="size-4" />
                Voltar
              </button>

              {step < 3 ? (
                <button
                  type="button"
                  disabled={!canAdvance}
                  onClick={() => setStep((s) => s + 1)}
                  className="inline-flex items-center gap-2 bg-primary px-8 py-3.5 text-[11px] font-semibold tracking-[0.18em] text-white uppercase transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Continuar
                  <ArrowRight className="size-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!canAdvance || createBooking.isPending}
                  onClick={submit}
                  className="inline-flex items-center gap-2 bg-primary px-8 py-3.5 text-[11px] font-semibold tracking-[0.18em] text-white uppercase transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {createBooking.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  Confirmar agendamento
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function Loading() {
  return (
    <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> Carregando…
    </p>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="eyebrow mb-2 block text-[10px] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Scissors;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
      <div className="min-w-0">
        <dt className="text-[11px] text-white/50">{label}</dt>
        <dd className="capitalize">{value}</dd>
      </div>
    </div>
  );
}
