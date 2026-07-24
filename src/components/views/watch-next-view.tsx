"use client";

import { useQuery } from "@tanstack/react-query";
import { Play, Clock3, Flame, CheckCircle2, Tv, Sparkles, Languages, CalendarDays } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SafeImage } from "@/components/media/safe-image";
import { useNav } from "@/lib/store";
import { userHeaders, withUserId } from "@/lib/client-user";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type WatchNextItem = { tmdbId: number; title: string; poster: string | null; seasonNumber: number; episodeNumber: number; watchedEpisodes: number; releasedEpisodes: number; lastActivity: string; isAnime: boolean; isArabic: boolean };
type UpcomingItem = { tmdbId: number; title: string; poster: string | null; seasonNumber: number; episodeNumber: number; episodeName: string | null; airDate: string; isAnime: boolean; isArabic: boolean };

export function WatchNextView() {
  const goTv = useNav((state) => state.goTv);
  const query = useQuery({
    queryKey: ["watch-next"],
    queryFn: async () => {
      const response = await fetch(withUserId(new URL("/api/watch-next", window.location.origin)), { headers: userHeaders() });
      if (!response.ok) throw new Error("Failed to build Watch Next");
      return response.json() as Promise<{ items: WatchNextItem[]; upcoming: UpcomingItem[] }>;
    },
    staleTime: 60_000,
  });
  const items = query.data?.items ?? [];
  const upcoming = query.data?.upcoming ?? [];
  const active = items.filter((item) => daysSince(item.lastActivity) < 30);
  const paused = items.filter((item) => daysSince(item.lastActivity) >= 30);

  return <div className="space-y-7">
    <section className="relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/20 via-background to-fuchsia-500/10 p-6 sm:p-9">
      <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative flex items-end justify-between gap-5 flex-wrap">
        <div><Badge className="mb-3 border-0 bg-primary/20 text-primary"><Flame className="mr-1 h-3.5 w-3.5" /> Personal queue</Badge><h1 className="text-3xl sm:text-5xl font-black tracking-tight">Watch Next</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">The exact next released episode for every show you follow—ordered by your latest activity.</p></div>
        <div className="rounded-2xl border border-white/10 bg-background/60 px-5 py-3 backdrop-blur"><p className="text-3xl font-black text-primary">{items.length}</p><p className="text-xs text-muted-foreground">shows ready</p></div>
      </div>
    </section>

    {query.isLoading ? <WatchNextSkeleton /> : query.isError ? <Card className="p-10 text-center text-muted-foreground">Could not load your queue. Your progress is safe.</Card> :
      <Tabs defaultValue="ready" className="space-y-5">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="ready"><Play className="mr-2 h-4 w-4" />Ready to Watch ({items.length})</TabsTrigger>
          <TabsTrigger value="upcoming"><CalendarDays className="mr-2 h-4 w-4" />Upcoming ({upcoming.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="ready" className="space-y-7">
          {items.length === 0 ? <EmptyReady /> : <>
            <WatchSection title="Ready to continue" subtitle="Your active shows" items={active} onOpen={goTv} />
            <WatchSection title="Paused for a while" subtitle="No activity for 30 days or more" items={paused} onOpen={goTv} paused />
          </>}
        </TabsContent>
        <TabsContent value="upcoming">
          {upcoming.length === 0
            ? <Card className="p-12 text-center"><CalendarDays className="mx-auto mb-3 h-12 w-12 text-muted-foreground" /><h2 className="text-xl font-bold">No announced episodes</h2><p className="mt-1 text-sm text-muted-foreground">Upcoming dates for followed shows will appear here.</p></Card>
            : <UpcomingSection items={upcoming} onOpen={goTv} />}
        </TabsContent>
      </Tabs>}
  </div>;
}

function EmptyReady() {
  return <Card className="p-12 text-center"><CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-400" /><h2 className="text-xl font-bold">You’re all caught up</h2><p className="mt-1 text-sm text-muted-foreground">New released episodes will appear here automatically.</p></Card>;
}

function UpcomingSection({ items, onOpen }: { items: UpcomingItem[]; onOpen: (id: number) => void }) {
  return <section className="space-y-3">
    <div><h2 className="text-xl font-extrabold">Upcoming episodes</h2><p className="text-xs text-muted-foreground">The next announced episode for every show you follow</p></div>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map((item) => {
      const remaining = daysUntil(item.airDate);
      const code = `S${String(item.seasonNumber).padStart(2, "0")}E${String(item.episodeNumber).padStart(2, "0")}`;
      return <a key={item.tmdbId} href={`/tv/${item.tmdbId}`} onClick={(event) => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onOpen(item.tmdbId); }} className="group block">
        <Card className="grid grid-cols-[104px_1fr] overflow-hidden p-0 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10">
          <div className="relative aspect-[2/3] bg-muted"><SafeImage src={item.poster} alt={item.title} fill variant="poster" /></div>
          <div className="flex min-w-0 flex-col p-4">
            <Badge variant="secondary" className="w-fit"><CalendarDays className="mr-1 h-3 w-3" />{item.airDate}</Badge>
            <h3 className="mt-2 line-clamp-1 font-bold group-hover:text-primary">{item.title}</h3>
            <p className="mt-1 text-sm font-black text-primary">{code}</p>
            {item.episodeName && <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{item.episodeName}</p>}
            <p className="mt-auto pt-3 text-sm font-bold text-amber-300">{remaining === 1 ? "1 day remaining" : `${remaining} days remaining`}</p>
          </div>
        </Card>
      </a>;
    })}</div>
  </section>;
}

function WatchSection({ title, subtitle, items, onOpen, paused = false }: { title: string; subtitle: string; items: WatchNextItem[]; onOpen: (id: number) => void; paused?: boolean }) {
  if (items.length === 0) return null;
  return <section className="space-y-3"><div className="flex items-end justify-between"><div><h2 className="text-xl font-extrabold">{title}</h2><p className="text-xs text-muted-foreground">{subtitle}</p></div><Badge variant="secondary">{items.length}</Badge></div>
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{items.map((item) => {
      const progress = Math.round((item.watchedEpisodes / Math.max(item.releasedEpisodes, 1)) * 100);
      const href = `/tv/${item.tmdbId}`;
      return <a key={item.tmdbId} href={href} onClick={(event) => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onOpen(item.tmdbId); }} className="group block">
        <Card className="grid grid-cols-[104px_1fr] overflow-hidden p-0 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10">
          <div className="relative aspect-[2/3] bg-muted"><SafeImage src={item.poster} alt={item.title} fill variant="poster" /><span className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" /></div>
          <div className="flex min-w-0 flex-col p-4"><div className="flex items-center gap-1.5"><Badge variant="secondary" className="h-5 text-[9px]">{item.isArabic ? <Languages className="mr-1 h-3 w-3" /> : item.isAnime ? <Sparkles className="mr-1 h-3 w-3" /> : <Tv className="mr-1 h-3 w-3" />}{item.isArabic ? "Arabic TV" : item.isAnime ? "Anime" : "TV"}</Badge>{paused && <Badge className="h-5 border-0 bg-amber-500/15 text-[9px] text-amber-300"><Clock3 className="mr-1 h-3 w-3" />{daysSince(item.lastActivity)}d</Badge>}</div>
            <h3 className="mt-2 line-clamp-2 font-bold group-hover:text-primary">{item.title}</h3><p className="mt-1 text-sm font-black text-primary">S{item.seasonNumber} · E{item.episodeNumber}</p>
            <div className="mt-auto pt-3"><div className="mb-1 flex justify-between text-[10px] text-muted-foreground"><span>{item.watchedEpisodes}/{item.releasedEpisodes} watched</span><span>{progress}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-primary to-fuchsia-500" style={{ width: `${progress}%` }} /></div><span className="mt-2 inline-flex items-center text-xs font-bold text-primary"><Play className="mr-1 h-3 w-3 fill-current" /> Continue</span></div>
          </div>
        </Card>
      </a>;
    })}</div>
  </section>;
}

function daysSince(value: string) { const time = Date.parse(value); return Number.isFinite(time) ? Math.max(0, Math.floor((Date.now() - time) / 86400000)) : 0; }
function daysUntil(value: string) { const time = Date.parse(`${value}T00:00:00Z`); const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`); return Number.isFinite(time) ? Math.max(0, Math.ceil((time - today) / 86400000)) : 0; }
function WatchNextSkeleton() { return <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-40 shimmer rounded-xl" />)}</div>; }
