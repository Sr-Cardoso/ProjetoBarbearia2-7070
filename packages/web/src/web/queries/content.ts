import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";
import { DEFAULT_CONTENT, type SiteContent } from "../lib/site-content";

/** `?preview=1` faz o site renderizar o rascunho — usado no preview do painel. */
export function isPreviewMode(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("preview") === "1";
}

/** Conteúdo publicado (ou rascunho no modo preview). */
export function useSiteContent(): SiteContent {
  const preview = isPreviewMode();
  const query = useQuery(
    orpc.content.get.queryOptions({
      input: { preview },
      staleTime: preview ? 0 : 60_000,
      refetchInterval: preview ? 1500 : false,
    }),
  );
  return query.data?.content ?? DEFAULT_CONTENT;
}

export function useContentDraft() {
  return useQuery(orpc.content.draft.queryOptions({ staleTime: 0, retry: false }));
}

function useInvalidateContent() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: orpc.content.key() });
}

export function useSaveDraft() {
  const invalidate = useInvalidateContent();
  return useMutation(orpc.content.saveDraft.mutationOptions({ onSuccess: invalidate }));
}

export function usePublishContent() {
  const invalidate = useInvalidateContent();
  return useMutation(orpc.content.publish.mutationOptions({ onSuccess: invalidate }));
}

export function useDiscardDraft() {
  const invalidate = useInvalidateContent();
  return useMutation(orpc.content.discard.mutationOptions({ onSuccess: invalidate }));
}

export function useResetContent() {
  const invalidate = useInvalidateContent();
  return useMutation(orpc.content.reset.mutationOptions({ onSuccess: invalidate }));
}
