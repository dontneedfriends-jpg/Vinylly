import { useTranslation } from 'react-i18next';
import { PageHeader, Button } from '@vinylly/ui';
import { StatsPanel } from '../components/StatsPanel';
import { useItems } from '../lib/queries';
import { usePriceRefresh } from '../lib/price-refresh';

export function StatsPage() {
  const { t } = useTranslation();
  const { data: items = [] } = useItems({});
  const { refresh, refreshing, progress, canRefresh } = usePriceRefresh();

  const refreshLabel = refreshing && progress
    ? `${progress.done}/${progress.total}`
    : t('stats:refresh.button');

  return (
    <section className="animate-rise">
      <PageHeader
        level="h1"
        title={t('layout:nav.stats')}
        actions={
          canRefresh ? (
            <Button onClick={() => void refresh(items)} disabled={refreshing}>
              {refreshLabel}
            </Button>
          ) : undefined
        }
      />
      <StatsPanel />
    </section>
  );
}
