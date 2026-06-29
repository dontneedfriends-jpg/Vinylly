import { DiscogsProvider, type DiscogsConfig } from './discogs';
import { MusicBrainzProvider } from './musicbrainz';
import { LastFmProvider, type LastFmConfig } from './lastfm';
import { GeniusProvider, type GeniusConfig } from './genius';
import type { MediaProvider, SearchQuery, SearchResult } from './types';

export interface ProvidersConfig {
  discogs?: DiscogsConfig;
  lastfm?: LastFmConfig;
  genius?: GeniusConfig;
}

export class ProvidersRegistry {
  readonly discogs?: DiscogsProvider;
  readonly musicbrainz = new MusicBrainzProvider();
  readonly lastfm?: LastFmProvider;
  readonly genius?: GeniusProvider;

  constructor(cfg: ProvidersConfig) {
    if (cfg.discogs) this.discogs = new DiscogsProvider(cfg.discogs);
    if (cfg.lastfm) this.lastfm = new LastFmProvider(cfg.lastfm);
    if (cfg.genius) this.genius = new GeniusProvider(cfg.genius);
  }

  all(): MediaProvider[] {
    return [this.discogs, this.musicbrainz, this.lastfm].filter(Boolean) as MediaProvider[];
  }

  async searchAll(query: SearchQuery): Promise<SearchResult[]> {
    const out: SearchResult[] = [];
    await Promise.all(
      this.all().map(async (p) => {
        try {
          const r = await p.search(query);
          out.push(...r);
        } catch {
          // provider failures must not break the whole search
        }
      }),
    );
    return out.sort((a, b) => b.score - a.score);
  }
}

export * from './types';
export { DiscogsProvider, MusicBrainzProvider, LastFmProvider, GeniusProvider };
export type { DiscogsConfig, LastFmConfig, GeniusConfig };
export {
  cacheCover,
  ensureReleaseAssets,
  type CachedCover,
  type CacheCoverOptions,
} from './assets';
