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
  /** Optional CORS proxy prefix prepended to every Discogs API URL (browser-only). */
  proxyUrl?: string;
  userAgent?: string;
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
    format?: string[];
    country?: string;
    label?: string[];
    catno?: string;
    barcode?: string[];
    community?: { want?: number; have?: number };
    master_url?: string;
    uri?: string;
  }>;
}

interface DiscogsReleaseResponse {
  id: number;
  title: string;
  artists?: Array<{ name: string; anv?: string; role?: string }>;
  year?: number;
  genres?: string[];
  styles?: string[];
  notes?: string;
  images?: Array<{ uri: string; type: string; uri150?: string; width?: number; height?: number }>;
  tracklist?: Array<{ position: string; title: string; duration?: string }>;
  country?: string;
  released?: string;
  released_formatted?: string;
  labels?: Array<{ name: string; catno?: string }>;
  formats?: Array<{ name: string; qty?: string; descriptions?: string[] }>;
  videos?: Array<{ uri: string; title: string; description?: string; duration?: number }>;
  community?: { have?: number; want?: number; rating?: { count?: number; average?: number } };
  identifiers?: Array<{ type: string; value: string; description?: string }>;
  uri?: string;
  master_url?: string | null;
  master_id?: number | null;
  num_for_sale?: number;
  lowest_price?: number | null;
  estimated_weight?: number;
  extraartists?: Array<{ name: string; role?: string; anv?: string }>;
}

export class DiscogsProvider implements MediaProvider {
  readonly name = 'discogs' as const;

  constructor(private readonly config: DiscogsConfig) {}

  isEnabled(): boolean {
    return Boolean(this.config.token);
  }

  private proxy(): string {
    return this.config.proxyUrl ?? '';
  }

  private wrap(url: string): string {
    const proxy = this.proxy();
    if (!proxy) return url;
    // Path-based proxy (e.g., "/discogs-api/") — extract path from the absolute URL
    if (proxy.startsWith('/') || proxy.startsWith('.')) {
      const u = new URL(url);
      const prefix = proxy.replace(/\/+$/, '');
      return `${prefix}${u.pathname}${u.search}`;
    }
    // Full URL proxy (e.g., "https://cors-proxy.example.com/") — prepend the full URL
    return `${proxy.replace(/\/+$/, '')}/${url}`;
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
    if (query.mediaType) params.set('format', query.mediaType);
    params.set('type', 'release');

    const url = `${BASE}/database/search?${params.toString()}`;
    return withCache(`discogs:search:${this.proxy()}${params.toString()}`, TTL_SEARCH, async () => {
      const data = await getHostShell().net().fetchJson<DiscogsSearchResponse>(this.wrap(url), {
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
          mediaType: detectMediaType(r.format),
          country: r.country,
          labels: r.label?.length ? r.label : undefined,
          barcode: r.barcode?.length ? r.barcode : undefined,
          community:
            r.community?.have != null
              ? { have: r.community.have, want: r.community.want ?? 0 }
              : undefined,
          discogsUrl: r.uri ? `https://www.discogs.com${r.uri}` : undefined,
          masterUrl: r.master_url ?? null,
        },
      }));
    });
  }

  async getRelease(sourceId: string): Promise<NormalizedRelease | null> {
    if (!this.isEnabled()) return null;
    const url = `${BASE}/releases/${sourceId}`;
    return withCache(`discogs:release:${this.proxy()}${sourceId}`, TTL_RELEASE, async () => {
      try {
        const r = await getHostShell().net().fetchJson<DiscogsReleaseResponse>(this.wrap(url), {
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
    const h: Record<string, string> = {
      Authorization: `Discogs token=${this.config.token}`,
    };
    // Browser fetch() forbids setting User-Agent — Tauri's net_fetch (Rust) allows it.
    // Only attach the header when the host shell will actually forward it.
    if (this.config.userAgent) h['User-Agent'] = this.config.userAgent;
    return h;
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
  const barcodeArr = r.identifiers?.filter((i) => i.type === 'Barcode').map((i) => i.value);

  const fmt = r.formats?.[0];

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
    country: r.country,
    released: r.released_formatted ?? r.released,
    labels: r.labels?.map((l) => l.name),
    format: fmt ? [fmt.name, ...(fmt.descriptions ?? [])].filter(Boolean).join(', ') : undefined,
    community:
      r.community?.have != null
        ? { have: r.community.have, want: r.community.want ?? 0 }
        : undefined,
    discogsUrl: r.uri ?? undefined,
    masterUrl: r.master_url ?? null,
    barcode: barcodeArr?.length ? barcodeArr : undefined,
    videos: r.videos?.map((v) => ({ uri: v.uri, title: v.title })),
    extraArtists: r.extraartists?.map((a) => ({ name: a.name, role: a.role ?? '' })),
  };
}

function detectMediaType(format: string[] | undefined): string | undefined {
  if (!format?.length) return undefined;
  for (const f of format) {
    const lower = f.toLowerCase();
    if (lower.includes('vinyl') || lower.includes('lp') || lower.includes('ep')) return 'vinyl';
    if (lower.includes('cd') || lower.includes('dvd')) return 'cd';
    if (lower.includes('cassette') || lower.includes('tape')) return 'cassette';
  }
  return 'other';
}
