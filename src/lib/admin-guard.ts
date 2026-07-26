import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { resolveUserId } from "@/lib/auth";
import {
  MIN_ADMIN_REPAIR_SECRET_LENGTH,
  isAdminOriginAllowed,
  parseAdminCommandBody,
  parseBearerSecret,
  type AdminCommandInput,
} from "@/lib/admin-command";

export type AdminCommandAuthorization =
  | {
      ok: true;
      userId: string;
      apply: boolean;
      input: AdminCommandInput;
      confirmation: string;
    }
  | { ok: false; response: NextResponse };

function sameSecret(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length
    && timingSafeEqual(providedBuffer, expectedBuffer);
}

/**
 * Authorize a destructive maintenance command.
 *
 * Requirements:
 * - authenticated owner session (resolved by resolveUserId)
 * - same-origin browser request, or an origin-less CLI request
 * - ADMIN_REPAIR_SECRET supplied only as Authorization: Bearer
 * - POST JSON body with an explicit apply flag and confirmation token
 */
export async function requireAdminCommand(
  req: NextRequest,
  operation: string,
): Promise<AdminCommandAuthorization> {
  const expected = String(process.env.ADMIN_REPAIR_SECRET ?? "").trim();
  if (expected.length < MIN_ADMIN_REPAIR_SECRET_LENGTH) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: `Admin endpoints require ADMIN_REPAIR_SECRET with at least ${MIN_ADMIN_REPAIR_SECRET_LENGTH} characters.`,
          code: "ADMIN_SECRET_NOT_CONFIGURED",
        },
        { status: 503 },
      ),
    };
  }

  if (!isAdminOriginAllowed(req.headers.get("origin"), req.nextUrl.origin, req.headers.get("sec-fetch-site"))) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Cross-origin admin requests are forbidden.", code: "ADMIN_ORIGIN_FORBIDDEN" },
        { status: 403 },
      ),
    };
  }

  const provided = parseBearerSecret(req.headers.get("authorization"));
  if (!provided || !sameSecret(provided, expected)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "A valid admin Bearer token is required.", code: "ADMIN_SECRET_INVALID" },
        { status: 401 },
      ),
    };
  }

  let userId: string;
  try {
    userId = await resolveUserId(req);
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "An authenticated owner session is required.", code: "UNAUTHORIZED" },
        { status: 401 },
      ),
    };
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Admin request body must be valid JSON.", code: "INVALID_ADMIN_JSON" },
        { status: 400 },
      ),
    };
  }

  const command = parseAdminCommandBody(rawBody, operation);
  if (!command.ok) {
    return {
      ok: false,
      response: NextResponse.json(command, { status: command.status }),
    };
  }

  return {
    ok: true,
    userId,
    apply: command.apply,
    input: command.input,
    confirmation: command.confirmation,
  };
}
