import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { AppRouterClient } from "../../api";
import { authClient } from "./auth";

const ADMIN_TOKEN_KEY = "barbearia-cardoso.admin-token";

export function getAdminToken(): string | null {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string | null) {
  try {
    if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
    else localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    /* storage indisponível */
  }
}

const link = new RPCLink({
  url: `${window.location.origin}/api/rpc`,
  headers: () => {
    const headers: Record<string, string> = {};
    const masterToken = getAdminToken();
    if (masterToken) headers["x-admin-token"] = masterToken;
    const bearer = authClient.managedAuth.getToken();
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
    return headers;
  },
});

/** Direct typed client: await client.booking.services() */
export const client: AppRouterClient = createORPCClient(link);

/** TanStack Query helpers: useQuery(orpc.booking.services.queryOptions()) */
export const orpc = createTanstackQueryUtils(client);
