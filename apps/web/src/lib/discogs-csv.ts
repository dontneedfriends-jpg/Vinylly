import type { MediaType } from '@vinylly/db';

/** One row of a Discogs collection CSV export. */
export interface DiscogsCsvRow {
  releaseId: string | null;
  artist: string;
  title: string;
  catalogNumber: string | null;
  format: string | null;
  mediaType: MediaType;
  rating: number | null;
  released: number | null;
  mediaCondition: string | null;
  sleeveCondition: string | null;
  notes: string | null;
}

const HEADER_MAP: Record<string, keyof DiscogsCsvRow | 'ignore'> = {
  'catalog#': 'catalogNumber',
  artist: 'artist',
  title: 'title',
  label: 'ignore',
  format: 'format',
  rating: 'rating',
  released: 'released',
  release_id: 'releaseId',
  collectionfolder: 'ignore',
  'date added': 'ignore',
  'media condition': 'mediaCondition',
  'sleeve condition': 'sleeveCondition',
  notes: 'notes',
};

/** RFC-4180-ish CSV row splitter (quoted fields, embedded commas/newlines/quotes). */
export function splitCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  row.push(field);
  if (row.some((f) => f !== '')) rows.push(row);
  return rows;
}

function detectMediaType(format: string | null): MediaType {
  const f = (format ?? '').toLowerCase();
  if (/vinyl|\blp\b|\bep\b/.test(f)) return 'vinyl';
  if (/\bcd\b|dvd/.test(f)) return 'cd';
  if (/cassette|tape/.test(f)) return 'cassette';
  return 'other';
}

/** Parse a Discogs collection CSV export. Returns null when the header doesn't match. */
export function parseDiscogsCsv(text: string): DiscogsCsvRow[] | null {
  const rows = splitCsvRows(text.replace(/^\uFEFF/, ''));
  if (rows.length < 2) return null;
  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  const columns = header.map((h) => HEADER_MAP[h] ?? 'ignore');
  // Must at least know artist + title + release_id to be a Discogs export.
  if (!columns.includes('artist') || !columns.includes('title') || !columns.includes('releaseId')) {
    return null;
  }
  const out: DiscogsCsvRow[] = [];
  for (const raw of rows.slice(1)) {
    const get = (k: keyof DiscogsCsvRow): string | null => {
      const idx = columns.indexOf(k);
      const v = idx >= 0 ? (raw[idx] ?? '').trim() : '';
      return v || null;
    };
    const releasedRaw = get('released');
    const ratingRaw = get('rating');
    out.push({
      releaseId: get('releaseId'),
      artist: get('artist') ?? '',
      title: get('title') ?? '',
      catalogNumber: get('catalogNumber'),
      format: get('format'),
      mediaType: detectMediaType(get('format')),
      rating: ratingRaw && Number(ratingRaw) > 0 ? Number(ratingRaw) : null,
      released: releasedRaw && /^\d{4}/.test(releasedRaw) ? Number(releasedRaw.slice(0, 4)) : null,
      mediaCondition: get('mediaCondition'),
      sleeveCondition: get('sleeveCondition'),
      notes: get('notes'),
    });
  }
  return out.filter((r) => r.title || r.releaseId);
}
