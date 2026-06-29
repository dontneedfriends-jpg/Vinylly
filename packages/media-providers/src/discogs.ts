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

const BASE = 'https://api.discogs.com';
const TTL_SEARCH = 1000 * 60 * 60 * 24; // 24h
const TTL_RELEASE = 1000 * 60 * 60 * 24 * 7; // 7d

export interface DiscogsConfig {
  token: string;
  userAgent: string;
}

interface DiscogsSearchResponse {
  results: Array<{
    id: number;
    master_id?: number;
    title: string;
    year?: number;
    genre?: string[];
    style?: string[];
    cover_image?: string;
    thumb?: string;
    resource_url?: string;
  }>;
}

interface DiscogsReleaseResponse {
  id: number;
  title: string;
  artists?: Array<{ name: string }>;
  year?: number;
  genres?: string[];
  styles?: string[];
  images?: Array<{ uri: string; type: string; uri150?: string }>;
  tracklist?: Array<{ position: string; title: string; duration?: string }>;
}

export class DiscogsProvider implements MediaProvider {
  readonly name = 'discogs' as const;

  constructor(private readonly config: DiscogsConfig) {}

  isEnabled(): boolean {
    return Boolean(this.config.token);
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    if (!this.isEnabled()) return [];
    const params = new URLSearchParams();
    if (query.text) params.set('q', query.text);
    if (query.barcode) {
      params.set('barcode', query.barcode);
    } else if (query.catalogNumber) {
      params.set('catno', query.catalogNumber);
    } else if (query.artist && query.title) {
      params.set('artist', query.artist);
      params.set('release_title', query.title);
    } else if (query.artist) {
      params.set('artist', query.artist);
    } else if (query.title) {
      params.set('release_title', query.title);
    }
    if (query.year) params.set('year', String(query.year));
    params.set('type', 'release');

    const url = `${BASE}/database/search?${params.toString()}`;
    return withCache(`discogs:search:${params.toString()}`, TTL_SEARCH, async () => {
      const data = await getHostShell().net().fetchJson<DiscogsSearchResponse>(url, {
        headers: this.headers(),
      });
      return data.results.slice(0, 25).map((r, i) => ({
        provider: this.name,
        score: 1 - i * 0.02,
        release: {
          source: this.name,
          sourceId: String(r.id),
          title: r.title,
          artist: extractArtist(r.title),
          year: r.year ?? null,
          genres: r.genre ?? [],
          styles: r.style ?? [],
          coverUrl: r.cover_image ?? null,
          thumbUrl: r.thumb ?? null,
          tracklist: [],
        },
      }));
    });
  }

  async getRelease(sourceId: string): Promise<NormalizedRelease | null> {
    if (!this.isEnabled()) return null;
    const url = `${BASE}/releases/${sourceId}`;
    return withCache(`discogs:release:${sourceId}`, TTL_RELEASE, async () => {
      try {
        const r = await getHostShell().net().fetchJson<DiscogsReleaseResponse>(url, {
          headers: this.headers(),
        });
        return normalizeDiscogsRelease(r, this.name);
      } catch {
        return null;
      }
    });
  }

  async getCover(sourceId: string): Promise<CoverRef | null> {
    const rel = await this.getRelease(sourceId);
    return rel?.coverUrl ? { url: rel.coverUrl } : null;
  }

  async getLyrics(_artist: string, _title: string): Promise<LyricsResult | null> {
    return null;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Discogs token=${this.config.token}`,
      'User-Agent': this.config.userAgent,
    };
  }
}

function extractArtist(title: string): string {
  const idx = title.indexOf(' - ');
  return idx === -1 ? title : title.slice(0, idx).trim();
}

function parseDuration(s: string | undefined): number | null {
  if (!s) return null;
  const m = s.match(/(\d+):(\d+)/);
  if (!m) return null;
  const min = Number(m[1]);
  const sec = Number(m[2]);
  if (Number.isNaN(min) || Number.isNaN(sec)) return null;
  return (min * 60 + sec) * 1000;
}

export function normalizeDiscogsRelease(
  r: DiscogsReleaseResponse,
  source: 'discogs',
): NormalizedRelease {
  const primary = r.images?.find((i) => i.type === 'primary') ?? r.images?.[0];
  return {
    source,
    sourceId: String(r.id),
    title: r.title,
    artist: r.artists?.[0]?.name ?? extractArtist(r.title),
    year: r.year ?? null,
    genres: r.genres ?? [],
    styles: r.styles ?? [],
    coverUrl: primary?.uri ?? null,
    thumbUrl: primary?.uri150 ?? null,
    tracklist:
      r.tracklist?.map((t) => ({
        position: t.position,
        title: t.title,
        durationMs: parseDuration(t.duration),
      })) ?? [],
    raw: r,
  };
}
