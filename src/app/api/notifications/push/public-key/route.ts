import { NextResponse } from "next/server";
import { getVapidPublicKey } from "@/lib/web-push-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const publicKey = getVapidPublicKey();
  return NextResponse.json(
    { enabled: Boolean(publicKey), publicKey },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
