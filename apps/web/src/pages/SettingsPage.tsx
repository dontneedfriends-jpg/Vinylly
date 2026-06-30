import { useState } from 'react';
import { Badge, Card, CardBody, CardHeader, CardFooter, Button, Input, PageHeader } from '@vinylly/ui';
import { useUi } from '../lib/ui-store';
import { itemRepo, trackRepo } from '../lib/db';
import { useDefaultCollection, useItems } from '../lib/queries';
import {
  buildBundle,
  bundleToCsv,
  bundleToJson,
  downloadFile,
  parseBundle,
  readFileText,
} from '../lib/import-export';
import { useSettings } from '../lib/settings-store';
import { resetProvidersRegistry } from '../lib/providers';
import { getHostShell } from '@vinylly/host';
import type { CreateItemInput, TrackRecord } from '@vinylly/db';

type Status = { kind: 'idle' | 'ok' | 'error'; message: string };

export function SettingsPage() {
  const openCollection = useUi((s) => s.openCollection);
  const { data: collection } = useDefaultCollection();
  const { data: items = [] } = useItems({});
  const discogsToken = useSettings((s) => s.discogsToken);
  const setDiscogsToken = useSettings((s) => s.setDiscogsToken);
  const clearDiscogsToken = useSettings((s) => s.clearDiscogsToken);
  const [status, setStatus] = useState<Status>({ kind: 'idle', message: '' });
  const [busy, setBusy] = useState(false);

  const onExportJson = async () => {
    const tracksByRelease = await loadAllTracks(items.map((it) => it.release.id));
    const bundle = buildBundle(items, tracksByRelease);
    const date = new Date().toISOString().slice(0, 10);
    downloadFile(`vinylly-${date}.json`, bundleToJson(bundle), 'application/json');
    setStatus({ kind: 'ok', message: `Экспортировано ${items.length} релизов в JSON.` });
  };

  const onExportCsv = async () => {
    const tracksByRelease = await loadAllTracks(items.map((it) => it.release.id));
    const bundle = buildBundle(items, tracksByRelease);
    const date = new Date().toISOString().slice(0, 10);
    downloadFile(`vinylly-${date}.csv`, bundleToCsv(bundle), 'text/csv;charset=utf-8');
    setStatus({ kind: 'ok', message: `Экспортировано ${items.length} релизов в CSV.` });
  };

  const onImport = async (file: File) => {
    if (!collection) return;
    setBusy(true);
    try {
      const raw = await readFileText(file);
      const bundle = parseBundle(raw);
      let added = 0;
      for (const it of bundle.items) {
        const input: CreateItemInput = {
          collectionId: collection.id,
          type: it.type,
          release: {
            source: it.release.source,
            sourceId: it.release.sourceId,
            title: it.release.title,
            artist: it.release.artist,
            year: it.release.year,
            genres: it.release.genres,
            styles: it.release.styles,
            coverPath: it.release.coverPath,
            thumbPath: it.release.thumbPath,
            coverRemote: it.release.coverRemote,
            thumbRemote: it.release.thumbRemote,
          },
          tracklist: it.tracklist.map((t) => ({
            position: t.position,
            title: t.title,
            duration: t.duration,
          })),
          notes: it.notes,
          location: it.location,
          tags: it.tags,
          acquiredAt: it.acquiredAt,
          barcode: it.barcode,
          catalogNumber: it.catalogNumber,
          sleeveCondition: it.sleeveCondition,
          mediaCondition: it.mediaCondition,
        };
        await itemRepo.create(input);
        added += 1;
      }
      setStatus({ kind: 'ok', message: `Импортировано ${added} релизов.` });
    } catch (e) {
      setStatus({ kind: 'error', message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="animate-rise">
      <PageHeader
        title="Настройки"
        subtitle="API-ключи, импорт и экспорт коллекции, бэкап данных."
        actions={
          <Button variant="neutral" onClick={openCollection} leftIcon={<BackIcon />}>
            К коллекции
          </Button>
        }
      />

      <div className="flex flex-col gap-6">
        <DiscogsCard
          token={discogsToken}
          onSave={setDiscogsToken}
          onClear={clearDiscogsToken}
        />

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader className="pt-8 pb-6">
              <div className="flex items-start gap-5">
                <div className="rounded-base bg-surface shadow-neu-inset flex h-11 w-11 shrink-0 items-center justify-center">
                  <ExportIcon />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <h3 className="text-fg-heading text-base font-semibold leading-tight">Экспорт</h3>
                  <p className="text-fg-body-subtle mt-2 text-xs leading-snug">
                    Скачайте коллекцию в файл
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardBody className="py-6 px-12">
              <p className="text-fg-body-subtle text-[15px] leading-relaxed">
                В коллекции сейчас:{' '}
                <span className="text-fg-heading font-medium">{items.length}</span> релиз(ов).
                Экспорт включает метаданные и треклист (без обложек).
              </p>
            </CardBody>
            <CardFooter className="pt-5 pb-8">
              <div className="ml-auto flex flex-wrap items-center gap-3">
                <Button variant="neutral" onClick={onExportCsv} disabled={items.length === 0}>
                  Скачать CSV
                </Button>
                <Button onClick={onExportJson} disabled={items.length === 0}>
                  Скачать JSON
                </Button>
              </div>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader className="pt-8 pb-6">
              <div className="flex items-start gap-5">
                <div className="rounded-base bg-surface shadow-neu-inset flex h-11 w-11 shrink-0 items-center justify-center">
                  <ImportIcon />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <h3 className="text-fg-heading text-base font-semibold leading-tight">Импорт</h3>
                  <p className="text-fg-body-subtle mt-2 text-xs leading-snug">
                    Загрузите ранее экспортированный файл
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardBody className="py-6 px-12">
              <p className="text-fg-body-subtle text-[15px] leading-relaxed">
                Импортируйте ранее экспортированный JSON. Релизы добавляются к коллекции; дубликаты
                по source+sourceId не создаются.
              </p>
              {busy ? <p className="text-fg-body-subtle mt-3 text-sm">Импортирую…</p> : null}
            </CardBody>
            <CardFooter className="pt-5 pb-8">
              <div className="ml-auto">
                <label className="border-border-default bg-surface text-fg-heading rounded-base shadow-neu-sm hover:shadow-neu-md active:shadow-neu-inset inline-flex cursor-pointer items-center gap-2.5 border px-5 py-2.5 text-sm font-medium transition-all duration-200 ease-in-out">
                  <UploadIcon />
                  <span>Выбрать файл…</span>
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void onImport(f);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>

      {status.kind !== 'idle' ? (
        <div className="mt-6">
          <Alert tone={status.kind === 'error' ? 'danger' : 'success'}>{status.message}</Alert>
        </div>
      ) : null}
    </section>
  );
}

interface DiscogsCardProps {
  token: string;
  onSave(token: string): Promise<void>;
  onClear(): Promise<void>;
}

function DiscogsCard({ token, onSave, onClear }: DiscogsCardProps) {
  const [draft, setDraft] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle', message: '' });
  const [testResult, setTestResult] = useState<Status | null>(null);
  const [busy, setBusy] = useState<'save' | 'clear' | 'test' | null>(null);

  const hasToken = Boolean(token);
  const dirty = draft.trim() !== '' && draft.trim() !== token;

  const displayValue = revealed && !dirty && hasToken ? token : draft;
  const inputType = !hasToken ? 'password' : revealed && !dirty ? 'text' : 'password';

  const onSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const next = draft.trim();
    if (!next) {
      setStatus({ kind: 'error', message: 'Введите токен, прежде чем сохранить.' });
      return;
    }
    setBusy('save');
    setStatus({ kind: 'idle', message: '' });
    setTestResult(null);
    try {
      await onSave(next);
      resetProvidersRegistry();
      setDraft('');
      setRevealed(false);
      setStatus({ kind: 'ok', message: 'Токен сохранён. Поиск Discogs активирован.' });
    } catch (err) {
      setStatus({ kind: 'error', message: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const onClearClick = async () => {
    setBusy('clear');
    setStatus({ kind: 'idle', message: '' });
    setTestResult(null);
    try {
      await onClear();
      resetProvidersRegistry();
      setDraft('');
      setRevealed(false);
      setConfirmingDelete(false);
      setStatus({ kind: 'ok', message: 'Токен удалён.' });
    } catch (err) {
      setStatus({ kind: 'error', message: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const onTest = async () => {
    setBusy('test');
    setTestResult(null);
    setStatus({ kind: 'idle', message: '' });
    try {
      const shell = getHostShell();
      const res = await shell.net().fetchJson<{ username?: string }>(
        'https://api.discogs.com/oauth/identity',
        { headers: { Authorization: `Discogs token=${token}` } },
      );
      const who = res.username ? ` (@${res.username})` : '';
      setTestResult({ kind: 'ok', message: `Подключение установлено${who}.` });
    } catch (err) {
      const msg = (err as Error).message ?? 'неизвестная ошибка';
      setTestResult({
        kind: 'error',
        message: `Не удалось подключиться: ${msg}. Проверьте токен и интернет-соединение.`,
      });
    } finally {
      setBusy(null);
    }
  };

  const toggleReveal = () => {
    if (!hasToken) return;
    if (revealed) {
      setRevealed(false);
      setDraft('');
    } else {
      setRevealed(true);
    }
  };

  return (
    <Card>
      <CardHeader className="pt-8 pb-6">
        <div className="flex items-start gap-5">
          <div className="rounded-base bg-brand-softer border-border-brand-subtle flex h-12 w-12 shrink-0 items-center justify-center border">
            <VinylIcon />
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <h3 className="text-fg-heading text-lg font-semibold leading-tight">Discogs</h3>
            <p className="text-fg-body-subtle mt-2 text-sm leading-snug">
              Поиск релизов, обложки и треклисты
            </p>
          </div>
          <Badge tone={hasToken ? 'success' : 'warning'} pill>
            {hasToken ? 'Настроено' : 'Не задано'}
          </Badge>
        </div>
      </CardHeader>
      <CardBody className="space-y-8 py-6 px-12">
        <p className="text-fg-body text-[15px] leading-relaxed">
          Чтобы искать релизы и подгружать метаданные, нужен{' '}
          <a
            href="https://www.discogs.com/settings/developers"
            target="_blank"
            rel="noopener noreferrer"
            className="text-fg-brand-strong hover:text-fg-heading font-medium underline decoration-border-brand decoration-1 underline-offset-4 transition-colors"
          >
            Personal Access Token
          </a>{' '}
          из настроек разработчика Discogs.{' '}
          <a
            href="https://www.discogs.com/settings/developers"
            target="_blank"
            rel="noopener noreferrer"
            className="text-fg-body-subtle hover:text-fg-heading inline-flex items-center gap-1 transition-colors"
          >
            Открыть инструкцию
            <ArrowUpRightIcon />
          </a>
        </p>

        <form onSubmit={onSubmit} className="space-y-6">
          <Input
            label="Personal Access Token"
            type={inputType}
            value={displayValue}
            onChange={(e) => {
              setDraft(e.target.value);
              if (revealed && !hasToken) setRevealed(false);
            }}
            placeholder={
              hasToken
                ? revealed
                  ? 'Токен отображается'
                  : '••••••••••••••••••••••••••'
                : 'Вставьте токен сюда'
            }
            autoComplete="off"
            spellCheck={false}
            leftIcon={<KeyIcon />}
            rightIcon={
              hasToken ? (
                <button
                  type="button"
                  onClick={toggleReveal}
                    aria-label={revealed ? 'Скрыть токен' : 'Показать токен'}
                    className="text-fg-body hover:text-fg-heading pointer-events-auto inline-flex h-6 w-6 items-center justify-center rounded transition-colors"
                  >
                  {revealed ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              ) : null
            }
            helperText={
              hasToken
                ? revealed
                  ? 'Сейчас отображается сохранённый токен. Чтобы заменить, начните вводить новое значение.'
                  : 'Введите новое значение, чтобы заменить текущий токен.'
                : 'Токен сохранится локально и будет использоваться только для запросов к api.discogs.com.'
            }
          />

          {hasToken && confirmingDelete ? (
            <div className="rounded-base border-border-danger-subtle bg-danger-soft flex flex-wrap items-center gap-5 px-6 py-5 animate-rise">
              <AlertIcon className="text-fg-danger-strong h-5 w-5 shrink-0" />
              <span className="text-fg-body text-[15px] leading-relaxed">
                Удалить сохранённый токен? Поиск и подгрузка перестанут работать.
              </span>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={busy === 'clear'}
                >
                  Отмена
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={onClearClick}
                  disabled={busy === 'clear'}
                >
                  {busy === 'clear' ? 'Удаляю…' : 'Да, удалить'}
                </Button>
              </div>
            </div>
          ) : null}

          {status.kind !== 'idle' ? (
            <Alert tone={status.kind === 'error' ? 'danger' : 'success'}>{status.message}</Alert>
          ) : null}

          {testResult ? (
            <Alert tone={testResult.kind === 'error' ? 'danger' : 'success'}>
              {testResult.message}
            </Alert>
          ) : null}
        </form>
      </CardBody>
      <CardFooter className="pt-5 pb-8">
        <div className="ml-auto flex flex-wrap items-center gap-3">
          {hasToken && !confirmingDelete ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmingDelete(true)}
              disabled={busy !== null}
            >
              Удалить
            </Button>
          ) : null}
          {hasToken ? (
            <Button
              type="button"
              variant="neutral"
              onClick={onTest}
              disabled={busy !== null}
              leftIcon={busy === 'test' ? undefined : <BoltIcon />}
            >
              {busy === 'test' ? 'Проверяю…' : 'Проверить подключение'}
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={onSubmit}
            leftIcon={busy === 'save' ? undefined : <CheckIcon />}
            disabled={!dirty || busy !== null}
          >
            {busy === 'save'
              ? 'Сохраняю…'
              : hasToken
                ? 'Сохранить изменения'
                : 'Сохранить токен'}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

type AlertTone = 'success' | 'danger' | 'warning' | 'brand';

function Alert({
  tone,
  children,
}: {
  tone: AlertTone;
  children: React.ReactNode;
}) {
  const toneClasses: Record<AlertTone, string> = {
    success: 'bg-success-soft text-fg-success-strong border-border-success-subtle',
    danger: 'bg-danger-soft text-fg-danger-strong border-border-danger-subtle',
    warning: 'bg-warning-soft text-fg-warning border-border-default',
    brand: 'bg-brand-softer text-fg-brand-strong border-border-brand-subtle',
  };
  const iconClasses: Record<AlertTone, string> = {
    success: 'text-fg-success-strong',
    danger: 'text-fg-danger-strong',
    warning: 'text-fg-warning',
    brand: 'text-fg-brand-strong',
  };
  return (
    <div
      role="status"
      className={`flex items-start gap-4 rounded-base border px-6 py-5 text-[15px] leading-relaxed animate-rise ${toneClasses[tone]}`}
    >
      <span className={`mt-0.5 shrink-0 ${iconClasses[tone]}`}>
        {tone === 'success' ? (
          <CheckIcon />
        ) : tone === 'danger' ? (
          <AlertIcon />
        ) : tone === 'warning' ? (
          <AlertIcon />
        ) : (
          <InfoIcon />
        )}
      </span>
      <span className="flex-1">{children}</span>
    </div>
  );
}

async function loadAllTracks(releaseIds: string[]): Promise<Map<string, TrackRecord[]>> {
  const out = new Map<string, TrackRecord[]>();
  for (const id of releaseIds) {
    const tracks = await trackRepo.listByRelease(id);
    out.set(id, tracks);
  }
  return out;
}

function BackIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function VinylIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="text-fg-brand-strong h-6 w-6"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2.5" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="h-4 w-4"
      aria-hidden
    >
      <circle cx="8" cy="15" r="4" />
      <path d="M10.85 12.15L19 4M15 8l3 3M18 5l3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M3 3l18 18M10.6 6.1A10.7 10.7 0 0 1 12 6c6.5 0 10 6 10 6a17.6 17.6 0 0 1-3.2 4M6.6 6.6A17.7 17.7 0 0 0 2 12s3.5 6 10 6c1.4 0 2.7-.2 3.9-.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14.1 14.1A3 3 0 0 1 9.9 9.9" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AlertIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-4 w-4"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowUpRightIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-3.5 w-3.5"
      aria-hidden
    >
      <path d="M7 17L17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M12 16V4M6 10l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 20h16" strokeLinecap="round" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="text-fg-body-subtle h-5 w-5"
      aria-hidden
    >
      <path d="M12 4v12M8 8l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" strokeLinecap="round" />
    </svg>
  );
}

function ImportIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="text-fg-body-subtle h-5 w-5"
      aria-hidden
    >
      <path d="M12 16V4M8 12l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 20h16" strokeLinecap="round" />
    </svg>
  );
}
