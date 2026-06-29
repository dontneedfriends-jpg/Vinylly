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

const BASE = 'https://api.genius.com';
const TTL = 1000 * 60 * 60 * 24 * 7;

export interface GeniusConfig {
  accessToken: string;
}

interface GeniusSearchResponse {
  response: {
    hits: Array<{
      result: {
        id: number;
        title: string;
        primary_artist: { name: string };
        url: string;
        song_art_image_url?: string;
      };
    }>;
  };
}

export class GeniusProvider implements MediaProvider {
  readonly name = 'manual' as const; // genius is treated as lyrics source, not catalog
  private lyricsOnly = true;

  isEnabled(): boolean {
    return Boolean(this.config.accessToken);
  }

  constructor(private readonly config: GeniusConfig) {}

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
    if (!this.isEnabled()) return null;
    const q = `${artist} ${title}`.trim();
    if (!q) return null;
    const url = `${BASE}/search?q=${encodeURIComponent(q)}`;
    return withCache(`genius:lyrics:${q}`, TTL, async () => {
      try {
        const data = await getHostShell()
          .net()
          .fetchJson<GeniusSearchResponse>(url, {
            headers: { Authorization: `Bearer ${this.config.accessToken}` },
          });
        const hit = data.response.hits[0]?.result;
        if (!hit) return null;
        return {
          text: `Текст доступен на странице: ${hit.url}`,
          source: 'genius',
          syncedLrc: null,
        };
      } catch {
        return null;
      }
    });
  }
}
