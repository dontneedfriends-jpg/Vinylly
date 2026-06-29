import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collectionRepo,
  itemRepo,
  trackRepo,
  type CreateItemInput,
  type ItemListFilter,
} from '@vinylly/db';

const qk = {
  collection: ['collection'] as const,
  items: (filter: ItemListFilter) => ['items', filter] as const,
  item: (id: string) => ['item', id] as const,
  tracks: (releaseId: string) => ['tracks', releaseId] as const,
};

export function useDefaultCollection() {
  return useQuery({
    queryKey: qk.collection,
    queryFn: () => collectionRepo.ensureDefault(),
    staleTime: Infinity,
  });
}

export function useItems(filter: ItemListFilter) {
  return useQuery({
    queryKey: qk.items(filter),
    queryFn: () => itemRepo.list(filter),
  });
}

export function useItem(id: string | null) {
  return useQuery({
    queryKey: id ? qk.item(id) : ['item', 'none'],
    queryFn: () => (id ? itemRepo.get(id) : Promise.resolve(null)),
    enabled: Boolean(id),
  });
}

export function useTracks(releaseId: string | null) {
  return useQuery({
    queryKey: releaseId ? qk.tracks(releaseId) : ['tracks', 'none'],
    queryFn: () => (releaseId ? trackRepo.listByRelease(releaseId) : Promise.resolve([])),
    enabled: Boolean(releaseId),
  });
}

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateItemInput) => itemRepo.create(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['items'] });
    },
  });
}

export function useUpdateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<CreateItemInput> }) =>
      itemRepo.update(id, patch),
    onSuccess: (item) => {
      void qc.invalidateQueries({ queryKey: ['items'] });
      void qc.invalidateQueries({ queryKey: qk.item(item.id) });
    },
  });
}

export function useRemoveItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => itemRepo.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['items'] });
    },
  });
}

export function useSetTrackLyrics() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      trackId,
      lyrics,
      src,
    }: {
      trackId: string;
      lyrics: string | null;
      src: string | null;
    }) => trackRepo.setLyrics(trackId, lyrics, src),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tracks'] });
    },
  });
}
