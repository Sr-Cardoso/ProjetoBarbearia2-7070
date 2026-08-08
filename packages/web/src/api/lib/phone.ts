/** Normalização de telefone brasileiro para E.164 (+55DDNNNNNNNNN). */
export function toE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  // Já veio com código do país
  if (raw.trim().startsWith("+")) {
    return digits.length >= 10 ? `+${digits}` : null;
  }
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return `+${digits}`;
  }
  // DDD + número (10 ou 11 dígitos)
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  return null;
}

/** (11) 98852-5471 */
export function formatBrPhone(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return e164;
}
