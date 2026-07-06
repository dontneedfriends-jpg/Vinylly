import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import ruCommon from '../../public/locales/ru/common.json';
import ruLayout from '../../public/locales/ru/layout.json';
import ruCollection from '../../public/locales/ru/collection.json';
import ruAdd from '../../public/locales/ru/add.json';
import ruDetail from '../../public/locales/ru/detail.json';
import ruSettings from '../../public/locales/ru/settings.json';
import ruStats from '../../public/locales/ru/stats.json';
import ruWantlist from '../../public/locales/ru/wantlist.json';
import ruArtist from '../../public/locales/ru/artist.json';
import ruReleasePreview from '../../public/locales/ru/release_preview.json';

import enCommon from '../../public/locales/en/common.json';
import enLayout from '../../public/locales/en/layout.json';
import enCollection from '../../public/locales/en/collection.json';
import enAdd from '../../public/locales/en/add.json';
import enDetail from '../../public/locales/en/detail.json';
import enSettings from '../../public/locales/en/settings.json';
import enStats from '../../public/locales/en/stats.json';
import enWantlist from '../../public/locales/en/wantlist.json';
import enArtist from '../../public/locales/en/artist.json';
import enReleasePreview from '../../public/locales/en/release_preview.json';

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
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'ru',
    ns: ['common', 'layout', 'collection', 'add', 'detail', 'settings', 'stats', 'wantlist', 'artist', 'release_preview'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'vinylly:locale',
    },
  });

export default i18n;
