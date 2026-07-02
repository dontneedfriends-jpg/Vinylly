import { describe, expect, it } from 'vitest';
import { extractArtist, stripArtistPrefix } from './parse';

describe('extractArtist', () => {
  it('splits on " - "', () => {
    expect(extractArtist('Pink Floyd - The Wall')).toBe('Pink Floyd');
  });

  it('returns full title when no separator', () => {
    expect(extractArtist('OK Computer')).toBe('OK Computer');
  });
});

describe('stripArtistPrefix', () => {
  it('removes exact artist prefix', () => {
    expect(stripArtistPrefix('Pink Floyd - The Wall', 'Pink Floyd')).toBe('The Wall');
  });

  it('matches case-insensitively', () => {
    expect(stripArtistPrefix('radiohead - OK Computer', 'Radiohead')).toBe('OK Computer');
  });

  it('tolerates "(N)" disambiguation suffix on artist', () => {
    expect(stripArtistPrefix('Pink Floyd (2) - The Wall', 'Pink Floyd')).toBe('The Wall');
  });

  it('leaves title untouched when prefix differs from artist', () => {
    expect(stripArtistPrefix('Pink Floyd - The Wall', 'Led Zeppelin')).toBe(
      'Pink Floyd - The Wall',
    );
  });

  it('leaves title untouched when no separator', () => {
    expect(stripArtistPrefix('OK Computer', 'Radiohead')).toBe('OK Computer');
  });

  it('returns title unchanged when artist is empty', () => {
    expect(stripArtistPrefix('The Wall', '')).toBe('The Wall');
  });

  it('trims surrounding whitespace from result', () => {
    expect(stripArtistPrefix('Pink Floyd -   The Wall  ', 'Pink Floyd')).toBe('The Wall');
  });
});