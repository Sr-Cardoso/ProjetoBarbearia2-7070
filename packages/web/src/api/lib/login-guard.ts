/**
 * Proteção do login por senha mestra contra ataque de força bruta.
 *
 * Sem isso, um script pode testar milhares de senhas por minuto no
 * `admin.login` até acertar. Aqui cada origem (IP) tem um orçamento de
 * tentativas erradas; ao estourar, o login é bloqueado por um tempo que
 * dobra a cada nova rodada de erros (5min → 10 → 20 … até 1h).
 *
 * O estado é em memória: reinicia o processo, zera. É o suficiente para
 * frear um ataque automatizado e não depende de tabela nova no banco.
 */

/** Tentativas erradas toleradas antes do primeiro bloqueio. */
const MAX_ATTEMPTS = 5;

/** Janela em que as tentativas erradas se acumulam (10 min). */
const WINDOW_MS = 10 * 60 * 1000;

/** Bloqueio inicial e teto do bloqueio. */
const BASE_LOCK_MS = 5 * 60 * 1000;
const MAX_LOCK_MS = 60 * 60 * 1000;

/** Não deixa o mapa crescer sem limite (proteção contra IPs falsificados). */
const MAX_TRACKED = 10_000;

interface Attempt {
  /** Erros dentro da janela atual. */
  count: number;
  /** Quando o último erro aconteceu. */
  lastAt: number;
  /** Bloqueado até (epoch ms); 0 = liberado. */
  lockedUntil: number;
  /** Quantas vezes já foi bloqueado — controla o backoff exponencial. */
  lockLevel: number;
}

const attempts = new Map<string, Attempt>();

/** Remove registros velhos para o mapa não virar vazamento de memória. */
function evictStale(now: number) {
  for (const [key, entry] of attempts) {
    const expired = entry.lockedUntil < now && now - entry.lastAt > WINDOW_MS;
    if (expired) attempts.delete(key);
  }
  if (attempts.size <= MAX_TRACKED) return;
  // Ainda grande: descarta os mais antigos primeiro.
  const ordered = [...attempts.entries()].sort((a, b) => a[1].lastAt - b[1].lastAt);
  for (const [key] of ordered.slice(0, attempts.size - MAX_TRACKED)) {
    attempts.delete(key);
  }
}

/**
 * Identifica a origem da requisição. Usa o IP repassado pelo proxy da
 * plataforma; sem ele, cai num rótulo fixo (pior caso: o limite passa a ser
 * global, o que ainda protege a senha).
 */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]!.trim() || headers.get("cf-connecting-ip")?.trim();
  return ip && ip.length > 0 ? ip : "sem-ip";
}

export interface LockState {
  locked: boolean;
  /** Segundos restantes de bloqueio. */
  retryAfterSec: number;
  /** Tentativas que ainda restam antes de bloquear. */
  remaining: number;
}

/** Consulta se a origem pode tentar agora. */
export function checkLock(key: string, now = Date.now()): LockState {
  const entry = attempts.get(key);
  if (!entry) return { locked: false, retryAfterSec: 0, remaining: MAX_ATTEMPTS };

  if (entry.lockedUntil > now) {
    return {
      locked: true,
      retryAfterSec: Math.ceil((entry.lockedUntil - now) / 1000),
      remaining: 0,
    };
  }

  // Janela expirada sem novo erro: o contador recomeça.
  if (now - entry.lastAt > WINDOW_MS) {
    return { locked: false, retryAfterSec: 0, remaining: MAX_ATTEMPTS };
  }

  return {
    locked: false,
    retryAfterSec: 0,
    remaining: Math.max(0, MAX_ATTEMPTS - entry.count),
  };
}

/** Registra uma senha errada e devolve o estado resultante. */
export function registerFailure(key: string, now = Date.now()): LockState {
  evictStale(now);

  const existing = attempts.get(key);
  const withinWindow = existing && now - existing.lastAt <= WINDOW_MS;

  const entry: Attempt = withinWindow
    ? { ...existing!, count: existing!.count + 1, lastAt: now }
    : { count: 1, lastAt: now, lockedUntil: 0, lockLevel: existing?.lockLevel ?? 0 };

  if (entry.count >= MAX_ATTEMPTS) {
    const lockMs = Math.min(BASE_LOCK_MS * 2 ** entry.lockLevel, MAX_LOCK_MS);
    entry.lockedUntil = now + lockMs;
    entry.lockLevel += 1;
    entry.count = 0;
    attempts.set(key, entry);
    return { locked: true, retryAfterSec: Math.ceil(lockMs / 1000), remaining: 0 };
  }

  attempts.set(key, entry);
  return {
    locked: false,
    retryAfterSec: 0,
    remaining: Math.max(0, MAX_ATTEMPTS - entry.count),
  };
}

/** Login certo: limpa o histórico daquela origem. */
export function registerSuccess(key: string) {
  attempts.delete(key);
}

/** Mensagem de bloqueio para o usuário (sem vazar detalhe técnico). */
export function lockMessage(retryAfterSec: number): string {
  const min = Math.ceil(retryAfterSec / 60);
  return `Muitas tentativas de senha. Tente novamente em ${min} ${min === 1 ? "minuto" : "minutos"}.`;
}
