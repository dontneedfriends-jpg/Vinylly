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

const BASE = 'https://ws.audioscrobbler.com/2.0';
const TTL = 1000 * 60 * 60 * 24;

export interface LastFmConfig {
  apiKey: string;
}

interface LastFmSearchResponse {
  results: {
    albummatches: {
      album: Array<{
        mbid?: string;
        name: string;
        artist: string;
        url: string;
        image?: Array<{ '#text': string; size: string }>;
      }>;
    };
  };
}

export class LastFmProvider implements MediaProvider {
  readonly name = 'lastfm' as const;

  constructor(private readonly config: LastFmConfig) {}

  isEnabled(): boolean {
    return Boolean(this.config.apiKey);
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    if (!this.isEnabled()) return [];
    const text = query.text ?? [query.artist, query.title].filter(Boolean).join(' ');
    if (!text) return [];
    const params = new URLSearchParams({
      method: 'album.search',
      album: query.title ?? text,
      api_key: this.config.apiKey,
      format: 'json',
    });
    if (query.artist) params.set('artist', query.artist);
    return withCache(`lastfm:search:${params.toString()}`, TTL, async () => {
      const data = await getHostShell()
        .net()
        .fetchJson<LastFmSearchResponse>(`${BASE}/?${params.toString()}`);
      return (data.results.albummatches.album ?? []).slice(0, 25).map((a, i) => ({
        provider: this.name,
        score: 0.7 - i * 0.02,
        release: {
          source: this.name,
          sourceId: a.mbid ?? a.url,
          title: a.name,
          artist: a.artist,
          year: null,
          genres: [],
          styles: [],
          coverUrl: pickImage(a.image) ?? null,
          thumbUrl: pickImage(a.image) ?? null,
          tracklist: [],
        },
      }));
    });
  }

  async getRelease(_sourceId: string): Promise<NormalizedRelease | null> {
    return null;
  }

  async getCover(_sourceId: string): Promise<CoverRef | null> {
    return null;
  }

  async getLyrics(_artist: string, _title: string): Promise<LyricsResult | null> {
    return null;
  }
}

function pickImage(images: Array<{ '#text': string; size: string }> | undefined): string | null {
  if (!images?.length) return null;
  const extralarge = images.find((i) => i.size === 'extralarge');
  const fallback = images[images.length - 1];
  return (extralarge ?? fallback)?.['#text'] || null;
}
