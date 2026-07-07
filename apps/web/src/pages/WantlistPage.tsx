import { useTranslation } from 'react-i18next';
import { Button, PageHeader, Card, EmptyState } from '@vinylly/ui';
import { useUi } from '../lib/ui-store';
import { useRemoveFromWantlist, useWantlist } from '../lib/queries';
import type { WantlistEntry } from '@vinylly/db';
import { CoverImage } from '../components/CoverImage';

export function WantlistPage() {
  const { t } = useTranslation();
  const openCollection = useUi((s) => s.openCollection);
  const openAdd = useUi((s) => s.openAdd);
  const { data: entries = [], isLoading } = useWantlist();

  return (
    <section className="animate-rise">
      <PageHeader
        level="h1"
        title={t('wantlist:page.title')}
        subtitle={
          entries.length === 0
            ? t('wantlist:page.subtitle_empty')
            : t('wantlist:page.subtitle', { count: entries.length })
        }
        actions={
          <Button variant="brand" onClick={() => openAdd()} leftIcon={<PlusIcon />}>
            {t('wantlist:page.add_button')}
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="h-64 animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          title={t('wantlist:empty.title')}
          description={t('wantlist:empty.suggestion')}
          action={
            <Button variant="brand" onClick={() => openAdd()}>
              {t('wantlist:empty.add_button')}
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {entries.map((entry) => (
            <WantlistTile key={entry.id} entry={entry} />
          ))}
        </div>
      )}

      <div className="mt-8">
        <Button variant="neutral" onClick={openCollection} leftIcon={<BackIcon />} size="sm">
          {t('common:button.back')}
        </Button>
      </div>
    </section>
  );
}

function WantlistTile({ entry }: { entry: WantlistEntry }) {
  const { t } = useTranslation();
  const removeFromWantlist = useRemoveFromWantlist();
  const openReleasePreview = useUi((s) => s.openReleasePreview);

  return (
    <Card className="group relative flex h-full flex-col p-0">
      <button
        type="button"
        onClick={() => removeFromWantlist.mutate(entry.id)}
        className="text-fg-danger hover:text-fg-danger-strong hover:shadow-neu-2xs absolute right-2 top-2 z-10 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full opacity-0 transition-[box-shadow,color,opacity] duration-200 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
        aria-label={t('wantlist:item.remove_aria')}
      >
        <TrashIcon />
      </button>
      <button
        type="button"
        onClick={() => openReleasePreview(entry.release.id)}
        className="flex h-full flex-col p-5 text-left"
        aria-label={t('wantlist:item.open_aria', { title: entry.release.title })}
      >
        <div className="rounded-base shadow-neu-inset aspect-square overflow-hidden">
          <CoverImage
            releaseId={entry.release.id}
            coverPath={entry.release.coverPath}
            coverRemote={entry.release.coverRemote}
            alt={entry.release.title}
            size="thumb"
          />
        </div>
        <div className="flex flex-1 flex-col justify-end pt-5">
          {entry.release.year ? (
            <div className="text-fg-body-subtle text-xs">{entry.release.year}</div>
          ) : null}
          <h3 className="text-fg-heading mt-1 line-clamp-1 text-base font-semibold leading-tight">
            {entry.release.title}
          </h3>
          <p className="text-fg-body-subtle mt-1 line-clamp-1 text-sm leading-relaxed">
            {entry.release.artist}
          </p>
          {entry.notes ? (
            <p className="text-fg-body-subtle mt-2 line-clamp-2 text-xs italic">{entry.notes}</p>
          ) : null}
        </div>
      </button>
    </Card>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <path d="M12 8v8M8 12h8" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <path d="M19 12H5m6-6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}