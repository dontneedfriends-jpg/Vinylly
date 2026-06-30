import type { ItemRecord, TrackRecord, MediaType, ReleaseSource } from '@vinylly/db';

export interface ExportBundleV1 {
  format: 'vinylly.v1';
  exportedAt: string;
  items: Array<{
    type: MediaType;
    barcode: string | null;
    catalogNumber: string | null;
    sleeveCondition: string | null;
    mediaCondition: string | null;
    notes: string | null;
    location: string | null;
    tags: string[];
    acquiredAt: string | null;
    release: {
      source: ReleaseSource;
      sourceId: string;
      title: string;
      artist: string;
      year: number | null;
      genres: string[];
      styles: string[];
      coverPath: string | null;
      thumbPath: string | null;
      coverRemote: string | null;
      thumbRemote: string | null;
    };
    tracklist: Array<{
      position: string;
      title: string;
      duration: number | null;
      lyrics: string | null;
    }>;
  }>;
}

export function buildBundle(
  items: ItemRecord[],
  tracksByRelease: Map<string, TrackRecord[]>,
): ExportBundleV1 {
  return {
    format: 'vinylly.v1',
    exportedAt: new Date().toISOString(),
    items: items.map((it) => ({
      type: it.type,
      barcode: it.barcode,
      catalogNumber: it.catalogNumber,
      sleeveCondition: it.sleeveCondition,
      mediaCondition: it.mediaCondition,
      notes: it.notes,
      location: it.location,
      tags: it.tags,
      acquiredAt: it.acquiredAt,
      release: {
        source: it.release.source,
        sourceId: it.release.sourceId,
        title: it.release.title,
        artist: it.release.artist,
        year: it.release.year,
        genres: it.release.genres,
        styles: it.release.styles,
        coverPath: it.release.coverPath,
        thumbPath: it.release.thumbPath,
        coverRemote: it.release.coverRemote,
        thumbRemote: it.release.thumbRemote,
      },
      tracklist: (tracksByRelease.get(it.release.id) ?? []).map((t) => ({
        position: t.position,
        title: t.title,
        duration: t.duration,
        lyrics: t.lyrics,
      })),
    })),
  };
}

export function bundleToJson(b: ExportBundleV1): string {
  return JSON.stringify(b, null, 2);
}

export function parseBundle(raw: string): ExportBundleV1 {
  const parsed = JSON.parse(raw) as unknown;
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    (parsed as { format?: string }).format !== 'vinylly.v1'
  ) {
    throw new Error('Неверный формат файла. Ожидается Vinylly v1.');
  }
  const items = (parsed as { items?: unknown }).items;
  if (!Array.isArray(items)) {
    throw new Error('Поле "items" должно быть массивом.');
  }
  return parsed as ExportBundleV1;
}

export function bundleToCsv(b: ExportBundleV1): string {
  const headers = [
    'title',
    'artist',
    'year',
    'type',
    'barcode',
    'catalogNumber',
    'sleeveCondition',
    'mediaCondition',
    'location',
    'tags',
    'genres',
    'styles',
    'notes',
    'acquiredAt',
    'source',
  ];
  const escape = (s: unknown): string => {
    if (s === null || s === undefined) return '';
    const v = String(s);
    if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  };
  const rows = b.items.map((it) =>
    [
      it.release.title,
      it.release.artist,
      it.release.year ?? '',
      it.type,
      it.barcode ?? '',
      it.catalogNumber ?? '',
      it.sleeveCondition ?? '',
      it.mediaCondition ?? '',
      it.location ?? '',
      it.tags.join('|'),
      it.release.genres.join('|'),
      it.release.styles.join('|'),
      it.notes ?? '',
      it.acquiredAt ?? '',
      it.release.source,
    ]
      .map(escape)
      .join(','),
  );
  return [headers.join(','), ...rows].join('\n');
}

export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error ?? new Error('read error'));
    r.onload = () => resolve(String(r.result));
    r.readAsText(file);
  });
}
