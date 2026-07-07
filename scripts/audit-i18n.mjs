// Standalone script: audits i18n keys across apps/web/src against en/ru JSON files.
// Run with: node scripts/audit-i18n.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const srcRoot = path.join(root, 'apps', 'web', 'src');
const localesRoot = path.join(root, 'apps', 'web', 'public', 'locales');

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      // Skip tests
      if (entry.name === '__tests__' || entry.name === 'test' || entry.name === 'tests') continue;
      walk(path.join(dir, entry.name), files);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

function extractKeysFromFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  const keys = new Set();
  // t('ns.key') / t("ns.key") with possible ternary in args
  // Match t( ...args ) handling arbitrary nesting depth
  const callRe = /\bt\(/g;
  let m;
  while ((m = callRe.exec(src))) {
    // Walk to find matching close paren
    let depth = 0;
    let end = m.index + 2;
    for (let i = m.index + 2; i < src.length; i++) {
      if (src[i] === '(') depth++;
      else if (src[i] === ')') {
        if (depth === 0) { end = i; break; }
        depth--;
      }
    }
    const args = src.slice(m.index + 2, end);
    for (const str of args.matchAll(/['"]([^'"]+)['"]/g)) {
      if (str[1].includes('${')) continue;
      if (!/^[a-z]+:[a-z0-9_.\-]+$/i.test(str[1])) continue;
      keys.add(str[1]);
    }
    callRe.lastIndex = end + 1;
  }
  for (const i18n of src.matchAll(/i18nKey\s*=\s*['"]([^'"]+)['"]/g)) {
    keys.add(i18n[1]);
  }
  // labelKey="ns.key" — string property holding a key
  for (const lk of src.matchAll(/labelKey\s*[:=]\s*['"]([^'"]+)['"]/g)) {
    if (!lk[1].includes('${')) keys.add(lk[1]);
  }
  return keys;
}

const sourceFiles = walk(srcRoot);
const usedKeys = new Set();
for (const f of sourceFiles) {
  for (const k of extractKeysFromFile(f)) usedKeys.add(k);
}

// Debug: dump all collection:* keys collected for sanity
if (process.env.DEBUG_I18N) {
  const collectionKeys = Array.from(usedKeys).filter((k) => k.startsWith('collection:'));
  console.error('--- DEBUG collection keys collected:', collectionKeys.length);
  for (const k of collectionKeys) console.error('  ' + k);
  if (!sourceFiles.some((f) => f.includes('RightRail.tsx'))) {
    console.error('WARN: RightRail.tsx not in source files!');
  }
}

const namespaces = Array.from(new Set(Array.from(usedKeys).map((k) => k.split(':')[0])));
namespaces.sort();

const enDir = path.join(localesRoot, 'en');
const ruDir = path.join(localesRoot, 'ru');

function loadLocale(dir) {
  const map = {};
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const ns = f.replace(/\.json$/, '');
    map[ns] = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  }
  return map;
}

const en = loadLocale(enDir);
const ru = loadLocale(ruDir);

const out = [];
out.push(`i18n audit — ${sourceFiles.length} source files scanned`);
out.push(`Namespaces in use: ${namespaces.join(', ')}`);
out.push('');

let totalMissing = 0;
let totalExtra = 0;

function flatKeys(obj, prefix = '', out = new Set()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      flatKeys(v, key, out);
    } else {
      out.add(key);
    }
  }
  return out;
}

for (const ns of namespaces) {
  const enKeys = flatKeys(en[ns] ?? {});
  const ruKeys = flatKeys(ru[ns] ?? {});
  // Used keys for this namespace, with the namespace prefix stripped.
  const usedInNs = new Set(
    Array.from(usedKeys)
      .filter((k) => k.startsWith(`${ns}:`))
      .map((k) => k.slice(ns.length + 1)),
  );
  const missing = [];
  for (const k of usedInNs) {
    if (!enKeys.has(k)) missing.push(`EN missing: ${ns}:${k}`);
    if (!ruKeys.has(k)) missing.push(`RU missing: ${ns}:${k}`);
  }
  const extra = [];
  for (const k of enKeys) {
    if (!usedInNs.has(k)) extra.push(`${ns}:${k}`);
  }
  if (missing.length) {
    out.push(`## ${ns} (${missing.length} missing)`);
    for (const m of missing.sort()) out.push(`  ${m}`);
    out.push('');
    totalMissing += missing.length;
  }
  if (extra.length) {
    out.push(`## ${ns} (${extra.length} unused)`);
    for (const e of extra.sort()) out.push(`  ${e}`);
    out.push('');
    totalExtra += extra.length;
  }
}

out.push('---');
out.push(`Total missing: ${totalMissing}`);
out.push(`Total unused:  ${totalExtra}`);

console.log(out.join('\n'));
process.exit(totalMissing > 0 ? 1 : 0);
