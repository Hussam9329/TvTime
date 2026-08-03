import { Tv } from "lucide-react";
import { TvWorldPageView } from "@/components/views/tv-world-page-view";

export function TVShowsPageView() {
  return (
    <TvWorldPageView
      pageClassName="tvtime-tv-view"
      icon={Tv}
      iconClassName="text-sky-400"
      heroClassName="border-sky-500/20 from-sky-500/10"
      title="TV Shows"
      description="Continue your shows, discover new series, and follow upcoming television premieres."
      trackingWorld="standard"
      discoverWorld="tv"
      releaseExcludedOriginalLanguage="ar"
      releaseCollectionWorld="standard-tv"
      releaseTitle="TV Release Schedule"
      releaseSubtitle="A six-month agenda for new TV show premieres, kept separate from Anime and Arabic TV."
    />
  );
}
