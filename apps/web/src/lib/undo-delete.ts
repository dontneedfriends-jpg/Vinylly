import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUi } from './ui-store';

export interface UndoableDelete<T> {
  /** Schedule an item for deletion: shows undo toast, commits after the grace period. */
  schedule(item: T, message: string): void;
  /** Item currently hidden pending commit (or already committed, awaiting source confirmation). */
  pending: T | null;
  /** Clear the pending marker — call once the data source confirms the item is gone. */
  clearPending(): void;
}

/**
 * Unified destructive-action flow: every delete in the app goes through the
 * same 4-second undo toast with a snapshot, instead of ad-hoc instant deletes.
 *
 * Race safety: a monotonic token invalidates older timers; scheduling a new
 * delete flushes (commits) the previous one immediately.
 */
export function useUndoableDelete<T extends { id: string }>(
  commit: (item: T, clear: () => void) => void,
  duration = 4000,
): UndoableDelete<T> {
  const { t } = useTranslation();
  const showToast = useUi((s) => s.showToast);
  const hideToast = useUi((s) => s.hideToast);
  const [pending, setPending] = useState<T | null>(null);
  const pendingRef = useRef<T | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenRef = useRef(0);
  const commitRef = useRef(commit);
  commitRef.current = commit;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearPending = useCallback(() => {
    pendingRef.current = null;
    setPending(null);
  }, []);

  const commitPending = useCallback(() => {
    clearTimer();
    const item = pendingRef.current;
    if (!item) return;
    pendingRef.current = null;
    // Keep `pending` set — the caller clears it via clearPending() once the
    // data source confirms removal, so the row never flashes back.
    commitRef.current(item, clearPending);
  }, [clearTimer, clearPending]);

  const schedule = useCallback(
    (item: T, message: string) => {
      commitPending();
      const myToken = ++tokenRef.current;
      pendingRef.current = item;
      setPending(item);
      showToast(message, {
        label: t('common:button.undo'),
        onClick: () => {
          clearTimer();
          tokenRef.current += 1;
          pendingRef.current = null;
          setPending(null);
          hideToast();
        },
      });
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (tokenRef.current !== myToken) return;
        commitPending();
      }, duration);
    },
    [commitPending, clearTimer, showToast, hideToast, t, duration],
  );

  useEffect(() => clearTimer, [clearTimer]);

  return { schedule, pending, clearPending };
}
