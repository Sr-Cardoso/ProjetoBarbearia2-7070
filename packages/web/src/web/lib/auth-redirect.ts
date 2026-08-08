import { authClient } from "./auth";

// Finaliza o leg de redirect do login Google antes de montar as rotas.
await authClient.managedAuth.handleRedirect().catch(() => {});
