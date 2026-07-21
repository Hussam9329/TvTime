import { APP_NAME, LEGACY_APP_ALIASES } from "@/lib/brand";

export const LIBRARY_BACKUP_VERSION = 6;
export const LIBRARY_BACKUP_KIND = "tvtime-backup";
export const LIBRARY_SUPPORTED_BACKUP_VERSIONS = [5, 6] as const;
export const LIBRARY_IMPORT_MAX_RECORDS = 250_000;
export const LIBRARY_IMPORT_MAX_CHUNK_RECORDS = 500;
export const LIBRARY_IMPORT_MAX_CHUNK_BYTES = 1_500_000;

export const LIBRARY_COLLECTIONS = [
  "media",
  "watchedEpisodes",
  "episodeRatings",
  "watchSessions",
  "notifications",
  "customLists",
  "customListItems",
  "preferences",
] as const;

export type LibraryCollection = (typeof LIBRARY_COLLECTIONS)[number];
export type LibraryBackupVersion = (typeof LIBRARY_SUPPORTED_BACKUP_VERSIONS)[number];

export type LibraryBackupManifest = {
  recordType: "manifest";
  kind: typeof LIBRARY_BACKUP_KIND;
  version: LibraryBackupVersion;
  format: "ndjson";
  app: typeof APP_NAME;
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
  return {
    media: 0,
    watchedEpisodes: 0,
    episodeRatings: 0,
    watchSessions: 0,
    notifications: 0,
    customLists: 0,
    customListItems: 0,
    preferences: 0,
  };
}

export function normalizeCollectionCounts(value: unknown): Record<LibraryCollection, number> {
  const normalized = emptyCollectionCounts();
  if (!value || typeof value !== "object") return normalized;
  for (const collection of LIBRARY_COLLECTIONS) {
    const count = Number((value as Record<string, unknown>)[collection] ?? 0);
    normalized[collection] = Number.isInteger(count) && count >= 0 ? count : 0;
  }
  return normalized;
}

export function isLibraryCollection(value: unknown): value is LibraryCollection {
  return typeof value === "string" && (LIBRARY_COLLECTIONS as readonly string[]).includes(value);
}


export function isSupportedBackupApp(value: unknown): boolean {
  return typeof value === "string"
    && (value === APP_NAME || (LEGACY_APP_ALIASES as readonly string[]).includes(value));
}

export function isSupportedBackupVersion(value: unknown): value is LibraryBackupVersion {
  return typeof value === "number"
    && (LIBRARY_SUPPORTED_BACKUP_VERSIONS as readonly number[]).includes(value);
}
