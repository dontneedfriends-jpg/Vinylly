import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collectionRepo,
  itemRepo,
  trackRepo,
  wantlistRepo,
  type CreateItemInput,
  type CreateWantlistInput,
  type ItemListFilter,
} from '@vinylly/db';
import { useProfileStore } from './profile-store';

function activeProfileId(): string {
  return useProfileStore.getState().activeId ?? '__none__';
}

const qk = {
  collection: (pid?: string | null) => ['collection', pid ?? activeProfileId()] as const,
  items: (filter: ItemListFilter, pid?: string | null) =>
    ['items', pid ?? activeProfileId(), filter] as const,
  item: (id: string, pid?: string | null) => ['item', pid ?? activeProfileId(), id] as const,
  tracks: (releaseId: string, pid?: string | null) =>
    ['tracks', pid ?? activeProfileId(), releaseId] as const,
  wantlist: (pid?: string | null) => ['wantlist', pid ?? activeProfileId()] as const,
};

export function useDefaultCollection() {
  const profileId = useProfileStore((s) => s.activeId);
  return useQuery({
    queryKey: qk.collection(profileId),
    queryFn: () => collectionRepo.ensureDefault(),
    staleTime: Infinity,
    enabled: Boolean(profileId),
  });
}

export function useItems(filter: ItemListFilter) {
  const profileId = useProfileStore((s) => s.activeId);
  return useQuery({
    queryKey: qk.items(filter, profileId),
    queryFn: () => itemRepo.list(filter),
    enabled: Boolean(profileId),
  });
}

export function useItem(id: string | null) {
  const profileId = useProfileStore((s) => s.activeId);
  return useQuery({
    queryKey: id ? qk.item(id, profileId) : ['item', profileId ?? '__none__', 'none'],
    queryFn: () => (id ? itemRepo.get(id) : Promise.resolve(null)),
    enabled: Boolean(id) && Boolean(profileId),
  });
}

export function useTracks(releaseId: string | null) {
  const profileId = useProfileStore((s) => s.activeId);
  return useQuery({
    queryKey: releaseId ? qk.tracks(releaseId, profileId) : ['tracks', profileId ?? '__none__', 'none'],
    queryFn: () => (releaseId ? trackRepo.listByRelease(releaseId) : Promise.resolve([])),
    enabled: Boolean(releaseId) && Boolean(profileId),
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
      void qc.invalidateQueries({ queryKey: ['item', activeProfileId(), item.id] });
    },
  });
}

export function useRemoveItem() {
  const qc = useQueryClient();
  const profileId = useProfileStore((s) => s.activeId);
  return useMutation({
    mutationFn: (id: string) => itemRepo.remove(id),
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: ['items'] });
      void qc.invalidateQueries({ queryKey: ['item', profileId ?? '__none__', id] });
    },
  });
}

export function useWantlist() {
  const profileId = useProfileStore((s) => s.activeId);
  return useQuery({
    queryKey: qk.wantlist(profileId),
    queryFn: () => wantlistRepo.list(),
    enabled: Boolean(profileId),
  });
}

export function useAddToWantlist() {
  const qc = useQueryClient();
  const profileId = useProfileStore((s) => s.activeId);
  return useMutation({
    mutationFn: (input: CreateWantlistInput) => wantlistRepo.add(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wantlist', profileId ?? '__none__'] });
    },
  });
}

export function useRemoveFromWantlist() {
  const qc = useQueryClient();
  const profileId = useProfileStore((s) => s.activeId);
  return useMutation({
    mutationFn: (id: string) => wantlistRepo.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wantlist', profileId ?? '__none__'] });
    },
  });
}
