import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import { normalizeMediaMany } from "@/lib/media-normalize";

const SORTABLE_FIELDS = new Set(["addedAt", "updatedAt", "userRating", "title", "year", "watchedAt"]);
const ORDERS = new Set(["asc", "desc"]);

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const url = new URL(req.url);
    const type = url.searchParams.get("type");
    const status = url.searchParams.get("status");
    const watched = url.searchParams.get("watched");
    const rated = url.searchParams.get("rated");
    const search = url.searchParams.get("search")?.trim();
    const sortByParam = url.searchParams.get("sortBy") || "addedAt";
    const orderParam = url.searchParams.get("order") || "desc";
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 100, 1), 500);
    const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);

    const where: any = { userId: user.id };
    if (type && type !== "undefined" && type !== "all") where.type = type;
    if (status && status !== "all" && status !== "undefined") {
      // Support comma-separated statuses (e.g. "finished,watched" for backward compat)
      if (status.includes(",")) {
        where.status = { in: status.split(",").map((s) => s.trim()).filter(Boolean) };
      } else if (status === "finished") {
        // Backward compat: legacy shows have status="watched" — treat as finished
        where.status = { in: ["finished", "watched"] };
      } else {
        where.status = status;
      }
    }
    if (watched === "true") where.watched = true;
    if (watched === "false") where.watched = false;
    if (rated === "true") where.userRating = { not: null };
    if (rated === "false") where.userRating = null;

    const isAnime = url.searchParams.get("isAnime");
    if (isAnime === "true") where.isAnime = true;
    if (isAnime === "false") where.isAnime = false;
    if (search) where.title = { contains: search };

    const sortBy = SORTABLE_FIELDS.has(sortByParam) ? sortByParam : "addedAt";
    const order = ORDERS.has(orderParam) ? orderParam : "desc";

    const [items, total] = await Promise.all([
      db.media.findMany({ where, orderBy: { [sortBy]: order }, take: limit, skip: offset }),
      db.media.count({ where }),
    ]);

    return NextResponse.json({ items: normalizeMediaMany(items), total, limit, offset });
  } catch (error) {
    console.error("[media:list]", error);
    return NextResponse.json({ error: "Failed to load media library" }, { status: 500 });
  }
}
