import { db } from "@/lib/db";

// Get or create a user based on a client-supplied userId (stored in localStorage)
// This is a simplified auth-less approach for a personal tracking app.
export async function getOrCreateUser(userId?: string | null, name?: string) {
  if (userId) {
    const existing = await db.user.findUnique({ where: { id: userId } });
    if (existing) return existing;
  }
  return db.user.create({
    data: {
      id: userId || undefined,
      name: name || "Cinephile",
    },
  });
}

export function parseUserId(req: Request): string | null {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") || req.headers.get("x-user-id");
  return userId;
}
