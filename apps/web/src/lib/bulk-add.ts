import type { SearchQuery } from '@vinylly/media-providers';

export type BulkLineKind = 'discogs_id' | 'barcode' | 'catno' | 'text';

export interface BulkLine {
  raw: string;
  kind: BulkLineKind;
  query: SearchQuery;
  /** Direct Discogs release id — resolved via getRelease, no search needed. */
  directId?: string;
}

const DISCOGS_RELEASE_RE = /discogs\.com\/(?:[^/]+\/)?release\/(\d+)/i;
const DISCOGS_ID_RE = /^r?(\d{4,9})$/i;
// 10-14 digits → EAN/UPC barcode; 4-9 digits hit the Discogs-id rule above.
const BARCODE_RE = /^\d{10,14}$/;
const CATNO_RE = /^[A-Za-z0-9][A-Za-z0-9 ._/#-]{1,24}$/;

/**
 * Classify one input line:
 * - Discogs release URL or bare id (4-9 digits) → direct lookup
 * - 10-14 digits → barcode
 * - short code without spaces → catalog number
 * - anything else → free-text search ("Artist — Title" works as-is)
 */
export function parseBulkLine(raw: string): BulkLine | null {
  const line = raw.trim();
  if (!line || line.startsWith('#')) return null;

  const urlMatch = DISCOGS_RELEASE_RE.exec(line);
  if (urlMatch) {
    return { raw: line, kind: 'discogs_id', query: {}, directId: urlMatch[1] };
  }
  const idMatch = DISCOGS_ID_RE.exec(line);
  if (idMatch) {
    return { raw: line, kind: 'discogs_id', query: {}, directId: idMatch[1] };
  }
  if (BARCODE_RE.test(line)) {
    return { raw: line, kind: 'barcode', query: { barcode: line } };
  }
  if (!line.includes(' ') && CATNO_RE.test(line)) {
    return { raw: line, kind: 'catno', query: { catalogNumber: line } };
  }
  return { raw: line, kind: 'text', query: { text: line } };
}

export function parseBulkInput(text: string): BulkLine[] {
  return text
    .split(/\r?\n/)
    .map(parseBulkLine)
    .filter((l): l is BulkLine => l !== null);
}

/**
 * Sequential rate gate: each call resolves once the previous one + minInterval
 * has elapsed. Keeps bulk resolution under the Discogs 60 req/min auth limit.
 */
export function createThrottle(minIntervalMs: number): () => Promise<void> {
  let next = 0;
  let chain = Promise.resolve();
  return () => {
    const run = async () => {
      const wait = Math.max(0, next - Date.now());
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      next = Date.now() + minIntervalMs;
    };
    chain = chain.then(run, run);
    return chain;
  };
}
