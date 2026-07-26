import { describe, expect, it } from 'vitest';
import { createThrottle, parseBulkInput, parseBulkLine } from './bulk-add';

describe('parseBulkLine', () => {
  it('parses Discogs release URLs', () => {
    expect(parseBulkLine('https://www.discogs.com/release/123456-Artist-Title')).toEqual({
      raw: 'https://www.discogs.com/release/123456-Artist-Title',
      kind: 'discogs_id',
      query: {},
      directId: '123456',
    });
    expect(parseBulkLine('https://www.discogs.com/ru/release/789-Test')?.directId).toBe('789');
  });

  it('parses bare and r-prefixed ids', () => {
    expect(parseBulkLine('123456')?.kind).toBe('discogs_id');
    expect(parseBulkLine('r123456')?.directId).toBe('123456');
  });

  it('parses barcodes (10-14 digits); shorter numbers are Discogs ids', () => {
    expect(parseBulkLine('4607033712345')).toEqual({
      raw: '4607033712345',
      kind: 'barcode',
      query: { barcode: '4607033712345' },
      directId: undefined,
    });
    expect(parseBulkLine('12345678')?.kind).toBe('discogs_id');
  });

  it('parses catalog numbers (short codes without spaces)', () => {
    expect(parseBulkLine('MOVLP-1234')).toEqual({
      raw: 'MOVLP-1234',
      kind: 'catno',
      query: { catalogNumber: 'MOVLP-1234' },
      directId: undefined,
    });
    expect(parseBulkLine('XL-987/CD')?.kind).toBe('catno');
  });

  it('falls back to free text for artist-title lines', () => {
    expect(parseBulkLine('Pink Floyd — Animals')).toEqual({
      raw: 'Pink Floyd — Animals',
      kind: 'text',
      query: { text: 'Pink Floyd — Animals' },
      directId: undefined,
    });
    expect(parseBulkLine('Portishead Dummy')?.kind).toBe('text');
  });

  it('skips empty lines and comments', () => {
    expect(parseBulkLine('')).toBeNull();
    expect(parseBulkLine('   ')).toBeNull();
    expect(parseBulkLine('# my wishlist')).toBeNull();
  });
});

describe('parseBulkInput', () => {
  it('parses multiline input and skips blanks', () => {
    const out = parseBulkInput(
      '4607033712345\n\n# comment\nPink Floyd — Animals\nMOVLP-1234\r\nhttps://www.discogs.com/release/999-X',
    );
    expect(out.map((l) => l.kind)).toEqual(['barcode', 'text', 'catno', 'discogs_id']);
  });

  it('returns empty array for empty input', () => {
    expect(parseBulkInput('')).toEqual([]);
  });
});

describe('createThrottle', () => {
  it('serializes calls with minimum interval', async () => {
    const throttle = createThrottle(30);
    const t0 = Date.now();
    await throttle();
    await throttle();
    await throttle();
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeGreaterThanOrEqual(55);
  });
});
