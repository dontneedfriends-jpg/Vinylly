import { DiscogsProvider, type DiscogsConfig } from './discogs';
import { MusicBrainzProvider } from './musicbrainz';
import { LastFmProvider, type LastFmConfig } from './lastfm';
import { GeniusProvider, type GeniusConfig } from './genius';
import { LrclibProvider } from './lrclib';
import type { MediaProvider, SearchQuery, SearchResult } from './types';

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
