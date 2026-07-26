import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { ensureLegacyLibraryMigrated } from "@/lib/legacy-library-migration";
import { requireAdminCommand } from "@/lib/admin-guard";

const OPERATION = "migrate-legacy-library";

// Explicit verification/repair endpoint. Normal users do not need to call it:
// getOrCreateUser performs the same idempotent migration before library reads.
export async function POST(req: NextRequest) {
  const command = await requireAdminCommand(req, OPERATION);
  if (!command.ok) return command.response;
  if (!command.apply) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      message: `Migration was not run. Re-submit with apply=true and confirm=${command.confirmation}.`,
    });
  }

  try {
    const user = await getOrCreateUser(command.userId);
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
