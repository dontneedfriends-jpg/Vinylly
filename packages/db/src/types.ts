export type MediaType = 'vinyl' | 'cd' | 'cassette' | 'other';
export type ReleaseSource = 'discogs' | 'musicbrainz' | 'lastfm' | 'manual';

export interface CollectionRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReleaseRecord {
  id: string;
  source: ReleaseSource;
  sourceId: string;
  title: string;
  artist: string;
  year: number | null;
  lowestPrice: number | null;
  numForSale: number | null;
  trackCount: number | null;
  totalDurationMs: number | null;
  masterId: number | null;
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
  images: ReleaseImage[];
}

export interface WantlistEntry {
  id: string;
  notes: string | null;
  addedAt: string;
  release: ReleaseRecord;
  /** Price watch: alert when market price drops to/below this value ($). */
  targetPrice?: number | null;
}

export interface ReleaseImage {
  type: string;
  uri: string;
  uri150?: string | null;
  localPath: string | null;
}

export interface TrackRecord {
  id: string;
  position: string;
  title: string;
  duration: number | null;
  lyrics: string | null;
  lyricsSrc: string | null;
}

export interface ItemRecord {
  id: string;
  type: MediaType;
  barcode: string | null;
  catalogNumber: string | null;
  discogsInstanceId: number | null;
  purchasePrice: number | null;
  sleeveCondition: string | null;
  mediaCondition: string | null;
  notes: string | null;
  acquiredAt: string | null;
  location: string | null;
  tags: string[];
  release: ReleaseRecord;
  /** Play log: how many times the owner spun it + when last. */
  playCount?: number;
  lastPlayedAt?: string | null;
  /** Loan tracking: who holds it right now + since when. */
  lentTo?: string | null;
  lentAt?: string | null;
}
