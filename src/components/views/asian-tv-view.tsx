import { TvWorldPageView } from "@/components/views/tv-world-page-view";

export function AsianTvView() {
  return (
    <TvWorldPageView
      pageClassName="tvtime-asian-tv-page"
      title="Asian TV Shows"
      trackingWorld="asian"
      discoverWorld="asian-tv"
      releaseCollectionWorld="asian-tv"
      releaseAccentClass="text-teal-300"
      releaseTitle="Asian TV Release Schedule"
      releaseSubtitle="Upcoming Asian series, ordered with Korea, Japan and China first."
    />
  );
}
