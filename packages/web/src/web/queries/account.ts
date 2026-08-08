import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";
import { authClient } from "../lib/auth";

/** Sessão reativa do cliente (Google ou telefone). */
export function useSession() {
  return authClient.useSession();
}

export function useAccount(enabled: boolean) {
  return useQuery(orpc.account.me.queryOptions({ enabled, staleTime: 30_000 }));
}

export function useMyAppointments(enabled: boolean) {
  return useQuery(orpc.account.appointments.queryOptions({ enabled, staleTime: 10_000 }));
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation(
    orpc.account.updateProfile.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: orpc.account.me.key() });
        void authClient.getSession({ query: { disableCookieCache: true } });
      },
    }),
  );
}

export function useCancelAppointment() {
  const qc = useQueryClient();
  return useMutation(
    orpc.account.cancel.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: orpc.account.appointments.key() }),
    }),
  );
}
