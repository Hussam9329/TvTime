import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type RouteContext = { params: Promise<{ slug: string }> };

/** Public, read-only projection. It intentionally exposes no user/account fields. */
export async function GET(_request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const list = await db.customList.findFirst({
    where: { slug, isPublic: true },
    select: {
      name: true,
      description: true,
      color: true,
      slug: true,
      updatedAt: true,
      items: {
        orderBy: [{ order: "asc" }, { addedAt: "asc" }],
        select: { tmdbId: true, mediaType: true, title: true, posterPath: true, addedAt: true },
      },
    },
  });

  if (!list) return NextResponse.json({ error: "Public list not found" }, { status: 404 });
  return NextResponse.json({ list }, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
