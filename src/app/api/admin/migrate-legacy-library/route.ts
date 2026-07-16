import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import { ensureLegacyLibraryMigrated } from "@/lib/legacy-library-migration";

function authorized(req: NextRequest) {
  const expected = String(process.env.ADMIN_REPAIR_SECRET || "").trim();
  if (!expected) return process.env.NODE_ENV !== "production";
  const supplied = req.headers.get("x-admin-repair-secret") || req.nextUrl.searchParams.get("secret") || "";
  return supplied === expected;
}

// Explicit verification/repair endpoint. Normal users do not need to call it:
// getOrCreateUser performs the same idempotent migration before library reads.
export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json(
      { error: "unauthorized", hint: "Configure ADMIN_REPAIR_SECRET and send it as x-admin-repair-secret." },
      { status: 401 },
    );
  }

  try {
    const user = await getOrCreateUser(parseUserId(req));
    const report = await ensureLegacyLibraryMigrated(user.id);
    return NextResponse.json({ ok: true, report, atomic: true, sourceAfterMigration: "Media" });
  } catch (error) {
    console.error("[admin:migrate-legacy-library]", error);
    return NextResponse.json(
      { error: "Legacy library migration failed; the unverified transaction was rolled back." },
      { status: 500 },
    );
  }
}
