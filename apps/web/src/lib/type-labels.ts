import { useTranslation } from 'react-i18next';
import type { MediaType } from '@vinylly/db';

export function useTypeLabels(): Record<MediaType, string> {
  const { t } = useTranslation();
  return {
    vinyl: t('common:media.vinyl'),
    cd: t('common:media.cd'),
    cassette: t('common:media.cassette'),
    other: t('common:media.other'),
  };
}
