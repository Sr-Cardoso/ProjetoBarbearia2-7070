import { useMutation, useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/api";

/** Catálogo ativo da loja (itens + categorias). */
export function useProducts() {
  return useQuery(orpc.shop.products.queryOptions({ staleTime: 30_000 }));
}

/** Agendamentos futuros aos quais o pedido pode ser somado (comanda). */
export function useLinkableAppointments(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return useQuery(
    orpc.shop.linkableAppointments.queryOptions({
      input: { phone: digits.length >= 10 ? phone : undefined },
      staleTime: 15_000,
    }),
  );
}

export function useCreateOrder() {
  return useMutation(orpc.shop.createOrder.mutationOptions());
}
