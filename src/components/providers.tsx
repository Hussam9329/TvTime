"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState, useEffect } from "react";
import { useNav } from "@/lib/store";
import { getClientUserId, userHeaders, withUserId } from "@/lib/client-user";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
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

  // Keep the server-side TV state engine alive while the app is open. A show
  // that was Up To Date must be re-evaluated when a new episode reaches its air
  // date, even if the user leaves the tab open overnight.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const stableUserId = userId || getClientUserId();
    let running = false;

    const refreshTrackingState = async () => {
      if (running) return;
      running = true;
      try {
        const url = withUserId(new URL("/api/tv-tracking", window.location.origin));
        url.searchParams.set("countsOnly", "true");
        const res = await fetch(url, {
          headers: userHeaders(),
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`TV Tracking counts ${res.status}`);
        const payload = await res.json();
        client.setQueryData(["tv-tracking-counts", stableUserId], payload);
        await Promise.all([
          client.invalidateQueries({ queryKey: ["tv-tracking"] }),
          client.invalidateQueries({ queryKey: ["tmdb", "show-progress-seasons"] }),
          client.invalidateQueries({ queryKey: ["media"] }),
          client.invalidateQueries({ queryKey: ["media", "following"] }),
        ]);

        const statsRes = await fetch(
          withUserId(new URL("/api/library/stats", window.location.origin)),
          { headers: userHeaders(), cache: "no-store" },
        );
        if (statsRes.ok) {
          client.setQueryData(["lib", "stats", stableUserId], await statsRes.json());
        }
      } catch {
        // Background refresh is best effort. Visible queries still surface their
        // own errors and retry normally.
      } finally {
        running = false;
      }
    };

    const timer = window.setTimeout(() => void refreshTrackingState(), 100);
    const interval = window.setInterval(() => void refreshTrackingState(), 5 * 60 * 1000);
    const onFocus = () => void refreshTrackingState();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refreshTrackingState();
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [client, userId]);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </ThemeProvider>
  );
}
