/**
 * Envio do código OTP por SMS.
 *
 * Em produção usa a Twilio (basta preencher as variáveis no `.env` da raiz).
 * Sem credenciais, o código é apenas registrado no log do servidor e devolvido
 * ao cliente para permitir testar o fluxo em desenvolvimento.
 */
const SID = process.env.TWILIO_ACCOUNT_SID ?? "";
const TOKEN = process.env.TWILIO_AUTH_TOKEN ?? "";
const FROM = process.env.TWILIO_FROM ?? "";

/** true quando não há provedor configurado — o código volta na resposta. */
export const SMS_DEV_MODE = !(SID && TOKEN && FROM);

export async function sendSms(to: string, body: string): Promise<void> {
  if (SMS_DEV_MODE) {
    console.info(`[sms:dev] para ${to}: ${body}`);
    return;
  }

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${SID}:${TOKEN}`)}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: FROM, Body: body }),
  });

  if (!res.ok) {
    console.error(`[sms] falha ao enviar para ${to}: ${res.status} ${await res.text()}`);
    throw new Error("Não foi possível enviar o SMS agora.");
  }
}

/** Guarda o último código gerado por telefone — usado só no modo dev. */
const devCodes = new Map<string, string>();

export function rememberDevCode(phone: string, code: string) {
  if (!SMS_DEV_MODE) return;
  devCodes.set(phone, code);
  setTimeout(() => devCodes.delete(phone), 5 * 60 * 1000).unref?.();
}

export function readDevCode(phone: string): string | null {
  return SMS_DEV_MODE ? (devCodes.get(phone) ?? null) : null;
}
