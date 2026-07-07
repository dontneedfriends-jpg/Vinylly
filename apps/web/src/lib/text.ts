/**
 * Strip BBCode/HTML tags from a string and decode common entities.
 * Discogs uses BBCode-style tags in artist profile/release notes ([b], [i], [a=Name]).
 * React text children escape angle brackets, so we render `<b>foo</b>` as text.
 * Strip tags before rendering plain text. We intentionally do NOT use
 * dangerouslySetInnerHTML — Discogs notes are user-generated content.
 */
const ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
  '&rsquo;': '\u2019',
  '&lsquo;': '\u2018',
  '&rdquo;': '\u201D',
  '&ldquo;': '\u201C',
};

export function stripHtml(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z#0-9]+;/gi, (m) => ENTITY_MAP[m] ?? m)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Discogs artist profiles and release notes use BBCode-flavored markup:
 *   [b]bold[/b] [i]italic[/i] [a=Name]display[/a] [url=...]label[/url] [img]src[/img]
 * Strip those tags, leaving the visible text in brackets like [a=Roger Waters]
 * as the readable label (e.g. "Roger Waters").
 */
export function stripBbcode(input: string | null | undefined): string {
  if (!input) return '';
  return input
    // [url=...]label[/url] or [url]...[/url] → label
    .replace(/\[url(?:=[^\]]+)?\]([\s\S]*?)\[\/url\]/gi, '$1')
    // Discogs uses [a=Name] as a reference marker (often unclosed). The bracketed
    // name IS the visible reference, so replace the marker with the name itself.
    .replace(/\[a=([^\]]+)\]\s*/gi, '$1 ')
    // [img]...[/img] or self-closing → empty
    .replace(/\[img(?:=[^\]]+)?\]([\s\S]*?)\[\/img\]/gi, '')
    .replace(/\[img(?:=[^\]]+)?\/?\]/gi, '')
    // [b], [i], [u], [s], [strong], [em] etc. → drop tag, keep inner
    .replace(/\[(\/?)(b|i|u|s|strong|em)\]/gi, '')
    // [size=...], [color=...], [quote], [list], [*] — drop entirely (rarely used)
    .replace(/\[(\/?)(size=[^\]]+|color=[^\]]+|quote|list|\*)(?:\s[^\]]*)?\]/gi, '')
    // Paragraph/line breaks → newlines
    .replace(/\[\/?br\]/gi, '\n')
    .replace(/\[hr\]/gi, '\n—\n')
    // Trim stray whitespace
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Composite: strip both HTML and BBCode. Use this for any Discogs/Genius text
 * field that may contain markup.
 */
export function stripMarkup(input: string | null | undefined): string {
  if (!input) return '';
  return stripBbcode(stripHtml(input));
}
