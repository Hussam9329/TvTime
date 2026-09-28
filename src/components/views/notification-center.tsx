"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Bell, X, CheckCheck, Trash2, Tv, Film, AlertTriangle, CalendarClock, Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { userHeaders, withUserId } from "@/lib/client-user";
import { useNav } from "@/lib/store";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";

interface NotificationItem {
  id: string; type: string; title: string; body: string; tmdbId: number | null; mediaType: string | null;
  read: boolean; createdAt: string; scheduledFor: string | null;
}
type Filter = "all" | "unread" | "read";
type Counts = { all: number; unread: number; read: number };

const TYPE_META: Record<string, { icon: React.ComponentType<{ size?: number; className?: string }>; color: string; bg: string; label: string }> = {
  new_episode: { icon: Tv, color: "text-chart-3", bg: "bg-chart-3/15", label: "New episode" },
  movie_available: { icon: Film, color: "text-chart-5", bg: "bg-chart-5/15", label: "Movie available" },
  season_return: { icon: CalendarClock, color: "text-chart-2", bg: "bg-chart-2/15", label: "Season return" },
  season_premiere: { icon: CalendarClock, color: "text-chart-1", bg: "bg-chart-1/15", label: "Season premiere" },
  season_finale: { icon: Flag, color: "text-chart-2", bg: "bg-chart-2/15", label: "Season finale" },
  backlog_alert: { icon: AlertTriangle, color: "text-chart-4", bg: "bg-chart-4/15", label: "Episode backlog" },
};

export function NotificationCenter({ onClose, onUnreadCountChange }: { onClose: () => void; onUnreadCountChange?: (count: number) => void }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [counts, setCounts] = useState<Counts>({ all: 0, unread: 0, read: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const filterRef = useRef<Filter>("all");
  const requestSerial = useRef(0);
  const goTv = useNav((state) => state.goTv);
  const goMovie = useNav((state) => state.goMovie);

  const fetchNotifications = useCallback(async (targetFilter: Filter, append = false, offset = 0) => {
    const requestId = ++requestSerial.current;
    try {
      if (append) setLoadingMore(true);
      else setLoading(true);
      const url = withUserId(new URL("/api/notifications", window.location.origin));
      if (targetFilter !== "all") url.searchParams.set("filter", targetFilter);
      url.searchParams.set("limit", "100");
      url.searchParams.set("offset", String(Math.max(0, offset)));
      const res = await fetch(url, { headers: userHeaders(), cache: "no-store" });
      if (!res.ok) {
        if (requestId === requestSerial.current && !append) setLoadError(true);
        if (requestId === requestSerial.current && append) toast.error("Couldn’t load more notifications");
        return;
      }
      const data = await res.json();
      if (requestId !== requestSerial.current) return;
      setLoadError(false);
      const next = Array.isArray(data.notifications) ? data.notifications : [];
      setNotifications((prev) => append
        ? [...new Map([...prev, ...next].map((item) => [item.id, item])).values()]
        : next);
      const nextCounts = data.counts || { all: next.length, unread: Number(data.unreadCount || 0), read: 0 };
      setCounts(nextCounts);
      setHasMore(Boolean(data.page?.hasMore));
      onUnreadCountChange?.(Number(nextCounts.unread || 0));
    } catch (error) {
      console.error(error);
      if (requestId === requestSerial.current) {
        if (append) toast.error("Couldn’t load more notifications");
        else setLoadError(true);
      }
    } finally {
      if (requestId === requestSerial.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [onUnreadCountChange]);

  useEffect(() => {
    filterRef.current = filter;
    void fetchNotifications(filter, false, 0);
  }, [fetchNotifications, filter]);

  useEffect(() => {
    void (async () => {
      const syncUrl = withUserId(new URL("/api/notifications/sync", window.location.origin));
      const synced = await fetch(syncUrl, { method: "POST", headers: userHeaders() }).catch(() => null);
      if (synced?.ok) await fetchNotifications(filterRef.current, false, 0);
    })();
  }, [fetchNotifications]);

  const refreshCurrent = () => fetchNotifications(filter, false, 0);

  const handleMarkRead = async (id: string) => {
    const url = withUserId(new URL("/api/notifications", window.location.origin));
    url.searchParams.set("id", id); url.searchParams.set("action", "read");
    const response = await fetch(url, { method: "PATCH", headers: userHeaders() });
    if (!response.ok) return void toast.error("Couldn’t update the notification");
    await refreshCurrent();
  };

  const openNotification = async (notification: NotificationItem) => {
    if (!notification.read) await handleMarkRead(notification.id);
    if (!notification.tmdbId) return;
    onClose();
    if (notification.mediaType === "movie") goMovie(notification.tmdbId);
    else goTv(notification.tmdbId);
  };

  const handleMarkAllRead = async () => {
    const url = withUserId(new URL("/api/notifications", window.location.origin)); url.searchParams.set("action", "all");
    const response = await fetch(url, { method: "PATCH", headers: userHeaders() });
    if (!response.ok) return void toast.error("Couldn’t update notifications");
    await refreshCurrent(); toast.success("All notifications marked as read");
  };

  const handleDelete = async (id: string) => {
    const url = withUserId(new URL("/api/notifications", window.location.origin)); url.searchParams.set("id", id);
    const response = await fetch(url, { method: "DELETE", headers: userHeaders() });
    if (!response.ok) return void toast.error("Couldn’t delete the notification");
    await refreshCurrent();
  };

  const handleClearAll = async () => {
    if (!confirm("Clear all notifications? This can’t be undone.")) return;
    const url = withUserId(new URL("/api/notifications", window.location.origin)); url.searchParams.set("action", "all");
    const response = await fetch(url, { method: "DELETE", headers: userHeaders() });
    if (!response.ok) return void toast.error("Couldn’t clear notifications");
    setNotifications([]); setCounts({ all: 0, unread: 0, read: 0 }); setHasMore(false); onUnreadCountChange?.(0);
    toast.success("All notifications cleared");
  };

  const tabs = [
    { key: "all" as const, label: "All", count: counts.all },
    { key: "unread" as const, label: "Unread", count: counts.unread },
    { key: "read" as const, label: "Read", count: counts.read },
  ];

  let listContent: React.ReactNode;
  if (loading) {
    listContent = (
      <div className="feedback-state feedback-state--loading feedback-state--compact m-3 flex items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground" role="status" aria-busy="true">
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        Loading notifications…
      </div>
    );
  } else if (loadError && notifications.length === 0) {
    listContent = (
      <ErrorState
        compact
        className="m-3"
        title="Couldn’t load notifications"
        description="Check your connection and try again."
        onRetry={() => void refreshCurrent()}
      />
    );
  } else if (notifications.length === 0) {
    listContent = (
      <EmptyState
        className="m-3 h-full"
        icon={<Bell size={32} />}
        title={filter === "unread" ? "No unread notifications" : filter === "read" ? "No read notifications" : "No notifications yet"}
        description="New episodes, releases and season alerts will appear here."
      />
    );
  } else {
    listContent = (
      <>
        <div className="divide-y divide-border">
          {notifications.map((n) => {
            const meta = TYPE_META[n.type] || TYPE_META.new_episode;
            const Icon = meta.icon;
            return (
              <div key={n.id} onClick={() => void openNotification(n)} className={`tvtime-notification-item group relative flex cursor-pointer items-start gap-3 p-3 transition-colors hover:bg-accent/50 ${!n.read ? "bg-primary/5" : ""}`}>
                {!n.read && <div className="absolute left-1 top-3 size-2 rounded-full bg-primary" aria-hidden="true" />}
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${meta.bg}`}><Icon size={18} className={meta.color} /></div>
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-center gap-1.5">
                    <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${meta.bg} ${meta.color}`}>{meta.label}</span>
                    <span className="text-xs text-muted-foreground">{timeAgo(n.createdAt)}</span>
                  </div>
                  <h4 className="text-sm font-medium leading-tight" dir="auto">{n.title}</h4>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground" dir="auto">{n.body}</p>
                </div>
                <button type="button" data-ui-action="danger-icon" onClick={(e) => { e.stopPropagation(); void handleDelete(n.id); }} className="tvtime-notification-icon-button flex size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/15 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100" aria-label={`Delete notification ${n.title}`}><Trash2 size={14} /></button>
              </div>
            );
          })}
        </div>
        {hasMore && (
          <div className="p-3">
            <Button type="button" variant="outline" onClick={() => void fetchNotifications(filter, true, notifications.length)} disabled={loadingMore} aria-busy={loadingMore} className="w-full">
              {loadingMore && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              Load more
            </Button>
          </div>
        )}
      </>
    );
  }

  return createPortal(
    <div className="tvtime-notification-center fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="tvtime-notification-backdrop absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div data-ui-surface="dialog" onClick={(e) => e.stopPropagation()} className="tvtime-notification-panel relative flex h-full min-h-0 w-full max-w-md flex-col border-l border-border bg-card shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="tvtime-notification-title">
        <div className="tvtime-notification-header flex shrink-0 items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Bell size={20} />
              {counts.unread > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold leading-none tabular-nums text-destructive-foreground" aria-hidden="true">{counts.unread > 99 ? "99+" : counts.unread}</span>}
            </div>
            <div>
              <h2 id="tvtime-notification-title" className="text-base font-bold">Notifications</h2>
              <p className="text-xs text-muted-foreground">{counts.unread > 0 ? `${counts.unread} unread` : "You’re all caught up"}</p>
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon" data-ui-action="icon" onClick={onClose} className="tvtime-notification-icon-button" aria-label="Close notifications"><X size={16} /></Button>
        </div>
        <div className="tvtime-notification-tabs flex shrink-0 items-center gap-1 border-b border-border px-4 py-2">
          {tabs.map((t) => <button type="button" data-ui-action="choice" key={t.key} onClick={() => setFilter(t.key)} aria-pressed={filter === t.key} className={`tvtime-notification-tab flex h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-medium transition-colors ${filter === t.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"}`}>{t.label}<span className="text-xs tabular-nums opacity-70">({t.count})</span></button>)}
        </div>
        {counts.all > 0 && (
          <div className="tvtime-notification-actions flex shrink-0 items-center gap-2 border-b border-border px-4 py-1">
            <button type="button" data-ui-action="link" onClick={handleMarkAllRead} disabled={counts.unread === 0} className="flex min-h-10 items-center gap-1 text-xs text-primary hover:underline disabled:text-muted-foreground/50 disabled:no-underline"><CheckCheck size={12} /> Mark all as read</button>
            <span className="text-muted-foreground/30" aria-hidden="true">•</span>
            <button type="button" data-ui-action="danger-link" onClick={handleClearAll} className="flex min-h-10 items-center gap-1 text-xs text-destructive hover:underline"><Trash2 size={12} /> Clear all</button>
          </div>
        )}
        <div className="tvtime-notification-list min-h-0 flex-1 overflow-y-auto">
          {listContent}
        </div>
      </div>
    </div>, document.body,
  );
}

function timeAgo(iso: string): string {
  const d = new Date(iso); const diff = Date.now() - d.getTime(); const minutes = Math.floor(diff / 60000); const hours = Math.floor(diff / 3600000); const days = Math.floor(diff / 86400000);
  if (diff < 60000) return "Just now"; if (minutes < 60) return `${minutes}m ago`; if (hours < 24) return `${hours}h ago`; if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}
