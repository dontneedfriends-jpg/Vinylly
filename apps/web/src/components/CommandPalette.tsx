import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useUi } from '../lib/ui-store';
import { useItems } from '../lib/queries';
import { useTheme } from '../lib/theme';
import { CoverImage } from './CoverImage';

interface PaletteAction {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

interface PaletteItem {
  key: string;
  kind: 'item' | 'action';
  title: string;
  subtitle?: string;
  itemId?: string;
  cover?: { releaseId: string; coverPath: string | null; coverRemote: string | null };
  run: () => void;
}

export function CommandPalette() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const openCollection = useUi((s) => s.openCollection);
  const openAdd = useUi((s) => s.openAdd);
  const openWantlist = useUi((s) => s.openWantlist);
  const openStats = useUi((s) => s.openStats);
  const openSettings = useUi((s) => s.openSettings);
  const openDetail = useUi((s) => s.openDetail);
  const cycleTheme = useTheme((s) => s.cycle);

  const { data: items = [] } = useItems({});

  // Global toggle: Ctrl/Cmd+K (and Ctrl+/).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const actions = useMemo<PaletteAction[]>(
    () => [
      { id: 'collection', label: t('layout:nav.collection'), hint: '1', run: openCollection },
      { id: 'add', label: t('layout:nav.add'), hint: '2', run: openAdd },
      { id: 'wantlist', label: t('layout:nav.wantlist'), hint: '3', run: openWantlist },
      { id: 'stats', label: t('layout:nav.stats'), hint: '4', run: openStats },
      { id: 'settings', label: t('layout:nav.settings'), hint: '5', run: openSettings },
      { id: 'theme', label: t('palette:action.theme'), run: cycleTheme },
    ],
    [t, openCollection, openAdd, openWantlist, openStats, openSettings, cycleTheme],
  );

  const results = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase();
    const actionHits = actions
      .filter((a) => !q || a.label.toLowerCase().includes(q))
      .map((a) => ({
        key: `action:${a.id}`,
        kind: 'action' as const,
        title: a.label,
        subtitle: a.hint,
        run: a.run,
      }));
    if (!q) return actionHits;
    const scored: Array<{ it: (typeof items)[number]; score: number }> = [];
    for (const it of items) {
      const title = it.release.title.toLowerCase();
      const artist = it.release.artist.toLowerCase();
      let score = -1;
      if (title.startsWith(q)) score = 3;
      else if (artist.startsWith(q)) score = 2;
      else if (title.includes(q) || artist.includes(q)) score = 1;
      if (score > 0) scored.push({ it, score });
    }
    scored.sort((a, b) => b.score - a.score || a.it.release.title.localeCompare(b.it.release.title));
    const itemHits = scored.slice(0, 8).map(({ it }) => ({
      key: `item:${it.id}`,
      kind: 'item' as const,
      title: it.release.title,
      subtitle: `${it.release.artist}${it.release.year ? ` · ${it.release.year}` : ''}`,
      itemId: it.id,
      cover: {
        releaseId: it.release.id,
        coverPath: it.release.thumbPath ?? it.release.coverPath,
        coverRemote: it.release.thumbRemote ?? it.release.coverRemote,
      },
      run: () => openDetail(it.id),
    }));
    return [...itemHits, ...actionHits];
  }, [query, items, actions, openDetail]);

  useEffect(() => {
    setCursor(0);
  }, [results.length]);

  const runAt = useCallback(
    (idx: number) => {
      const r = results[idx];
      if (!r) return;
      setOpen(false);
      r.run();
    },
    [results],
  );

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-overlay backdrop-blur-sm px-4 pt-[15vh]"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('palette:title')}
        className="rounded-base border-border-default bg-surface shadow-neu-xl w-full max-w-lg overflow-hidden border"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setCursor((c) => Math.min(c + 1, results.length - 1));
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setCursor((c) => Math.max(c - 1, 0));
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            runAt(cursor);
          }
        }}
      >
        <div className="border-border-default flex items-center gap-3 border-b px-4 py-3">
          <SearchIcon />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('palette:placeholder')}
            aria-label={t('palette:title')}
            className="text-fg-heading placeholder:text-fg-body-subtle min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
          />
          <kbd className="text-fg-body-subtle rounded-sm border-border-default bg-surface shadow-neu-2xs border px-1.5 py-0.5 text-xs">
            Esc
          </kbd>
        </div>
        <ul ref={listRef} role="listbox" aria-label={t('palette:title')} className="max-h-80 overflow-y-auto p-1.5">
          {results.length === 0 ? (
            <li className="text-fg-body-subtle px-4 py-6 text-center text-sm">
              {t('palette:empty')}
            </li>
          ) : (
            results.map((r, i) => (
              <li key={r.key} role="option" aria-selected={i === cursor}>
                <button
                  type="button"
                  onClick={() => runAt(i)}
                  onMouseEnter={() => setCursor(i)}
                  className={`flex w-full items-center gap-3 rounded-base px-3 py-2 text-left transition-neu ${
                    i === cursor ? 'shadow-neu-inset text-fg-heading' : 'text-fg-body'
                  }`}
                >
                  {r.cover ? (
                    <span className="rounded-base shadow-neu-inset block h-9 w-9 shrink-0 overflow-hidden">
                      <CoverImage
                        releaseId={r.cover.releaseId}
                        coverPath={r.cover.coverPath}
                        coverRemote={r.cover.coverRemote}
                        alt=""
                        size="thumb"
                      />
                    </span>
                  ) : (
                    <span className="text-fg-body-subtle flex h-9 w-9 shrink-0 items-center justify-center">
                      <ActionIcon />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.title}</span>
                    {r.subtitle ? (
                      <span className="text-fg-body-subtle block truncate text-xs">{r.subtitle}</span>
                    ) : null}
                  </span>
                  {i === cursor ? (
                    <kbd className="text-fg-body-subtle rounded-sm border-border-default bg-surface shadow-neu-2xs border px-1.5 py-0.5 text-xs">
                      ↵
                    </kbd>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>,
    document.body,
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-fg-body-subtle h-4 w-4 shrink-0" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
    </svg>
  );
}

function ActionIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
