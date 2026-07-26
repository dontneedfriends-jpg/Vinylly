import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ItemRecord, WantlistEntry } from '@vinylly/db';
import { getProvidersRegistry } from '../lib/providers';
import type { DiscogsMasterVersion } from '@vinylly/media-providers';

interface Props {
  masterId: number;
  ownedItems: ItemRecord[];
  wantedReleases: WantlistEntry[];
  currentSourceId: string;
}

type MasterState =
  | { kind: 'loading' }
  | { kind: 'ready'; versions: DiscogsMasterVersion[] }
  | { kind: 'error'; message: string };

export function MasterVariants({ masterId, ownedItems, wantedReleases, currentSourceId }: Props) {
  const { t } = useTranslation();
  const [state, setState] = useState<MasterState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    void (async () => {
      const registry = getProvidersRegistry();
      if (!registry.discogs?.isEnabled()) {
        if (!cancelled) setState({ kind: 'error', message: t('detail:variants.discogs_disabled') });
        return;
      }
      try {
        const versions = await registry.getMasterVersions(masterId);
        if (!cancelled) setState({ kind: 'ready', versions });
      } catch (err) {
        if (!cancelled) {
          console.warn('[variants] fetch failed:', err);
          setState({ kind: 'error', message: String(err) });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [masterId, t]);

  if (state.kind === 'loading') {
    return (
      <div className="text-fg-body-subtle text-sm">{t('common:loading.generic')}</div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="text-fg-danger text-xs">{t('detail:variants.error', { error: state.message })}</div>
    );
  }

  if (!state.versions.length) {
    return <div className="text-fg-body-subtle text-sm">{t('detail:variants.empty')}</div>;
  }

  const ownedSourceIds = new Set(ownedItems.map((it) => it.release.sourceId));
  const wantedSourceIds = new Set(wantedReleases.map((w) => w.release.sourceId));
  const sorted = [...state.versions].sort((a, b) => {
    const oa = String(a.id) === currentSourceId ? -1 : 0;
    const ob = String(b.id) === currentSourceId ? -1 : 0;
    if (oa !== ob) return oa - ob;
    return (a.year ?? 9999) - (b.year ?? 9999);
  });

  return (
    <div className="rounded-base border-border-default bg-surface shadow-neu-inset border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-fg-body-subtle border-border-default border-b text-left text-xs">
            <th className="px-3 py-2 font-medium">{t('detail:variants.label')}</th>
            <th className="px-3 py-2 font-medium">{t('detail:variants.country')}</th>
            <th className="px-3 py-2 font-medium">{t('detail:variants.year')}</th>
            <th className="px-3 py-2 font-medium">{t('detail:variants.format')}</th>
            <th className="px-3 py-2 text-right font-medium">{t('detail:variants.status')}</th>
          </tr>
        </thead>
        <tbody className="divide-border-default divide-y">
          {sorted.map((v) => {
            const owned = ownedSourceIds.has(String(v.id));
            const wanted = wantedSourceIds.has(String(v.id));
            const isCurrent = String(v.id) === currentSourceId;
            return (
              <tr
                key={v.id}
                className={
                  isCurrent
                    ? 'bg-brand-softer text-fg-heading font-medium'
                    : 'text-fg-body hover:bg-brand-softer/40 transition-[background-color] duration-200'
                }
              >
                <td className="px-3 py-2">
                  <span className="block truncate">{v.label ?? '—'}</span>
                  <span className="text-fg-body-subtle block truncate font-mono text-xs">
                    {v.catno ?? '—'}
                  </span>
                </td>
                <td className="px-3 py-2">{v.country ?? '—'}</td>
                <td className="px-3 py-2">{v.year ?? '—'}</td>
                <td className="px-3 py-2 text-xs">{v.format || '—'}</td>
                <td className="px-3 py-2 text-right text-xs">
                  {isCurrent ? (
                    <span className="text-fg-brand font-medium">●</span>
                  ) : owned ? (
                    <span className="text-fg-success-strong">{t('detail:variants.owned')}</span>
                  ) : wanted ? (
                    <span className="text-fg-warning">{t('detail:variants.wanted')}</span>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="text-fg-body-subtle border-border-default border-t px-3 py-2 text-xs">
        {t('detail:variants.total', { count: state.versions.length })}
      </div>
    </div>
  );
}