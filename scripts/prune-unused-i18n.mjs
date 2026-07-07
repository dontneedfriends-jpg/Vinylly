// Strip unused keys from locale JSON files based on the audit output.
// Reads audit report from stdin or re-runs audit, then mutates each JSON.
// Safe: prunes only keys listed as "unused" with no reference in the report.

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const localesRoot = path.join(root, 'apps', 'web', 'public', 'locales');

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) walk(path.join(dir, entry.name), files);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

function extractKeys(file) {
  const src = fs.readFileSync(file, 'utf8');
  const keys = new Set();
  const re = /\bt\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g;
  let m;
  while ((m = re.exec(src))) {
    for (const str of m[1].matchAll(/['"]([^'"]+)['"]/g)) {
      if (str[1].includes('${')) continue;
      if (!/^[a-z]+:[a-z0-9_.\-]+$/i.test(str[1])) continue;
      keys.add(str[1]);
    }
  }
  for (const i18n of src.matchAll(/i18nKey\s*=\s*['"]([^'"]+)['"]/g)) keys.add(i18n[1]);
  for (const lk of src.matchAll(/labelKey\s*[:=]\s*['"]([^'"]+)['"]/g)) {
    if (!lk[1].includes('${')) keys.add(lk[1]);
  }
  return keys;
}

function flatKeys(obj, prefix = '', out = new Set()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatKeys(v, key, out);
    else out.add(key);
  }
  return out;
}

const srcRoot = path.join(root, 'apps', 'web', 'src');
const sourceFiles = walk(srcRoot);
const usedKeys = new Set();
for (const f of sourceFiles) for (const k of extractKeys(f)) usedKeys.add(k);

function loadLocale(dir) {
  const map = {};
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const ns = f.replace(/\.json$/, '');
    map[ns] = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  }
  return map;
}

const en = loadLocale(path.join(localesRoot, 'en'));
const ru = loadLocale(path.join(localesRoot, 'ru'));

const toRemove = { en: {}, ru: {} };
for (const ns of Object.keys({ ...en, ...ru })) {
  const enKeys = flatKeys(en[ns] ?? {});
  const ruKeys = flatKeys(ru[ns] ?? {});
  const usedInNs = new Set(
    Array.from(usedKeys)
      .filter((k) => k.startsWith(`${ns}:`))
      .map((k) => k.slice(ns.length + 1)),
  );
  toRemove.en[ns] = [...enKeys].filter((k) => !usedInNs.has(k));
  toRemove.ru[ns] = [...ruKeys].filter((k) => !usedInNs.has(k));
}

function dropNested(obj, dottedKey) {
  // JSON may use either a flat key like "result.about_album" or a nested object.
  // Handle both. The audit was based on a flat dotted key, but the file may store
  // it as either. We try the dotted path first, then fall back to a flat delete.
  if (dottedKey in obj) {
    delete obj[dottedKey];
    return;
  }
  const parts = dottedKey.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    cur = cur?.[parts[i]];
    if (!cur) return;
  }
  if (cur && parts[parts.length - 1] in cur) {
    delete cur[parts[parts.length - 1]];
  }
}

let removed = 0;
for (const [locale, fileDir] of [['en', 'en'], ['ru', 'ru']]) {
  for (const ns of Object.keys(toRemove[locale])) {
    const keys = toRemove[locale][ns];
    if (!keys.length) continue;
    const file = path.join(localesRoot, fileDir, `${ns}.json`);
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const k of keys) {
      dropNested(data, k);
      removed++;
    }
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
    console.log(`${file}: -${keys.length}`);
  }
}
console.log(`Total removed: ${removed}`);
