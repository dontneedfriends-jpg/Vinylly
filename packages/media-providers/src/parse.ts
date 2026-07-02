export function extractArtist(title: string): string {
  const idx = title.indexOf(' - ');
  return idx === -1 ? title : title.slice(0, idx).trim();
}

export function stripArtistPrefix(title: string, artist: string): string {
  const cleaned = artist.replace(/\s*\(\d+\)\s*$/, '').trim();
  if (!cleaned) return title;
  const sep = title.indexOf(' - ');
  if (sep === -1) return title;
  const prefix = title.slice(0, sep).trim();
  const norm = (s: string): string => s.replace(/\s*\(\d+\)\s*$/, '').trim().toLowerCase();
  if (norm(prefix) === norm(cleaned)) {
    return title.slice(sep + 3).trim();
  }
  return title;
}