"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useNav } from "@/lib/store";
import {
  Calendar as CalendarIcon,
  Clock,
  Star,
  Trash2,
  RefreshCw,
  Edit3,
  X,
  Check,
  Filter,
  Search,
  Film,
  Tv,
  Sparkles,
  Clapperboard,
} from "lucide-react";

interface WatchSession {
  id: string;
  mediaId: string | null;
  mediaType: string;
  tmdbId: number;
  title: string;
  season: number | null;
  episode: number | null;
  watchedAt: string;
  duration: number | null;
  rewatch: boolean;
  rating: number | null;
  source: string | null;
  notes: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  movie: "فيلم",
  tv: "مسلسل",
  anime: "أنمي",
  arabic_movie: "فيلم عربي",
  arabic_tv: "مسلسل عربي",
  series: "مسلسل",
};

const TYPE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  movie: Film,
  tv: Tv,
  anime: Sparkles,
  arabic_movie: Clapperboard,
  arabic_tv: Tv,
  series: Tv,
};

type GroupKey = "date" | "title" | "type";

export function DiaryView() {
  const [sessions, setSessions] = useState<WatchSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempDate, setTempDate] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterRewatch, setFilterRewatch] = useState<"all" | "rewatch" | "first">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [groupBy, setGroupBy] = useState<GroupKey>("date");

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/diary");
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleDelete = async (id: string) => {
    if (!confirm("هل تريد حذف هذه الجلسة من السجل؟")) return;
    await fetch(`/api/diary?id=${id}`, { method: "DELETE" });
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const handleRewatch = async (s: WatchSession) => {
    const res = await fetch("/api/diary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mediaId: s.mediaId,
        mediaType: s.mediaType,
        tmdbId: s.tmdbId,
        title: s.title,
        season: s.season,
        episode: s.episode,
        duration: s.duration,
        rewatch: true,
        rating: s.rating,
        source: s.source,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setSessions((prev) => [data.session, ...prev]);
    }
  };

  const handleStartEdit = (s: WatchSession) => {
    const d = new Date(s.watchedAt);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setTempDate(local);
    setEditingId(s.id);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !tempDate) return;
    const iso = new Date(tempDate).toISOString();
    await fetch(`/api/diary?id=${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ watchedAt: iso }),
    });
    setSessions((prev) =>
      prev.map((s) => (s.id === editingId ? { ...s, watchedAt: iso } : s))
    );
    setEditingId(null);
    setTempDate("");
  };

  const filtered = useMemo(() => {
    let items = [...sessions];
    if (filterType !== "all") items = items.filter((s) => s.mediaType === filterType);
    if (filterRewatch === "rewatch") items = items.filter((s) => s.rewatch);
    if (filterRewatch === "first") items = items.filter((s) => !s.rewatch);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter((s) => s.title.toLowerCase().includes(q));
    }
    items.sort((a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime());
    return items;
  }, [sessions, filterType, filterRewatch, searchQuery]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const totalMinutes = filtered.reduce((sum, s) => sum + (s.duration || 0), 0);
    const rewatchCount = filtered.filter((s) => s.rewatch).length;
    const daysWithActivity = new Set(filtered.map((s) => s.watchedAt.slice(0, 10))).size;
    return { total, totalMinutes, rewatchCount, daysWithActivity };
  }, [filtered]);

  const grouped = useMemo(() => {
    const map = new Map<string, WatchSession[]>();
    filtered.forEach((s) => {
      let key: string;
      if (groupBy === "date") key = s.watchedAt.slice(0, 10);
      else if (groupBy === "title") key = s.title;
      else key = TYPE_LABELS[s.mediaType] || s.mediaType;
      const arr = map.get(key) || [];
      arr.push(s);
      map.set(key, arr);
    });
    return Array.from(map.entries());
  }, [filtered, groupBy]);

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground">جاري تحميل السجل...</div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarIcon size={24} /> سجل المشاهدة
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          تتبّع كل جلسة مشاهدة — متى شاهدت، ماذا شاهدت، والتقييم وقتها
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="جلسات المشاهدة" value={stats.total.toString()} icon={<CalendarIcon size={18} />} color="bg-amber-500" />
        <SummaryCard label="وقت المشاهدة" value={formatMinutesShort(stats.totalMinutes)} icon={<Clock size={18} />} color="bg-emerald-500" />
        <SummaryCard label="مرات إعادة المشاهدة" value={stats.rewatchCount.toString()} icon={<RefreshCw size={18} />} color="bg-purple-500" />
        <SummaryCard label="أيام نشطة" value={stats.daysWithActivity.toString()} icon={<CalendarIcon size={18} />} color="bg-blue-500" />
      </div>

      <div className="bg-card border border-border rounded-xl p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Search size={16} className="text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث في سجل المشاهدة..."
            className="flex-1 bg-transparent text-sm focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-muted-foreground" />
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="text-xs bg-background border border-border rounded-md px-2 py-1">
            <option value="all">كل الأنواع</option>
            <option value="movie">أفلام</option>
            <option value="tv">مسلسلات</option>
            <option value="anime">أنمي</option>
            <option value="arabic_movie">أفلام عربية</option>
            <option value="arabic_tv">مسلسلات عربية</option>
          </select>
          <select value={filterRewatch} onChange={(e) => setFilterRewatch(e.target.value as any)} className="text-xs bg-background border border-border rounded-md px-2 py-1">
            <option value="all">الكل</option>
            <option value="rewatch">إعادة مشاهدة فقط</option>
            <option value="first">مشاهدة أولى فقط</option>
          </select>
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupKey)} className="text-xs bg-background border border-border rounded-md px-2 py-1">
            <option value="date">تجميع حسب التاريخ</option>
            <option value="title">تجميع حسب العنوان</option>
            <option value="type">تجميع حسب النوع</option>
          </select>
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <CalendarIcon className="text-muted-foreground/40 mx-auto mb-3" size={48} />
          <h3 className="text-base font-medium text-muted-foreground">لا توجد سجلات مشاهدات بعد</h3>
          <p className="text-xs text-muted-foreground/70 mt-1">عندما تشاهد حلقة أو فيلمًا، سيظهر هنا</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([key, items]) => (
            <div key={key} className="space-y-2">
              <div className="flex items-center justify-between sticky top-14 bg-background/80 backdrop-blur-sm py-1 z-10">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  {groupBy === "date" && <CalendarIcon size={14} />}
                  {groupBy === "date" ? formatDateGroup(key) : key}
                  {groupBy === "date" && (
                    <span className="text-xs text-muted-foreground font-normal">({items.length} جلسة)</span>
                  )}
                </h3>
                {groupBy === "date" && (
                  <span className="text-xs text-muted-foreground">
                    {formatMinutesShort(items.reduce((s, i) => s + (i.duration || 0), 0))}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {items.map((s) => (
                  <SessionRow
                    key={s.id}
                    session={s}
                    onEdit={() => handleStartEdit(s)}
                    onDelete={() => handleDelete(s.id)}
                    onRewatch={() => handleRewatch(s)}
                    isEditing={editingId === s.id}
                    tempDate={tempDate}
                    onTempDateChange={setTempDate}
                    onSaveEdit={handleSaveEdit}
                    onCancelEdit={() => setEditingId(null)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SessionRow({
  session, onEdit, onDelete, onRewatch, isEditing, tempDate, onTempDateChange, onSaveEdit, onCancelEdit,
}: {
  session: WatchSession;
  onEdit: () => void;
  onDelete: () => void;
  onRewatch: () => void;
  isEditing: boolean;
  tempDate: string;
  onTempDateChange: (v: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
}) {
  const Icon = TYPE_ICONS[session.mediaType] || Film;
  const d = new Date(session.watchedAt);
  const typeLabel = TYPE_LABELS[session.mediaType] || session.mediaType;

  return (
    <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-3 group">
      <div className="w-10 h-14 rounded bg-muted shrink-0 flex items-center justify-center">
        <Icon size={16} className="text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <h4 className="text-sm font-medium truncate">{session.title}</h4>
          {session.rewatch && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-500 font-medium flex items-center gap-0.5">
              <RefreshCw size={9} /> إعادة
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          <Icon size={11} />
          <span>{typeLabel}</span>
          {session.season && session.episode && <span>• S{session.season}E{session.episode}</span>}
          {session.source && <span>• {session.source}</span>}
        </div>
      </div>
      {isEditing ? (
        <div className="flex items-center gap-1">
          <input
            type="datetime-local"
            value={tempDate}
            onChange={(e) => onTempDateChange(e.target.value)}
            className="text-xs bg-background border border-border rounded-md px-2 py-1"
          />
          <button onClick={onSaveEdit} className="w-7 h-7 rounded-md bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 flex items-center justify-center" title="حفظ">
            <Check size={14} />
          </button>
          <button onClick={onCancelEdit} className="w-7 h-7 rounded-md bg-muted hover:bg-accent flex items-center justify-center" title="إلغاء">
            <X size={14} />
          </button>
        </div>
      ) : (
        <>
          <div className="text-left shrink-0">
            <div className="text-xs font-medium">
              {d.toLocaleDateString("ar-EG", { day: "numeric", month: "short" })}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
          {session.rating != null && (
            <div className="flex items-center gap-0.5 text-xs shrink-0">
              <Star size={11} className="text-amber-500 fill-amber-500" />
              <span className="font-medium">{session.rating}</span>
            </div>
          )}
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onEdit} className="w-7 h-7 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" title="تعديل التاريخ">
              <Edit3 size={13} />
            </button>
            <button onClick={onRewatch} className="w-7 h-7 rounded-md text-purple-500 hover:bg-purple-500/15 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" title="إعادة مشاهدة">
              <RefreshCw size={13} />
            </button>
            <button onClick={onDelete} className="w-7 h-7 rounded-md text-rose-500 hover:bg-rose-500/15 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" title="حذف">
              <Trash2 size={13} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white mb-2 ${color}`}>
        {icon}
      </div>
      <div className="text-xl font-bold tabular-nums leading-tight">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function formatMinutesShort(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} د`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)} س`;
  const days = hours / 24;
  return `${days.toFixed(1)} ي`;
}

function formatDateGroup(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "اليوم";
  if (d.toDateString() === yesterday.toDateString()) return "أمس";
  return d.toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
