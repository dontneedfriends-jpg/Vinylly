import { ProvidersRegistry, type ProvidersConfig } from '@vinylly/media-providers';
import { isTauriEnvironment } from '@vinylly/host';
import { useSettings } from './settings-store';
import { useProfileStore } from './profile-store';

const env = import.meta.env as Record<string, string | undefined>;

const DISCOGS_PROXY = env.VITE_DISCOGS_PROXY_URL ?? '';

// In browser (non-Tauri) mode, route Discogs API through Vite's dev proxy to avoid CORS.
// In Tauri mode, HTTP goes through Rust (no CORS), so no proxy is needed.
const isBrowser = !isTauriEnvironment();
const proxyUrl = DISCOGS_PROXY || (isBrowser ? '/discogs-api/' : undefined);
const caaProxyUrl = isBrowser ? '/coverartarchive' : undefined;

type CacheKey = `${string}::${string}`;
const cache = new Map<CacheKey, ProvidersRegistry>();

function buildConfig(token: string): ProvidersConfig {
  return {
    discogs: token
      ? {
          token,
          userAgent: 'Vinylly/0.1 (https://github.com/vinylly)',
          proxyUrl,
        }
      : undefined,
    caaProxyUrl,
  };
}

function registryKey(profileId: string | null, token: string): CacheKey {
  return `${profileId ?? '__none__'}::${token}`;
}

export function getProvidersRegistry(): ProvidersRegistry {
  const profileId = useProfileStore.getState().activeId;
  const token = useSettings.getState().discogsToken;
  const key = registryKey(profileId, token);
  let r = cache.get(key);
  if (!r) {
    r = new ProvidersRegistry(buildConfig(token));
    cache.set(key, r);
  }
  return r;
}

/**
 * Drop cached registries that belong to the given profile id. Called
 * after a profile is deleted or its Discogs token is cleared.
 */
export function resetProvidersRegistry(profileId?: string): void {
  if (!profileId) {
    cache.clear();
    return;
  }
  const prefix = `${profileId}::`;
  for (const key of Array.from(cache.keys())) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}
