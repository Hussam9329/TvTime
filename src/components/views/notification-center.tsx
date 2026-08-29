"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Bell, X, CheckCheck, Trash2, Tv, Film, AlertTriangle, CalendarClock, Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { userHeaders, withUserId } from "@/lib/client-user";
import { useNav } from "@/lib/store";

interface NotificationItem {
  id: string; type: string; title: string; body: string; tmdbId: number | null; mediaType: string | null;
  read: boolean; createdAt: string; scheduledFor: string | null;
}
type Filter = "all" | "unread" | "read";
type Counts = { all: number; unread: number; read: number };

const TYPE_META: Record<string, { icon: React.ComponentType<{ size?: number; className?: string }>; color: string; bg: string; label: string }> = {
  new_episode: { icon: Tv, color: "text-emerald-500", bg: "bg-emerald-500/15", label: "حلقة جديدة" },
  movie_available: { icon: Film, color: "text-blue-500", bg: "bg-blue-500/15", label: "فيلم متوفر" },
  season_return: { icon: CalendarClock, color: "text-purple-500", bg: "bg-purple-500/15", label: "عودة موسم" },
  season_premiere: { icon: CalendarClock, color: "text-cyan-500", bg: "bg-cyan-500/15", label: "بداية موسم" },
  season_finale: { icon: Flag, color: "text-fuchsia-500", bg: "bg-fuchsia-500/15", label: "نهاية موسم" },
  backlog_alert: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/15", label: "تراكم حلقات" },
};

export function NotificationCenter({ onClose, onUnreadCountChange }: { onClose: () => void; onUnreadCountChange?: (count: number) => void }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [counts, setCounts] = useState<Counts>({ all: 0, unread: 0, read: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const filterRef = useRef<Filter>("all");
  const requestSerial = useRef(0);
  const goTv = useNav((state) => state.goTv);
  const goMovie = useNav((state) => state.goMovie);

  const fetchNotifications = useCallback(async (targetFilter: Filter, append = false, offset = 0) => {
    const requestId = ++requestSerial.current;
    try {
      append ? setLoadingMore(true) : setLoading(true);
      const url = withUserId(new URL("/api/notifications", window.location.origin));
      if (targetFilter !== "all") url.searchParams.set("filter", targetFilter);
      url.searchParams.set("limit", "100");
      url.searchParams.set("offset", String(Math.max(0, offset)));
      const res = await fetch(url, { headers: userHeaders(), cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (requestId !== requestSerial.current) return;
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
    if (!response.ok) return void toast.error("تعذر تحديث الإشعار");
    await refreshCurrent();
  };

  const openNotification = async (notification: NotificationItem) => {
    if (!notification.read) await handleMarkRead(notification.id);
    if (!notification.tmdbId) return;
    onClose();
    notification.mediaType === "movie" ? goMovie(notification.tmdbId) : goTv(notification.tmdbId);
  };

  const handleMarkAllRead = async () => {
    const url = withUserId(new URL("/api/notifications", window.location.origin)); url.searchParams.set("action", "all");
    const response = await fetch(url, { method: "PATCH", headers: userHeaders() });
    if (!response.ok) return void toast.error("تعذر تحديث الإشعارات");
    await refreshCurrent(); toast.success("تم تعليم الكل كمقروء");
  };

  const handleDelete = async (id: string) => {
    const url = withUserId(new URL("/api/notifications", window.location.origin)); url.searchParams.set("id", id);
    const response = await fetch(url, { method: "DELETE", headers: userHeaders() });
    if (!response.ok) return void toast.error("تعذر حذف الإشعار");
    await refreshCurrent();
  };

  const handleClearAll = async () => {
    if (!confirm("هل تريد مسح كل الإشعارات؟")) return;
    const url = withUserId(new URL("/api/notifications", window.location.origin)); url.searchParams.set("action", "all");
    const response = await fetch(url, { method: "DELETE", headers: userHeaders() });
    if (!response.ok) return void toast.error("تعذر مسح الإشعارات");
    setNotifications([]); setCounts({ all: 0, unread: 0, read: 0 }); setHasMore(false); onUnreadCountChange?.(0);
    toast.success("تم مسح كل الإشعارات");
  };

  return createPortal(
    <div className="tvtime-notification-center fixed inset-0 z-50 flex justify-start" onClick={onClose} dir="rtl">
      <div className="tvtime-notification-backdrop absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div data-ui-surface="dialog" onClick={(e) => e.stopPropagation()} className="tvtime-notification-panel relative flex h-full min-h-0 w-full max-w-md flex-col border-l border-border bg-card shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="tvtime-notification-title">
        <div className="tvtime-notification-header flex shrink-0 items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2"><div className="relative"><Bell size={20} />{counts.unread > 0 && <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">{counts.unread > 99 ? "99+" : counts.unread}</span>}</div><div><h2 id="tvtime-notification-title" className="font-bold text-base">الإشعارات</h2><p className="text-xs text-muted-foreground">{counts.unread > 0 ? `${counts.unread.toLocaleString("ar-IQ")} غير مقروء` : "كل الإشعارات مقروءة"}</p></div></div>
          <button type="button" data-ui-action="icon" onClick={onClose} className="tvtime-notification-icon-button w-8 h-8 rounded-md hover:bg-accent flex items-center justify-center" aria-label="إغلاق الإشعارات"><X size={16} /></button>
        </div>
        <div className="tvtime-notification-tabs flex shrink-0 items-center gap-1 border-b border-border px-4 py-2">
          {[{ key: "all" as const, label: "الكل", count: counts.all }, { key: "unread" as const, label: "غير مقروء", count: counts.unread }, { key: "read" as const, label: "مقروء", count: counts.read }].map((t) => <button type="button" data-ui-action="choice" key={t.key} onClick={() => setFilter(t.key)} aria-pressed={filter === t.key} className={`tvtime-notification-tab px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${filter === t.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"}`}>{t.label}<span className="text-[10px] tabular-nums opacity-70">({t.count.toLocaleString("ar-IQ")})</span></button>)}
        </div>
        {counts.all > 0 && <div className="tvtime-notification-actions flex shrink-0 items-center gap-2 border-b border-border px-4 py-2"><button type="button" data-ui-action="link" onClick={handleMarkAllRead} disabled={counts.unread === 0} className="text-xs text-primary hover:underline disabled:text-muted-foreground/50 disabled:no-underline flex items-center gap-1"><CheckCheck size={12} /> تعليم الكل كمقروء</button><span className="text-muted-foreground/30">•</span><button type="button" data-ui-action="danger-link" onClick={handleClearAll} className="text-xs text-rose-500 hover:underline flex items-center gap-1"><Trash2 size={12} /> مسح الكل</button></div>}
        <div className="tvtime-notification-list min-h-0 flex-1 overflow-y-auto">
          {loading ? <div className="feedback-state feedback-state--loading feedback-state--compact m-3 p-8 text-center text-muted-foreground" role="status" aria-busy="true">جاري التحميل...</div> : notifications.length === 0 ? <div className="feedback-state feedback-state--empty m-3 flex flex-col items-center justify-center h-full py-12 text-center" role="status"><Bell className="text-muted-foreground/30 mb-3" size={48} /><h3 className="text-sm font-medium text-muted-foreground">{filter === "unread" ? "لا توجد إشعارات غير مقروءة" : "لا توجد إشعارات"}</h3><p className="text-xs text-muted-foreground/70 mt-1">ستظهر هنا عند وصول جديد</p></div> : <><div className="divide-y divide-border">{notifications.map((n) => { const meta = TYPE_META[n.type] || TYPE_META.new_episode; const Icon = meta.icon; return <div key={n.id} onClick={() => void openNotification(n)} className={`tvtime-notification-item p-3 flex items-start gap-3 cursor-pointer hover:bg-accent/50 transition-colors relative group ${!n.read ? "bg-primary/5" : ""}`}>{!n.read && <div className="absolute top-3 right-1 w-2 h-2 rounded-full bg-primary" />}<div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${meta.bg}`}><Icon size={18} className={meta.color} /></div><div className="flex-1 min-w-0 pr-3"><div className="flex items-center gap-1.5 mb-0.5"><span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${meta.bg} ${meta.color}`}>{meta.label}</span><span className="text-[10px] text-muted-foreground">{timeAgo(n.createdAt)}</span></div><h4 className="text-sm font-medium leading-tight" dir="auto">{n.title}</h4><p className="text-xs text-muted-foreground mt-0.5 line-clamp-2" dir="auto">{n.body}</p></div><button type="button" data-ui-action="danger-icon" onClick={(e) => { e.stopPropagation(); void handleDelete(n.id); }} className="tvtime-notification-icon-button w-7 h-7 rounded-md text-muted-foreground hover:bg-rose-500/15 hover:text-rose-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0" aria-label={`حذف إشعار ${n.title}`}><Trash2 size={12} /></button></div>; })}</div>{hasMore && <div className="p-3"><button type="button" onClick={() => void fetchNotifications(filter, true, notifications.length)} disabled={loadingMore} className="w-full h-10 rounded-lg border border-border hover:bg-accent text-sm flex items-center justify-center gap-2 disabled:opacity-60">{loadingMore && <Loader2 size={14} className="animate-spin" />}تحميل المزيد</button></div>}</>}
        </div>
      </div>
    </div>, document.body,
  );
}

function timeAgo(iso: string): string {
  const d = new Date(iso); const diff = Date.now() - d.getTime(); const minutes = Math.floor(diff / 60000); const hours = Math.floor(diff / 3600000); const days = Math.floor(diff / 86400000);
  if (diff < 60000) return "الآن"; if (minutes < 60) return `قبل ${minutes} د`; if (hours < 24) return `قبل ${hours} س`; if (days < 7) return `قبل ${days} يوم`;
  return d.toLocaleDateString("ar-IQ", { day: "numeric", month: "short" });
}
