import { TvWorldPageView } from "@/components/views/tv-world-page-view";

export function TVShowsPageView() {
  return (
    <TvWorldPageView
      pageClassName="tvtime-tv-view"
      title="TV Shows"
      trackingWorld="standard"
      discoverWorld="tv"
      releaseExcludedOriginalLanguage="ar"
      releaseCollectionWorld="standard-tv"
      releaseTitle="TV Release Schedule"
      releaseSubtitle="A six-month agenda for new TV show premieres, kept separate from Anime and Arabic TV."
    />
  );
}
