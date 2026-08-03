import { Languages } from "lucide-react";
import { TvWorldPageView } from "@/components/views/tv-world-page-view";

export function ArabicTvView() {
  return (
    <TvWorldPageView
      pageClassName="tvtime-arabic-tv-page"
      icon={Languages}
      iconClassName="text-amber-300"
      heroClassName="border-amber-500/20 from-amber-500/15"
      title="المسلسلات العربية"
      description="تتبّع مسلسلاتك، واكتشف إنتاجات عربية جديدة، وتابع مواعيد الإصدارات القادمة."
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
