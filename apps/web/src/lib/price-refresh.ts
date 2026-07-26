import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import type { ItemRecord } from '@vinylly/db';
import { itemRepo } from './db';
import { getProvidersRegistry } from './providers';
import { useUi } from './ui-store';

export interface PriceRefresh {
  refresh(items: ItemRecord[]): Promise<void>;
  refreshing: boolean;
  progress: { done: number; total: number } | null;
  canRefresh: boolean;
}

/**
 * Batch-refresh Discogs market data (lowestPrice / numForSale / community)
 * for every discogs-sourced release. Bounded concurrency 4 ≈ 240 req/min,
 * under the authenticated Discogs rate limit.
 */
export function usePriceRefresh(): PriceRefresh {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const showToast = useUi((s) => s.showToast);
  const [refreshing, setRefreshing] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const registry = getProvidersRegistry();
  const canRefresh = Boolean(registry.discogs?.isEnabled());

  const refresh = useCallback(
    async (items: ItemRecord[]) => {
      if (refreshing) return;
      const discogs = registry.discogs;
      if (!discogs?.isEnabled()) {
        showToast(t('stats:refresh.discogs_required'));
        return;
      }
      const targets = items.filter((i) => i.release.source === 'discogs' && i.release.sourceId);
      if (!targets.length) {
        showToast(t('stats:refresh.no_targets'));
        return;
      }
      setRefreshing(true);
      setProgress({ done: 0, total: targets.length });
      let updated = 0;
      let failed = 0;
      const queue = [...targets];
      async function worker(): Promise<void> {
        while (queue.length > 0) {
          const item = queue.shift();
          if (!item) return;
          try {
            const fresh = await discogs!.getRelease(item.release.sourceId);
            if (fresh) {
              await itemRepo.setReleaseMarketData(item.release.id, {
                lowestPrice: fresh.lowestPrice ?? null,
                numForSale: fresh.numForSale ?? null,
              });
              if (fresh.community) {
                await itemRepo.setReleaseCommunityStats(item.release.id, {
                  have: fresh.community.have ?? null,
                  want: fresh.community.want ?? null,
                  ratingAvg: fresh.community.rating?.average ?? null,
                  ratingCount: fresh.community.rating?.count ?? null,
                });
              }
              updated++;
            }
          } catch (err) {
            console.warn(`[price-refresh] failed for ${item.release.sourceId}:`, err);
            failed++;
          }
          setProgress({ done: updated + failed, total: targets.length });
        }
      }
      await Promise.all(Array.from({ length: Math.min(4, targets.length) }, () => worker()));
      setRefreshing(false);
      setProgress(null);
      await queryClient.invalidateQueries({ queryKey: ['items'] });
      showToast(
        failed > 0
          ? t('stats:refresh.done_with_failures', { updated, total: targets.length, failed })
          : t('stats:refresh.done', { updated, total: targets.length }),
      );
    },
    [refreshing, registry, queryClient, showToast, t],
  );

  return { refresh, refreshing, progress, canRefresh };
}
