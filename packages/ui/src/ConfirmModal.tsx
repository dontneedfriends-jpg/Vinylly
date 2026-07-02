import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';
import type { ButtonVariant } from './Button';

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  variant = 'danger',
  loading = false,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const el = document.querySelector<HTMLButtonElement>('[data-confirm-cancel]');
    el?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="mx-4 w-full max-w-sm rounded-base border-border-default bg-surface shadow-neu-xl border p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 text-center">
          <h2 className="text-fg-heading text-lg font-semibold">{title}</h2>
        </div>
        <div className="mb-6 text-center">
          <p className="text-fg-body text-sm leading-relaxed">{message}</p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="neutral"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
            <span data-confirm-cancel className="hidden" />
          </Button>
          <Button
            variant={variant}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? '…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
