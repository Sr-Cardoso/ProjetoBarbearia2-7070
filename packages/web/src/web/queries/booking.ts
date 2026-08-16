import { useMutation, useQuery } from "@tanstack/react-query";
import { orpc } from "../lib/api";

export function useServices() {
  return useQuery(orpc.booking.services.queryOptions({ staleTime: 60_000 }));
}

export function useBarbers() {
  return useQuery(orpc.booking.barbers.queryOptions({ staleTime: 60_000 }));
}

export function useShopSettings() {
  return useQuery(orpc.booking.settings.queryOptions({ staleTime: 60_000 }));
}

/** Dias de atendimento + liberações/fechamentos do painel. */
export function useSchedule() {
  return useQuery(
    orpc.booking.schedule.queryOptions({
      staleTime: 0,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
    }),
  );
}

/** Redirecionamento do agendamento para o app (configurado no painel). */
export function useAppBooking() {
  return useQuery(
    orpc.booking.appBooking.queryOptions({ staleTime: 0, refetchOnMount: "always" }),
  );
}

export function useAvailability(date: string | null, barberId?: number) {
  return useQuery(
    orpc.booking.availability.queryOptions({
      input: { date: date ?? "", barberId },
      enabled: Boolean(date),
      staleTime: 0,
    }),
  );
}

export function useCreateBooking() {
  return useMutation(orpc.booking.create.mutationOptions());
}
