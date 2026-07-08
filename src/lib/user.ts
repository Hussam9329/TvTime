import { db } from "@/lib/db";
import { sanitizeUserId } from "@/lib/user-id";

export async function getOrCreateUser(userId?: string | null, name?: string) {
  const id = sanitizeUserId(userId);
  const existing = await db.user.findUnique({ where: { id } });
  if (existing) return existing;

  return db.user.create({
    data: {
      id,
      name: (name && name.trim()) || "Cinephile",
    },
  });
}

export function parseUserId(req: Request): string {
  const url = new URL(req.url);
  return sanitizeUserId(url.searchParams.get("userId") || req.headers.get("x-user-id"));
}
