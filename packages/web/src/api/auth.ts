import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { phoneNumber } from "better-auth/plugins";
import { expo } from "@better-auth/expo";
import { runableManagedAuth } from "@runablehq/managed-auth/server";
import { db } from "./database";
import { rememberDevCode, sendSms } from "./lib/sms";
import { formatBrPhone } from "./lib/phone";

export const auth = betterAuth({
  basePath: "/api/auth",
  baseURL: process.env.WEBSITE_URL,
  database: drizzleAdapter(db, { provider: "sqlite" }),
  emailAndPassword: { enabled: false },
  secret: process.env.BETTER_AUTH_SECRET,
  user: {
    additionalFields: {
      /** Telefone de contato exibido/pré-preenchido no agendamento. */
      contactPhone: { type: "string", required: false, input: true },
    },
  },
  trustedOrigins: (request) => {
    const origin = request?.headers.get("origin");
    return origin ? [origin] : ["*"];
  },
  plugins: [
    ...runableManagedAuth({
      applicationId: process.env.APPLICATION_ID!,
      issuer: process.env.VITE_RUNABLE_AUTH_ISSUER!,
    }),
    phoneNumber({
      otpLength: 6,
      expiresIn: 5 * 60,
      allowedAttempts: 5,
      sendOTP: async ({ phoneNumber: phone, code }) => {
        rememberDevCode(phone, code);
        await sendSms(
          phone,
          `Barbearia Cardoso: seu código de acesso é ${code}. Vale por 5 minutos.`,
        );
      },
      signUpOnVerification: {
        getTempEmail: (phone) => `${phone.replace(/\D/g, "")}@telefone.barbeariacardoso.app`,
        getTempName: (phone) => formatBrPhone(phone),
      },
    }),
    expo(),
  ],
});
