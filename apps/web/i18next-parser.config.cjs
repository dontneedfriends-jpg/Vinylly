module.exports = {
  locales: ['ru', 'en'],
  defaultLocale: 'ru',
  namespaceSeparator: ':',
  keySeparator: false,
  useKeysAsDefaultValue: false,
  keepRemoved: true,
  createOldCatalogs: false,
  sort: true,
  input: ['src/**/*.{ts,tsx}'],
  output: 'public/locales/$LOCALE/$NAMESPACE.json',
};
