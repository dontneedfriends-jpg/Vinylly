import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Button, ConfirmModal, Input, useDialogA11y } from '@vinylly/ui';
import { useProfileStore } from '../lib/profile-store';
import { switchActiveProfile } from '../lib/db';
import { ProfileSettings } from './ProfileSettings';

interface ProfileManagerProps {
  open: boolean;
  onClose(): void;
}

export function ProfileManager({ open, onClose }: ProfileManagerProps) {
  const { t } = useTranslation();
  const profiles = useProfileStore((s) => s.profiles);
  const activeId = useProfileStore((s) => s.activeId);
  const createProfile = useProfileStore((s) => s.createProfile);
  const renameProfile = useProfileStore((s) => s.renameProfile);
  const deleteProfile = useProfileStore((s) => s.deleteProfile);
  const switchProfile = useProfileStore((s) => s.switchProfile);
  const [newLabel, setNewLabel] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [settingsFor, setSettingsFor] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogA11y(dialogRef, open, onClose);

  useEffect(() => {
    if (!open) {
      setNewLabel('');
      setEditingId(null);
      setConfirmDeleteId(null);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const onCreate = async () => {
    const label = newLabel.trim();
    if (!label) return;
    try {
      await createProfile(label);
      setNewLabel('');
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const onSwitch = async (id: string) => {
    if (id === activeId) return;
    await switchProfile(id);
    await switchActiveProfile(id);
  };

  const onSaveRename = async () => {
    if (!editingId) return;
    const label = editingLabel.trim();
    if (!label) return;
    try {
      await renameProfile(editingId, label);
      setEditingId(null);
      setEditingLabel('');
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const onConfirmDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      await deleteProfile(confirmDeleteId);
      setConfirmDeleteId(null);
      setError(null);
      // switchActiveProfile happens inside store; ensure DB reflects active.
      const next = useProfileStore.getState().activeId;
      if (next) await switchActiveProfile(next);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const targetDelete = profiles.find((p) => p.id === confirmDeleteId);

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-overlay backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-manager-title"
    >
      <div ref={dialogRef} className="rounded-base border-border-default bg-surface shadow-neu-xl relative isolate w-full max-w-lg overflow-hidden border">
        <header className="border-border-default flex items-center justify-between border-b px-6 py-4">
          <h2 id="profile-manager-title" className="text-fg-heading text-lg font-semibold">
            {t('profile:manager.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-fg-body-subtle hover:text-fg-heading inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-base transition-neu"
            aria-label={t('common:button.close')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="flex flex-col gap-4 p-6">
          {error ? (
            <div className="rounded-base border-border-danger-subtle bg-danger-soft text-fg-danger border px-4 py-2 text-sm">
              {error}
            </div>
          ) : null}

          <ul className="rounded-base border-border-default bg-surface shadow-neu-inset divide-border-default divide-y border">
            {profiles.map((p) => {
              const isActive = p.id === activeId;
              const isEditing = editingId === p.id;
              return (
                <li
                  key={p.id}
                  className={`flex items-center gap-3 px-4 py-3 text-sm ${isActive ? 'text-fg-heading' : 'text-fg-body'}`}
                >
                  {isEditing ? (
                    <>
                      <Input
                        value={editingLabel}
                        onChange={(e) => setEditingLabel(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void onSaveRename();
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                      />
                      <Button size="sm" onClick={() => void onSaveRename()}>
                        {t('common:button.save')}
                      </Button>
                      <Button size="sm" variant="neutral" onClick={() => setEditingId(null)}>
                        {t('common:button.cancel')}
                      </Button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => void onSwitch(p.id)}
                        className={`flex min-w-0 flex-1 items-center gap-2 rounded-base px-2 py-1 text-left text-sm transition-neu ${
                          isActive
                            ? 'shadow-neu-inset font-semibold'
                            : 'hover:shadow-neu-2xs'
                        }`}
                        aria-current={isActive ? 'true' : undefined}
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                          {isActive ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="text-fg-heading h-4 w-4" aria-hidden>
                              <path d="M5 12l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : null}
                        </span>
                        <span className="truncate">{p.label}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(p.id);
                          setEditingLabel(p.label);
                        }}
                        className="text-fg-body-subtle hover:text-fg-heading inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-base transition-neu"
                        aria-label={t('profile:manager.rename_aria', { label: p.label })}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
                          <path d="M4 20h4l11-11-4-4L4 16v4z" strokeLinejoin="round" />
                          <path d="M14 5l4 4" strokeLinecap="round" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSettingsFor(p.id)}
                        className="text-fg-body-subtle hover:text-fg-heading inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-base transition-neu"
                        aria-label={t('profile:manager.settings_aria', { label: p.label })}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
                          <circle cx="12" cy="12" r="3" />
                          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(p.id)}
                        disabled={profiles.length <= 1}
                        className="text-fg-body-subtle hover:text-fg-danger inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-base transition-neu disabled:opacity-40"
                        aria-label={t('profile:manager.delete_aria', { label: p.label })}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
                          <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input
                label={t('profile:manager.new_label')}
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void onCreate();
                }}
                placeholder={t('profile:manager.new_placeholder')}
              />
            </div>
            <Button onClick={() => void onCreate()} disabled={!newLabel.trim()}>
              {t('profile:manager.create')}
            </Button>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={Boolean(confirmDeleteId)}
        title={t('profile:manager.delete_title')}
        message={t('profile:manager.delete_message', { label: targetDelete?.label ?? '' })}
        confirmLabel={t('common:button.delete')}
        cancelLabel={t('common:button.cancel')}
        onConfirm={() => void onConfirmDelete()}
        onCancel={() => setConfirmDeleteId(null)}
        destructive
      />

      <ProfileSettings
        profileId={settingsFor}
        onClose={() => setSettingsFor(null)}
      />
    </div>,
    document.body,
  );
}
