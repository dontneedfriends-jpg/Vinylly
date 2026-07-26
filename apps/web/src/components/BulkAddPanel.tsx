import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Card, CardBody, Badge, Textarea, ConditionPicker, Input } from '@vinylly/ui';
import { ensureReleaseAssets, fromDiscogsCondition, type NormalizedRelease } from '@vinylly/media-providers';
import type { MediaType } from '@vinylly/db';
import { itemRepo } from '../lib/db';
import { useDefaultCollection } from '../lib/queries';
import { useSettings } from '../lib/settings-store';
import { useUi } from '../lib/ui-store';
import { getProvidersRegistry } from '../lib/providers';
import { createThrottle, parseBulkInput, type BulkLine } from '../lib/bulk-add';
import { parseDiscogsCsv, type DiscogsCsvRow } from '../lib/discogs-csv';
import { CoverImage } from './CoverImage';
import { ImportProgress } from './ImportProgress';
import { useTypeLabels } from '../lib/type-labels';

type RowStatus =
  | 'pending'
  | 'searching'
  | 'matched'
  | 'not_found'
  | 'duplicate'
  | 'importing'
  | 'imported'
  | 'failed'
  | 'skipped';

interface BulkRow {
  id: number;
  line: BulkLine;
  status: RowStatus;
  release: NormalizedRelease | null;
  error: string | null;
  include: boolean;
  /** Per-row overrides — empty means "fall back to CSV value, then bulk default". */
  sleeve: string;
  media: string;
  price: number | null;
}

type Phase = 'input' | 'resolving' | 'review' | 'importing' | 'done';

const RESOLVE_INTERVAL_MS = 1100; // ~54 req/min — under Discogs 60 req/min auth limit

export function BulkAddPanel() {
  const { t } = useTranslation();
  const typeLabels = useTypeLabels();
  const { data: collection } = useDefaultCollection();
  const discogsUsername = useSettings((s) => s.discogsUsername);
  const discogsSyncEnabled = useSettings((s) => s.discogsSyncEnabled);
  const discogsPriceFieldId = useSettings((s) => s.discogsPriceFieldId);
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<Phase>('input');
  const [rawInput, setRawInput] = useState('');
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [defaultType, setDefaultType] = useState<MediaType>('other');
  const [bulkSleeve, setBulkSleeve] = useState('');
  const [bulkMedia, setBulkMedia] = useState('');
  const [syncDiscogs, setSyncDiscogs] = useState(true);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [csvByRow, setCsvByRow] = useState<Map<number, DiscogsCsvRow>>(new Map());
  const [csvError, setCsvError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const cancelRef = useRef(false);
  const rowIdRef = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const canSync = Boolean(discogsUsername) && discogsSyncEnabled;

  const patchRow = useCallback((id: number, patch: Partial<BulkRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const onResolve = useCallback(async () => {
    const lines = parseBulkInput(rawInput);
    if (!lines.length) return;
    cancelRef.current = false;
    setCsvByRow(new Map());
    const initial: BulkRow[] = lines.map((line) => ({
      id: ++rowIdRef.current,
      line,
      status: 'pending',
      release: null,
      error: null,
      include: false,
      sleeve: '',
      media: '',
      price: null,
    }));
    setRows(initial);
    setPhase('resolving');
    const throttle = createThrottle(RESOLVE_INTERVAL_MS);
    const registry = getProvidersRegistry();

    for (const row of initial) {
      if (cancelRef.current) {
        patchRow(row.id, { status: 'skipped' });
        continue;
      }
      patchRow(row.id, { status: 'searching' });
      await throttle();
      try {
        let release: NormalizedRelease | null = null;
        if (row.line.directId) {
          release = (await registry.discogs?.getRelease(row.line.directId)) ?? null;
        } else {
          const hits = await registry.searchAll(row.line.query);
          release = hits[0]?.release ?? null;
        }
        if (!release) {
          patchRow(row.id, { status: 'not_found', include: false });
          continue;
        }
        const existing = await itemRepo.findBySource(release.source, release.sourceId);
        if (existing) {
          patchRow(row.id, { status: 'duplicate', release, include: false });
        } else {
          patchRow(row.id, { status: 'matched', release, include: true });
        }
      } catch (err) {
        patchRow(row.id, { status: 'not_found', error: String(err), include: false });
      }
    }
    setPhase('review');
  }, [rawInput, patchRow]);

  /** Discogs CSV export → rows with direct ids; conditions/type ride along. */
  const onCsvFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      setCsvError(null);
      const text = await file.text();
      const parsed = parseDiscogsCsv(text);
      if (!parsed) {
        setCsvError(t('add:bulk.csv_error'));
        return;
      }
      cancelRef.current = false;
      const csv = new Map<number, DiscogsCsvRow>();
      const initial: BulkRow[] = parsed.map((row) => {
        const id = ++rowIdRef.current;
        csv.set(id, row);
        const line: BulkLine = row.releaseId
          ? { raw: `${row.artist} — ${row.title}`, kind: 'discogs_id', query: {}, directId: row.releaseId }
          : { raw: `${row.artist} — ${row.title}`, kind: 'text', query: { text: `${row.artist} ${row.title}` } };
        return { id, line, status: 'pending', release: null, error: null, include: false, sleeve: '', media: '', price: null };
      });
      setCsvByRow(csv);
      setRows(initial);
      setPhase('resolving');
      const throttle = createThrottle(RESOLVE_INTERVAL_MS);
      const registry = getProvidersRegistry();
      for (const row of initial) {
        if (cancelRef.current) {
          patchRow(row.id, { status: 'skipped' });
          continue;
        }
        patchRow(row.id, { status: 'searching' });
        await throttle();
        try {
          let release: NormalizedRelease | null = null;
          if (row.line.directId) {
            release = (await registry.discogs?.getRelease(row.line.directId)) ?? null;
          } else {
            const hits = await registry.searchAll(row.line.query);
            release = hits[0]?.release ?? null;
          }
          if (!release) {
            patchRow(row.id, { status: 'not_found', include: false });
            continue;
          }
          const existing = await itemRepo.findBySource(release.source, release.sourceId);
          if (existing) {
            patchRow(row.id, { status: 'duplicate', release, include: false });
          } else {
            patchRow(row.id, { status: 'matched', release, include: true });
          }
        } catch (err) {
          patchRow(row.id, { status: 'not_found', error: String(err), include: false });
        }
      }
      setPhase('review');
    },
    [patchRow, t],
  );

  const onImport = useCallback(async () => {
    if (!collection) return;
    cancelRef.current = false;
    const targets = rows.filter((r) => r.include && r.status === 'matched' && r.release);
    if (!targets.length) return;
    setPhase('importing');
    setProgress({ done: 0, total: targets.length });
    const throttle = createThrottle(RESOLVE_INTERVAL_MS);
    const registry = getProvidersRegistry();

    let done = 0;
    for (const row of targets) {
      if (cancelRef.current) break;
      const release = row.release!;
      patchRow(row.id, { status: 'importing' });
      try {
        const csv = csvByRow.get(row.id);
        const type =
          csv?.mediaType && csv.mediaType !== 'other'
            ? csv.mediaType
            : ((release.mediaType as MediaType | undefined) ?? defaultType);
        // Precedence: per-row override → CSV value → bulk default.
        const sleeveCondition =
          row.sleeve ||
          (csv?.sleeveCondition ? fromDiscogsCondition(csv.sleeveCondition) : null) ||
          bulkSleeve ||
          null;
        const mediaCondition =
          row.media ||
          (csv?.mediaCondition ? fromDiscogsCondition(csv.mediaCondition) : null) ||
          bulkMedia ||
          null;
        const created = await itemRepo.create({
          collectionId: collection.id,
          type,
          release: {
            source: release.source,
            sourceId: release.sourceId,
            title: release.title,
            artist: release.artist,
            year: release.year,
            masterId: release.masterId,
            genres: release.genres,
            styles: release.styles,
          },
          tracklist: release.tracklist?.map((tr) => ({
            position: tr.position,
            title: tr.title,
            duration: tr.durationMs ?? null,
          })),
          barcode: release.barcode?.[0] ?? (row.line.kind === 'barcode' ? row.line.raw : null),
          catalogNumber: csv?.catalogNumber ?? (row.line.kind === 'catno' ? row.line.raw : null),
          purchasePrice: row.price,
          sleeveCondition,
          mediaCondition,
          notes: csv?.notes ?? null,
        });
        const assets = await ensureReleaseAssets(release, created.release.id);
        if (assets.coverPath || assets.coverRemote) {
          await itemRepo.setReleaseCover(created.release.id, {
            coverPath: assets.coverPath,
            thumbPath: assets.thumbPath,
            coverRemote: assets.coverRemote,
            thumbRemote: assets.thumbRemote,
          });
        }
        if (assets.images.length) {
          await itemRepo.setReleaseImages(created.release.id, assets.images);
        }
        if (syncDiscogs && canSync && release.source === 'discogs') {
          await throttle();
          const instanceId = await registry.addToDiscogsCollection(
            discogsUsername!,
            Number(release.sourceId),
          );
          if (instanceId != null) {
            await itemRepo.update(created.id, { discogsInstanceId: instanceId });
            if (mediaCondition || sleeveCondition) {
              void registry.syncConditionToDiscogs(discogsUsername!, Number(release.sourceId), instanceId, {
                mediaCondition,
                sleeveCondition,
              });
            }
            if (row.price != null && discogsPriceFieldId != null) {
              void registry.syncPriceToDiscogs(
                discogsUsername!,
                Number(release.sourceId),
                instanceId,
                row.price,
                discogsPriceFieldId,
              );
            }
          }
        }
        patchRow(row.id, { status: 'imported' });
      } catch (err) {
        patchRow(row.id, { status: 'failed', error: String(err) });
      }
      done += 1;
      setProgress({ done, total: targets.length });
    }
    await queryClient.invalidateQueries({ queryKey: ['items'] });
    setPhase('done');
  }, [rows, collection, defaultType, bulkSleeve, bulkMedia, syncDiscogs, canSync, discogsUsername, patchRow, queryClient, csvByRow, discogsPriceFieldId]);

  const counts = useMemo(() => {
    const c = { matched: 0, not_found: 0, duplicate: 0, imported: 0, failed: 0, included: 0 };
    for (const r of rows) {
      if (r.status === 'matched') c.matched += 1;
      if (r.status === 'not_found') c.not_found += 1;
      if (r.status === 'duplicate') c.duplicate += 1;
      if (r.status === 'imported') c.imported += 1;
      if (r.status === 'failed') c.failed += 1;
      if (r.include && r.status === 'matched') c.included += 1;
    }
    return c;
  }, [rows]);

  const onReset = () => {
    setPhase('input');
    setRows([]);
    setProgress(null);
  };

  /* ─── Input phase ─── */
  if (phase === 'input') {
    const lineCount = parseBulkInput(rawInput).length;
    return (
      <Card>
        <CardBody className="flex flex-col gap-4">
          <Textarea
            label={t('add:bulk.input_label')}
            placeholder={t('add:bulk.input_placeholder')}
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            rows={8}
          />
          <p className="text-fg-body-subtle text-xs">{t('add:bulk.input_hint')}</p>
          {csvError ? <p className="text-fg-danger text-xs">{csvError}</p> : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void onResolve()} disabled={!lineCount} leftIcon={<SearchIcon />}>
              {t('add:bulk.resolve_button', { count: lineCount })}
            </Button>
            <Button variant="neutral" onClick={() => fileRef.current?.click()} leftIcon={<UploadIcon />}>
              {t('add:bulk.csv_button')}
            </Button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={(e) => void onCsvFile(e)} className="hidden" />
          </div>
        </CardBody>
      </Card>
    );
  }

  /* ─── Resolving / review / importing / done ─── */
  return (
    <div className="flex flex-col gap-4">
      {/* Status summary */}
      <Card>
        <CardBody className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <SummaryItem label={t('add:bulk.summary_found')} value={counts.matched} tone="text-fg-success-strong" />
          <SummaryItem label={t('add:bulk.summary_not_found')} value={counts.not_found} tone="text-fg-body-subtle" />
          <SummaryItem label={t('add:bulk.summary_duplicates')} value={counts.duplicate} tone="text-fg-warning" />
          {phase === 'done' ? (
            <>
              <SummaryItem label={t('add:bulk.summary_imported')} value={counts.imported} tone="text-fg-success-strong" />
              <SummaryItem label={t('add:bulk.summary_failed')} value={counts.failed} tone="text-fg-danger" />
            </>
          ) : null}
          {phase === 'resolving' ? (
            <span className="text-fg-body-subtle text-sm">{t('add:bulk.resolving')}</span>
          ) : null}
        </CardBody>
      </Card>

      {progress ? <ImportProgress done={progress.done} total={progress.total} /> : null}

      {/* Rows */}
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <BulkRowView
            key={row.id}
            row={row}
            typeLabels={typeLabels}
            expanded={expandedRows.has(row.id)}
            onToggleExpand={
              phase === 'review' && row.status === 'matched'
                ? () =>
                    setExpandedRows((prev) => {
                      const next = new Set(prev);
                      if (next.has(row.id)) next.delete(row.id);
                      else next.add(row.id);
                      return next;
                    })
                : undefined
            }
            onPatch={(patch) => patchRow(row.id, patch)}
            onToggle={
              phase === 'review' && row.status === 'matched'
                ? () => patchRow(row.id, { include: !row.include })
                : undefined
            }
          />
        ))}
      </ul>

      {/* Actions */}
      {phase === 'resolving' ? (
        <div className="flex gap-2">
          <Button
            variant="neutral"
            onClick={() => {
              cancelRef.current = true;
              setPhase('review');
            }}
          >
            {t('add:bulk.stop_resolving')}
          </Button>
        </div>
      ) : null}

      {phase === 'review' ? (
        <Card>
          <CardBody className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
              <div>
                <span className="text-fg-heading mb-2 block text-sm font-medium">
                  {t('add:bulk.default_type')}
                </span>
                <div className="flex gap-1">
                  {(['vinyl', 'cd', 'cassette', 'other'] as const).map((mt) => (
                    <button
                      key={mt}
                      type="button"
                      onClick={() => setDefaultType(mt)}
                      aria-pressed={defaultType === mt}
                      className={`rounded-base px-3 py-1.5 text-xs font-medium transition-neu ${
                        defaultType === mt
                          ? 'bg-surface text-fg-brand-strong shadow-neu-sm border border-border-default'
                          : 'text-fg-body-subtle hover:text-fg-body border border-transparent hover:shadow-neu-2xs'
                      }`}
                    >
                      {typeLabels[mt]}
                    </button>
                  ))}
                </div>
              </div>
              <ConditionPicker
                label={t('detail:my_notes.sleeve')}
                value={bulkSleeve}
                onChange={setBulkSleeve}
              />
              <ConditionPicker
                label={t('detail:my_notes.media')}
                value={bulkMedia}
                onChange={setBulkMedia}
              />
              {canSync ? (
                <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={syncDiscogs}
                    onChange={(e) => setSyncDiscogs(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <span className="text-fg-body-subtle">{t('add:form.sync_discogs')}</span>
                </label>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void onImport()} disabled={!counts.included} leftIcon={<CheckIcon />}>
                {t('add:bulk.import_button', { count: counts.included })}
              </Button>
              <Button variant="neutral" onClick={onReset}>
                {t('add:bulk.back_to_input')}
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {phase === 'importing' ? (
        <div className="flex gap-2">
          <Button variant="neutral" onClick={() => (cancelRef.current = true)}>
            {t('add:bulk.stop_importing')}
          </Button>
        </div>
      ) : null}

      {phase === 'done' ? (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => useUi.getState().openCollection()} leftIcon={<CheckIcon />}>
            {t('add:bulk.goto_collection')}
          </Button>
          <Button variant="neutral" onClick={onReset}>
            {t('add:bulk.again')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function SummaryItem({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <span className="flex items-baseline gap-2 text-sm">
      <span className="text-fg-body-subtle">{label}</span>
      <span className={`font-semibold tabular-nums ${tone}`}>{value}</span>
    </span>
  );
}

function BulkRowView({
  row,
  typeLabels,
  onToggle,
  expanded = false,
  onToggleExpand,
  onPatch,
}: {
  row: BulkRow;
  typeLabels: Record<MediaType, string>;
  onToggle?: () => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
  onPatch?: (patch: Partial<BulkRow>) => void;
}) {
  const { t } = useTranslation();
  const rel = row.release;

  const statusBadge = (() => {
    switch (row.status) {
      case 'pending':
        return <Badge tone="neu">{t('add:bulk.status.pending')}</Badge>;
      case 'searching':
        return <Badge tone="neu">{t('add:bulk.status.searching')}</Badge>;
      case 'matched':
        return <Badge tone="brand">{t('add:bulk.status.matched')}</Badge>;
      case 'not_found':
        return <Badge tone="warning">{t('add:bulk.status.not_found')}</Badge>;
      case 'duplicate':
        return <Badge tone="neu">{t('add:bulk.status.duplicate')}</Badge>;
      case 'importing':
        return <Badge tone="brand">{t('add:bulk.status.importing')}</Badge>;
      case 'imported':
        return <Badge tone="success">{t('add:bulk.status.imported')}</Badge>;
      case 'failed':
        return <Badge tone="danger">{t('add:bulk.status.failed')}</Badge>;
      case 'skipped':
        return <Badge tone="neu">{t('add:bulk.status.skipped')}</Badge>;
    }
  })();

  return (
    <li className="rounded-base border-border-default bg-surface shadow-neu-2xs border">
      <div className="flex items-center gap-3 px-4 py-3">
        {onToggle ? (
          <input
            type="checkbox"
            checked={row.include}
            onChange={onToggle}
            className="h-4 w-4 shrink-0"
            aria-label={t('add:bulk.include_aria', { title: rel?.title ?? row.line.raw })}
          />
        ) : null}
        <span className="rounded-base shadow-neu-inset block h-12 w-12 shrink-0 overflow-hidden">
          {rel ? (
            <CoverImage
              releaseId={`bulk-${row.id}`}
              coverPath={null}
              coverRemote={rel.thumbUrl ?? rel.coverUrl}
              alt={rel.title}
              size="thumb"
            />
          ) : (
            <span className="text-fg-body-subtle flex h-full w-full items-center justify-center text-xs">?</span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-fg-heading block truncate text-sm font-medium">
            {rel ? rel.title : row.line.raw}
          </span>
          <span className="text-fg-body-subtle block truncate text-xs">
            {rel
              ? `${rel.artist}${rel.year ? ` · ${rel.year}` : ''}${
                  rel.mediaType ? ` · ${typeLabels[rel.mediaType as MediaType] ?? rel.mediaType}` : ''
                }`
              : t(`add:bulk.kind.${row.line.kind}`)}
          </span>
          {row.error ? (
            <span className="text-fg-danger block truncate text-xs">{row.error}</span>
          ) : null}
          {row.status === 'matched' && (row.sleeve || row.media || row.price != null) ? (
            <span className="text-fg-brand block truncate text-xs">
              {[row.sleeve || null, row.media || null, row.price != null ? `$${row.price.toFixed(2)}` : null]
                .filter(Boolean)
                .join(' · ')}
            </span>
          ) : null}
        </span>
        {onToggleExpand ? (
          <button
            type="button"
            onClick={onToggleExpand}
            aria-expanded={expanded}
            aria-label={t('add:bulk.row_edit_aria', { title: rel?.title ?? row.line.raw })}
            className={`inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-base transition-neu ${
              expanded ? 'text-fg-brand-strong shadow-neu-inset' : 'text-fg-body-subtle hover:text-fg-body hover:shadow-neu-2xs'
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`h-4 w-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} aria-hidden>
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : null}
        {statusBadge}
      </div>
      {expanded && onPatch ? (
        <div className="border-border-default flex flex-wrap items-end gap-x-6 gap-y-4 border-t px-4 py-4">
          <ConditionPicker
            label={t('detail:my_notes.sleeve')}
            value={row.sleeve}
            onChange={(v) => onPatch({ sleeve: v })}
          />
          <ConditionPicker
            label={t('detail:my_notes.media')}
            value={row.media}
            onChange={(v) => onPatch({ media: v })}
          />
          <div className="w-32">
            <Input
              label={t('add:form.purchase_price')}
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={row.price ?? ''}
              onChange={(e) => onPatch({ price: e.target.value ? Number(e.target.value) : null })}
            />
          </div>
        </div>
      ) : null}
    </li>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-4 w-4" aria-hidden>
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <path d="M12 16V4M6 10l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 20h16" strokeLinecap="round" />
    </svg>
  );
}
