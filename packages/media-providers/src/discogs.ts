import { withCache } from './cache';
import { extractArtist, stripArtistPrefix } from './parse';
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

/** Internal condition codes → Discogs collection-field notation. */
export const CONDITION_TO_DISCOGS: Record<string, string> = {
  M: 'Mint (M)',
  NM: 'Near Mint (NM or M-)',
  'VG+': 'Very Good Plus (VG+)',
  VG: 'Very Good (VG)',
  'G+': 'Good Plus (G+)',
  G: 'Good (G)',
  F: 'Fair (F)',
  P: 'Poor (P)',
};

/** Parse a Discogs condition string back to the internal code (null = not graded). */
export function fromDiscogsCondition(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  if (v.startsWith('near mint')) return 'NM';
  if (v.startsWith('mint')) return 'M';
  if (v.startsWith('very good plus')) return 'VG+';
  if (v.startsWith('very good')) return 'VG';
  if (v.startsWith('good plus')) return 'G+';
  if (v.startsWith('good')) return 'G';
  if (v.startsWith('fair')) return 'F';
  if (v.startsWith('poor')) return 'P';
  return null;
}

/** Parse a price from a free-form custom-field value ("$25.00", "25", "25,00 €"). */
export function parseFieldPrice(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = /(\d+(?:[.,]\d+)?)/.exec(value);
  if (!m) return null;
  const n = Number(m[1]!.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

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

interface DiscogsCollectionResponse {
  pagination: { page: number; pages: number; per_page: number; items: number };
  releases: Array<{
    instance_id: number;
    id: number;
    rating: number;
    /** Per-instance custom fields: 1 = Media Condition, 2 = Sleeve Condition, 3 = Notes. */
    notes?: Array<{ field_id: number; value: string }>;
    basic_information: {
      id: number;
      master_id: number;
      title: string;
      artists: Array<{ name: string; anv?: string }>;
      year?: number;
      genres?: string[];
      styles?: string[];
      cover_image?: string;
      thumb?: string;
      format?: string[];
    };
  }>;
}

interface DiscogsAddResponse {
  instance_id: number;
  resource_url: string;
}

interface DiscogsWantlistResponse {
  pagination: { page: number; pages: number; per_page: number; items: number };
  wants: Array<{
    id: number;
    instance_id?: number;
    rating: number;
    notes?: string;
    date_added?: string;
    basic_information: {
      id: number;
      master_id: number;
      title: string;
      artists: Array<{ name: string; anv?: string }>;
      year?: number;
      genres?: string[];
      styles?: string[];
      cover_image?: string;
      thumb?: string;
      format?: string[];
    };
  }>;
}

interface DiscogsMasterResponse {
  id: number;
  title: string;
  artists: Array<{ name: string }>;
  year?: number;
  genres?: string[];
  styles?: string[];
  images?: Array<{ uri: string; type: string; uri150?: string }>;
  tracklist?: Array<{ position: string; title: string; duration?: string }>;
  notes?: string;
}

interface DiscogsMasterVersionsResponse {
  pagination: { page: number; pages: number; per_page: number; items: number };
  versions: Array<{
    id: number;
    label?: string[];
    catno?: string | null;
    country?: string | null;
    year?: number;
    format?: string[];
    released?: string;
    thumb?: string;
    cover_image?: string;
    major_formats?: string[];
  }>;
}

interface DiscogsArtistResponse {
  id: number;
  name: string;
  namevariations?: string[];
  profile?: string;
  members?: Array<{ id: number; name: string; active?: boolean }>;
  urls?: string[];
  images?: Array<{ uri: string; type: string; uri150?: string }>;
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
      return data.results.slice(0, 50).map((r, i) => ({
        provider: this.name,
        score: 1 - i * 0.02,
        release: {
          source: this.name,
          sourceId: String(r.id),
          title: stripArtistPrefix(r.title, extractArtist(r.title)),
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
      } catch (err) {
        console.warn(`[discogs] getRelease(${sourceId}) failed:`, err);
        throw err;
      }
    }).catch((err): null => {
      // Cache layer wraps errors — already logged above on first try. Return null
      // so existing callers that pattern-match `if (fresh)` keep working.
      void err;
      return null;
    });
  }

  async getCover(sourceId: string): Promise<CoverRef | null> {
    const rel = await this.getRelease(sourceId);
    return rel?.coverUrl ? { url: rel.coverUrl } : null;
  }

  async getLyrics(_artist: string, _title: string): Promise<LyricsResult | null> {
    return null;
  }

  async fetchCollection(username: string): Promise<DiscogsCollectionResponse['releases']> {
    if (!this.isEnabled() || !username) return [];
    const perPage = 100;
    const fetchPage = (page: number) =>
      withCache(`discogs:collection:${username}:${page}`, TTL_SEARCH, async () =>
        getHostShell().net().fetchJson<DiscogsCollectionResponse>(
          this.wrap(
            `${BASE}/users/${encodeURIComponent(username)}/collection/folders/0/releases?page=${page}&per_page=${perPage}`,
          ),
          { headers: this.headers() },
        ),
      );
    const first = await fetchPage(1);
    const totalPages = first.pagination?.pages ?? 1;
    if (totalPages <= 1) return first.releases ?? [];
    // Remaining pages in parallel — sequential paging turned big collections
    // into N round-trips of pure wait.
    const rest = await Promise.all(
      Array.from({ length: Math.min(totalPages, 100) - 1 }, (_, i) => fetchPage(i + 2)),
    );
    return (first.releases ?? []).concat(...rest.map((r) => r.releases ?? []));
  }

  async addToCollection(username: string, releaseId: number): Promise<number | null> {
    if (!this.isEnabled() || !username) return null;
    const url = `${BASE}/users/${encodeURIComponent(username)}/collection/folders/0/releases/${releaseId}`;
    try {
      const data = await getHostShell().net().fetchJson<DiscogsAddResponse>(this.wrap(url), {
        method: 'POST',
        headers: this.headers(),
      });
      return data.instance_id ?? null;
    } catch (err) {
      console.warn(`[discogs] addToCollection(${username}, ${releaseId}) failed:`, err);
      return null;
    }
  }

  async removeFromCollection(username: string, releaseId: number, instanceId: number): Promise<boolean> {
    if (!this.isEnabled() || !username) return false;
    const url = `${BASE}/users/${encodeURIComponent(username)}/collection/folders/0/releases/${releaseId}/${instanceId}`;
    try {
      await getHostShell().net().fetchBinary(this.wrap(url), {
        method: 'DELETE',
        headers: this.headers(),
      });
      return true;
    } catch (err) {
      console.warn(`[discogs] removeFromCollection(${username}, ${releaseId}, ${instanceId}) failed:`, err);
      return false;
    }
  }

  /**
   * List the owner's collection fields (built-in 1-3 + custom fields 4+).
   * Used to map a custom field for purchase-price sync.
   */
  async getCollectionFields(
    username: string,
  ): Promise<Array<{ id: number; name: string; type: string; position: number }>> {
    if (!this.isEnabled() || !username) return [];
    const url = `${BASE}/users/${encodeURIComponent(username)}/collection/fields`;
    try {
      const data = await getHostShell().net().fetchJson<{
        fields: Array<{ id: number; name: string; type: string; position: number }>;
      }>(this.wrap(url), { headers: this.headers() });
      return data.fields ?? [];
    } catch (err) {
      console.warn(`[discogs] getCollectionFields(${username}) failed:`, err);
      return [];
    }
  }

  /**
   * Set a collection-instance field. Default Discogs field ids:
   * 1 = Media Condition, 2 = Sleeve Condition, 3 = Notes.
   */
  async updateCollectionField(
    username: string,
    releaseId: number,
    instanceId: number,
    fieldId: number,
    value: string,
  ): Promise<boolean> {
    if (!this.isEnabled() || !username) return false;
    const url = `${BASE}/users/${encodeURIComponent(username)}/collection/folders/0/releases/${releaseId}/${instanceId}/fields/${fieldId}`;
    try {
      await getHostShell().net().fetchJson(this.wrap(url), {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ value }),
      });
      return true;
    } catch (err) {
      console.warn(`[discogs] updateCollectionField(${username}, ${releaseId}, ${instanceId}, ${fieldId}) failed:`, err);
      return false;
    }
  }

  async fetchWantlist(username: string): Promise<DiscogsWantlistResponse['wants']> {
    if (!this.isEnabled() || !username) return [];
    const perPage = 100;
    const fetchPage = (page: number) =>
      withCache(`discogs:wantlist:${username}:${page}`, TTL_SEARCH, async () =>
        getHostShell().net().fetchJson<DiscogsWantlistResponse>(
          this.wrap(`${BASE}/users/${encodeURIComponent(username)}/wants?page=${page}&per_page=${perPage}`),
          { headers: this.headers() },
        ),
      );
    const first = await fetchPage(1);
    const totalPages = first.pagination?.pages ?? 1;
    if (totalPages <= 1) return first.wants ?? [];
    const rest = await Promise.all(
      Array.from({ length: Math.min(totalPages, 100) - 1 }, (_, i) => fetchPage(i + 2)),
    );
    return (first.wants ?? []).concat(...rest.map((r) => r.wants ?? []));
  }

  async addToWantlist(username: string, releaseId: number): Promise<boolean> {
    if (!this.isEnabled() || !username) return false;
    const url = `${BASE}/users/${encodeURIComponent(username)}/wants/${releaseId}`;
    try {
      await getHostShell().net().fetchJson<unknown>(this.wrap(url), {
        method: 'PUT',
        headers: this.headers(),
      });
      return true;
    } catch (err) {
      console.warn(`[discogs] addToWantlist(${username}, ${releaseId}) failed:`, err);
      return false;
    }
  }

  async removeFromWantlist(username: string, releaseId: number): Promise<boolean> {
    if (!this.isEnabled() || !username) return false;
    const url = `${BASE}/users/${encodeURIComponent(username)}/wants/${releaseId}`;
    try {
      await getHostShell().net().fetchBinary(this.wrap(url), {
        method: 'DELETE',
        headers: this.headers(),
      });
      return true;
    } catch (err) {
      console.warn(`[discogs] removeFromWantlist(${username}, ${releaseId}) failed:`, err);
      return false;
    }
  }

  async getMaster(masterId: number): Promise<DiscogsMasterResponse | null> {
    if (!this.isEnabled()) return null;
    const url = `${BASE}/masters/${masterId}`;
    return withCache(`discogs:master:${masterId}`, TTL_RELEASE, async () => {
      try {
        return await getHostShell().net().fetchJson<DiscogsMasterResponse>(this.wrap(url), {
          headers: this.headers(),
        });
      } catch (err) {
        console.warn(`[discogs] getMaster(${masterId}) failed:`, err);
        return null;
      }
    });
  }

  async getMasterVersions(masterId: number): Promise<DiscogsMasterVersionsResponse['versions']> {
    if (!this.isEnabled()) return [];
    const perPage = 100;
    const fetchPage = (page: number) =>
      withCache(`discogs:master-versions:${masterId}:${page}`, TTL_RELEASE, async () =>
        getHostShell().net().fetchJson<DiscogsMasterVersionsResponse>(
          this.wrap(`${BASE}/masters/${masterId}/versions?page=${page}&per_page=${perPage}`),
          { headers: this.headers() },
        ),
      );
    const first = await fetchPage(1);
    const totalPages = first.pagination?.pages ?? 1;
    if (totalPages <= 1) return first.versions ?? [];
    const rest = await Promise.all(
      Array.from({ length: Math.min(totalPages, 50) - 1 }, (_, i) => fetchPage(i + 2)),
    );
    return (first.versions ?? []).concat(...rest.map((r) => r.versions ?? []));
  }

  async getArtist(artistId: number): Promise<DiscogsArtistResponse | null> {
    if (!this.isEnabled()) return null;
    const url = `${BASE}/artists/${artistId}`;
    return withCache(`discogs:artist:${artistId}`, TTL_RELEASE, async () => {
      try {
        return await getHostShell().net().fetchJson<DiscogsArtistResponse>(this.wrap(url), {
          headers: this.headers(),
        });
      } catch (err) {
        console.warn(`[discogs] getArtist(${artistId}) failed:`, err);
        return null;
      }
    });
  }

  async searchArtist(name: string): Promise<number | null> {
    if (!this.isEnabled() || !name) return null;
    try {
      const url = `${BASE}/database/search?q=${encodeURIComponent(name)}&type=artist`;
      const data = await withCache(
        `discogs:artist-search:${name.toLowerCase()}`,
        TTL_SEARCH,
        async () =>
          getHostShell().net().fetchJson<{ results: Array<{ id: number; title: string }> }>(
            this.wrap(url),
            { headers: this.headers() },
          ),
      );
      const first = data.results?.[0];
      return first?.id ?? null;
    } catch (err) {
      console.warn(`[discogs] searchArtist(${name}) failed:`, err);
      return null;
    }
  }

  async getArtistReleaseCount(artistId: number): Promise<{ total: number; ownedIds: Set<number> } | null> {
    if (!this.isEnabled()) return null;
    try {
      // Fetch first page only — Discogs caps releases per page at 50/100 depending on auth.
      // We use 100 to get a wider sample and trust the local count for owned IDs.
      const url = `${BASE}/artists/${artistId}/releases?per_page=100&page=1`;
      const data = await withCache(`discogs:artist-releases:${artistId}`, TTL_RELEASE, async () => {
        return getHostShell().net().fetchJson<{
          pagination: { items: number; pages: number };
          releases: Array<{ id: number; type: string }>;
        }>(this.wrap(url), { headers: this.headers() });
      });
      const ownedIds = new Set<number>();
      for (const r of data.releases ?? []) {
        if (r.type === 'master' || r.type === 'release') ownedIds.add(r.id);
      }
      // `pagination.items` is total across all pages
      return { total: data.pagination?.items ?? ownedIds.size, ownedIds };
    } catch (err) {
      console.warn(`[discogs] getArtistReleaseCount(${artistId}) failed:`, err);
      return null;
    }
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
    title: stripArtistPrefix(r.title, r.artists?.[0]?.name ?? extractArtist(r.title)),
    artist: r.artists?.[0]?.name ?? extractArtist(r.title),
    year: r.year ?? null,
    genres: r.genres ?? [],
    styles: r.styles ?? [],
    coverUrl: primary?.uri ?? null,
    thumbUrl: primary?.uri150 ?? null,
    images: r.images?.map((i) => ({
      type: i.type,
      uri: i.uri,
      uri150: i.uri150 ?? null,
    })) ?? undefined,
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
        ? {
            have: r.community.have,
            want: r.community.want ?? 0,
            rating: r.community.rating?.average != null
              ? { average: r.community.rating.average, count: r.community.rating.count ?? 0 }
              : undefined,
          }
        : undefined,
    numForSale: r.num_for_sale,
    lowestPrice: r.lowest_price,
    discogsUrl: r.uri ?? undefined,
    masterUrl: r.master_url ?? null,
    masterId: r.master_id ?? null,
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
