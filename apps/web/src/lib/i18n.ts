import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import ruCommon from '../locales/ru/common.json';
import ruLayout from '../locales/ru/layout.json';
import ruCollection from '../locales/ru/collection.json';
import ruAdd from '../locales/ru/add.json';
import ruDetail from '../locales/ru/detail.json';
import ruSettings from '../locales/ru/settings.json';
import ruStats from '../locales/ru/stats.json';
import ruWantlist from '../locales/ru/wantlist.json';
import ruArtist from '../locales/ru/artist.json';
import ruReleasePreview from '../locales/ru/release_preview.json';
import ruProfile from '../locales/ru/profile.json';

import enCommon from '../locales/en/common.json';
import enLayout from '../locales/en/layout.json';
import enCollection from '../locales/en/collection.json';
import enAdd from '../locales/en/add.json';
import enDetail from '../locales/en/detail.json';
import enSettings from '../locales/en/settings.json';
import enStats from '../locales/en/stats.json';
import enWantlist from '../locales/en/wantlist.json';
import enArtist from '../locales/en/artist.json';
import enReleasePreview from '../locales/en/release_preview.json';
import enProfile from '../locales/en/profile.json';

const resources = {
  ru: {
    common: ruCommon,
    layout: ruLayout,
    collection: ruCollection,
    add: ruAdd,
    detail: ruDetail,
    settings: ruSettings,
    stats: ruStats,
    wantlist: ruWantlist,
    artist: ruArtist,
    release_preview: ruReleasePreview,
    profile: ruProfile,
  },
  en: {
    common: enCommon,
    layout: enLayout,
    collection: enCollection,
    add: enAdd,
    detail: enDetail,
    settings: enSettings,
    stats: enStats,
    wantlist: enWantlist,
    artist: enArtist,
    release_preview: enReleasePreview,
    profile: enProfile,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'ru',
    ns: ['common', 'layout', 'collection', 'add', 'detail', 'settings', 'stats', 'wantlist', 'artist', 'release_preview', 'profile'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'vinylly:locale',
    },
  });

export default i18n;
