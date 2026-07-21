export const LIBRARY_BACKUP_VERSION = 5;
export const LIBRARY_BACKUP_KIND = "tvtime-backup";
export const LIBRARY_IMPORT_MAX_RECORDS = 250_000;
export const LIBRARY_IMPORT_MAX_CHUNK_RECORDS = 500;
export const LIBRARY_IMPORT_MAX_CHUNK_BYTES = 1_500_000;

export const LIBRARY_COLLECTIONS = [
  "media",
  "watchedEpisodes",
  "episodeRatings",
] as const;

export type LibraryCollection = (typeof LIBRARY_COLLECTIONS)[number];

export type LibraryBackupManifest = {
  recordType: "manifest";
  kind: typeof LIBRARY_BACKUP_KIND;
  version: typeof LIBRARY_BACKUP_VERSION;
  format: "ndjson";
  app: "TvTime";
  exportedAt: string;
  source: string;
  user: {
    name: string;
    avatar: string | null;
    createdAt: string;
  };
  collections: Record<LibraryCollection, number>;
  totalRecords: number;
  pageSize: number;
};

export type LibraryBackupRecord = {
  recordType: "record";
  collection: LibraryCollection;
  ordinal: number;
  data: unknown;
};

export type LibraryBackupEnd = {
  recordType: "end";
  collections: Record<LibraryCollection, number>;
  totalRecords: number;
};

export type LibraryTransferRecord = {
  collection: LibraryCollection;
  ordinal: number;
  data: unknown;
};

export function emptyCollectionCounts(): Record<LibraryCollection, number> {
  return { media: 0, watchedEpisodes: 0, episodeRatings: 0 };
}

export function isLibraryCollection(value: unknown): value is LibraryCollection {
  return typeof value === "string" && (LIBRARY_COLLECTIONS as readonly string[]).includes(value);
}
