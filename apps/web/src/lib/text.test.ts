import { describe, expect, it } from 'vitest';
import { stripHtml, stripBbcode, stripMarkup } from './text';

describe('stripHtml', () => {
  it('returns empty for null/undefined/empty', () => {
    expect(stripHtml(null)).toBe('');
    expect(stripHtml(undefined)).toBe('');
    expect(stripHtml('')).toBe('');
  });

  it('strips simple tags', () => {
    expect(stripHtml('hello <b>world</b>')).toBe('hello world');
    expect(stripHtml('<a href="x">link</a>')).toBe('link');
  });

  it('converts <br> to newline and </p> to double newline', () => {
    expect(stripHtml('a<br>b')).toBe('a\nb');
    expect(stripHtml('a<br/>b')).toBe('a\nb');
    expect(stripHtml('a<br />b')).toBe('a\nb');
    expect(stripHtml('<p>one</p><p>two</p>')).toBe('one\n\ntwo');
  });

  it('decodes common HTML entities', () => {
    expect(stripHtml('AT&amp;T')).toBe('AT&T');
    expect(stripHtml('&lt;tag&gt;')).toBe('<tag>');
    expect(stripHtml('&quot;hi&quot;')).toBe('"hi"');
    expect(stripHtml('&mdash;')).toBe('—');
    expect(stripHtml('&hellip;')).toBe('…');
  });

  it('collapses excessive newlines', () => {
    expect(stripHtml('a\n\n\n\nb')).toBe('a\n\nb');
  });

  it('handles nested and malformed tags', () => {
    expect(stripHtml('<b><i>bold italic</i></b>')).toBe('bold italic');
    expect(stripHtml('<incomplete<b>tag')).toBe('tag');
  });

  it('strips typical Discogs notes formatting', () => {
    const input = 'Label: <b>Columbia</b><br/>Year: <i>1973</i>';
    expect(stripHtml(input)).toBe('Label: Columbia\nYear: 1973');
  });

  it('preserves < as literal if no tag', () => {
    expect(stripHtml('a < b')).toBe('a < b');
  });
});

describe('stripBbcode', () => {
  it('strips [b] and [i] tags', () => {
    expect(stripBbcode('[b]bold[/b]')).toBe('bold');
    expect(stripBbcode('[i]italic[/i]')).toBe('italic');
  });

  it('replaces [a=Name] marker with the bracketed name itself', () => {
    // Discogs uses [a=Name] as a reference marker; the name is the visible label.
    expect(stripBbcode('[a=Roger Waters] – bass guitar, vocals (1965-1985)')).toBe(
      'Roger Waters – bass guitar, vocals (1965-1985)',
    );
    expect(stripBbcode('[a=David Gilmour] – guitar (1967-1994)')).toBe('David Gilmour – guitar (1967-1994)');
  });

  it('handles [url=...]label[/url]', () => {
    expect(stripBbcode('[url=https://example.com]example[/url]')).toBe('example');
  });

  it('strips [img] tags entirely', () => {
    expect(stripBbcode('before [img]https://x.jpg[/img] after')).toBe('before  after');
    expect(stripBbcode('self [img=https://x.jpg/]')).toBe('self');
  });

  it('handles the Pink Floyd artist profile case', () => {
    const input = `[b]Main official members (in a chronological order):[/b]
[a=Roger Waters] – bass guitar, vocals, sound effects (1965-1985, 2005)
[a=Nick Mason] – drums, percussion, sound effects (1965-1994, 2005, 2007, 2013-2014, 2022)
[b]Pre-Pink Floyd members (in a chronological order):[/b]
[a=Syd Barrett] – guitar, vocals (1965-1968)
[a=David Gilmour] – guitar, slide guitar, vocals (1967-1994, 2005, 2007, 2013–2014, 2022)`;
    const out = stripBbcode(input);
    expect(out).not.toMatch(/\[b\]/);
    expect(out).not.toMatch(/\[\/b\]/);
    expect(out).not.toMatch(/\[a=/);
    expect(out).toContain('Main official members');
    expect(out).toContain('Roger Waters – bass guitar');
    expect(out).toContain('David Gilmour – guitar');
  });
});

describe('stripMarkup', () => {
  it('handles both BBCode and HTML together', () => {
    expect(stripMarkup('[b]hello[/b] &amp; <b>world</b>')).toBe('hello & world');
  });
});
