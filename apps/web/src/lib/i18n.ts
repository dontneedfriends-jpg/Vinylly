import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import ruCommon from '../../public/locales/ru/common.json';
import ruLayout from '../../public/locales/ru/layout.json';
import ruCollection from '../../public/locales/ru/collection.json';
import ruAdd from '../../public/locales/ru/add.json';
import ruDetail from '../../public/locales/ru/detail.json';
import ruSettings from '../../public/locales/ru/settings.json';

import enCommon from '../../public/locales/en/common.json';
import enLayout from '../../public/locales/en/layout.json';
import enCollection from '../../public/locales/en/collection.json';
import enAdd from '../../public/locales/en/add.json';
import enDetail from '../../public/locales/en/detail.json';
import enSettings from '../../public/locales/en/settings.json';

const resources = {
  ru: {
    common: ruCommon,
    layout: ruLayout,
    collection: ruCollection,
    add: ruAdd,
    detail: ruDetail,
    settings: ruSettings,
  },
  en: {
    common: enCommon,
    layout: enLayout,
    collection: enCollection,
    add: enAdd,
    detail: enDetail,
    settings: enSettings,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'ru',
    ns: ['common', 'layout', 'collection', 'add', 'detail', 'settings'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'vinylly:locale',
    },
  });

export default i18n;
