import { db } from "@/lib/db";
import { sanitizeUserId } from "@/lib/user-id";
import { ensureLegacyLibraryMigrated } from "@/lib/legacy-library-migration";

export async function getOrCreateUser(userId?: string | null, name?: string) {
  const id = sanitizeUserId(userId);
  let user = await db.user.findUnique({ where: { id } });
  if (!user) {
    user = await db.user.create({
      data: {
        id,
        name: (name && name.trim()) || "Cinephile",
      },
    });
  }

  // TVM-10: import and verify legacy title-level tables once, then clean them
  // atomically. Fail closed: returning an apparently empty library would be
  // more dangerous than surfacing a migration error, so an unverified
  // migration blocks this request while leaving every legacy row untouched.
  try {
    const migration = await ensureLegacyLibraryMigrated(user.id);
    if (migration.mode === "applied") {
      console.info("[legacy-library-migration] completed", migration);
    }
  } catch (error) {
    console.error("[legacy-library-migration]", error);
    throw new Error("Legacy library migration could not be verified; no legacy rows were deleted.");
  }

  return user;
}

export function parseUserId(req: Request): string {
  const url = new URL(req.url);
  return sanitizeUserId(url.searchParams.get("userId") || req.headers.get("x-user-id"));
}
