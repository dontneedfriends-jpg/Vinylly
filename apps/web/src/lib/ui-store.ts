import { create } from 'zustand';

export type Page = 'collection' | 'add' | 'detail' | 'settings';

export interface VideoLink {
  uri: string;
  title: string;
}

export interface TrackItem {
  position: string;
  title: string;
  durationMs?: number | null;
}

export interface AddReleaseMeta {
  country: string | null;
  released: string | null;
  labels: string[] | null;
  format: string | null;
  barcode: string[] | null;
}

export interface UiState {
  page: Page;
  detailItemId: string | null;
  detailTrackId: string | null;
  releaseVideos: VideoLink[];
  addTracklist: TrackItem[];
  addTracklistLoading: boolean;
  addReleaseMeta: AddReleaseMeta | null;
  search: string;
  filterType: 'all' | 'vinyl' | 'cd' | 'cassette' | 'other';
  sort: 'addedDesc' | 'addedAsc' | 'titleAsc' | 'artistAsc' | 'yearDesc';
  openCollection(): void;
  openAdd(query?: string): void;
  openDetail(itemId: string): void;
  openSettings(): void;
  setSearch(q: string): void;
  setFilterType(t: UiState['filterType']): void;
  setSort(s: UiState['sort']): void;
  setTrack(trackId: string | null): void;
  setReleaseVideos(videos: VideoLink[]): void;
  setAddTracklist(tracks: TrackItem[], loading: boolean): void;
  setAddReleaseMeta(meta: AddReleaseMeta | null): void;
}

export const useUi = create<UiState>((set) => ({
  page: 'collection',
  detailItemId: null,
  detailTrackId: null,
  releaseVideos: [],
  addTracklist: [],
  addTracklistLoading: false,
  addReleaseMeta: null,
  search: '',
  filterType: 'all',
  sort: 'addedDesc',
  openCollection: () => set({ page: 'collection', detailItemId: null, releaseVideos: [] }),
  openAdd: (query) =>
    set({
      page: 'add',
      search: query ?? '',
      addTracklist: [],
      addTracklistLoading: false,
      addReleaseMeta: null,
    }),
  openDetail: (itemId) => set({ page: 'detail', detailItemId: itemId, releaseVideos: [] }),
  openSettings: () => set({ page: 'settings' }),
  setSearch: (q) => set({ search: q }),
  setFilterType: (t) => set({ filterType: t }),
  setSort: (s) => set({ sort: s }),
  setTrack: (trackId) => set({ detailTrackId: trackId }),
  setReleaseVideos: (videos) => set({ releaseVideos: videos }),
  setAddTracklist: (tracks, loading) => set({ addTracklist: tracks, addTracklistLoading: loading }),
  setAddReleaseMeta: (meta) => set({ addReleaseMeta: meta }),
}));
