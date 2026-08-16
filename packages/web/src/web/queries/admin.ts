import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

function useInvalidateAdmin() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: orpc.admin.key() });
    queryClient.invalidateQueries({ queryKey: orpc.booking.key() });
  };
}

export function useAdminLogin() {
  return useMutation(orpc.admin.login.mutationOptions());
}

export function useAdminSession() {
  return useQuery(orpc.admin.session.queryOptions({ retry: false, staleTime: 0 }));
}

export function useAgenda(date: string) {
  return useQuery(orpc.admin.agenda.queryOptions({ input: { date }, staleTime: 0 }));
}

export function useUpcoming() {
  return useQuery(orpc.admin.upcoming.queryOptions({ staleTime: 0 }));
}

export function useSetStatus() {
  const invalidate = useInvalidateAdmin();
  return useMutation(orpc.admin.setStatus.mutationOptions({ onSuccess: invalidate }));
}

export function useRemoveAppointment() {
  const invalidate = useInvalidateAdmin();
  return useMutation(orpc.admin.removeAppointment.mutationOptions({ onSuccess: invalidate }));
}

export function useAllServices() {
  return useQuery(orpc.admin.allServices.queryOptions());
}

export function useSaveService() {
  const invalidate = useInvalidateAdmin();
  return useMutation(orpc.admin.saveService.mutationOptions({ onSuccess: invalidate }));
}

export function useRemoveService() {
  const invalidate = useInvalidateAdmin();
  return useMutation(orpc.admin.removeService.mutationOptions({ onSuccess: invalidate }));
}

export function useAllBarbers() {
  return useQuery(orpc.admin.allBarbers.queryOptions());
}

export function useSaveBarber() {
  const invalidate = useInvalidateAdmin();
  return useMutation(orpc.admin.saveBarber.mutationOptions({ onSuccess: invalidate }));
}

export function useRemoveBarber() {
  const invalidate = useInvalidateAdmin();
  return useMutation(orpc.admin.removeBarber.mutationOptions({ onSuccess: invalidate }));
}

export function useBlocks() {
  return useQuery(orpc.admin.blocks.queryOptions());
}

export function useCreateBlock() {
  const invalidate = useInvalidateAdmin();
  return useMutation(orpc.admin.createBlock.mutationOptions({ onSuccess: invalidate }));
}

export function useRemoveBlock() {
  const invalidate = useInvalidateAdmin();
  return useMutation(orpc.admin.removeBlock.mutationOptions({ onSuccess: invalidate }));
}

/** Situação do dia na agenda (aberto, fechado pela regra, bloqueado). */
export function useDayStatus(date: string) {
  return useQuery(orpc.admin.dayStatus.queryOptions({ input: { date }, staleTime: 0 }));
}

/** Dias liberados manualmente, de hoje em diante. */
export function useReleasedDays() {
  return useQuery(orpc.admin.releasedDays.queryOptions({ staleTime: 0 }));
}

export function useOpenDay() {
  const invalidate = useInvalidateAdmin();
  return useMutation(orpc.admin.openDay.mutationOptions({ onSuccess: invalidate }));
}

export function useCloseDay() {
  const invalidate = useInvalidateAdmin();
  return useMutation(orpc.admin.closeDay.mutationOptions({ onSuccess: invalidate }));
}

export function useSetWorkDays() {
  const invalidate = useInvalidateAdmin();
  return useMutation(orpc.admin.setWorkDays.mutationOptions({ onSuccess: invalidate }));
}

export function useAdminSettings() {
  return useQuery(orpc.admin.settings.queryOptions());
}

export function useSaveSettings() {
  const invalidate = useInvalidateAdmin();
  return useMutation(orpc.admin.saveSettings.mutationOptions({ onSuccess: invalidate }));
}

export function useTenants() {
  return useQuery(orpc.tenants.list.queryOptions({ retry: false }));
}

function useInvalidateTenants() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: orpc.tenants.key() });
  };
}

export function useSaveTenant() {
  const invalidate = useInvalidateTenants();
  return useMutation(orpc.tenants.save.mutationOptions({ onSuccess: invalidate }));
}

export function useRemoveTenant() {
  const invalidate = useInvalidateTenants();
  return useMutation(orpc.tenants.remove.mutationOptions({ onSuccess: invalidate }));
}

export function useAddTenantAdmin() {
  const invalidate = useInvalidateTenants();
  return useMutation(orpc.tenants.addAdmin.mutationOptions({ onSuccess: invalidate }));
}

export function useRemoveTenantAdmin() {
  const invalidate = useInvalidateTenants();
  return useMutation(orpc.tenants.removeAdmin.mutationOptions({ onSuccess: invalidate }));
}

/** Troca as áreas do painel liberadas para um usuário convidado. */
export function useSetAdminAccess() {
  const invalidate = useInvalidateTenants();
  return useMutation(orpc.tenants.setAdminAccess.mutationOptions({ onSuccess: invalidate }));
}

/** Descarta o pedido de integração de plataforma de uma unidade. */
export function useClearTenantIntegrationRequest() {
  const invalidate = useInvalidateTenants();
  return useMutation(
    orpc.tenants.clearIntegrationRequest.mutationOptions({ onSuccess: invalidate }),
  );
}
