"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { pickGradient } from "@/lib/mock-data";
import type { Notification } from "@/lib/types";
import {
  Bell,
  X,
  CheckCheck,
  Trash2,
  Tv,
  Film,
  AlertTriangle,
  CalendarClock,
  Sparkles,
} from "lucide-react";

const TYPE_META: Record<
  Notification["type"],
  { icon: React.ComponentType<{ size?: number; className?: string }>; color: string; bg: string; label: string }
> = {
  new_episode: { icon: Tv, color: "text-emerald-500", bg: "bg-emerald-500/15", label: "حلقة جديدة" },
  movie_available: { icon: Film, color: "text-blue-500", bg: "bg-blue-500/15", label: "فيلم متوفر" },
  season_return: { icon: CalendarClock, color: "text-purple-500", bg: "bg-purple-500/15", label: "عودة موسم" },
  backlog_alert: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/15", label: "تراكم حلقات" },
};

export function NotificationCenter({ onClose }: { onClose: () => void }) {
  const {
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    clearAllNotifications,
    setView,
  } = useAppStore();

  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");

  const filtered = notifications.filter((n) => {
    if (filter === "unread") return !n.read;
    if (filter === "read") return n.read;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleNotificationClick = (n: Notification) => {
    if (!n.read) markNotificationRead(n.id);
    // Could navigate to media — for now just close
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-start" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md h-full bg-card border-l border-border flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>
            <div>
              <h2 className="font-bold text-base">الإشعارات</h2>
              <p className="text-xs text-muted-foreground">
                {unreadCount > 0 ? `${unreadCount} غير مقروء` : "كل الإشعارات مقروءة"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md hover:bg-accent flex items-center justify-center"
          >
            <X size={16} />
          </button>
        </div>

        {/* Filter tabs */}
        <div className="px-4 py-2 border-b border-border flex items-center gap-1">
          {[
            { key: "all" as const, label: "الكل", count: notifications.length },
            { key: "unread" as const, label: "غير مقروء", count: unreadCount },
            { key: "read" as const, label: "مقروء", count: notifications.length - unreadCount },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5",
                filter === t.key
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent"
              )}
            >
              {t.label}
              <span className="text-[10px] tabular-nums opacity-70">({t.count})</span>
            </button>
          ))}
        </div>

        {/* Actions */}
        {notifications.length > 0 && (
          <div className="px-4 py-2 border-b border-border flex items-center gap-2">
            <button
              onClick={markAllNotificationsRead}
              disabled={unreadCount === 0}
              className="text-xs text-primary hover:underline disabled:text-muted-foreground/50 disabled:no-underline flex items-center gap-1"
            >
              <CheckCheck size={12} /> تعليم الكل كمقروء
            </button>
            <span className="text-muted-foreground/30">•</span>
            <button
              onClick={clearAllNotifications}
              className="text-xs text-rose-500 hover:underline flex items-center gap-1"
            >
              <Trash2 size={12} /> مسح الكل
            </button>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto scroll-thin">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center">
              <Bell className="text-muted-foreground/30 mb-3" size={48} />
              <h3 className="text-sm font-medium text-muted-foreground">
                {filter === "unread" ? "لا توجد إشعارات غير مقروءة" : "لا توجد إشعارات"}
              </h3>
              <p className="text-xs text-muted-foreground/70 mt-1">ستظهر هنا عند وصول جديد</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((n) => {
                const meta = TYPE_META[n.type];
                const Icon = meta.icon;
                const gradient = n.tmdbId ? pickGradient(n.tmdbId) : null;
                return (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={cn(
                      "p-3 flex items-start gap-3 cursor-pointer hover:bg-accent/50 transition-colors relative group",
                      !n.read && "bg-primary/5"
                    )}
                  >
                    {/* Unread indicator */}
                    {!n.read && (
                      <div className="absolute top-3 right-1 w-2 h-2 rounded-full bg-primary" />
                    )}

                    {/* Icon / Poster */}
                    {gradient ? (
                      <div className={cn("w-10 h-14 rounded bg-gradient-to-br shrink-0 flex items-center justify-center", gradient)}>
                        <Icon size={14} className="text-white/80" />
                      </div>
                    ) : (
                      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", meta.bg)}>
                        <Icon size={18} className={meta.color} />
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-3">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", meta.bg, meta.color)}>
                          {meta.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {timeAgo(n.createdAt)}
                        </span>
                      </div>
                      <h4 className="text-sm font-medium leading-tight">{n.title}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                    </div>

                    {/* Delete on hover */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(n.id);
                      }}
                      className="w-7 h-7 rounded-md text-muted-foreground hover:bg-rose-500/15 hover:text-rose-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer — settings link */}
        <div className="p-3 border-t border-border">
          <button
            onClick={() => {
              onClose();
              setView("stats");
            }}
            className="w-full py-2 text-xs text-muted-foreground hover:text-foreground text-center"
          >
            إعدادات الإشعارات في صفحة الإعدادات
          </button>
        </div>
      </div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "الآن";
  if (minutes < 60) return `قبل ${minutes} د`;
  if (hours < 24) return `قبل ${hours} س`;
  if (days < 7) return `قبل ${days} يوم`;
  return d.toLocaleDateString("ar-EG", { day: "numeric", month: "short" });
}
