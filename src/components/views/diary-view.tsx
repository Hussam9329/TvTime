"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  fetchUserPreferences,
  getUserPreferences,
  USER_PREFERENCES_EVENT,
  type UserPreferences,
} from "@/lib/user-preferences";
import { FilterField, FilterGrid, FilterPanel, FilterSection } from "@/components/ui/filter-panel";
import {
  Calendar as CalendarIcon,
  Clock,
  Star,
  Trash2,
  RefreshCw,
  Edit3,
  X,
  Check,
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
  const [timezone, setTimezone] = useState(() => getUserPreferences().timezone);

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

  useEffect(() => {
    let cancelled = false;
    fetchUserPreferences().then((preferences) => {
      if (!cancelled) setTimezone(preferences.timezone);
    }).catch(() => undefined);
    const handlePreferences = (event: Event) => {
      const preferences = (event as CustomEvent<UserPreferences>).detail;
      if (preferences) setTimezone(preferences.timezone);
    };
    window.addEventListener(USER_PREFERENCES_EVENT, handlePreferences);
    return () => {
      cancelled = true;
      window.removeEventListener(USER_PREFERENCES_EVENT, handlePreferences);
    };
  }, []);

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
    const daysWithActivity = new Set(filtered.map((session) => dateKeyInTimezone(session.watchedAt, timezone))).size;
    return { total, totalMinutes, rewatchCount, daysWithActivity };
  }, [filtered, timezone]);

  const grouped = useMemo(() => {
    const map = new Map<string, WatchSession[]>();
    filtered.forEach((s) => {
      let key: string;
      if (groupBy === "date") key = dateKeyInTimezone(s.watchedAt, timezone);
      else if (groupBy === "title") key = s.title;
      else key = TYPE_LABELS[s.mediaType] || s.mediaType;
      const arr = map.get(key) || [];
      arr.push(s);
      map.set(key, arr);
    });
    return Array.from(map.entries());
  }, [filtered, groupBy, timezone]);

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground">جاري تحميل السجل...</div>
    );
  }

  return (
    <div className="tvtime-diary-page space-y-6 p-4 md:p-6">
      <div className="view-page-header">
        <h1 className="view-page-title text-2xl font-bold flex items-center gap-2">
          <CalendarIcon size={24} /> سجل المشاهدة
        </h1>
        <p className="view-page-description text-sm text-muted-foreground mt-1">
          تتبّع كل جلسة مشاهدة — متى شاهدت، ماذا شاهدت، والتقييم وقتها
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="جلسات المشاهدة" value={stats.total.toString()} icon={<CalendarIcon size={18} />} color="bg-amber-500" />
        <SummaryCard label="وقت المشاهدة" value={formatMinutesShort(stats.totalMinutes)} icon={<Clock size={18} />} color="bg-emerald-500" />
        <SummaryCard label="مرات إعادة المشاهدة" value={stats.rewatchCount.toString()} icon={<RefreshCw size={18} />} color="bg-purple-500" />
        <SummaryCard label="أيام نشطة" value={stats.daysWithActivity.toString()} icon={<CalendarIcon size={18} />} color="bg-blue-500" />
      </div>

      <FilterPanel
        title="فلاتر سجل المشاهدة"
        description="ابحث أولاً، ثم حدّد نوع المحتوى ونوع المشاهدة وطريقة التجميع."
        activeLabel="نشطة"
        activeCount={
          Number(searchQuery.trim() !== "") +
          Number(filterType !== "all") +
          Number(filterRewatch !== "all") +
          Number(groupBy !== "date")
        }
      >
        <FilterSection title="البحث">
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث في سجل المشاهدة..."
              className="h-9 w-full rounded-md border border-input bg-background/60 px-3 pr-9 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
        </FilterSection>

        <FilterSection title="التصفية والتجميع" divided>
          <FilterGrid className="lg:grid-cols-3">
            <FilterField label="نوع المحتوى">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="h-9 rounded-md border border-input bg-background/60 px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="all">كل الأنواع</option>
                <option value="movie">أفلام</option>
                <option value="tv">مسلسلات</option>
                <option value="anime">أنمي</option>
                <option value="arabic_movie">أفلام عربية</option>
                <option value="arabic_tv">مسلسلات عربية</option>
              </select>
            </FilterField>

            <FilterField label="نوع المشاهدة">
              <select
                value={filterRewatch}
                onChange={(e) => setFilterRewatch(e.target.value as any)}
                className="h-9 rounded-md border border-input bg-background/60 px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="all">الكل</option>
                <option value="rewatch">إعادة مشاهدة فقط</option>
                <option value="first">مشاهدة أولى فقط</option>
              </select>
            </FilterField>

            <FilterField label="طريقة التجميع">
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as GroupKey)}
                className="h-9 rounded-md border border-input bg-background/60 px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="date">تجميع حسب التاريخ</option>
                <option value="title">تجميع حسب العنوان</option>
                <option value="type">تجميع حسب النوع</option>
              </select>
            </FilterField>
          </FilterGrid>
        </FilterSection>
      </FilterPanel>

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
                  {groupBy === "date" ? formatDateGroup(key, timezone) : key}
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
                    timezone={timezone}
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
  session, onEdit, onDelete, onRewatch, isEditing, tempDate, onTempDateChange, onSaveEdit, onCancelEdit, timezone,
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
  timezone: string;
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
          <button type="button" data-ui-action="success-icon" onClick={onSaveEdit} className="w-7 h-7 rounded-md bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 flex items-center justify-center" title="حفظ" aria-label="حفظ التاريخ">
            <Check size={14} />
          </button>
          <button type="button" data-ui-action="icon" onClick={onCancelEdit} className="w-7 h-7 rounded-md bg-muted hover:bg-accent flex items-center justify-center" title="إلغاء" aria-label="إلغاء التعديل">
            <X size={14} />
          </button>
        </div>
      ) : (
        <>
          <div className="text-left shrink-0">
            <div className="text-xs font-medium">
              {new Intl.DateTimeFormat("ar-EG", { timeZone: timezone, day: "numeric", month: "short" }).format(d)}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {new Intl.DateTimeFormat("ar-EG", { timeZone: timezone, hour: "2-digit", minute: "2-digit" }).format(d)}
            </div>
          </div>
          {session.rating != null && (
            <div className="flex items-center gap-0.5 text-xs shrink-0">
              <Star size={11} className="text-amber-500 fill-amber-500" />
              <span className="font-medium">{session.rating}</span>
            </div>
          )}
          <div className="flex items-center gap-1 shrink-0">
            <button type="button" data-ui-action="icon" onClick={onEdit} className="w-7 h-7 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" title="تعديل التاريخ" aria-label="تعديل التاريخ">
              <Edit3 size={13} />
            </button>
            <button type="button" data-ui-action="accent-icon" onClick={onRewatch} className="w-7 h-7 rounded-md text-purple-500 hover:bg-purple-500/15 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" title="إعادة مشاهدة" aria-label="تسجيل إعادة مشاهدة">
              <RefreshCw size={13} />
            </button>
            <button type="button" data-ui-action="danger-icon" onClick={onDelete} className="w-7 h-7 rounded-md text-rose-500 hover:bg-rose-500/15 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" title="حذف" aria-label="حذف جلسة المشاهدة">
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

function dateKeyInTimezone(value: Date | string, timezone: string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function formatDateGroup(dateStr: string, timezone: string): string {
  const todayKey = dateKeyInTimezone(new Date(), timezone);
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayKey = dateKeyInTimezone(yesterday, timezone);
  if (dateStr === todayKey) return "اليوم";
  if (dateStr === yesterdayKey) return "أمس";
  const date = new Date(`${dateStr}T12:00:00Z`);
  return new Intl.DateTimeFormat("ar-EG", {
    timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(date);
}
