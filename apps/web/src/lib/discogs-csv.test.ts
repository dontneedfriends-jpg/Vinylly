import { describe, expect, it } from 'vitest';
import { parseDiscogsCsv, splitCsvRows } from './discogs-csv';

const HEADER =
  'Catalog#,Artist,Title,Label,Format,Rating,Released,release_id,CollectionFolder,Date Added,Media Condition,Sleeve Condition,Notes';

describe('splitCsvRows', () => {
  it('splits simple rows', () => {
    expect(splitCsvRows('a,b,c\n1,2,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('handles quoted fields with commas and escaped quotes', () => {
    expect(splitCsvRows('"a, b","say ""hi""",c')).toEqual([['a, b', 'say "hi"', 'c']]);
  });

  it('handles newlines inside quoted fields', () => {
    expect(splitCsvRows('"line1\nline2",b')).toEqual([['line1\nline2', 'b']]);
  });

  it('handles CRLF and skips empty rows', () => {
    expect(splitCsvRows('a,b\r\n\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('parseDiscogsCsv', () => {
  it('parses a full export', () => {
    const csv = `${HEADER}\nABC-123,"Pink Floyd",Animals,Harvest,"Vinyl, LP, Album",5,1977,123456,All,2020-01-01,"Very Good Plus (VG+)","Near Mint (NM or M-)","first press"`;
    const rows = parseDiscogsCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows![0]).toMatchObject({
      releaseId: '123456',
      artist: 'Pink Floyd',
      title: 'Animals',
      catalogNumber: 'ABC-123',
      mediaType: 'vinyl',
      rating: 5,
      released: 1977,
      mediaCondition: 'Very Good Plus (VG+)',
      sleeveCondition: 'Near Mint (NM or M-)',
      notes: 'first press',
    });
  });

  it('detects media types', () => {
    const mk = (fmt: string) => `${HEADER}\nC,A,T,L,"${fmt}",0,1970,1,All,2020-01-01,,,\n`;
    expect(parseDiscogsCsv(mk('CD, Album'))![0]!.mediaType).toBe('cd');
    expect(parseDiscogsCsv(mk('Cassette, Album'))![0]!.mediaType).toBe('cassette');
    expect(parseDiscogsCsv(mk('Blu-ray'))![0]!.mediaType).toBe('other');
  });

  it('returns null for non-Discogs CSV', () => {
    expect(parseDiscogsCsv('a,b,c\n1,2,3')).toBeNull();
  });

  it('handles rating 0 / empty as null', () => {
    const csv = `${HEADER}\nC,A,T,L,Vinyl,0,1970,1,All,2020-01-01,,,`;
    expect(parseDiscogsCsv(csv)![0]!.rating).toBeNull();
  });
});
