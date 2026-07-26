/**
 * Per-profile runtime configuration (Discogs token, sync flag).
 *
 * Lives inside the profile-scoped JSON snapshot under the
 * `__profile_settings` key. Backward compatible: if the field is
 * absent, an empty default is returned and writes start populating
 * it on the next persist.
 */
import { getPrismaClient } from './client';

export interface ProfileSettings {
  discogsToken: string;
  discogsUsername: string;
  discogsSyncEnabled: boolean;
  /** Custom Discogs collection field used for purchase-price sync (null = off). */
  discogsPriceFieldId: number | null;
}

const DEFAULTS: ProfileSettings = {
  discogsToken: '',
  discogsUsername: '',
  discogsSyncEnabled: true,
  discogsPriceFieldId: null,
};

interface ProfileSettingsRow {
  id?: string;
  data?: Partial<ProfileSettings>;
}

export async function getProfileSettings(): Promise<ProfileSettings> {
  const prisma = getPrismaClient() as unknown as {
    profileSettings?: {
      findFirst: (a?: unknown) => Promise<ProfileSettingsRow | null>;
    };
  };
  if (!prisma.profileSettings) return { ...DEFAULTS };
  const row = await prisma.profileSettings.findFirst({});
  return { ...DEFAULTS, ...(row?.data ?? {}) };
}

export async function setProfileSettings(
  partial: Partial<ProfileSettings>,
): Promise<ProfileSettings> {
  const current = await getProfileSettings();
  const next: ProfileSettings = { ...current, ...partial };
  const prisma = getPrismaClient() as unknown as {
    profileSettings?: {
      findFirst: (a?: unknown) => Promise<ProfileSettingsRow | null>;
      upsert?: (a: unknown) => Promise<unknown>;
    };
  };
  if (prisma.profileSettings?.upsert) {
    await prisma.profileSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', data: next },
      update: { data: next },
    });
  }
  return next;
}
