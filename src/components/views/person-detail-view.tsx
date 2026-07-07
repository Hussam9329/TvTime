"use client";

import { useNav } from "@/lib/store";
import { usePersonDetail } from "@/hooks/use-tmdb";
import { img, imgOrPlaceholder } from "@/lib/tmdb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Film, Tv, Cake, MapPin, Briefcase, Star, Users } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

export function PersonDetailView() {
  const { personId, back } = useNav();
  const detail = usePersonDetail(personId);
  const [activeTab, setActiveTab] = useState("movies");
  const goMovie = useNav((s) => s.goMovie);
  const goTv = useNav((s) => s.goTv);

  if (detail.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-48 shimmer rounded-2xl" />
        <div className="flex gap-4">
          <div className="w-32 h-48 shimmer rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-8 shimmer rounded w-3/4" />
            <div className="h-4 shimmer rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (detail.isError || !detail.data) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>Failed to load person.</p>
        <Button variant="outline" className="mt-4" onClick={back}>Go back</Button>
      </div>
    );
  }

  const p = detail.data;
  const movieCredits = (p.movie_credits?.cast ?? []).filter((c: any) => c.poster_path).sort((a: any, b: any) => (b.vote_average || 0) - (a.vote_average || 0));
  const tvCredits = (p.tv_credits?.cast ?? []).filter((c: any) => c.poster_path).sort((a: any, b: any) => (b.vote_average || 0) - (a.vote_average || 0));
  const knownFor = [...movieCredits, ...tvCredits].sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 10);

  const age = p.birthday ? Math.floor((Date.now() - new Date(p.birthday).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={back} className="text-muted-foreground">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back
      </Button>

      {/* Hero with profile */}
      <div className="relative rounded-2xl overflow-hidden border border-border/50 -mt-4">
        <div className="relative bg-gradient-to-br from-primary/20 via-purple-500/10 to-transparent p-6 sm:p-8">
          <div className="absolute inset-0 opacity-30">
            {knownFor[0]?.backdrop_path && (
              <img src={img(knownFor[0].backdrop_path, "original")} alt="" className="w-full h-full object-cover blur-2xl" />
            )}
          </div>
          <div className="relative flex flex-col sm:flex-row gap-5 items-center sm:items-start">
            <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden border-4 border-background shadow-2xl flex-shrink-0">
              {p.profile_path ? (
                <img src={img(p.profile_path, "w300")} alt={p.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <Users className="w-12 h-12 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight drop-shadow-lg">{p.name}</h1>
              {p.known_for_department && (
                <Badge variant="secondary" className="mt-2 bg-primary/20 text-primary border-0">
                  <Briefcase className="w-3 h-3 mr-1" /> {p.known_for_department}
                </Badge>
              )}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-3 text-sm text-muted-foreground">
                {p.birthday && (
                  <span className="flex items-center gap-1.5">
                    <Cake className="w-4 h-4 text-primary" />
                    {new Date(p.birthday).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                    {age != null && <span className="text-xs">({age} years)</span>}
                  </span>
                )}
                {p.place_of_birth && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-primary" />
                    {p.place_of_birth}
                  </span>
                )}
              </div>
              {p.biography && (
                <p className="text-sm text-foreground/80 leading-relaxed mt-3 line-clamp-4 max-w-2xl">{p.biography}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <p className="text-2xl font-extrabold text-primary">{movieCredits.length}</p>
          <p className="text-xs text-muted-foreground">Movie credits</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-extrabold text-primary">{tvCredits.length}</p>
          <p className="text-xs text-muted-foreground">TV credits</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-extrabold text-primary">{p.popularity ? Math.round(p.popularity) : "—"}</p>
          <p className="text-xs text-muted-foreground">Popularity</p>
        </Card>
      </div>

      {/* Known For */}
      {knownFor.length > 0 && (
        <section>
          <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
            <Star className="w-5 h-5 text-primary fill-primary" /> Known For
          </h3>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
            {knownFor.map((c: any, i: number) => (
              <motion.button
                key={`${c.id}-${i}`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
                onClick={() => c.title ? goMovie(c.id) : goTv(c.id)}
                className="flex-shrink-0 w-[120px] sm:w-[140px] group text-left"
              >
                <Card className="overflow-hidden p-0 border-border/50 hover:border-primary/60 transition-all hover:-translate-y-1">
                  <div className="aspect-[2/3] overflow-hidden bg-muted">
                    <img src={img(c.poster_path, "w342")} alt={c.title || c.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-semibold line-clamp-1">{c.title || c.name}</p>
                    <p className="text-[10px] text-muted-foreground line-clamp-1">{c.character || c.job}</p>
                  </div>
                </Card>
              </motion.button>
            ))}
          </div>
        </section>
      )}

      {/* Full filmography */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start overflow-x-auto no-scrollbar">
          <TabsTrigger value="movies"><Film className="w-4 h-4 mr-1.5" />Movies ({movieCredits.length})</TabsTrigger>
          <TabsTrigger value="tv"><Tv className="w-4 h-4 mr-1.5" />TV Shows ({tvCredits.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="movies" className="mt-4">
          <FilmographyList items={movieCredits} type="movie" onGo={(id) => goMovie(id)} />
        </TabsContent>

        <TabsContent value="tv" className="mt-4">
          <FilmographyList items={tvCredits} type="tv" onGo={(id) => goTv(id)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FilmographyList({ items, type, onGo }: { items: any[]; type: "movie" | "tv"; onGo: (id: number) => void }) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-center py-8">No credits available.</p>;
  }
  return (
    <div className="space-y-2">
      {items.slice(0, 50).map((c, i) => {
        const year = (c.release_date || c.first_air_date || "").slice(0, 4);
        const title = c.title || c.name;
        return (
          <motion.button
            key={`${c.id}-${i}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i * 0.01, 0.3) }}
            onClick={() => onGo(c.id)}
            className="w-full text-left"
          >
            <Card className="p-2.5 flex items-center gap-3 hover:border-primary/40 transition-colors group">
              <div className="w-10 h-14 rounded-md overflow-hidden bg-muted flex-shrink-0">
                {c.poster_path ? (
                  <img src={img(c.poster_path, "w92")} alt={title} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    {type === "movie" ? <Film className="w-4 h-4" /> : <Tv className="w-4 h-4" />}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm line-clamp-1 group-hover:text-primary transition-colors">{title}</p>
                {c.character && <p className="text-xs text-muted-foreground line-clamp-1">as {c.character}</p>}
              </div>
              <div className="text-right flex-shrink-0">
                {year && <p className="text-xs text-muted-foreground">{year}</p>}
                {c.vote_average > 0 && (
                  <p className="text-xs text-amber-400 flex items-center gap-0.5 justify-end">
                    <Star className="w-3 h-3 fill-amber-400" /> {c.vote_average.toFixed(1)}
                  </p>
                )}
              </div>
            </Card>
          </motion.button>
        );
      })}
      {items.length > 50 && (
        <p className="text-center text-xs text-muted-foreground py-3">Showing 50 of {items.length} credits</p>
      )}
    </div>
  );
}
