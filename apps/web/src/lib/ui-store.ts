import { create } from 'zustand';

export type Page = 'search' | 'collection' | 'add' | 'detail';

export interface UiState {
  page: Page;
  detailItemId: string | null;
  detailTrackId: string | null;
  search: string;
  filterType: 'all' | 'vinyl' | 'cd' | 'cassette' | 'other';
  sort: 'addedDesc' | 'addedAsc' | 'titleAsc' | 'artistAsc' | 'yearDesc';
  openSearch(query?: string): void;
  openCollection(): void;
  openAdd(): void;
  openDetail(itemId: string): void;
  setSearch(q: string): void;
  setFilterType(t: UiState['filterType']): void;
  setSort(s: UiState['sort']): void;
  setTrack(trackId: string | null): void;
}

export const useUi = create<UiState>((set) => ({
  page: 'collection',
  detailItemId: null,
  detailTrackId: null,
  search: '',
  filterType: 'all',
  sort: 'addedDesc',
  openSearch: (query) => set({ page: 'search', search: query ?? '' }),
  openCollection: () => set({ page: 'collection', detailItemId: null }),
  openAdd: () => set({ page: 'add' }),
  openDetail: (itemId) => set({ page: 'detail', detailItemId: itemId }),
  setSearch: (q) => set({ search: q }),
  setFilterType: (t) => set({ filterType: t }),
  setSort: (s) => set({ sort: s }),
  setTrack: (trackId) => set({ detailTrackId: trackId }),
}));
