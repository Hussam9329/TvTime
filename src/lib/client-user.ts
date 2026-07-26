"use client";

import { DEFAULT_USER_ID } from "@/lib/user-id";

// For a personal tracking app, all data belongs to the default user.
// This ensures all existing data (imported with userId="cinetrack_default") is accessible.
export function getClientUserId(): string {
  return DEFAULT_USER_ID;
}

export function withUserId(url: URL): URL {
  return url;
}

export function userHeaders(): HeadersInit {
  return {};
}
