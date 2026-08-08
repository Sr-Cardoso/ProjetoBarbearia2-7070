import { useState } from "react";
import { ArrowLeft, Loader2, Phone, ShieldCheck } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { authClient } from "../lib/auth";
import { client } from "../lib/api";
import { maskPhone } from "../lib/format";

function toE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return `+${digits}`;
  return null;
}

/**
 * Login do cliente: Google (auth gerenciado) ou telefone com código por SMS.
 * `onDone` é chamado assim que a sessão é criada.
 */
export function AuthPanel({ onDone }: { onDone?: () => void }) {
  const [mode, setMode] = useState<"choose" | "phone" | "code">("choose");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  async function google() {
    setError(null);
    setBusy(true);
    const result = await authClient.managedAuth.signIn({ provider: "google" });
    setBusy(false);
    if (result.error && result.error.code !== "POPUP_CLOSED") {
      setError(result.error.message ?? "Não foi possível entrar com o Google.");
      return;
    }
    if (!result.error) onDone?.();
  }

  async function sendCode() {
    const e164 = toE164(phone);
    if (!e164) {
      setError("Digite o número com DDD, ex: (11) 98852-5471.");
      return;
    }
    setError(null);
    setBusy(true);
    const { error: err } = await authClient.phoneNumber.sendOtp({ phoneNumber: e164 });
    if (err) {
      setBusy(false);
      setError(err.message ?? "Não conseguimos enviar o código agora.");
      return;
    }
    // Sem provedor de SMS configurado, mostramos o código na tela.
    const dev = await client.account.devOtp({ phone: e164 }).catch(() => null);
    setDevCode(dev?.devMode ? dev.code : null);
    setBusy(false);
    setMode("code");
  }

  async function verify() {
    const e164 = toE164(phone);
    if (!e164) return;
    setError(null);
    setBusy(true);
    const { error: err } = await authClient.phoneNumber.verify({
      phoneNumber: e164,
      code: code.trim(),
    });
    setBusy(false);
    if (err) {
      setError(err.message ?? "Código inválido ou expirado.");
      return;
    }
    onDone?.();
  }

  return (
    <div className="w-full">
      {error && (
        <p className="mb-5 border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-white">
          {error}
        </p>
      )}

      {mode === "choose" && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={google}
            disabled={busy}
            className="flex w-full items-center justify-center gap-3 bg-white px-6 py-4 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-5 animate-spin" /> : <FcGoogle className="size-5" />}
            Entrar com Google
          </button>

          <div className="flex items-center gap-4 py-1">
            <span className="h-px flex-1 bg-white/15" />
            <span className="text-[10px] tracking-[0.25em] text-white/40 uppercase">ou</span>
            <span className="h-px flex-1 bg-white/15" />
          </div>

          <button
            type="button"
            onClick={() => setMode("phone")}
            className="flex w-full items-center justify-center gap-3 border border-white/20 px-6 py-4 text-sm font-semibold text-white transition-colors hover:border-primary hover:text-primary"
          >
            <Phone className="size-5" />
            Entrar com telefone
          </button>
        </div>
      )}

      {mode === "phone" && (
        <div className="space-y-5">
          <label className="block">
            <span className="eyebrow mb-2 block text-[10px] text-white/50">Seu WhatsApp</span>
            <input
              value={phone}
              onChange={(e) => setPhone(maskPhone(e.target.value))}
              inputMode="tel"
              placeholder="(11) 98852-5471"
              className="w-full border border-white/15 bg-black/40 px-4 py-3.5 text-white outline-none focus:border-primary"
            />
          </label>
          <button
            type="button"
            onClick={sendCode}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 bg-primary px-6 py-4 text-[11px] font-semibold tracking-[0.18em] text-white uppercase transition-colors hover:bg-primary-dark disabled:opacity-60"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            Enviar código
          </button>
          <button
            type="button"
            onClick={() => setMode("choose")}
            className="flex items-center gap-2 text-xs text-white/50 hover:text-white"
          >
            <ArrowLeft className="size-3.5" /> Voltar
          </button>
        </div>
      )}

      {mode === "code" && (
        <div className="space-y-5">
          <p className="text-sm text-white/60">
            Enviamos um código de 6 dígitos para <strong className="text-white">{phone}</strong>.
          </p>
          {devCode && (
            <p className="flex items-center gap-2 border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/80">
              <ShieldCheck className="size-4 text-primary" />
              Modo teste (SMS não configurado): seu código é{" "}
              <strong className="tracking-[0.3em] text-white">{devCode}</strong>
            </p>
          )}
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            placeholder="000000"
            className="w-full border border-white/15 bg-black/40 px-4 py-3.5 text-center text-2xl tracking-[0.5em] text-white outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={verify}
            disabled={busy || code.length < 6}
            className="flex w-full items-center justify-center gap-2 bg-primary px-6 py-4 text-[11px] font-semibold tracking-[0.18em] text-white uppercase transition-colors hover:bg-primary-dark disabled:opacity-60"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            Confirmar
          </button>
          <div className="flex items-center justify-between text-xs text-white/50">
            <button
              type="button"
              onClick={() => setMode("phone")}
              className="flex items-center gap-2 hover:text-white"
            >
              <ArrowLeft className="size-3.5" /> Trocar número
            </button>
            <button type="button" onClick={sendCode} disabled={busy} className="hover:text-white">
              Reenviar código
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
