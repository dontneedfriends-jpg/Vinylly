import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader, Button } from '@vinylly/ui';
import { StatsPanel } from '../components/StatsPanel';
import { useItems } from '../lib/queries';
import { useQueryClient } from '@tanstack/react-query';
import { useUi } from '../lib/ui-store';
import { itemRepo } from '../lib/db';
import { getProvidersRegistry } from '../lib/providers';
import { tryGetHostShell } from '@vinylly/host';

export function StatsPage() {
  const { t } = useTranslation();
  const { data: items = [] } = useItems({});
  const queryClient = useQueryClient();
  const showToast = useUi((s) => s.showToast);
  const [refreshing, setRefreshing] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const onRefresh = async () => {
    if (refreshing) return;
    const shell = tryGetHostShell();
    if (!shell) {
      showToast(t('stats:refresh.not_available'));
      return;
    }
    const registry = getProvidersRegistry();
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
    // Bounded concurrency: 4 in flight, roughly 240 req/min stays under Discogs auth rate-limit
    const queue = [...targets];
    const CONCURRENCY = 4;
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
          console.warn(`[stats] refresh failed for ${item.release.sourceId}:`, err);
          failed++;
        }
        setProgress((p) => (p ? { done: p.done + 1, total: p.total } : null));
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, () => worker()));
    setRefreshing(false);
    setProgress(null);
    await queryClient.invalidateQueries({ queryKey: ['items'] });
    if (failed > 0) {
      showToast(t('stats:refresh.done_with_failures', { updated, total: targets.length, failed }));
    } else {
      showToast(t('stats:refresh.done', { updated, total: targets.length }));
    }
  };

  const refreshLabel = refreshing && progress
    ? `${progress.done}/${progress.total}`
    : t('stats:refresh.button');

  return (
    <section className="animate-rise">
      <PageHeader
        level="h1"
        title={t('layout:nav.stats')}
        actions={
          <Button onClick={onRefresh} disabled={refreshing}>
            {refreshLabel}
          </Button>
        }
      />
      <StatsPanel />
    </section>
  );
}
