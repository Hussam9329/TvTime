"use client";

import { useNav } from "@/lib/store";
import { mediaStateKey, useMediaStates, usePersonDetail } from "@/hooks/use-tmdb";
import { img } from "@/lib/tmdb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SafeImage } from "@/components/media/safe-image";
import { WatchedIndicator } from "@/components/media/watched-indicator";
import { TmdbScoreIndicator } from "@/components/media/tmdb-score-indicator";
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
  const newestCreditFirst = (a: any, b: any) => {
    const aDate = a.release_date || a.first_air_date || "";
    const bDate = b.release_date || b.first_air_date || "";

    // ISO dates sort chronologically as strings. Missing dates always belong
    // at the end, while popularity provides a stable order for equal dates.
    if (aDate && bDate && aDate !== bDate) return bDate.localeCompare(aDate);
    if (aDate && !bDate) return -1;
    if (!aDate && bDate) return 1;
    return (b.popularity || 0) - (a.popularity || 0);
  };

  const movieCredits = (p.movie_credits?.cast ?? []).filter((c: any) => c.poster_path).sort(newestCreditFirst);
  const tvCredits = (p.tv_credits?.cast ?? []).filter((c: any) => c.poster_path).sort(newestCreditFirst);
  const knownFor = [...movieCredits, ...tvCredits].sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 10);

  const age = p.birthday ? Math.floor((Date.now() - new Date(p.birthday).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;

  return (
    <div className="tvtime-person-detail-page space-y-6">
      <Button variant="ghost" size="sm" onClick={back} className="text-muted-foreground">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back
      </Button>

      {/* Hero with profile */}
      <div data-ui-surface="hero" className="relative rounded-2xl overflow-hidden border border-border/50 -mt-4">
        <div className="relative bg-gradient-to-br from-primary/20 via-purple-500/10 to-transparent p-6 sm:p-8">
          <div className="absolute inset-0 opacity-30">
            {knownFor[0]?.backdrop_path && (
              <SafeImage src={img(knownFor[0].backdrop_path, "w1280")} alt="" fill variant="backdrop" className="blur-2xl" />
            )}
          </div>
          <div className="relative flex flex-col sm:flex-row gap-6 items-center sm:items-start">
            <div className="tvtime-person-profile relative w-36 aspect-[2/3] sm:w-48 overflow-hidden rounded-[1.2rem] border border-primary/35 bg-muted shadow-2xl flex-shrink-0">
              {p.profile_path ? (
                <SafeImage
                  src={img(p.profile_path, "w500")}
                  alt={p.name}
                  fill
                  variant="profile"
                  sizes="(max-width: 640px) 144px, 192px"
                  className="object-cover object-top"
                  priority
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <Users className="w-12 h-12 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 text-center sm:pt-2 sm:text-left">
              <h1 className="view-page-title text-2xl sm:text-4xl font-extrabold tracking-tight drop-shadow-lg">{p.name}</h1>
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
          <KnownForCards items={knownFor} onGoMovie={goMovie} onGoTv={goTv} />
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

function KnownForCards({ items, onGoMovie, onGoTv }: { items: any[]; onGoMovie: (id: number) => void; onGoTv: (id: number) => void }) {
  const states = useMediaStates(items.map((item) => ({
    tmdbId: Number(item.id),
    mediaType: Boolean(item.title) ? "movie" as const : "tv" as const,
  })));

  return (
    <div className="tvtime-person-credits-grid">
      {items.map((c: any, i: number) => {
        const isMovie = Boolean(c.title);
        const mediaType = isMovie ? "movie" as const : "tv" as const;
        const year = (c.release_date || c.first_air_date || "").slice(0, 4);
        const role = c.character || c.job || "Role not listed";
        const libraryState = states.data?.[mediaStateKey(mediaType, Number(c.id))];
        const completed = isMovie ? Boolean(libraryState?.watched) : libraryState?.status === "finished";
        return (
              <motion.button
                key={`${c.id}-${i}`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
                onClick={() => isMovie ? onGoMovie(c.id) : onGoTv(c.id)}
                className="tvtime-person-credit group min-w-0 text-left"
              >
                <Card className="tvtime-person-credit__card overflow-hidden p-0 border-border/50 transition-[border-color,box-shadow,background-color] duration-200">
                  <div className="tvtime-person-credit__poster relative aspect-[2/3] overflow-hidden bg-muted">
                    <SafeImage src={img(c.poster_path, "w342")} alt={c.title || c.name} fill variant="poster" className="transition-opacity duration-200 group-hover:opacity-95" />
                    {completed && (
                      <WatchedIndicator
                        rating={libraryState?.userRating}
                        status={isMovie ? "watched" : "finished"}
                      />
                    )}
                    {!completed && <TmdbScoreIndicator rating={c.vote_average} />}
                  </div>
                  <div className="tvtime-person-credit__body">
                    <p className="tvtime-person-credit__title line-clamp-2">{c.title || c.name}</p>
                    <div className="tvtime-person-credit__role">
                      <span>Role</span>
                      <p className="line-clamp-2">{role}</p>
                    </div>
                    <div className="tvtime-person-credit__meta">
                      <span>{isMovie ? "Movie" : "TV Show"}</span>
                      {year && <span>{year}</span>}
                    </div>
                  </div>
                </Card>
              </motion.button>
        );
      })}
    </div>
  );
}

function FilmographyList({ items, type, onGo }: { items: any[]; type: "movie" | "tv"; onGo: (id: number) => void }) {
  const visibleItems = items.slice(0, 50);
  const states = useMediaStates(
    visibleItems.map((item) => ({ tmdbId: Number(item.id), mediaType: type })),
  );

  if (items.length === 0) {
    return <p className="text-muted-foreground text-center py-8">No credits available.</p>;
  }
  return (
    <div className="tvtime-person-filmography-grid">
      {visibleItems.map((c, i) => {
        const year = (c.release_date || c.first_air_date || "").slice(0, 4);
        const title = c.title || c.name;
        const libraryState = states.data?.[mediaStateKey(type, Number(c.id))];
        const completed = type === "movie" ? Boolean(libraryState?.watched) : libraryState?.status === "finished";
        return (
          <motion.button
            key={`${c.id}-${i}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i * 0.01, 0.3) }}
            onClick={() => onGo(c.id)}
            className="tvtime-person-credit group min-w-0 text-left"
          >
            <Card className="tvtime-person-credit__card overflow-hidden p-0 transition-[border-color,box-shadow,background-color] duration-200">
              <div className="tvtime-person-credit__poster relative aspect-[2/3] overflow-hidden bg-muted">
                {c.poster_path ? (
                  <SafeImage src={img(c.poster_path, "w342")} alt={title} fill variant="poster" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    {type === "movie" ? <Film className="w-4 h-4" /> : <Tv className="w-4 h-4" />}
                  </div>
                )}
                {completed && (
                  <WatchedIndicator
                    rating={libraryState?.userRating}
                    status={type === "movie" ? "watched" : "finished"}
                  />
                )}
                {!completed && <TmdbScoreIndicator rating={c.vote_average} />}
              </div>
              <div className="tvtime-person-credit__body">
                <p className="tvtime-person-credit__title line-clamp-2">{title}</p>
                <div className="tvtime-person-credit__role">
                  <span>Role</span>
                  <p className="line-clamp-2">{c.character || c.job || "Role not listed"}</p>
                </div>
                <div className="tvtime-person-credit__meta">
                  <span>{type === "movie" ? "Movie" : "TV Show"}</span>
                  {year && <span>{year}</span>}
                </div>
              </div>
            </Card>
          </motion.button>
        );
      })}
      {items.length > 50 && (
        <p className="tvtime-person-filmography-count text-center text-xs text-muted-foreground py-3">Showing 50 of {items.length} credits</p>
      )}
    </div>
  );
}
