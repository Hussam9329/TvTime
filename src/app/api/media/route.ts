import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import { normalizeMediaMany } from "@/lib/media-normalize";
import {
  CANONICAL_MEDIA_STATES,
  normalizeCanonicalState,
  queryStatesFromLegacyStatus,
  type CanonicalMediaState,
} from "@/lib/media-state";

const SORTABLE_FIELDS = new Set(["addedAt", "updatedAt", "stateChangedAt", "userRating", "title", "year", "watchedAt"]);
const ORDERS = new Set(["asc", "desc"]);

function parseStateList(raw: string | null): CanonicalMediaState[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((value) => normalizeCanonicalState(value))
    .filter((value): value is CanonicalMediaState => Boolean(value));
}

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const url = new URL(req.url);
    const type = url.searchParams.get("type");
    const status = url.searchParams.get("status");
    const state = url.searchParams.get("state");
    const active = url.searchParams.get("active");
    const watched = url.searchParams.get("watched");
    const rated = url.searchParams.get("rated");
    const search = url.searchParams.get("search")?.trim();
    const sortByParam = url.searchParams.get("sortBy") || "addedAt";
    const orderParam = url.searchParams.get("order") || "desc";
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 100, 1), 500);
    const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);

    const where: any = { userId: user.id };
    if (type && type !== "undefined" && type !== "all") where.type = type === "tv" ? "series" : type;

    const explicitStates = parseStateList(state);
    const legacyStates = status && status !== "all" && status !== "undefined"
      ? queryStatesFromLegacyStatus(status)
      : [];
    const requestedStates = explicitStates.length ? explicitStates : legacyStates;

    if (requestedStates.length === 1) where.libraryState = requestedStates[0];
    if (requestedStates.length > 1) where.libraryState = { in: requestedStates };

    if (!requestedStates.length && active === "true") {
      where.libraryState = { in: CANONICAL_MEDIA_STATES.filter((value) => value !== "none") };
    }
    if (!requestedStates.length && active === "false") where.libraryState = "none";

    // Compatibility query only. Work-level watched state is derived from the
    // canonical state, never from rating or the deprecated boolean.
    if (!requestedStates.length && watched === "true") {
      where.libraryState = { in: ["completed", "up_to_date"] };
    }
    if (!requestedStates.length && watched === "false") {
      where.libraryState = { in: ["none", "planned", "watching"] };
    }

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
