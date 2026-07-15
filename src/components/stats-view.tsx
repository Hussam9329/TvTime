"use client";

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { watchSessions } from "@/lib/mock-data";
import { computeStats, formatWatchTime, formatMinutes } from "@/lib/stats";
import { cn } from "@/lib/utils";
import { pickGradient } from "@/lib/mock-data";
import { SectionHeader } from "./shared";
import {
  TrendingUp,
  Flame,
  Clock,
  Star,
  Calendar,
  Globe,
  Tv,
  Film,
  Sparkles,
  Heart,
  RefreshCw,
  BarChart3,
  Award,
  AlertTriangle,
  Activity,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

const PIE_COLORS = ["#f59e0b", "#10b981", "#3b82f6", "#ec4899", "#8b5cf6", "#ef4444", "#14b8a6", "#f97316"];

export function StatsView() {
  const { media } = useAppStore();

  // Combine store media with watch sessions for stats
  const stats = useMemo(() => computeStats(media, watchSessions), [media]);

  // Watch time formatting
  const watchTimeFormatted = formatWatchTime(stats.totalWatchTimeMinutes);

  // Year over year chart data
  const yearOverYearData = stats.yearOverYear.map((y) => ({
    year: y.year.toString(),
    أفلام: y.movies,
    حلقات: y.episodes,
    ساعات: Math.round(y.minutes / 60),
  }));

  return (
    <div className="space-y-8 pb-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 size={24} /> إحصائياتي
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          تحليل شخصي عميق لعاداتك في المشاهدة
        </p>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<Clock size={20} />}
          label="وقت المشاهدة"
          value={watchTimeFormatted}
          color="bg-amber-500"
        />
        <KpiCard
          icon={<Film size={20} />}
          label="أفلام شوهدت"
          value={stats.totalMovies.toString()}
          color="bg-emerald-500"
        />
        <KpiCard
          icon={<Tv size={20} />}
          label="حلقات شوهدت"
          value={stats.totalEpisodes.toString()}
          color="bg-blue-500"
        />
        <KpiCard
          icon={<Star size={20} />}
          label="متوسط تقييمك"
          value={`${stats.averageRating.toFixed(0)}/100`}
          color="bg-rose-500"
        />
      </div>

      {/* Streaks & engagement */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<Flame size={20} />}
          label="السلسلة الحالية"
          value={`${stats.currentStreak} يوم`}
          color="bg-orange-500"
        />
        <KpiCard
          icon={<Award size={20} />}
          label="أطول سلسلة"
          value={`${stats.longestStreak} يوم`}
          color="bg-purple-500"
        />
        <KpiCard
          icon={<RefreshCw size={20} />}
          label="مرات إعادة المشاهدة"
          value={stats.rewatchCount.toString()}
          color="bg-cyan-500"
        />
        <KpiCard
          icon={<Activity size={20} />}
          label="معدل الإكمال"
          value={`${Math.round(stats.completionRate * 100)}%`}
          color="bg-green-600"
        />
      </div>

      {/* Personal insights — most watched */}
      <section>
        <SectionHeader title="رؤى شخصية" subtitle="ما الذي يميّز عاداتك؟" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.mostWatchedGenre && (
            <InsightCard
              icon={<Sparkles size={18} />}
              label="النوع المفضل"
              value={stats.mostWatchedGenre.genre}
              hint={`${stats.mostWatchedGenre.count} مشاهدة`}
              color="from-purple-500 to-pink-500"
            />
          )}
          {stats.mostUsedPlatform && (
            <InsightCard
              icon={<Tv size={18} />}
              label="المنصة الأكثر استخدامًا"
              value={stats.mostUsedPlatform.platform}
              hint={formatMinutes(stats.mostUsedPlatform.minutes)}
              color="from-emerald-500 to-teal-500"
            />
          )}
          {stats.mostWatchedCountry && (
            <InsightCard
              icon={<Globe size={18} />}
              label="الدولة الأكثر مشاهدة"
              value={stats.mostWatchedCountry.country}
              hint={`${stats.mostWatchedCountry.count} عمل`}
              color="from-amber-500 to-orange-500"
            />
          )}
          {stats.mostWatchedLanguage && (
            <InsightCard
              icon={<Globe size={18} />}
              label="اللغة الأكثر مشاهدة"
              value={stats.mostWatchedLanguage.language === "ar" ? "العربية" : stats.mostWatchedLanguage.language === "ja" ? "اليابانية" : stats.mostWatchedLanguage.language === "en" ? "الإنجليزية" : stats.mostWatchedLanguage.language}
              hint={`${stats.mostWatchedLanguage.count} مشاهدة`}
              color="from-rose-500 to-red-500"
            />
          )}
        </div>
      </section>

      {/* Weekday activity */}
      <section>
        <SectionHeader title="نشاطك خلال الأسبوع" subtitle="متى تشاهد أكثر؟" />
        <div className="bg-card border border-border rounded-xl p-4">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.weekdayActivity}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v) => `${Math.round(v / 60)}س`} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(v: any) => [`${Math.round(v as number)} دقيقة`, "وقت المشاهدة"]}
              />
              <Bar dataKey="minutes" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Hourly activity */}
      <section>
        <SectionHeader title="ساعات المشاهدة المفضلة" subtitle="في أي ساعات من اليوم تشاهد؟" />
        <div className="bg-card border border-border rounded-xl p-4">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={stats.hourlyActivity}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="hour"
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickFormatter={(h) => `${h}:00`}
              />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v) => `${Math.round(v / 60)}س`} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(v: any) => [`${Math.round(v as number)} دقيقة`, "وقت المشاهدة"]}
                labelFormatter={(h) => `الساعة ${h}:00`}
              />
              <Line
                type="monotone"
                dataKey="minutes"
                stroke="var(--primary)"
                strokeWidth={2}
                dot={false}
                fill="var(--primary)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Monthly activity */}
      <section>
        <SectionHeader title="النشاط الشهري" subtitle="كيف توزّعت مشاهداتك خلال السنة؟" />
        <div className="bg-card border border-border rounded-xl p-4">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.monthlyActivity}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v) => `${Math.round(v / 60)}س`} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(v: any) => [`${Math.round(v as number)} دقيقة`, "وقت المشاهدة"]}
              />
              <Bar dataKey="minutes" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Two-column section: Rating distribution + Genre breakdown */}
      <div className="grid md:grid-cols-2 gap-6">
        <section>
          <SectionHeader title="توزيع تقييماتك" />
          <div className="bg-card border border-border rounded-xl p-4">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.ratingDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="rating" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(v: any) => [`${v} عمل`, "العدد"]}
                  labelFormatter={(r) => `التقييم ${r * 10}-${(Number(r) + 1) * 10}`}
                />
                <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section>
          <SectionHeader title="توزيع الأنواع" />
          <div className="bg-card border border-border rounded-xl p-4">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={stats.genreBreakdown}
                  dataKey="count"
                  nameKey="genre"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={40}
                  label={(e: any) => e.genre}
                  labelLine={false}
                >
                  {stats.genreBreakdown.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Year over year */}
      <section>
        <SectionHeader title="مقارنة سنوية" subtitle="كيف تطوّرت عاداتك؟" />
        <div className="bg-card border border-border rounded-xl p-4">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={yearOverYearData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="year" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="أفلام" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="حلقات" fill="#ec4899" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Watchlist burden */}
      <section>
        <SectionHeader title="عبء قائمة المشاهدة" subtitle="كم من الوقت تحتاج لإنهاء ما لديك؟" />
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-3xl font-bold text-primary tabular-nums">
                {stats.watchlistBurden.totalItems}
              </div>
              <div className="text-xs text-muted-foreground mt-1">عنصر بانتظارك</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-amber-500 tabular-nums">
                {Math.round(stats.watchlistBurden.estimatedMinutes / 60)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">ساعة متبقية</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-rose-500 tabular-nums">
                {stats.watchlistBurden.monthsToFinish}
              </div>
              <div className="text-xs text-muted-foreground mt-1">أشهر بإيقاعك الحالي</div>
            </div>
          </div>
        </div>
      </section>

      {/* Top shows */}
      <section>
        <SectionHeader title="أكثر المسلسلات مشاهدة" />
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          {stats.topShows.map((show, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-6 text-center font-bold text-muted-foreground tabular-nums">
                {i + 1}
              </div>
              <div className={cn("w-8 h-10 rounded bg-gradient-to-br shrink-0", pickGradient(i))} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{show.title}</div>
                <div className="text-xs text-muted-foreground">{show.episodesWatched} حلقة</div>
              </div>
              <div className="text-sm font-bold text-primary tabular-nums">
                {show.episodesWatched}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Per-world summary */}
      <section>
        <SectionHeader title="توزيع مكتبتك" subtitle="حسب نوع المحتوى" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <WorldStat icon={<Film size={18} />} label="أفلام" count={stats.totalMovies} color="bg-red-500" />
          <WorldStat icon={<Tv size={18} />} label="مسلسلات" count={stats.totalShows} color="bg-purple-500" />
          <WorldStat icon={<Sparkles size={18} />} label="أنمي" count={stats.totalAnime} color="bg-pink-500" />
          <WorldStat icon={<Tv size={18} />} label="مسلسلات عربية" count={stats.totalArabicTV} color="bg-emerald-500" />
          <WorldStat icon={<Film size={18} />} label="أفلام عربية" count={stats.totalArabicMovies} color="bg-amber-500" />
        </div>
      </section>

      {/* Abandoned rate alert */}
      {stats.abandonedRate > 0.15 && (
        <section className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={20} />
          <div>
            <h4 className="text-sm font-medium text-amber-500">معدل التخلّي مرتفع</h4>
            <p className="text-xs text-muted-foreground mt-1">
              تخليت عن {Math.round(stats.abandonedRate * 100)}% من أعمالك. ربما تستحق المراجعة قبل بدء أعمال جديدة.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center text-white mb-2", color)}>
        {icon}
      </div>
      <div className="text-xl font-bold tabular-nums leading-tight">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function InsightCard({
  icon,
  label,
  value,
  hint,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  color: string;
}) {
  return (
    <div className={cn("relative rounded-xl p-4 bg-gradient-to-br text-white overflow-hidden", color)}>
      <div className="absolute top-2 left-2 opacity-40">{icon}</div>
      <div className="relative">
        <div className="text-xs opacity-90">{label}</div>
        <div className="text-lg font-bold mt-1 truncate">{value}</div>
        {hint && <div className="text-xs opacity-80 mt-0.5">{hint}</div>}
      </div>
    </div>
  );
}

function WorldStat({
  icon,
  label,
  count,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-3 text-center">
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center text-white mx-auto mb-2", color)}>
        {icon}
      </div>
      <div className="text-2xl font-bold tabular-nums">{count}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
