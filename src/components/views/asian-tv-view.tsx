import { TvWorldPageView } from "@/components/views/tv-world-page-view";

export function AsianTvView() {
  return (
    <TvWorldPageView
      pageClassName="tvtime-asian-tv-page"
      title="Asian TV Shows"
      trackingWorld="asian"
      discoverWorld="asian-tv"
      releaseCollectionWorld="asian-tv"
      releaseAccentClass="text-chart-3"
      releaseTitle="Asian TV Release Schedule"
      releaseSubtitle="A six-month agenda of upcoming Asian TV, with Korea, Japan and China first."
    />
  );
}
