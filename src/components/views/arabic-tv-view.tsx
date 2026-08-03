import { TvWorldPageView } from "@/components/views/tv-world-page-view";

export function ArabicTvView() {
  return (
    <TvWorldPageView
      pageClassName="tvtime-arabic-tv-page"
      title="المسلسلات العربية"
      trackingWorld="arabic"
      discoverWorld="arabic-tv"
      discoverTitle="اكتشف مسلسلات عربية"
      discoverSubtitle="ابحث عن إنتاجات عربية جديدة وأضفها إلى مكتبتك"
      releaseOriginalLanguage="ar"
      releaseLanguage="ar"
      releaseAccentClass="text-amber-400"
      releaseTitle="جدول إصدارات المسلسلات العربية"
      releaseSubtitle="جدول لستة أشهر من العروض العربية الجديدة، منفصل عن المسلسلات العالمية والأنمي."
      locale="ar"
    />
  );
}
