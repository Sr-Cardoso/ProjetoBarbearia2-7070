import type { RouterClient } from "@orpc/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { createApp } from "./__core/app";
import { s3, S3_BUCKET } from "./lib/s3";
import { auth } from "./auth";
import { ping } from "./routes/ping";
import { booking } from "./routes/booking";
import { admin } from "./routes/admin";
import { tenants } from "./routes/tenants";
import { content } from "./routes/content";
import { upload } from "./routes/upload";
import { account } from "./routes/account";
import { shop } from "./routes/shop";
import { store } from "./routes/store";
import { startMessenger } from "./lib/messenger";
import { registerBlipApi } from "./lib/blip-api";

// API features are oRPC procedures, one file per feature in ./routes/,
// composed into this router — typed end-to-end via the clients
// (web: src/web/lib/api.ts, mobile: lib/api.ts).
export const router = {
  ping,
  booking,
  admin,
  tenants,
  content,
  upload,
  account,
  shop,
  store,
};

export type AppRouter = typeof router;
/** Typed client for the router — used by the web and mobile api clients. */
export type AppRouterClient = RouterClient<AppRouter>;

const app = createApp(router);

// Worker das mensagens automáticas (lembrete 1h antes e reativação 30 dias).
startMessenger();

app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// Leitura da agenda/clientes pelo app BlipBeauty (token gerado no painel).
registerBlipApi(app);

/** Entrega as imagens enviadas pelo painel direto do storage. */
app.get("/api/files/*", async (c) => {
  const key = c.req.path.replace("/api/files/", "");
  if (!key) return c.json({ error: "not found" }, 404);
  try {
    const object = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    if (!object.Body) return c.json({ error: "not found" }, 404);
    return new Response(object.Body.transformToWebStream(), {
      status: 200,
      headers: {
        "content-type": object.ContentType ?? "application/octet-stream",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return c.json({ error: "not found" }, 404);
  }
});

export default app;
