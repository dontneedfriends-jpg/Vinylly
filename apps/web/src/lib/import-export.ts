import type {
  ItemRecord,
  MediaType,
  ReleaseRecord,
  ReleaseSource,
  TrackRecord,
  WantlistEntry,
} from '@vinylly/db';

export interface ExportBundleV2 {
  format: 'vinylly.v2';
  exportedAt: string;
  items: Array<{
    type: MediaType;
    barcode: string | null;
    catalogNumber: string | null;
    discogsInstanceId: number | null;
    purchasePrice: number | null;
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
      masterId: number | null;
      lowestPrice: number | null;
      numForSale: number | null;
      communityHave: number | null;
      communityWant: number | null;
      communityRatingAvg: number | null;
      communityRatingCount: number | null;
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
  wantlist: Array<{
    notes: string | null;
    addedAt: string;
    release: {
      source: ReleaseSource;
      sourceId: string;
      title: string;
      artist: string;
      year: number | null;
      masterId: number | null;
      genres: string[];
      styles: string[];
      coverRemote: string | null;
      thumbRemote: string | null;
    };
  }>;
}

// Legacy v1 — kept for parsing old exports
interface ExportBundleV1 {
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
  wantlist: WantlistEntry[] = [],
): ExportBundleV2 {
  return {
    format: 'vinylly.v2',
    exportedAt: new Date().toISOString(),
    items: items.map((it) => ({
      type: it.type,
      barcode: it.barcode,
      catalogNumber: it.catalogNumber,
      discogsInstanceId: it.discogsInstanceId,
      purchasePrice: it.purchasePrice,
      sleeveCondition: it.sleeveCondition,
      mediaCondition: it.mediaCondition,
      notes: it.notes,
      location: it.location,
      tags: it.tags,
      acquiredAt: it.acquiredAt,
      release: serializeRelease(it.release),
      tracklist: (tracksByRelease.get(it.release.id) ?? []).map((t) => ({
        position: t.position,
        title: t.title,
        duration: t.duration,
        lyrics: t.lyrics,
      })),
    })),
    wantlist: wantlist.map((w) => ({
      notes: w.notes,
      addedAt: w.addedAt,
      release: {
        source: w.release.source,
        sourceId: w.release.sourceId,
        title: w.release.title,
        artist: w.release.artist,
        year: w.release.year,
        masterId: w.release.masterId,
        genres: w.release.genres,
        styles: w.release.styles,
        coverRemote: w.release.coverRemote,
        thumbRemote: w.release.thumbRemote,
      },
    })),
  };
}

function serializeRelease(r: ReleaseRecord) {
  return {
    source: r.source,
    sourceId: r.sourceId,
    title: r.title,
    artist: r.artist,
    year: r.year,
    masterId: r.masterId,
    lowestPrice: r.lowestPrice,
    numForSale: r.numForSale,
    communityHave: r.communityHave,
    communityWant: r.communityWant,
    communityRatingAvg: r.communityRatingAvg,
    communityRatingCount: r.communityRatingCount,
    genres: r.genres,
    styles: r.styles,
    coverPath: r.coverPath,
    thumbPath: r.thumbPath,
    coverRemote: r.coverRemote,
    thumbRemote: r.thumbRemote,
  };
}

export function bundleToJson(b: ExportBundleV2): string {
  return JSON.stringify(b, null, 2);
}

export function parseBundle(raw: string): ExportBundleV2 {
  const parsed = JSON.parse(raw) as { format?: string };
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid bundle file');
  }
  if (parsed.format !== 'vinylly.v2' && parsed.format !== 'vinylly.v1') {
    throw new Error('Unsupported bundle format: ' + String(parsed.format));
  }
  // Forward v1 → v2 in-memory shape by filling missing fields with null/defaults.
  if (parsed.format === 'vinylly.v1') {
    const v1 = parsed as unknown as ExportBundleV1;
    return {
      format: 'vinylly.v2',
      exportedAt: v1.exportedAt,
      items: v1.items.map((it) => ({
        ...it,
        discogsInstanceId: null,
        purchasePrice: null,
        release: {
          ...it.release,
          masterId: null,
          lowestPrice: null,
          numForSale: null,
          communityHave: null,
          communityWant: null,
          communityRatingAvg: null,
          communityRatingCount: null,
        },
      })),
      wantlist: [],
    };
  }
  return parsed as ExportBundleV2;
}

export function bundleToCsv(b: ExportBundleV2): string {
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
    'purchasePrice',
    'lowestPrice',
    'communityRatingAvg',
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
      it.purchasePrice ?? '',
      it.release.lowestPrice ?? '',
      it.release.communityRatingAvg ?? '',
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
