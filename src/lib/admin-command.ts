export const MIN_ADMIN_REPAIR_SECRET_LENGTH = 32;

export type AdminCommandInput = Record<string, unknown>;

export type ParsedAdminCommand =
  | { ok: true; apply: boolean; input: AdminCommandInput; confirmation: string }
  | { ok: false; status: 400 | 409; code: string; error: string; confirmation?: string };

export function adminConfirmation(operation: string): string {
  return `APPLY:${operation}`;
}

export function parseBearerSecret(authorization: string | null | undefined): string | null {
  const match = String(authorization ?? "").match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
}

export function isAdminOriginAllowed(
  origin: string | null | undefined,
  expectedOrigin: string,
  secFetchSite: string | null | undefined,
): boolean {
  const fetchSite = String(secFetchSite ?? "").trim().toLowerCase();
  if (fetchSite === "cross-site") return false;
  if (!origin) return true; // CLI/server-to-server requests commonly omit Origin.

  try {
    return new URL(origin).origin === new URL(expectedOrigin).origin;
  } catch {
    return false;
  }
}

export function parseAdminCommandBody(raw: unknown, operation: string): ParsedAdminCommand {
  const input = raw == null ? {} : raw;
  if (typeof input !== "object" || Array.isArray(input)) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_ADMIN_BODY",
      error: "Admin request body must be a JSON object.",
    };
  }

  const command = input as AdminCommandInput;
  if (command.apply !== undefined && typeof command.apply !== "boolean") {
    return {
      ok: false,
      status: 400,
      code: "INVALID_APPLY_FLAG",
      error: "The apply field must be a boolean.",
    };
  }

  const apply = command.apply === true;
  const confirmation = adminConfirmation(operation);
  if (apply && command.confirm !== confirmation) {
    return {
      ok: false,
      status: 409,
      code: "ADMIN_CONFIRMATION_REQUIRED",
      error: `Applying this operation requires confirm=${confirmation}.`,
      confirmation,
    };
  }

  return { ok: true, apply, input: command, confirmation };
}
