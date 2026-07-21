import { APP_NAME, BACKUP_FILE_PREFIX } from "@/lib/brand";
import {
  LIBRARY_BACKUP_KIND,
  LIBRARY_BACKUP_VERSION,
  LIBRARY_COLLECTIONS,
  LIBRARY_IMPORT_MAX_CHUNK_BYTES,
  emptyCollectionCounts,
  normalizeCollectionCounts,
  isLibraryCollection,
  isSupportedBackupVersion,
  type LibraryBackupManifest,
  type LibraryBackupRecord,
  type LibraryTransferRecord,
} from "@/lib/library-transfer-types";

const CLIENT_CHUNK_TARGET_BYTES = 900_000;
const CLIENT_CHUNK_MAX_RECORDS = 350;

type Progress = {
  phase: "export" | "reading" | "upload" | "validate" | "commit";
  completed: number;
  total: number;
  message: string;
};

type RestoreOptions = {
  onProgress?: (progress: Progress) => void;
  confirmPreview: (preview: Record<string, unknown>) => boolean | Promise<boolean>;
};

async function readJsonResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload?.error === "string" ? payload.error : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return payload as T;
}

async function sha256(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export async function downloadLibraryBackup(onProgress?: (progress: Progress) => void) {
  const manifest = await readJsonResponse<LibraryBackupManifest>(
    await fetch("/api/library/export", { cache: "no-store" }),
  );
  if (manifest.kind !== LIBRARY_BACKUP_KIND || manifest.version !== LIBRARY_BACKUP_VERSION) {
    throw new Error("The server returned an unsupported backup manifest");
  }

  const parts: BlobPart[] = [`${JSON.stringify(manifest)}\n`];
  const actualCounts = emptyCollectionCounts();
  let completed = 0;

  for (const collection of LIBRARY_COLLECTIONS) {
    let cursor: string | null = null;
    let ordinal = 0;
    const seenCursors = new Set<string>();

    do {
      const url = new URL("/api/library/export", window.location.origin);
      url.searchParams.set("collection", collection);
      url.searchParams.set("limit", String(manifest.pageSize || 500));
      if (cursor) url.searchParams.set("cursor", cursor);
      const page = await readJsonResponse<{
        records: unknown[];
        nextCursor: string | null;
      }>(await fetch(url, { cache: "no-store" }));

      const lines = page.records.map((data) => {
        const line: LibraryBackupRecord = { recordType: "record", collection, ordinal, data };
        ordinal++;
        actualCounts[collection]++;
        completed++;
        return `${JSON.stringify(line)}\n`;
      });
      if (lines.length > 0) parts.push(lines.join(""));

      onProgress?.({
        phase: "export",
        completed,
        total: manifest.totalRecords,
        message: `Exporting ${collection}: ${actualCounts[collection]}/${manifest.collections[collection]}`,
      });

      const next = page.nextCursor;
      if (next && seenCursors.has(next)) throw new Error("Export cursor did not advance");
      if (next) seenCursors.add(next);
      cursor = next;
    } while (cursor);

    if (actualCounts[collection] !== manifest.collections[collection]) {
      throw new Error(`The ${collection} collection changed during export. Run the export again.`);
    }
  }

  parts.push(`${JSON.stringify({
    recordType: "end",
    collections: actualCounts,
    totalRecords: completed,
  })}\n`);
  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(new Blob(parts, { type: "application/x-ndjson" }), `${BACKUP_FILE_PREFIX}-v${LIBRARY_BACKUP_VERSION}-${date}.ndjson`);
  return { totalRecords: completed, collections: actualCounts };
}

async function* ndjsonLines(file: File): AsyncGenerator<unknown> {
  const reader = file.stream().getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let newline;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line) yield JSON.parse(line);
      }
      if (done) break;
    }
    const tail = buffer.trim();
    if (tail) yield JSON.parse(tail);
  } finally {
    reader.releaseLock();
  }
}

function mediaFromLegacyWatchlist(item: any) {
  const type = item?.mediaType === "tv" ? "series" : "movie";
  return {
    tmdbId: item?.tmdbId,
    title: item?.title,
    type,
    poster: item?.posterPath ?? null,
    overview: item?.overview ?? null,
    year: item?.releaseDate ? String(item.releaseDate).slice(0, 4) : null,
    rating: item?.voteAverage == null ? null : String(item.voteAverage),
    status: "planned",
    watched: false,
    isFollowing: type === "series",
  };
}

function mediaFromLegacyWatchedMovie(item: any) {
  return {
    tmdbId: item?.tmdbId,
    title: item?.title,
    type: "movie",
    poster: item?.posterPath ?? null,
    runtime: item?.runtime ?? null,
    status: "watched",
    watched: true,
    watchedAt: item?.watchedAt ?? null,
  };
}

function mediaFromLegacyFollowing(item: any) {
  return {
    tmdbId: item?.tmdbId,
    title: item?.title,
    type: "series",
    poster: item?.posterPath ?? null,
    status: "not_started",
    watched: false,
    isFollowing: true,
  };
}

function safeIsoDate(value: unknown, fallback = new Date()): string {
  const candidate = value == null || value === "" ? fallback : new Date(String(value));
  return Number.isNaN(candidate.getTime()) ? fallback.toISOString() : candidate.toISOString();
}

function mediaFromLegacyRating(item: any) {
  const type = item?.mediaType === "tv" || item?.mediaType === "series" ? "series" : "movie";
  const raw = Number(item?.value);
  const userRating = Number.isFinite(raw) ? Math.max(0, Math.min(100, raw <= 10 ? raw * 10 : raw)) : null;
  return {
    tmdbId: item?.tmdbId,
    title: item?.title || "Unknown",
    type,
    poster: item?.posterPath ?? null,
    userRating,
  };
}

function buildLegacySource(data: any): {
  manifest: LibraryBackupManifest;
  records: AsyncGenerator<LibraryTransferRecord>;
} {
  const library = data?.library;
  if (!library || typeof library !== "object") throw new Error("Backup does not contain a library object");

  const mediaSources: unknown[][] = [
    Array.isArray(library.media) ? library.media : [],
    (Array.isArray(library.watchlist) ? library.watchlist : []).map(mediaFromLegacyWatchlist),
    (Array.isArray(library.watchedMovies) ? library.watchedMovies : []).map(mediaFromLegacyWatchedMovie),
    (Array.isArray(library.following) ? library.following : []).map(mediaFromLegacyFollowing),
    (Array.isArray(library.ratings) ? library.ratings : []).map(mediaFromLegacyRating),
  ];
  const watchedEpisodes = Array.isArray(library.watchedEpisodes) ? library.watchedEpisodes : [];
  const episodeRatings = Array.isArray(library.episodeRatings) ? library.episodeRatings : [];
  const mediaCount = mediaSources.reduce((sum, items) => sum + items.length, 0);
  const collections = {
    ...emptyCollectionCounts(),
    media: mediaCount,
    watchedEpisodes: watchedEpisodes.length,
    episodeRatings: episodeRatings.length,
  };
  const totalRecords = mediaCount + watchedEpisodes.length + episodeRatings.length;

  async function* generate() {
    let mediaOrdinal = 0;
    for (const source of mediaSources) {
      for (const item of source) yield { collection: "media" as const, ordinal: mediaOrdinal++, data: item };
    }
    for (let index = 0; index < watchedEpisodes.length; index++) {
      yield { collection: "watchedEpisodes" as const, ordinal: index, data: watchedEpisodes[index] };
    }
    for (let index = 0; index < episodeRatings.length; index++) {
      yield { collection: "episodeRatings" as const, ordinal: index, data: episodeRatings[index] };
    }
  }

  return {
    manifest: {
      recordType: "manifest",
      kind: LIBRARY_BACKUP_KIND,
      version: LIBRARY_BACKUP_VERSION,
      format: "ndjson",
      app: APP_NAME,
      exportedAt: new Date().toISOString(),
      source: `legacy-json-v${Number(data?.version || 1)}`,
      user: {
        name: String(data?.user?.name || "Imported user"),
        avatar: typeof data?.user?.avatar === "string" ? data.user.avatar : null,
        createdAt: safeIsoDate(data?.user?.createdAt),
      },
      collections,
      totalRecords,
      pageSize: 500,
    },
    records: generate(),
  };
}

async function openBackup(file: File): Promise<{
  manifest: LibraryBackupManifest;
  records: AsyncGenerator<LibraryTransferRecord>;
}> {
  const firstLine = (await file.slice(0, Math.min(file.size, 16_384)).text()).split(/\r?\n/, 1)[0]?.trim();
  if (firstLine) {
    try {
      const candidate = JSON.parse(firstLine);
      if (candidate?.recordType === "manifest" && candidate?.kind === LIBRARY_BACKUP_KIND) {
        if (!isSupportedBackupVersion(candidate.version) || candidate.format !== "ndjson") {
          throw new Error(`Unsupported backup version ${candidate.version}`);
        }
        const collections = normalizeCollectionCounts(candidate.collections);
        const manifest: LibraryBackupManifest = {
          ...candidate,
          version: candidate.version,
          collections,
          totalRecords: Object.values(collections).reduce((sum, count) => sum + count, 0),
        };
        async function* records() {
          let first = true;
          for await (const line of ndjsonLines(file)) {
            if (first) {
              first = false;
              continue;
            }
            const record = line as {
              recordType?: string;
              collection?: unknown;
              ordinal?: unknown;
              data?: unknown;
            };
            if (record.recordType === "end") break;
            if (record.recordType !== "record" || !isLibraryCollection(record.collection)) {
              throw new Error("Invalid NDJSON backup record");
            }
            yield {
              collection: record.collection,
              ordinal: Number(record.ordinal),
              data: record.data,
            };
          }
        }
        return { manifest, records: records() };
      }
    } catch (error) {
      if (firstLine.includes('"recordType":"manifest"')) throw error;
    }
  }

  const text = await file.text();
  return buildLegacySource(JSON.parse(text));
}

export async function restoreLibraryBackup(file: File, options: RestoreOptions) {
  options.onProgress?.({ phase: "reading", completed: 0, total: file.size, message: "Reading backup manifest" });
  const source = await openBackup(file);
  const start = await readJsonResponse<{ sessionId: string }>(
    await fetch("/api/library/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manifest: source.manifest }),
    }),
  );

  let sequence = 0;
  let uploadedRecords = 0;
  let chunk: LibraryTransferRecord[] = [];
  let chunkBytes = 2;

  const abort = async () => {
    await fetch(`/api/library/import/${start.sessionId}`, { method: "DELETE" }).catch(() => undefined);
  };

  const flush = async () => {
    if (chunk.length === 0) return;
    const records = chunk;
    chunk = [];
    chunkBytes = 2;
    const response = await fetch(`/api/library/import/${start.sessionId}/chunks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sequence, checksum: await sha256(records), records }),
    });
    await readJsonResponse(response);
    sequence++;
    uploadedRecords += records.length;
    options.onProgress?.({
      phase: "upload",
      completed: uploadedRecords,
      total: source.manifest.totalRecords,
      message: `Validated and staged ${uploadedRecords}/${source.manifest.totalRecords} records`,
    });
  };

  try {
    for await (const record of source.records) {
      const bytes = new TextEncoder().encode(JSON.stringify(record)).byteLength + 1;
      if (bytes > LIBRARY_IMPORT_MAX_CHUNK_BYTES - 50_000) {
        throw new Error(`A ${record.collection} record is too large to import safely`);
      }
      if (chunk.length > 0 && (chunk.length >= CLIENT_CHUNK_MAX_RECORDS || chunkBytes + bytes > CLIENT_CHUNK_TARGET_BYTES)) {
        await flush();
      }
      chunk.push(record);
      chunkBytes += bytes;
    }
    await flush();

    if (uploadedRecords !== source.manifest.totalRecords) {
      throw new Error(`Backup ended after ${uploadedRecords} records; ${source.manifest.totalRecords} were expected`);
    }

    options.onProgress?.({
      phase: "validate",
      completed: uploadedRecords,
      total: uploadedRecords,
      message: "Building restore preview",
    });
    const finalized = await readJsonResponse<{
      preview: Record<string, unknown>;
      confirmationForCommit: string;
    }>(await fetch(`/api/library/import/${start.sessionId}/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedChunks: sequence, expectedRecords: uploadedRecords }),
    }));

    const approved = await options.confirmPreview(finalized.preview);
    if (!approved) {
      await abort();
      return { cancelled: true, preview: finalized.preview };
    }

    options.onProgress?.({
      phase: "commit",
      completed: uploadedRecords,
      total: uploadedRecords,
      message: "Applying the validated restore atomically",
    });
    const committed = await readJsonResponse<{ imported: Record<string, unknown> }>(
      await fetch(`/api/library/import/${start.sessionId}/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: finalized.confirmationForCommit }),
      }),
    );
    return { cancelled: false, preview: finalized.preview, imported: committed.imported };
  } catch (error) {
    await abort();
    throw error;
  }
}
