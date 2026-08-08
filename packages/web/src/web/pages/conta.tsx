import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock,
  Loader2,
  LogOut,
  Scissors,
  User as UserIcon,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { SiteTheme } from "../components/site-theme";
import { useSiteContent } from "../queries/content";
import { authClient } from "../lib/auth";
import { client } from "../lib/api";
import { formatDateLong, formatPrice, maskPhone } from "../lib/format";
import {
  useAccount,
  useCancelAppointment,
  useMyAppointments,
  useSession,
  useUpdateProfile,
} from "../queries/account";

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando confirmação",
  confirmed: "Confirmado",
  done: "Concluído",
  cancelled: "Cancelado",
};

const STATUS_STYLE: Record<string, string> = {
  pending: "border-amber-400/40 text-amber-300",
  confirmed: "border-emerald-400/40 text-emerald-300",
  done: "border-white/20 text-white/60",
  cancelled: "border-primary/40 text-primary",
};

export default function Conta() {
  const content = useSiteContent();
  const [, navigate] = useLocation();
  const { data: session, isPending } = useSession();
  const signedIn = Boolean(session);

  const account = useAccount(signedIn);
  const appointments = useMyAppointments(signedIn);
  const updateProfile = useUpdateProfile();
  const cancel = useCancelAppointment();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isPending && !session) navigate("/entrar?next=/conta", { replace: true });
  }, [session, isPending, navigate]);

  useEffect(() => {
    if (!account.data) return;
    setName(account.data.name ?? "");
    setPhone(account.data.phone ? maskPhone(account.data.phone.replace(/^\+55/, "")) : "");
    setImage(account.data.image ?? null);
  }, [account.data]);

  async function pickPhoto(file: File) {
    setError(null);
    setUploading(true);
    try {
      const { url, publicUrl } = await client.upload.presignAvatar({
        filename: file.name,
        contentType: file.type || "image/jpeg",
      });
      const res = await fetch(url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "image/jpeg" },
      });
      if (!res.ok) throw new Error(`upload falhou (${res.status})`);
      setImage(publicUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível enviar a foto.");
    } finally {
      setUploading(false);
    }
  }

  function save() {
    setError(null);
    setSaved(false);
    updateProfile.mutate(
      { name: name.trim(), phone: phone.trim() || undefined, image },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
        },
        onError: (e) => setError(e.message),
      },
    );
  }

  async function signOut() {
    await authClient.signOut();
    navigate("/", { replace: true });
  }

  if (isPending || !session) {
    return (
      <div className="grid min-h-screen place-items-center bg-black">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const rows = appointments.data ?? [];
  const upcoming = rows.filter((r) => r.status === "pending" || r.status === "confirmed");
  const past = rows.filter((r) => r.status === "done" || r.status === "cancelled");

  return (
    <>
      <SiteTheme content={content} />
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />

        <main className="mx-auto max-w-5xl px-5 pt-32 pb-24 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow text-[10px] text-primary">Minha conta</p>
              <h1 className="mt-3 font-display text-4xl font-semibold text-white">
                Olá, {(account.data?.name ?? session.user.name ?? "cliente").split(" ")[0]}
              </h1>
            </div>
            <div className="flex gap-3">
              <Link
                to="/agendar"
                className="bg-primary px-6 py-3 text-[11px] font-semibold tracking-[0.18em] text-white uppercase hover:bg-primary-dark"
              >
                Novo agendamento
              </Link>
              <button
                type="button"
                onClick={signOut}
                className="flex items-center gap-2 border border-white/15 px-5 py-3 text-[11px] font-semibold tracking-[0.18em] text-white/70 uppercase hover:border-primary hover:text-primary"
              >
                <LogOut className="size-4" /> Sair
              </button>
            </div>
          </div>

          {error && (
            <p className="mt-8 border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-white">
              {error}
            </p>
          )}

          <div className="mt-12 grid gap-12 lg:grid-cols-[320px_1fr]">
            {/* Perfil */}
            <section className="border border-white/10 bg-surface p-7">
              <h2 className="font-display text-lg font-semibold text-white">Seu perfil</h2>

              <div className="mt-6 flex items-center gap-5">
                <div className="relative">
                  {image ? (
                    <img
                      src={image}
                      alt={name}
                      className="size-20 rounded-full object-cover ring-2 ring-primary/50"
                    />
                  ) : (
                    <div className="grid size-20 place-items-center rounded-full bg-white/5 ring-2 ring-white/10">
                      <UserIcon className="size-8 text-white/40" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="absolute -right-1 -bottom-1 grid size-8 place-items-center rounded-full bg-primary text-white hover:bg-primary-dark"
                    aria-label="Trocar foto"
                  >
                    {uploading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Camera className="size-4" />
                    )}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void pickPhoto(file);
                      e.target.value = "";
                    }}
                  />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm text-white/80">{account.data?.email}</p>
                  {image && (
                    <button
                      type="button"
                      onClick={() => setImage(null)}
                      className="mt-1 text-xs text-white/40 hover:text-primary"
                    >
                      Remover foto
                    </button>
                  )}
                </div>
              </div>

              <label className="mt-7 block">
                <span className="eyebrow mb-2 block text-[10px] text-white/50">Nome</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-white/15 bg-black/40 px-4 py-3 text-white outline-none focus:border-primary"
                />
              </label>

              <label className="mt-5 block">
                <span className="eyebrow mb-2 block text-[10px] text-white/50">WhatsApp</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(maskPhone(e.target.value))}
                  inputMode="tel"
                  placeholder="(11) 98852-5471"
                  className="w-full border border-white/15 bg-black/40 px-4 py-3 text-white outline-none focus:border-primary"
                />
              </label>

              <button
                type="button"
                onClick={save}
                disabled={updateProfile.isPending || name.trim().length < 2}
                className="mt-7 flex w-full items-center justify-center gap-2 bg-primary px-6 py-3.5 text-[11px] font-semibold tracking-[0.18em] text-white uppercase hover:bg-primary-dark disabled:opacity-60"
              >
                {updateProfile.isPending && <Loader2 className="size-4 animate-spin" />}
                {saved ? "Salvo!" : "Salvar alterações"}
              </button>
            </section>

            {/* Agendamentos */}
            <section>
              <h2 className="font-display text-lg font-semibold text-white">
                Próximos agendamentos
              </h2>

              {appointments.isLoading && (
                <p className="mt-5 text-sm text-white/50">Carregando...</p>
              )}

              {!appointments.isLoading && upcoming.length === 0 && (
                <div className="mt-5 border border-dashed border-white/15 p-8 text-center">
                  <CalendarDays className="mx-auto size-7 text-white/25" />
                  <p className="mt-3 text-sm text-white/50">Você não tem horários marcados.</p>
                  <Link to="/agendar" className="mt-3 inline-block text-sm text-primary hover:underline">
                    Agendar agora
                  </Link>
                </div>
              )}

              <div className="mt-5 space-y-4">
                {upcoming.map((row) => (
                  <article
                    key={row.id}
                    className="border border-white/10 bg-surface p-6 transition-colors hover:border-primary/40"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="font-display text-lg font-semibold text-white">
                          {row.serviceName}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/60">
                          <span className="flex items-center gap-1.5">
                            <Scissors className="size-3.5" /> {row.barberName}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <CalendarDays className="size-3.5" /> {formatDateLong(row.date)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Clock className="size-3.5" /> {row.range}
                          </span>
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={cn(
                            "inline-block border px-3 py-1 text-[10px] tracking-[0.15em] uppercase",
                            STATUS_STYLE[row.status] ?? "border-white/20 text-white/60",
                          )}
                        >
                          {STATUS_LABEL[row.status] ?? row.status}
                        </span>
                        <p className="mt-2 text-sm text-white/70">
                          {formatPrice(row.servicePrice)}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => cancel.mutate({ id: row.id })}
                      disabled={cancel.isPending}
                      className="mt-5 flex items-center gap-2 text-xs text-white/45 hover:text-primary"
                    >
                      <X className="size-3.5" /> Cancelar agendamento
                    </button>
                  </article>
                ))}
              </div>

              {past.length > 0 && (
                <>
                  <h2 className="mt-14 font-display text-lg font-semibold text-white">Histórico</h2>
                  <div className="mt-5 divide-y divide-white/10 border border-white/10">
                    {past.map((row) => (
                      <div
                        key={row.id}
                        className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                      >
                        <div>
                          <p className="text-sm font-medium text-white/85">{row.serviceName}</p>
                          <p className="text-xs text-white/45">
                            {formatDateLong(row.date)} · {row.range} · {row.barberName}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "flex items-center gap-1.5 text-[11px] tracking-[0.12em] uppercase",
                            row.status === "done" ? "text-emerald-300/80" : "text-primary/80",
                          )}
                        >
                          {row.status === "done" && <CheckCircle2 className="size-3.5" />}
                          {STATUS_LABEL[row.status]}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          </div>
        </main>

        <SiteFooter />
      </div>
    </>
  );
}
