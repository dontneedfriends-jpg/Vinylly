import type { ReleaseSource, TrackRecord } from '@vinylly/db';

export interface NormalizedTrack {
  position: string;
  title: string;
  durationMs: number | null;
}

export interface NormalizedRelease {
  source: ReleaseSource;
  sourceId: string;
  title: string;
  artist: string;
  year: number | null;
  genres: string[];
  styles: string[];
  coverUrl: string | null;
  thumbUrl: string | null;
  tracklist: NormalizedTrack[];
  raw?: unknown;
}

export interface SearchQuery {
  text?: string;
  barcode?: string;
  catalogNumber?: string;
  artist?: string;
  title?: string;
  year?: number;
}

export interface SearchResult {
  provider: ReleaseSource;
  score: number;
  release: NormalizedRelease;
}

export interface CoverRef {
  url: string;
  width?: number;
  height?: number;
}

export interface LyricsResult {
  text: string;
  source: string;
  syncedLrc: string | null;
}

export interface MediaProvider {
  readonly name: ReleaseSource;
  isEnabled(): boolean;
  search(query: SearchQuery): Promise<SearchResult[]>;
  getRelease(sourceId: string): Promise<NormalizedRelease | null>;
  getCover(sourceId: string): Promise<CoverRef | null>;
  getLyrics(artist: string, title: string): Promise<LyricsResult | null>;
}

export function tracksFromNormalized(
  input: NormalizedTrack[],
): Pick<TrackRecord, 'position' | 'title' | 'duration'>[] {
  return input.map((t) => ({
    position: t.position,
    title: t.title,
    duration: t.durationMs,
  }));
}
