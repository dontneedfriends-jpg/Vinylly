import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ConditionPicker, Input } from '@vinylly/ui';

export interface BulkEditPatch {
  location?: string;
  addTag?: string;
  sleeveCondition?: string;
  mediaCondition?: string;
}

export interface BulkEditBarProps {
  count: number;
  busy: boolean;
  onApply: (patch: BulkEditPatch) => void;
  onCancel: () => void;
}

export function BulkEditBar({ count, busy, onApply, onCancel }: BulkEditBarProps) {
  const { t } = useTranslation();
  const [location, setLocation] = useState('');
  const [tag, setTag] = useState('');
  const [sleeve, setSleeve] = useState('');
  const [media, setMedia] = useState('');

  const hasChanges = Boolean(location.trim() || tag.trim() || sleeve || media);

  return (
    <div className="fixed bottom-6 left-1/2 z-50 w-full max-w-2xl -translate-x-1/2 px-4">
      <div
        role="dialog"
        aria-label={t('collection:bulk_edit.title')}
        className="rounded-base border-border-default bg-surface shadow-neu-xl flex flex-col gap-4 border p-5"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-fg-heading text-sm font-semibold">
            {t('collection:bulk_edit.title')}
            <span className="text-fg-body-subtle ml-2 font-normal tabular-nums">{count}</span>
          </h3>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() =>
                onApply({
                  location: location.trim() || undefined,
                  addTag: tag.trim().toLowerCase() || undefined,
                  sleeveCondition: sleeve || undefined,
                  mediaCondition: media || undefined,
                })
              }
              disabled={busy || !hasChanges || count === 0}
            >
              {busy ? t('common:button.saving') : t('collection:bulk_edit.apply')}
            </Button>
            <Button size="sm" variant="neutral" onClick={onCancel} disabled={busy}>
              {t('common:button.cancel')}
            </Button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label={t('detail:my_notes.location')}
            placeholder={t('add:form.location_placeholder')}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <Input
            label={t('detail:my_notes.tags')}
            placeholder={t('detail:my_notes.tags_placeholder')}
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          />
          <ConditionPicker label={t('detail:my_notes.sleeve')} value={sleeve} onChange={setSleeve} />
          <ConditionPicker label={t('detail:my_notes.media')} value={media} onChange={setMedia} />
        </div>
      </div>
    </div>
  );
}
