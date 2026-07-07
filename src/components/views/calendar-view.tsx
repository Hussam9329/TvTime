"use client";

import { useFollowing } from "@/hooks/use-tmdb";
import { useNav } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, Tv, ChevronLeft, ChevronRight, Bell } from "lucide-react";
import { useState, useMemo } from "react";
import { img } from "@/lib/tmdb";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function CalendarView() {
  const following = useFollowing();
  const { goTv, setView } = useNav();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const days = useMemo(() => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startDay = first.getDay(); // 0 sun
    const total = last.getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= total; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  const monthName = cursor.toLocaleString("en-US", { month: "long", year: "numeric" });
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);

  // Following shows — for a real calendar we'd query TMDB for each show's episode schedule.
  // Since the user follows shows, we fetch the "on the air" + their followed shows' details.
  // For simplicity & avoiding N+1 calls, show a "coming up" list based on followed shows
  // plus a calendar highlighting today and a list of followed shows.
  const followed = following.data?.items ?? [];

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
          <p className="text-sm text-muted-foreground mt-1">Track your followed shows</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prev} aria-label="Previous month"><ChevronLeft className="w-4 h-4" /></Button>
          <Button variant="ghost" size="sm" onClick={goToday} className="min-w-[140px]">{monthName}</Button>
          <Button variant="outline" size="icon" onClick={next} aria-label="Next month"><ChevronRight className="w-4 h-4" /></Button>
        </div>
      </div>

      {/* Calendar grid */}
      <Card className="p-3 sm:p-4">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="text-center text-xs font-bold text-muted-foreground py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d, i) => {
            if (!d) return <div key={i} />;
            const key = d.toISOString().slice(0, 10);
            const isToday = key === todayKey;
            const isPast = d < today && !isToday;
            return (
              <div
                key={i}
                className={cn(
                  "aspect-square sm:aspect-[4/3] rounded-md border text-xs p-1 sm:p-2 flex flex-col",
                  isToday ? "border-primary bg-primary/15" : "border-border/40",
                  isPast && "opacity-50"
                )}
              >
                <span className={cn("font-semibold", isToday && "text-primary")}>{d.getDate()}</span>
              </div>
            );
          })}
        </div>
      </Card>

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
