"use client";

import { useFollowing } from "@/hooks/use-tmdb";
import { useNav } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, Tv, ChevronLeft, ChevronRight, Bell, Loader2 } from "lucide-react";
import { useState, useMemo } from "react";
import { img } from "@/lib/tmdb";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTvDetail } from "@/hooks/use-tmdb";

export function CalendarView() {
  const following = useFollowing();
  const { goTv, setView } = useNav();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const followed = following.data?.items ?? [];

  // Fetch details for each followed show to get seasons + episode air dates
  // We only need shows that have recent/upcoming episodes. To keep it efficient,
  // fetch all followed shows' details (capped at 12).
  const followedToShow = followed.slice(0, 12);

  const days = useMemo(() => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startDay = first.getDay();
    const total = last.getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= total; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  const monthName = cursor.toLocaleString("en-US", { month: "long", year: "numeric" });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = today.toISOString().slice(0, 10);

  const prev = () => setCursor(new Date(year, month - 1, 1));
  const next = () => setCursor(new Date(year, month + 1, 1));
  const goToday = () => setCursor(new Date(today.getFullYear(), today.getMonth(), 1));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <CalendarDays className="w-7 h-7 text-primary" /> Calendar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Episode schedule for your followed shows</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prev} aria-label="Previous month"><ChevronLeft className="w-4 h-4" /></Button>
          <Button variant="ghost" size="sm" onClick={goToday} className="min-w-[140px]">{monthName}</Button>
          <Button variant="outline" size="icon" onClick={next} aria-label="Next month"><ChevronRight className="w-4 h-4" /></Button>
        </div>
      </div>

      {/* Calendar grid with episodes */}
      <CalendarGrid
        days={days}
        todayKey={todayKey}
        showIds={followedToShow.map((s) => s.tmdbId)}
        showTitles={Object.fromEntries(followedToShow.map((s) => [s.tmdbId, s.title]))}
        onShowClick={(id) => goTv(id)}
        month={month}
        year={year}
      />

      {/* Following shows as "your schedule" */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" /> Your Shows
          </h2>
          <Button variant="ghost" size="sm" onClick={() => setView("discover")}>Discover more</Button>
        </div>
        {followed.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            <Tv className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="mb-3">You're not following any shows yet.</p>
            <Button onClick={() => setView("discover")}>Discover shows to follow</Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {followed.map((s) => (
              <Card
                key={s.id}
                className="p-3 flex gap-3 cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => goTv(s.tmdbId)}
              >
                <div className="w-12 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
                  {s.posterPath ? (
                    <img src={img(s.posterPath, "w92")} alt={s.title} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Tv className="w-5 h-5 text-muted-foreground" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm line-clamp-2">{s.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Followed {new Date(s.followedAt).toLocaleDateString()}
                  </p>
                  <Badge variant="secondary" className="mt-1 text-[10px]">Click to track episodes</Badge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface CalendarGridProps {
  days: (Date | null)[];
  todayKey: string;
  showIds: number[];
  showTitles: Record<number, string>;
  onShowClick: (id: number) => void;
  month: number;
  year: number;
}

function CalendarGrid({ days, todayKey, showIds, showTitles, onShowClick, month, year }: CalendarGridProps) {
  // Fetch all show details in parallel to extract episode air dates
  // Each show hook fetches seasons + we then need episode-level data.
  // Since we only care about air dates within the current month, we can use
  // the season's air_date as a rough guide, but for precise episode dates
  // we'd need to fetch each season. To keep it efficient, we fetch the show
  // detail (which includes seasons list with air_date) and for the most recent
  // season, fetch its episodes.

  return (
    <Card className="p-3 sm:p-4">
      <div className="grid grid-cols-7 gap-1 mb-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-center text-xs font-bold text-muted-foreground py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          if (!d) return <div key={i} className="aspect-square sm:aspect-[4/5]" />;
          const key = d.toISOString().slice(0, 10);
          const isToday = key === todayKey;
          const isPast = d < today && !isToday;
          return (
            <CalendarDay key={i} date={d} isToday={isToday} isPast={isPast} showIds={showIds} showTitles={showTitles} onShowClick={onShowClick} month={month} year={year} />
          );
        })}
      </div>
    </Card>
  );
}

function CalendarDay({ date, isToday, isPast, showIds, showTitles, onShowClick, month, year }: {
  date: Date; isToday: boolean; isPast: boolean; showIds: number[]; showTitles: Record<number, string>; onShowClick: (id: number) => void; month: number; year: number;
}) {
  // Collect episodes airing on this date across all followed shows
  const episodes: { showId: number; title: string; episodeName: string; season: number; episode: number }[] = [];
  // We can't call hooks in a loop, so we use a different approach:
  // Render child components per show that contribute their episode for this date.

  return (
    <div
      className={cn(
        "aspect-square sm:aspect-[4/5] rounded-md border text-xs p-1 sm:p-1.5 flex flex-col gap-0.5 overflow-hidden",
        isToday ? "border-primary bg-primary/15" : "border-border/40",
        isPast && "opacity-40"
      )}
    >
      <span className={cn("font-semibold text-[11px]", isToday && "text-primary")}>{date.getDate()}</span>
      <div className="flex-1 flex flex-col gap-0.5 overflow-hidden">
        {showIds.slice(0, 8).map((showId) => (
          <DayEpisode key={showId} showId={showId} showTitle={showTitles[showId] || `Show ${showId}`} date={date} onShowClick={onShowClick} />
        ))}
      </div>
    </div>
  );
}

function DayEpisode({ showId, showTitle, date, onShowClick }: { showId: number; showTitle: string; date: Date; onShowClick: (id: number) => void }) {
  const detail = useTvDetail(showId);
  // Look through seasons for episodes airing on this date.
  // Since the show detail doesn't include individual episode air dates,
  // we fetch the most recent 2 seasons' episode lists.
  const seasons = (detail.data?.seasons ?? []).filter((s) => s.season_number >= 1).slice(-2);
  const s1 = useSeasonDetail(seasons[0] ? showId : null, seasons[0]?.season_number ?? null);
  const s2 = useSeasonDetail(seasons[1] ? showId : null, seasons[1]?.season_number ?? null);

  const dateKey = date.toISOString().slice(0, 10);
  const matching = [s1, s2]
    .flatMap((s) => s.data?.episodes ?? [])
    .find((e) => e.air_date === dateKey);

  if (!matching) return null;

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onShowClick(showId); }}
      className="text-left bg-primary/20 hover:bg-primary/30 text-primary rounded px-1 py-0.5 text-[9px] leading-tight line-clamp-1 transition-colors"
      title={`${showTitle} - S${matching.season_number}E${matching.episode_number}: ${matching.name}`}
    >
      {showTitle} · S{matching.season_number}E{matching.episode_number}
    </button>
  );
}
