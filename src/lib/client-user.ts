"use client";

import { DEFAULT_USER_ID } from "@/lib/user-id";

export function getClientUserId(): string {
  if (typeof window === "undefined") return DEFAULT_USER_ID;
  try {
    const raw = window.localStorage.getItem("cinetrack-nav");
    if (!raw) return DEFAULT_USER_ID;
    const parsed = JSON.parse(raw);
    const userId = parsed?.state?.userId || parsed?.userId;
    return typeof userId === "string" && userId.trim() ? userId.trim() : DEFAULT_USER_ID;
  } catch {
    return DEFAULT_USER_ID;
  }
}

export function withUserId(url: URL): URL {
  url.searchParams.set("userId", getClientUserId());
  return url;
}

export function userHeaders(): HeadersInit {
  return { "x-user-id": getClientUserId() };
}
