"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState, useEffect } from "react";
import { useNav } from "@/lib/store";
import { getClientUserId, userHeaders, withUserId } from "@/lib/client-user";

/**
 * Background refresh interval for "slow-changing" data (TV tracking counts,
 * library stats). 15 minutes is realistic — TV episodes don't air more often
 * than that, and the server-side DB cache (TvMetadataCache) already has a
 * 5-minute TTL for ongoing shows, so the data is at most 5 minutes stale.
 *
 * Previously this was 5 minutes AND fired on every focus + visibility change,
 * causing 2 API calls + 4 query invalidations per trigger. That was ~12
 * background requests per hour per open tab — excessive for a personal app.
 */
const BACKGROUND_REFRESH_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Minimum gap between background refreshes. If the user switches tabs rapidly
 * (triggering online events) or the interval fires while a refresh is in
 * flight, we skip rather than queue. This prevents request pile-up.
 */
const MIN_REFRESH_GAP_MS = 30 * 1000;

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data is considered fresh for 5 minutes. After that, react-query
            // will refetch on the next mount/focus/interaction. This is a
            // good balance between freshness and server load.
            staleTime: 5 * 60 * 1000,
            // Don't refetch on window focus by default — the manual
            // background refresh below handles slow-changing data, and
            // individual views can opt in with their own refetchOnWindowFocus.
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            gcTime: 30 * 60 * 1000,
            retry: 1,
          },
        },
      })
  );

  const ensureUserId = useNav((s) => s.ensureUserId);
  const userId = useNav((s) => s.userId);
  const setUserName = useNav((s) => s.setUserName);

  useEffect(() => {
    ensureUserId();
  }, [ensureUserId]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js");
  }, []);

  useEffect(() => {
    if (!userId || typeof window === "undefined") return;
    const syncNotifications = async () => {
      try {
        const response = await fetch(withUserId(new URL("/api/notifications/sync", window.location.origin)), { method: "POST", headers: userHeaders() });
        if (!response.ok) return;
        const payload = await response.json();
        if (Notification.permission !== "granted" || !Array.isArray(payload.created)) return;
        const registration = await navigator.serviceWorker?.ready;
        for (const item of payload.created.slice(0, 3)) {
          registration?.active?.postMessage({ type: "SHOW_NOTIFICATION", title: item.title, body: item.body, url: item.tmdbId ? `/tv/${item.tmdbId}` : "/?view=watch-next" });
        }
      } catch { /* notifications are best-effort */ }
    };
    void syncNotifications();
    const timer = window.setInterval(() => void syncNotifications(), BACKGROUND_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [userId]);

  // Hydrate the display name from the server once on mount. This is a
  // single GET /api/user — not polled.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    const hydrateCanonicalProfile = async () => {
      try {
        const res = await fetch(withUserId(new URL("/api/user", window.location.origin)), {
          headers: userHeaders(),
          cache: "no-store",
        });
        if (!res.ok) return;
        const payload = await res.json();
        const serverName = String(payload?.user?.name || "").trim();
        if (!cancelled && serverName) setUserName(serverName);
      } catch {
        // Keep the locally cached display name when the profile endpoint is unavailable.
      }
    };

    void hydrateCanonicalProfile();
    return () => { cancelled = true; };
  }, [setUserName]);

  // ── BACKGROUND REFRESH ────────────────────────────────────────────────
  //
  // Replaces the old aggressive polling (5min interval + focus + visibility
  // listeners + 4 invalidateQueries cascades).
  //
  // What this does:
  // - Fires every 15 minutes (BACKGROUND_REFRESH_INTERVAL_MS).
  // - Fires once on "online" event (reconnect after network drop).
  // - Fetches ONLY /api/tv-tracking?countsOnly=true and /api/library/stats.
  // - Updates the react-query cache via setQueryData (no invalidation cascade).
  // - Individual view components refetch their own detailed data when the user
  //   navigates to them — they don't need to be force-invalidated in the
  //   background.
  //
  // What this does NOT do:
  // - Does NOT fire on every tab focus (was causing 2 API calls per focus).
  // - Does NOT fire on every visibility change (same issue).
  // - Does NOT invalidate 4 broad query keys (was causing N refetches per
  //   trigger where N = number of active queries matching those keys).
  // - Does NOT fire immediately on mount (the initial queries fire naturally
  //   when components mount; no need for a 100ms pre-emptive fetch).
  useEffect(() => {
    if (typeof window === "undefined") return;

    const stableUserId = userId || getClientUserId();
    let running = false;
    let lastRefreshAt = 0;

    const refreshSlowChangingData = async () => {
      // Debounce: skip if we refreshed less than MIN_REFRESH_GAP_MS ago.
      // This prevents pile-up when "online" fires multiple times.
      const now = Date.now();
      if (now - lastRefreshAt < MIN_REFRESH_GAP_MS) return;
      if (running) return;
      if (document.visibilityState !== "visible") return;

      running = true;
      lastRefreshAt = now;
      try {
        const countsUrl = withUserId(new URL("/api/tv-tracking", window.location.origin));
        countsUrl.searchParams.set("countsOnly", "true");
        countsUrl.searchParams.set("world", "standard");
        // Fetch both endpoints in parallel — they're independent.
        const [countsRes, statsRes] = await Promise.all([
          fetch(countsUrl, {
            headers: userHeaders(),
            cache: "no-store",
          }),
          fetch(withUserId(new URL("/api/library/stats", window.location.origin)), {
            headers: userHeaders(),
            cache: "no-store",
          }),
        ]);

        // Update cache for counts (if successful). Using setQueryData instead
        // of invalidateQueries means we don't force a refetch of every active
        // tv-tracking query — we just update the cached value. Views that are
        // currently mounted will see the fresh data on their next render.
        if (countsRes.ok) {
          const countsPayload = await countsRes.json();
          client.setQueryData(["tv-tracking-counts", stableUserId, "standard"], countsPayload);
        }

        // Update cache for library stats (if successful).
        if (statsRes.ok) {
          const statsPayload = await statsRes.json();
          client.setQueryData(["lib", "stats", stableUserId], statsPayload);
        }
      } catch {
        // Background refresh is best effort. Visible queries still surface their
        // own errors and retry normally.
      } finally {
        running = false;
      }
    };

    // 15-minute interval — slow-changing data only.
    const interval = window.setInterval(
      () => void refreshSlowChangingData(),
      BACKGROUND_REFRESH_INTERVAL_MS,
    );

    // Reconnect handler — fires when network comes back online.
    // Debounced via MIN_REFRESH_GAP_MS to avoid rapid-fire when the OS
    // flaps the connection.
    const onOnline = () => void refreshSlowChangingData();
    window.addEventListener("online", onOnline);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", onOnline);
    };
  }, [client, userId]);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </ThemeProvider>
  );
}
