import { Globe2 } from "lucide-react";
import { TvWorldPageView } from "@/components/views/tv-world-page-view";

export function AsianTvView() {
  return (
    <TvWorldPageView
      pageClassName="tvtime-asian-tv-page"
      icon={Globe2}
      iconClassName="text-teal-300"
      heroClassName="border-teal-400/20 from-teal-500/15"
      title="Asian TV Shows"
      description="Continue your Asian series, discover new shows, and follow upcoming television premieres."
      trackingWorld="asian"
      discoverWorld="asian-tv"
      releaseCollectionWorld="asian-tv"
      releaseAccentClass="text-teal-300"
      releaseTitle="Asian TV Release Schedule"
      releaseSubtitle="Upcoming Asian series, ordered with Korea, Japan and China first."
    />
  );
}
