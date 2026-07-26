import { describe, expect, it } from 'vitest';
import { fromDiscogsCondition, parseFieldPrice } from './discogs';

describe('parseFieldPrice', () => {
  it('parses dollar-prefixed values (legacy writes)', () => {
    expect(parseFieldPrice('$25.00')).toBe(25);
    expect(parseFieldPrice('$1,99')).toBe(1.99);
  });

  it('parses bare numbers and comma decimals', () => {
    expect(parseFieldPrice('25')).toBe(25);
    expect(parseFieldPrice('25,00')).toBe(25);
    expect(parseFieldPrice('12.5')).toBe(12.5);
  });

  it('parses values with currency suffix', () => {
    expect(parseFieldPrice('25,00 €')).toBe(25);
    expect(parseFieldPrice('100 USD')).toBe(100);
  });

  it('rejects empty and non-numeric', () => {
    expect(parseFieldPrice(null)).toBeNull();
    expect(parseFieldPrice('')).toBeNull();
    expect(parseFieldPrice('free')).toBeNull();
    expect(parseFieldPrice('0')).toBeNull();
  });
});

describe('fromDiscogsCondition', () => {
  it('parses all standard grades', () => {
    expect(fromDiscogsCondition('Mint (M)')).toBe('M');
    expect(fromDiscogsCondition('Near Mint (NM or M-)')).toBe('NM');
    expect(fromDiscogsCondition('Very Good Plus (VG+)')).toBe('VG+');
    expect(fromDiscogsCondition('Very Good (VG)')).toBe('VG');
    expect(fromDiscogsCondition('Good Plus (G+)')).toBe('G+');
    expect(fromDiscogsCondition('Good (G)')).toBe('G');
    expect(fromDiscogsCondition('Fair (F)')).toBe('F');
    expect(fromDiscogsCondition('Poor (P)')).toBe('P');
  });

  it('does not confuse Very Good Plus with Very Good', () => {
    expect(fromDiscogsCondition('Very Good Plus')).toBe('VG+');
    expect(fromDiscogsCondition('Very Good')).toBe('VG');
  });

  it('rejects non-grades', () => {
    expect(fromDiscogsCondition('')).toBeNull();
    expect(fromDiscogsCondition('Generic')).toBeNull();
    expect(fromDiscogsCondition('Not Graded')).toBeNull();
  });
});
