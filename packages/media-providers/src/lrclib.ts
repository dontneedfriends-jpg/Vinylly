import { withCache } from './cache';
import type {
  MediaProvider,
  NormalizedRelease,
  SearchQuery,
  SearchResult,
  LyricsResult,
  CoverRef,
} from './types';
import { getHostShell } from '@vinylly/host';

const BASE = 'https://lrclib.net/api';
const TTL = 1000 * 60 * 60 * 24 * 7;

interface LrclibResponse {
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

export class LrclibProvider implements MediaProvider {
  readonly name = 'manual' as const;

  isEnabled(): boolean {
    return true;
  }

  async search(_query: SearchQuery): Promise<SearchResult[]> {
    return [];
  }

  async getRelease(_sourceId: string): Promise<NormalizedRelease | null> {
    return null;
  }

  async getCover(_sourceId: string): Promise<CoverRef | null> {
    return null;
  }

  async getLyrics(artist: string, title: string): Promise<LyricsResult | null> {
    const q = `${artist} ${title}`.trim();
    if (!q) return null;
    const url = `${BASE}/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`;
    return withCache(`lrclib:lyrics:${q}`, TTL, async () => {
      try {
        const data = await getHostShell().net().fetchJson<LrclibResponse>(url);
        const text = data.plainLyrics ?? data.syncedLyrics;
        if (!text) return null;
        return {
          text,
          source: 'lrclib',
          syncedLrc: data.syncedLyrics ?? null,
        };
      } catch {
        return null;
      }
    });
  }
}
