#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type MediaCandidate = {
  id: string;
  userId: string;
  tmdbId: number | null;
  title: string;
  type: string;
  genres: string[];
};

type FailureReason =
  | "MISSING_TMDB_ID"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "TMDB_NOT_FOUND"
  | "TMDB_NO_GENRES"
  | "TMDB_RATE_LIMITED"
  | "TMDB_REQUEST_FAILED"
  | "DATABASE_UPDATE_FAILED";

type Failure = {
  id: string;
  userId: string;
  tmdbId: number | null;
  title: string;
  type: string;
  reason: FailureReason;
  detail: string;
};

type RepairPreview = {
  id: string;
  tmdbId: number;
  title: string;
  type: string;
  genres: string[];
};

type ParsedArgs = {
  apply: boolean;
  verifyOnly: boolean;
  batchSize: number;
  delayMs: number;
  batchPauseMs: number;
  maxRetries: number;
  timeoutMs: number;
  reportPath: string | null;
};

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_DELAY_MS = 300;
const DEFAULT_BATCH_PAUSE_MS = 1_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_TIMEOUT_MS = 10_000;

function parsePositiveIntFlag(name: string, fallback: number, min: number, max: number): number {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  if (raw == null) return fallback;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`--${name} must be an integer between ${min} and ${max}.`);
  }
  return parsed;
}

function parseArgs(): ParsedArgs {
  const apply = process.argv.includes("--apply");
  const verifyOnly = process.argv.includes("--verify-only");
  const reportArg = process.argv.find((arg) => arg.startsWith("--report="));
  const reportPath = reportArg ? reportArg.slice("--report=".length).trim() || null : null;

  if (apply && verifyOnly) {
    throw new Error("Choose either --apply or --verify-only, not both.");
  }

  return {
    apply,
    verifyOnly,
    batchSize: parsePositiveIntFlag("batch-size", DEFAULT_BATCH_SIZE, 1, 100),
    delayMs: parsePositiveIntFlag("delay-ms", DEFAULT_DELAY_MS, 0, 60_000),
    batchPauseMs: parsePositiveIntFlag("batch-pause-ms", DEFAULT_BATCH_PAUSE_MS, 0, 60_000),
    maxRetries: parsePositiveIntFlag("max-retries", DEFAULT_MAX_RETRIES, 0, 8),
    timeoutMs: parsePositiveIntFlag("timeout-ms", DEFAULT_TIMEOUT_MS, 1_000, 60_000),
    reportPath,
  };
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function tmdbEndpointFor(type: string): "movie" | "tv" | null {
  if (type === "movie") return "movie";
  if (type === "series" || type === "tv") return "tv";
  return null;
}

function normalizeGenreNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const names = value
    .map((genre) => {
      if (!genre || typeof genre !== "object") return "";
      const name = (genre as { name?: unknown }).name;
      return typeof name === "string" ? name.trim() : "";
    })
    .filter(Boolean);

  return Array.from(new Set(names));
}

function retryDelayMs(attempt: number, retryAfterHeader: string | null): number {
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1_000, 60_000);
  }
  return Math.min(1_000 * 2 ** attempt, 15_000);
}

class TmdbRequestError extends Error {
  status: number | null;
  retryAfter: string | null;

  constructor(message: string, status: number | null = null, retryAfter: string | null = null) {
    super(message);
    this.name = "TmdbRequestError";
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

async function fetchTmdbGenres(
  endpoint: "movie" | "tv",
  tmdbId: number,
  apiKey: string,
  maxRetries: number,
  timeoutMs: number,
): Promise<string[]> {
  const url = new URL(`${TMDB_BASE_URL}/${endpoint}/${tmdbId}`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("language", "en-US");

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      if (response.ok) {
        const data = await response.json() as { genres?: unknown };
        return normalizeGenreNames(data.genres);
      }

      const body = (await response.text().catch(() => "")).slice(0, 300);
      const retryAfter = response.headers.get("retry-after");
      const isRetryable = response.status === 429 || response.status >= 500;
      const error = new TmdbRequestError(
        `TMDB ${response.status}${body ? `: ${body}` : ""}`,
        response.status,
        retryAfter,
      );

      if (!isRetryable || attempt === maxRetries) throw error;
      await sleep(retryDelayMs(attempt, retryAfter));
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      const isAbort = normalizedError.name === "AbortError";
      const knownHttpError = normalizedError instanceof TmdbRequestError ? normalizedError : null;
      const canRetry = isAbort
        || knownHttpError == null
        || knownHttpError.status === 429
        || (knownHttpError.status ?? 0) >= 500;

      if (!canRetry || attempt === maxRetries) {
        if (isAbort) {
          throw new TmdbRequestError(`TMDB request timed out after ${timeoutMs}ms.`);
        }
        throw normalizedError;
      }

      await sleep(retryDelayMs(attempt, knownHttpError?.retryAfter ?? null));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new TmdbRequestError("TMDB request exhausted retries.");
}

function failureFromTmdbError(item: MediaCandidate, error: unknown): Failure {
  const detail = error instanceof Error ? error.message : String(error);
  const status = error instanceof TmdbRequestError ? error.status : null;

  let reason: FailureReason = "TMDB_REQUEST_FAILED";
  if (status === 404) reason = "TMDB_NOT_FOUND";
  else if (status === 429) reason = "TMDB_RATE_LIMITED";

  return {
    id: item.id,
    userId: item.userId,
    tmdbId: item.tmdbId,
    title: item.title,
    type: item.type,
    reason,
    detail,
  };
}

async function writeReport(path: string | null, report: unknown): Promise<void> {
  if (!path) return;
  const absolutePath = resolve(process.cwd(), path);
  await writeFile(absolutePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`[BAT-05] Report written to ${absolutePath}`);
}

async function main(): Promise<void> {
  let args: ParsedArgs;
  try {
    args = parseArgs();
  } catch (error) {
    console.error(`[BAT-05] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 64;
    return;
  }

  const apiKey = process.env.TMDB_API_KEY?.trim() || "";
  if (!args.verifyOnly && !apiKey) {
    console.error("[BAT-05] TMDB_API_KEY is required. No database connection or writes were attempted.");
    process.exitCode = 1;
    return;
  }

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({ log: ["error"] });
  const startedAt = new Date();

  try {
    const missingWhere = { genres: { isEmpty: true } } as const;
    const beforeCount = await prisma.media.count({ where: missingWhere });
    const missingRows = await prisma.media.findMany({
      where: missingWhere,
      select: {
        id: true,
        userId: true,
        tmdbId: true,
        title: true,
        type: true,
        genres: true,
      },
      orderBy: [{ addedAt: "asc" }, { id: "asc" }],
    });

    if (args.verifyOnly) {
      const unresolved = missingRows.map((item) => ({
        id: item.id,
        userId: item.userId,
        tmdbId: item.tmdbId,
        title: item.title,
        type: item.type,
        reason: item.tmdbId == null
          ? "MISSING_TMDB_ID"
          : tmdbEndpointFor(item.type) == null
            ? "UNSUPPORTED_MEDIA_TYPE"
            : "NEEDS_BACKFILL",
      }));
      const report = {
        bat: "BAT-05",
        mode: "verify-only",
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        missingGenres: beforeCount,
        success: beforeCount === 0,
        unresolved,
      };
      console.log(JSON.stringify(report, null, 2));
      await writeReport(args.reportPath, report);
      if (beforeCount > 0) process.exitCode = 2;
      return;
    }

    const mode = args.apply ? "APPLY" : "DRY RUN";
    console.log(`[BAT-05] ${mode}: found ${beforeCount} Media rows with empty genres.`);
    console.log(`[BAT-05] batchSize=${args.batchSize}, delayMs=${args.delayMs}, maxRetries=${args.maxRetries}`);

    let repaired = 0;
    let repairable = 0;
    let skippedConcurrentUpdate = 0;
    const failures: Failure[] = [];
    const preview: RepairPreview[] = [];

    for (let offset = 0; offset < missingRows.length; offset += args.batchSize) {
      const batch = missingRows.slice(offset, offset + args.batchSize);
      const batchNumber = Math.floor(offset / args.batchSize) + 1;
      const totalBatches = Math.ceil(missingRows.length / args.batchSize);
      console.log(`[BAT-05] Processing batch ${batchNumber}/${totalBatches} (${batch.length} rows)...`);

      for (const item of batch) {
        if (item.tmdbId == null) {
          failures.push({
            id: item.id,
            userId: item.userId,
            tmdbId: null,
            title: item.title,
            type: item.type,
            reason: "MISSING_TMDB_ID",
            detail: "Cannot fetch authoritative genres without a TMDB id.",
          });
          continue;
        }

        const endpoint = tmdbEndpointFor(item.type);
        if (!endpoint) {
          failures.push({
            id: item.id,
            userId: item.userId,
            tmdbId: item.tmdbId,
            title: item.title,
            type: item.type,
            reason: "UNSUPPORTED_MEDIA_TYPE",
            detail: `Unsupported Media.type value: ${JSON.stringify(item.type)}.`,
          });
          continue;
        }

        try {
          const genres = await fetchTmdbGenres(
            endpoint,
            item.tmdbId,
            apiKey,
            args.maxRetries,
            args.timeoutMs,
          );

          if (genres.length === 0) {
            failures.push({
              id: item.id,
              userId: item.userId,
              tmdbId: item.tmdbId,
              title: item.title,
              type: item.type,
              reason: "TMDB_NO_GENRES",
              detail: "TMDB returned an empty genres array; the row was left unchanged.",
            });
          } else {
            repairable++;
            preview.push({
              id: item.id,
              tmdbId: item.tmdbId,
              title: item.title,
              type: item.type,
              genres,
            });

            if (args.apply) {
              try {
                // Update only if genres are still empty. This avoids overwriting a
                // concurrent/manual correction made while the maintenance job runs.
                const result = await prisma.media.updateMany({
                  where: { id: item.id, genres: { isEmpty: true } },
                  data: { genres },
                });
                if (result.count === 1) {
                  repaired++;
                  console.log(`[BAT-05] ✓ ${item.title} -> ${genres.join(" • ")}`);
                } else {
                  skippedConcurrentUpdate++;
                  console.log(`[BAT-05] ↷ ${item.title} was already updated; skipped.`);
                }
              } catch (error) {
                failures.push({
                  id: item.id,
                  userId: item.userId,
                  tmdbId: item.tmdbId,
                  title: item.title,
                  type: item.type,
                  reason: "DATABASE_UPDATE_FAILED",
                  detail: error instanceof Error ? error.message : String(error),
                });
              }
            }
          }
        } catch (error) {
          failures.push(failureFromTmdbError(item, error));
        }

        await sleep(args.delayMs);
      }

      if (offset + args.batchSize < missingRows.length) {
        await sleep(args.batchPauseMs);
      }
    }

    const afterCount = args.apply
      ? await prisma.media.count({ where: missingWhere })
      : beforeCount;
    const remainingRows = args.apply && afterCount > 0
      ? await prisma.media.findMany({
          where: missingWhere,
          select: { id: true, userId: true, tmdbId: true, title: true, type: true },
          orderBy: [{ addedAt: "asc" }, { id: "asc" }],
        })
      : [];

    const report = {
      bat: "BAT-05",
      mode: args.apply ? "apply" : "dry-run",
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      configuration: {
        batchSize: args.batchSize,
        delayMs: args.delayMs,
        batchPauseMs: args.batchPauseMs,
        maxRetries: args.maxRetries,
        timeoutMs: args.timeoutMs,
      },
      counts: {
        before: beforeCount,
        scanned: missingRows.length,
        repairable,
        repaired,
        skippedConcurrentUpdate,
        failures: failures.length,
        after: afterCount,
      },
      success: args.apply ? afterCount === 0 : failures.length === 0,
      failures,
      remaining: remainingRows,
      preview: args.apply ? undefined : preview,
    };

    console.log("[BAT-05] Final report:");
    console.log(JSON.stringify(report, null, 2));
    await writeReport(args.reportPath, report);

    if (!args.apply) {
      if (failures.length === 0) {
        console.log("[BAT-05] Dry run passed. Re-run with --apply to write genres to the database.");
      } else {
        console.error("[BAT-05] Dry run found unresolved rows. Review the failure reasons before applying.");
        process.exitCode = 2;
      }
      return;
    }

    if (afterCount === 0) {
      console.log(`[BAT-05] COMPLETE: empty genres reduced from ${beforeCount} to 0.`);
    } else {
      console.error(`[BAT-05] INCOMPLETE: ${afterCount} rows still have empty genres.`);
      console.error("[BAT-05] Do not advance to the next phase until each remaining row has a documented resolution.");
      process.exitCode = 2;
    }
  } catch (error) {
    console.error("[BAT-05] Fatal error. No reset or destructive command was used.");
    console.error(error instanceof Error ? error.stack || error.message : error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

await main();
