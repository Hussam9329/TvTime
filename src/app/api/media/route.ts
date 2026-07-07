import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET - query media with filters and pagination
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const type = url.searchParams.get("type"); // movie | series | book | game
  const status = url.searchParams.get("status"); // planned | watched | ""
  const watched = url.searchParams.get("watched"); // true | false
  const rated = url.searchParams.get("rated"); // true (has userRating)
  const search = url.searchParams.get("search");
  const sortBy = url.searchParams.get("sortBy") || "addedAt"; // addedAt | userRating | title | year
  const order = url.searchParams.get("order") || "desc"; // asc | desc
  const limit = Math.min(Number(url.searchParams.get("limit")) || 100, 500);
  const offset = Number(url.searchParams.get("offset")) || 0;

  const where: any = {};
  if (type) where.type = type;
  if (status === "planned") where.status = "planned";
  if (watched === "true") where.watched = true;
  if (watched === "false") where.watched = false;
  if (rated === "true") where.userRating = { not: null };
  if (search) {
    where.title = { contains: search, mode: "insensitive" };
  }

  const orderBy: any = {};
  if (sortBy === "title") orderBy.title = order;
  else if (sortBy === "userRating") orderBy.userRating = order;
  else if (sortBy === "year") orderBy.year = order;
  else orderBy.addedAt = order;

  const [items, total] = await Promise.all([
    db.media.findMany({
      where,
      orderBy,
      take: limit,
      skip: offset,
    }),
    db.media.count({ where }),
  ]);

  return NextResponse.json({ items, total, limit, offset });
}
