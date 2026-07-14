/**
 * Arabic UI translations for /arabic/* pages only.
 *
 * This is NOT a full i18n system (next-intl). It's a lightweight translation
 * map used specifically by the Arabic views to show Arabic labels for tabs,
 * buttons, and section headers — without affecting the rest of the app.
 *
 * Usage:
 *   import { t } from "@/lib/arabic-ui";
 *   const label = isArabic ? t("watchlist") : "Watchlist";
 *
 * Or in a component that knows it's Arabic:
 *   const label = t("watchlist"); // always Arabic
 */

const ARABIC_LABELS: Record<string, string> = {
  // Tabs
  watchlist: "قائمة المشاهدة",
  watched: "تمت مشاهدته",
  discover: "استكشاف",
  releases: "الإصدارات",
  tracking: "التتبع",
  schedule: "الجدولة",
  library: "المكتبة",
  all: "الكل",

  // Stats
  notStarted: "لم يبدأ",
  inProgress: "قيد المشاهدة",
  upToDate: "محدّث",
  finished: "مكتمل",
  upcoming: "قادم",
  haventWatched: "لم تتم مشاهدته",
  haventStarted: "لم يبدأ",

  // Actions
  markWatched: "وضع كمشاهد",
  addToWatchlist: "إضافة للقائمة",
  removeFromWatchlist: "إزالة من القائمة",
  rate: "تقييم",
  reRate: "إعادة التقييم",
  removeRating: "إزالة التقييم",
  exploreMore: "استكشاف المزيد",
  retry: "إعادة المحاولة",
  reloadPage: "تحديث الصفحة",
  signOut: "تسجيل الخروج",

  // Search
  searchPlaceholder: "ابحث عن أفلام، مسلسلات، أنمي، عناوين عربية...",
  noResults: "لا توجد نتائج",
  noResultsDesc: "لم نجد نتائج لبحثك. جرب كلمات مختلفة.",
  startTyping: "ابدأ الكتابة للبحث في ملايين العناوين والأشخاص",
  endOfResults: "— نهاية النتائج —",
  loadMore: "تحميل المزيد",

  // Sort
  sortBy: "ترتيب حسب",
  recent: "الأحدث",
  rating: "التقييم",
  az: "أ-ي",
  year: "السنة",

  // Empty states
  watchlistEmpty: "قائمة المشاهدة فارغة",
  watchedEmpty: "لم تتم مشاهدته أي شيء بعد",
  watchlistEmptyDesc: "ابدأ بإضافة أفلام عربية من صفحة الاستكشاف.",
  watchedEmptyDesc: "اضغط زر 'وضع كمشاهد' على أي فيلم لتظهره هنا.",

  // Detail page
  overview: "القصة",
  cast: "الممثلون",
  details: "التفاصيل",
  videos: "الفيديوهات",
  recommendations: "توصيات",
  moreLikeThis: "المزيد مثل هذا",
  synopsis: "الملخص",
  noOverview: "لا يوجد وصف متاح.",
  noCast: "لا توجد معلومات عن الممثلين.",
  trailer: "الإعلان",

  // Badges
  arabicMovie: "فيلم عربي",
  arabicTV: "مسلسل عربي",
  movie: "فيلم",
  tvShow: "مسلسل",

  // Misc
  showing: "عرض",
  of: "من",
  page: "صفحة",
  season: "موسم",
  episode: "حلقة",
  seasons: "مواسم",
  episodes: "حلقات",
  runtime: "المدة",
  releaseDate: "تاريخ الإصدار",
  status: "الحالة",
  language: "اللغة",
  genres: "التصنيفات",
  production: "الإنتاج",
  budget: "الميزانية",
  revenue: "الإيرادات",

  // Profile
  profile: "الملف الشخصي",
  settings: "الإعدادات",
  backup: "النسخ الاحتياطي",
  export: "تصدير",
  import: "استيراد",
  clearAll: "مسح الكل",
  dangerZone: "منطقة الخطر",
  session: "الجلسة",

  // Calendar
  calendarSchedule: "جدول المسلسلات",
  arabicMovieSchedule: "جدول الأفلام العربية",
  followedTitles: "المسلسلات المتابعة",
  noUpcoming: "لا توجد حلقات قادمة",
};

/**
 * Translate a key to Arabic. Falls back to the key itself if not found
 * (makes missing translations visible during development).
 */
export function t(key: keyof typeof ARABIC_LABELS | string): string {
  return ARABIC_LABELS[key] ?? key;
}

/**
 * Check if a view name is an Arabic view.
 */
export function isArabicView(view: string): boolean {
  return view === "arabic-movies" || view === "arabic-tv";
}
