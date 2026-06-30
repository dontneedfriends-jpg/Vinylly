import { ProvidersRegistry, type ProvidersConfig } from '@vinylly/media-providers';
import { isTauriEnvironment } from '@vinylly/host';
import { useSettings } from './settings-store';

const env = import.meta.env as Record<string, string | undefined>;

const DISCOGS_PROXY = env.VITE_DISCOGS_PROXY_URL ?? '';

// In browser (non-Tauri) mode, route Discogs API through Vite's dev proxy to avoid CORS.
// In Tauri mode, HTTP goes through Rust (no CORS), so no proxy is needed.
const isBrowser = !isTauriEnvironment();
const proxyUrl = DISCOGS_PROXY || (isBrowser ? '/discogs-api/' : undefined);
const caaProxyUrl = isBrowser ? '/coverartarchive' : undefined;

let cached: { token: string; registry: ProvidersRegistry } | null = null;

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

export function getProvidersRegistry(): ProvidersRegistry {
  const token = useSettings.getState().discogsToken;
  if (cached && cached.token === token) return cached.registry;
  const registry = new ProvidersRegistry(buildConfig(token));
  cached = { token, registry };
  return registry;
}

export function resetProvidersRegistry(): void {
  cached = null;
}
