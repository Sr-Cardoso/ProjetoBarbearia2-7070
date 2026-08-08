import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/**
 * Hooks do painel da loja e das mensagens automáticas.
 * Toda alteração invalida `store` (catálogo/pedidos/fila) e `admin` (agenda,
 * que mostra a comanda com os produtos).
 */
function useInvalidateStore() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: orpc.store.key() });
    queryClient.invalidateQueries({ queryKey: orpc.admin.key() });
  };
}

/** Catálogo completo, incluindo produtos inativos. */
export function useStoreProducts() {
  return useQuery(orpc.store.products.queryOptions({ staleTime: 0 }));
}

export function useSaveProduct() {
  const invalidate = useInvalidateStore();
  return useMutation(orpc.store.saveProduct.mutationOptions({ onSuccess: invalidate }));
}

export function useDeleteProduct() {
  const invalidate = useInvalidateStore();
  return useMutation(orpc.store.deleteProduct.mutationOptions({ onSuccess: invalidate }));
}

/** Pedidos da loja, com itens e agendamento vinculado. */
export function useStoreOrders() {
  return useQuery(orpc.store.orders.queryOptions({ input: {}, staleTime: 0 }));
}

export function useSetOrderStatus() {
  const invalidate = useInvalidateStore();
  return useMutation(orpc.store.setOrderStatus.mutationOptions({ onSuccess: invalidate }));
}

/** Comanda do dia: produtos e total por agendamento. */
export function useAgendaTotals(date: string) {
  return useQuery(orpc.store.agendaTotals.queryOptions({ input: { date }, staleTime: 0 }));
}

/** Resumo da loja para os cartões do painel. */
export function useStoreStats() {
  return useQuery(orpc.store.stats.queryOptions({ staleTime: 0 }));
}

/** Configuração das mensagens automáticas. */
export function useMessagingConfig() {
  return useQuery(orpc.store.messagingConfig.queryOptions({ staleTime: 0 }));
}

export function useSaveMessagingConfig() {
  const invalidate = useInvalidateStore();
  return useMutation(orpc.store.saveMessagingConfig.mutationOptions({ onSuccess: invalidate }));
}

/** Fila de mensagens (lembretes e reativações). */
export function useMessages() {
  return useQuery(orpc.store.messages.queryOptions({ input: {}, staleTime: 0 }));
}

export function useMarkMessageSent() {
  const invalidate = useInvalidateStore();
  return useMutation(orpc.store.markMessageSent.mutationOptions({ onSuccess: invalidate }));
}

export function useCancelMessage() {
  const invalidate = useInvalidateStore();
  return useMutation(orpc.store.cancelMessage.mutationOptions({ onSuccess: invalidate }));
}

export function useRetryMessage() {
  const invalidate = useInvalidateStore();
  return useMutation(orpc.store.retryMessage.mutationOptions({ onSuccess: invalidate }));
}

/** Roda o ciclo de mensagens na hora, sem esperar o worker. */
export function useRunMessages() {
  const invalidate = useInvalidateStore();
  return useMutation(orpc.store.runMessages.mutationOptions({ onSuccess: invalidate }));
}
