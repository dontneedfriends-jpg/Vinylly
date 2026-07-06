import { DiscogsProvider, type DiscogsConfig } from './discogs';
import { MusicBrainzProvider } from './musicbrainz';
import { LastFmProvider, type LastFmConfig } from './lastfm';
import { GeniusProvider, type GeniusConfig } from './genius';
import { LrclibProvider } from './lrclib';
import type { MediaProvider, SearchQuery, SearchResult } from './types';

export interface DiscogsCollectionRelease {
  instanceId: number;
  discogsId: number;
  title: string;
  artist: string;
  year: number | null;
  genres: string[];
  styles: string[];
  coverUrl: string | null;
  thumbUrl: string | null;
  type: 'vinyl' | 'cd' | 'cassette' | 'other';
}

export interface DiscogsWantlistRelease {
  instanceId: number;
  discogsId: number;
  masterId: number | null;
  title: string;
  artist: string;
  year: number | null;
  genres: string[];
  styles: string[];
  coverUrl: string | null;
  thumbUrl: string | null;
  type: 'vinyl' | 'cd' | 'cassette' | 'other';
}

export interface DiscogsMasterVersion {
  id: number;
  label: string | null;
  catno: string | null;
  country: string | null;
  year: number | null;
  format: string;
  coverUrl: string | null;
  thumbUrl: string | null;
  released: string | null;
}

export interface DiscogsMasterInfo {
  id: number;
  title: string;
  artist: string;
  year: number | null;
  genres: string[];
  styles: string[];
  trackCount: number;
  coverUrl: string | null;
  thumbUrl: string | null;
}

export interface ProvidersConfig {
  discogs?: DiscogsConfig;
  lastfm?: LastFmConfig;
  genius?: GeniusConfig;
  caaProxyUrl?: string;
}

export class ProvidersRegistry {
  readonly discogs?: DiscogsProvider;
  readonly musicbrainz: MusicBrainzProvider;
  readonly lastfm?: LastFmProvider;
  readonly genius?: GeniusProvider;
  readonly lrclib = new LrclibProvider();

  constructor(cfg: ProvidersConfig) {
    this.musicbrainz = new MusicBrainzProvider(cfg.caaProxyUrl);
    if (cfg.discogs) this.discogs = new DiscogsProvider(cfg.discogs);
    if (cfg.lastfm) this.lastfm = new LastFmProvider(cfg.lastfm);
    if (cfg.genius) this.genius = new GeniusProvider(cfg.genius);
  }

  all(): MediaProvider[] {
    return [this.discogs, this.musicbrainz, this.lastfm].filter(Boolean) as MediaProvider[];
  }

  lyricsProviders(): MediaProvider[] {
    return [this.lrclib, this.genius].filter((p) => p?.isEnabled()) as MediaProvider[];
  }

  async fetchDiscogsCollection(username: string): Promise<DiscogsCollectionRelease[]> {
    if (!this.discogs?.isEnabled()) return [];
    try {
      const releases = await this.discogs.fetchCollection(username);
      return releases.map((r) => {
        const bi = r.basic_information;
        const fmt = bi.format?.[0]?.toLowerCase() ?? '';
        const detectedType = fmt.includes('vinyl') || fmt.includes('lp') || fmt.includes('ep')
          ? ('vinyl' as const)
          : fmt.includes('cd') || fmt.includes('dvd')
            ? ('cd' as const)
            : fmt.includes('cassette') || fmt.includes('tape')
              ? ('cassette' as const)
              : ('other' as const);
        return {
          instanceId: r.instance_id,
          discogsId: bi.id,
          title: bi.title,
          artist: bi.artists?.[0]?.name ?? '',
          year: bi.year ?? null,
          genres: bi.genres ?? [],
          styles: bi.styles ?? [],
          coverUrl: bi.cover_image ?? null,
          thumbUrl: bi.thumb ?? null,
          type: detectedType,
        };
      });
    } catch (err) {
      console.warn(`[discogs] fetchDiscogsCollection(${username}) failed:`, err);
      return [];
    }
  }

  async addToDiscogsCollection(username: string, discogsReleaseId: number): Promise<number | null> {
    if (!this.discogs?.isEnabled() || !username) return null;
    try {
      return await this.discogs.addToCollection(username, discogsReleaseId);
    } catch (err) {
      console.warn(`[discogs] addToDiscogsCollection(${username}, ${discogsReleaseId}) failed:`, err);
      return null;
    }
  }

  async removeFromDiscogsCollection(username: string, discogsReleaseId: number, instanceId: number): Promise<boolean> {
    if (!this.discogs?.isEnabled() || !username) return false;
    try {
      return await this.discogs.removeFromCollection(username, discogsReleaseId, instanceId);
    } catch (err) {
      console.warn(`[discogs] removeFromDiscogsCollection(${username}, ${discogsReleaseId}, ${instanceId}) failed:`, err);
      return false;
    }
  }

  async fetchDiscogsWantlist(username: string): Promise<DiscogsWantlistRelease[]> {
    if (!this.discogs?.isEnabled()) return [];
    try {
      const wants = await this.discogs.fetchWantlist(username);
      return wants.map((r) => {
        const bi = r.basic_information;
        const fmt = bi.format?.[0]?.toLowerCase() ?? '';
        const detectedType = fmt.includes('vinyl') || fmt.includes('lp') || fmt.includes('ep')
          ? ('vinyl' as const)
          : fmt.includes('cd') || fmt.includes('dvd')
            ? ('cd' as const)
            : fmt.includes('cassette') || fmt.includes('tape')
              ? ('cassette' as const)
              : ('other' as const);
        return {
          instanceId: r.instance_id ?? 0,
          discogsId: bi.id,
          masterId: bi.master_id ?? null,
          title: bi.title,
          artist: bi.artists?.[0]?.name ?? '',
          year: bi.year ?? null,
          genres: bi.genres ?? [],
          styles: bi.styles ?? [],
          coverUrl: bi.cover_image ?? null,
          thumbUrl: bi.thumb ?? null,
          type: detectedType,
        };
      });
    } catch (err) {
      console.warn(`[discogs] fetchDiscogsWantlist(${username}) failed:`, err);
      return [];
    }
  }

  async addToDiscogsWantlist(username: string, releaseId: number): Promise<boolean> {
    if (!this.discogs?.isEnabled() || !username) return false;
    try {
      return await this.discogs.addToWantlist(username, releaseId);
    } catch (err) {
      console.warn(`[discogs] addToDiscogsWantlist(${username}, ${releaseId}) failed:`, err);
      return false;
    }
  }

  async removeFromDiscogsWantlist(username: string, releaseId: number): Promise<boolean> {
    if (!this.discogs?.isEnabled() || !username) return false;
    try {
      return await this.discogs.removeFromWantlist(username, releaseId);
    } catch (err) {
      console.warn(`[discogs] removeFromDiscogsWantlist(${username}, ${releaseId}) failed:`, err);
      return false;
    }
  }

  async getMaster(masterId: number): Promise<DiscogsMasterInfo | null> {
    if (!this.discogs?.isEnabled()) return null;
    try {
      const m = await this.discogs.getMaster(masterId);
      if (!m) return null;
      const primary = m.images?.find((i) => i.type === 'primary') ?? m.images?.[0];
      return {
        id: m.id,
        title: m.title,
        artist: m.artists?.[0]?.name ?? '',
        year: m.year ?? null,
        genres: m.genres ?? [],
        styles: m.styles ?? [],
        trackCount: m.tracklist?.length ?? 0,
        coverUrl: primary?.uri ?? null,
        thumbUrl: primary?.uri150 ?? null,
      };
    } catch (err) {
      console.warn(`[discogs] getMaster(${masterId}) failed:`, err);
      return null;
    }
  }

  async getMasterVersions(masterId: number): Promise<DiscogsMasterVersion[]> {
    if (!this.discogs?.isEnabled()) return [];
    try {
      const versions = await this.discogs.getMasterVersions(masterId);
      return versions.map((v) => {
        const fmt = v.major_formats?.[0] ?? v.format?.[0] ?? '';
        return {
          id: v.id,
          label: v.label?.[0] ?? null,
          catno: v.catno ?? null,
          country: v.country ?? null,
          year: v.year ?? null,
          format: fmt,
          coverUrl: v.cover_image ?? null,
          thumbUrl: v.thumb ?? null,
          released: v.released ?? null,
        };
      });
    } catch (err) {
      console.warn(`[discogs] getMasterVersions(${masterId}) failed:`, err);
      return [];
    }
  }

  async findArtistId(name: string): Promise<number | null> {
    if (!this.discogs?.isEnabled()) return null;
    try {
      return await this.discogs.searchArtist(name);
    } catch (err) {
      console.warn(`[discogs] findArtistId(${name}) failed:`, err);
      return null;
    }
  }

  async getArtistReleaseCount(artistId: number): Promise<{ total: number; ownedIds: Set<number> } | null> {
    if (!this.discogs?.isEnabled()) return null;
    try {
      return await this.discogs.getArtistReleaseCount(artistId);
    } catch (err) {
      console.warn(`[discogs] getArtistReleaseCount(${artistId}) failed:`, err);
      return null;
    }
  }

  async getRelatedArtists(artistName: string): Promise<string[]> {
    if (!this.lastfm?.isEnabled()) return [];
    try {
      return await this.lastfm.getRelatedArtists(artistName);
    } catch (err) {
      console.warn(`[lastfm] getRelatedArtists(${artistName}) failed:`, err);
      return [];
    }
  }

  async searchAll(query: SearchQuery): Promise<SearchResult[]> {
    // Fire Discogs + MusicBrainz in parallel
    const [discogsResults, mbResults] = await Promise.all([
      this.discogs?.isEnabled()
        ? this.discogs.search(query).catch(() => [] as SearchResult[])
        : Promise.resolve([] as SearchResult[]),
      this.musicbrainz.search(query).catch(() => [] as SearchResult[]),
    ]);

    // Discogs is primary: if it returned anything, use only Discogs
    if (discogsResults.length > 0) return discogsResults;

    // Fallback to MusicBrainz
    if (mbResults.length > 0) return mbResults;

    // Last resort: Last.fm
    if (this.lastfm?.isEnabled()) {
      try {
        return await this.lastfm.search(query);
      } catch {
        // no more fallbacks
      }
    }

    return [];
  }
}

export * from './types';
export { DiscogsProvider, MusicBrainzProvider, LastFmProvider, GeniusProvider, LrclibProvider };
export type { DiscogsConfig, LastFmConfig, GeniusConfig };
export {
  cacheCover,
  ensureReleaseAssets,
  type CachedCover,
  type CachedImage,
  type CacheCoverOptions,
} from './assets';
