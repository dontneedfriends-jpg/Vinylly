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

const MB_BASE = 'https://musicbrainz.org/ws/2';
const CAA_BASE = 'https://coverartarchive.org';
const USER_AGENT = 'Vinylly/0.1 (https://github.com/vinylly)';
const TTL_SEARCH = 1000 * 60 * 60 * 24;
const TTL_RELEASE = 1000 * 60 * 60 * 24 * 7;

interface MBSearchResponse {
  releases: Array<{
    id: string;
    title: string;
    'artist-credit'?: Array<{ name: string }>;
    date?: string;
    'release-group-id'?: string;
  }>;
}

interface MBReleaseResponse {
  id: string;
  title: string;
  'artist-credit'?: Array<{ name: string }>;
  date?: string;
  genres?: Array<{ name: string }>;
  media?: Array<{
    tracks?: Array<{
      position: string;
      title: string;
      length?: number;
    }>;
  }>;
  releases?: Array<{ id: string }>;
}

export class MusicBrainzProvider implements MediaProvider {
  readonly name = 'musicbrainz' as const;

  isEnabled(): boolean {
    return true;
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    let q = '';
    if (query.barcode) {
      q = `barcode:${query.barcode}`;
    } else if (query.text) {
      q = query.text;
    } else {
      const parts: string[] = [];
      if (query.artist) parts.push(`artist:${JSON.stringify(query.artist)}`);
      if (query.title) parts.push(`release:${JSON.stringify(query.title)}`);
      if (query.catalogNumber) parts.push(`catno:${query.catalogNumber}`);
      q = parts.join(' AND ');
    }
    if (!q) return [];
    const url = `${MB_BASE}/release?query=${encodeURIComponent(q)}&fmt=json&limit=25`;
    return withCache(`mb:search:${q}`, TTL_SEARCH, async () => {
      const data = await getHostShell()
        .net()
        .fetchJson<MBSearchResponse>(url, {
          headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        });
      return data.releases.map((r, i) => ({
        provider: this.name,
        score: 1 - i * 0.02,
        release: {
          source: this.name,
          sourceId: r.id,
          title: r.title,
          artist: r['artist-credit']?.[0]?.name ?? '',
          year: r.date ? Number(r.date.slice(0, 4)) : null,
          genres: [],
          styles: [],
          coverUrl: null,
          thumbUrl: null,
          tracklist: [],
        },
      }));
    });
  }

  async getRelease(sourceId: string): Promise<NormalizedRelease | null> {
    const url = `${MB_BASE}/release/${sourceId}?inc=artist-credits+recordings+genres&fmt=json`;
    return withCache(`mb:release:${sourceId}`, TTL_RELEASE, async () => {
      try {
        const r = await getHostShell()
          .net()
          .fetchJson<MBReleaseResponse>(url, {
            headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
          });
        const cover = await this.fetchCover(sourceId);
        return {
          source: this.name,
          sourceId: r.id,
          title: r.title,
          artist: r['artist-credit']?.[0]?.name ?? '',
          year: r.date ? Number(r.date.slice(0, 4)) : null,
          genres: r.genres?.map((g) => g.name) ?? [],
          styles: [],
          coverUrl: cover?.url ?? null,
          thumbUrl: cover?.url ?? null,
          tracklist:
            r.media?.flatMap((m) =>
              (m.tracks ?? []).map((t) => ({
                position: t.position,
                title: t.title,
                durationMs: t.length ?? null,
              })),
            ) ?? [],
          raw: r,
        };
      } catch {
        return null;
      }
    });
  }

  async getCover(sourceId: string): Promise<CoverRef | null> {
    return this.fetchCover(sourceId);
  }

  async getLyrics(_artist: string, _title: string): Promise<LyricsResult | null> {
    return null;
  }

  private async fetchCover(releaseId: string): Promise<CoverRef | null> {
    try {
      const data = await getHostShell()
        .net()
        .fetchJson<{ images?: Array<{ image: string; thumbnails?: { small?: string } }> }>(
          `${CAA_BASE}/release/${releaseId}`,
          { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } },
        );
      const img = data.images?.[0];
      return img ? { url: img.thumbnails?.small ?? img.image } : null;
    } catch {
      return null;
    }
  }
}
