import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';
import type { ButtonVariant } from './Button';
import { useDialogA11y } from './useDialogA11y';

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: ButtonVariant;
  /** Alias of `variant="danger"`. Kept for caller readability. */
  destructive?: boolean;
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
  variant,
  destructive,
  loading = false,
}: ConfirmModalProps) {
  const resolvedVariant: ButtonVariant = destructive ? 'danger' : variant ?? 'danger';
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogA11y(dialogRef, open, onCancel);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-overlay backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
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
          </Button>
          <Button
            variant={resolvedVariant}
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
