# 🔍 تقرير تدقيق تجربة المستخدم — TvTime
**التاريخ:** 2026-09-05 · **النسخة المدققة:** commit `f388fc6` · **المنهجية:** تدقيق كود (واجهة + APIs + قاعدة بيانات) مع فحص فعلي لقاعدة Neon

> هذا التقرير يغطي **المشاكل المتبقية بعد إصلاحات المراحل 1–3** (تناقض الإحصائيات، جلسات الإعادة، robots، الكود الميت — المنجزة سابقاً). كل مشكلة مرفقة بكود التصليح الجاهز للتطبيق.

---

## ⚡ الملخص التنفيذي — أسوأ 10 مغثات للمستخدم

| # | المشكلة | الأثر المباشر |
|---|---------|----------------|
| 1 | Home بلا واجهة خطأ إطلاقاً | فشل TMDB = صفحة رئيسية "فاضية" توهم أنه ماكو محتوى |
| 2 | useStats يبتلع الأخطاء + Stats ترجع صفحة بيضاء | المستخدم يفتح الإحصائيات ويشوف لا شي، بدون سبب ولا زر إعادة |
| 3 | إجراءات المكتبة (سحب/قائمة) تفشل بصمت | تسحب "شاهدته" بالموبايل ويصير... لا شيء، بدون أي رسالة |
| 4 | فشل تحميل الحلقات المشاهدة = التقدم "ممسوح" | حلقات شوفتها تظهر غير مشاهدات — أرعب تجربة ممكنة |
| 5 | رقم الفوتر ≠ رقم الهوم للأفلام المشاهدة | رقمان مختلفان لنفس الشي على نفس الشاشة |
| 6 | `/api/tmdb/home` كل شي أو لا شي | تايم آوت واحد بـ 7 طلبات = الرئيسية كلها تسقط |
| 7 | المسلسل "المتوقف" بلا شارة بصفحة التفاصيل | بالقائمة "Stopped Watching" وبالتفاصيل لا شيء |
| 8 | وميض skeletons كامل عند كل تصفية/صفحة بالاكتشاف والمكتبة | التنقل بين الصفحات يقطع التجربة |
| 9 | بطء مكلف: جلب جدول Media كامل بكل أعمدته بـ 4 مسارات ساخنة | ثواني إضافية بكل فتح مكتبة/إحصائيات/هاب |
| 10 | تنسيقات تواريخ/أرقام/مدات متضاربة (13 نمط تاريخ!) | "5 September 2026" هنا و"Sep 5, 2026" هناك و"0h 45m" بالتفاصيل |

---

## أ) الأخطاء الصامتة والشاشات الفارغة (الأخطر)

### UX-01 🔴 useStats يبتلع الأخطاء — مصدر عدة مشاكل
**الملف:** `src/hooks/use-tmdb.ts:1230-1233`
```ts
// قبل:
if (!res.ok) return null;   // الفشل لا يختلف عن "لا بيانات" أبداً
```
**التصليح:**
```ts
// بعد:
if (!res.ok) {
  const body = await response.json().catch(() => null);
  throw new Error(body?.error ?? "Failed to load stats");
}
```

### UX-02 🔴 صفحة الإحصائيات ترجع بيضاء عند الفشل
**الملف:** `src/components/views/stats-view.tsx:29-30` — `if (!d) return null;`
**التصليح:** أضف فرع خطأ مع إعادة محاولة بعد الـ PageTitlebar مباشرة:
```tsx
if (stats.isError) {
  return (
    <>
      <PageTitlebar title="Your Statistics" subtitle="Your watching journey in numbers" />
      <div className="mx-auto max-w-6xl px-4 py-16 text-center">
        <p className="mb-4 text-lg">Couldn&apos;t load your statistics.</p>
        <button
          onClick={() => stats.refetch()}
          className="rounded-full bg-amber-500/20 px-5 py-2 text-sm text-amber-300 hover:bg-amber-500/30"
        >
          Try again
        </button>
      </div>
    </>
  );
}
const d = stats.data;
if (!d) return <StatsPageSkeleton />; // هيكل كامل (كل الأقسام) بدل null
```

### UX-03 🔴 الصفحة الرئيسية بلا واجهة خطأ
**الملف:** `src/components/views/home-view.tsx:103-254` — لا يوجد أي فرع `homeFeed.isError`.
**الأثر:** فشل `/api/tmdb/home` → الهيرو يختفي، كل صف MediaRow يطلع بعنوانه ومساحة فارغة، والعدّاد صفر — توهم أن TMDB فارغ.
**التصليح:** لُف كتلة الصفوف بالفرع التالي:
```tsx
{homeFeed.isError ? (
  <div className="mx-auto max-w-6xl px-4 py-16 text-center">
    <p className="mb-4 text-lg">Couldn&apos;t load the home feed right now.</p>
    <button
      onClick={() => homeFeed.refetch()}
      className="rounded-full bg-amber-500/20 px-5 py-2 text-sm text-amber-300 hover:bg-amber-500/30"
    >
      Try again
    </button>
  </div>
) : (
  <>{/* ...كل صفوف MediaRow الحالية... */}</>
)}
```

### UX-04 🟠 صفحة المسلسلات: الخطأ يظهر كـ"مكتبتك فاضية"
**الملف:** `src/components/views/tv-tracking-view.tsx:314-333` — لا فرع `tracking.isError`، فيصل `EmptyTab` "No tracked shows yet".
**التصليح:** قبل فرع الفراغ أضف:
```tsx
if (tracking.isError) {
  return (
    <EmptyTab
      title="Couldn't load your shows"
      subtitle="Something went wrong while loading your library."
      actionLabel="Try again"
      onAction={() => tracking.refetch()}
    />
  );
}
```

### UX-05 🟠 مركز الإشعارات: الفشل = "لا توجد إشعارات"
**الملف:** `src/components/views/notification-center.tsx:46-47` — `if (!res.ok) return;` بصمت.
**التصليح:**
```ts
// 1) أضف state جديد بجانب notifications:
const [loadError, setLoadError] = useState(false);
// 2) داخل fetchNotifications:
if (!res.ok) { setLoadError(true); return; }
setLoadError(false);
// 3) بالواجهة — قبل فرع الفراغ:
{loadError ? (
  <div className="px-4 py-8 text-center text-sm text-zinc-400">
    تعذر تحميل الإشعارات ·{" "}
    <button className="underline" onClick={() => fetchNotifications()}>إعادة المحاولة</button>
  </div>
) : /* الحالي... */}
```

### UX-06 🔴 فشل قائمة الحلقات المشاهدة يمسح التقدم بصرياً
**الملف:** `src/components/views/tv-detail-view.tsx` — `useWatchedEpisodes` (سطر 786) بلا معالجة خطأ: فشله = `watchedSet` فارغة = كل حلقاتك تظهر **غير مشاهدة**.
**التصليح:** داخل `SeasonEpisodes` (قرب 1046):
```tsx
const watchedQuery = useWatchedEpisodes(showId);
if (watchedQuery.isError) {
  return (
    <div className="px-4 py-6 text-center text-sm text-zinc-400">
      Couldn&apos;t load your watch progress — episodes may look unwatched.{" "}
      <button className="underline" onClick={() => watchedQuery.refetch()}>Retry</button>
    </div>
  );
}
const watchedSet = new Set((watchedQuery.data ?? []).map(...)); // كما هو حالياً
```
> ⚠️ القاعدة الذهبية: **مستحيل** نعرض حالة "غير مشاهد" اعتماداً على بيانات فشل تحميلها.

### UX-07 🟡 مسارات أخطاء ثانوية (تفاصيل/هاب/بحث)
- `tv-detail-view.tsx:1046-1157`: فشل الموسم = قائمة فارغة بصمت → أضف فرع `seasonData.isError` مع Retry.
- `tv-hub-overview.tsx:197-210`: بطاقة الخطأ تظهر فقط إذا فشل **الاثنان** — لو فشل `tracking` فقط، "Continue Watching" يعرض فراغاً مضللاً. عالج فشل كل استعلام على حدة.
- `movie-detail-view.tsx:60-67` / `tv-detail-view.tsx:108-115` / `person-detail-view.tsx:52-59`: أضف زر Retry بجانب "Go back" (نفس نمط discover).
- `header.tsx:646-661`: اقتراحات البحث — الخطأ يظهر "No suggestions yet"؛ ميّزه بـ"Search unavailable".

### UX-08 🟡 `/api/tmdb/home` — كل شي أو لا شي
**الملف:** `src/app/api/tmdb/[...path]/route.ts:33-41` — `Promise.all` على 7 طلبات؛ تايم آوت واحد يسقط الرئيسية كلها.
**التصليح** (نفس نمط movie-hub الموجود أصلاً):
```ts
const results = await Promise.allSettled([
  tmdbFetch("/trending/movie/week", ...),
  tmdbFetch("/trending/tv/week", ...),
  // ...البقية
]);
const pick = <T,>(r: PromiseSettledResult<T>, fallback: T) =>
  r.status === "fulfilled" ? r.value : fallback;
const anyFailed = results.some((r) => r.status === "rejected");
return NextResponse.json({
  /* ...خُذ كل نتيجة بـ pick(result[i], fallbackها الفارغ)... */
  partial: anyFailed,
}, { status: 200 });
```
ونفس الفكرة لـ `discover/filtered/route.ts:200` (استبدل `Promise.all` بـ `allSettled` وتجاهل الصفحات الفاشلة مع `partial: true`).

---

## ب) تعديلات بلا رد فعل (Mutations)

### UX-09 🔴 إجراءات المكتبة تفشل بصمت — الأسوأ بالتطبيق
**الملف:** `src/components/views/collection-world-view.tsx` — `handleMarkWatched` (854)، `handleRemoveRating` (887)، `handleUnwatch` (902)، `handleQuickUnwatch` (914) — كلها بلا try/catch وبلا toast.
**الأثر:** سحب "Watched" بالموبايل (922-935) أو اختيار "Remove from Watched" (1054-1081) وفشل الطلب = القائمة تنغلق ولا يصير شيء.
**التصليح** — لف كل واحدة:
```tsx
const handleMarkWatched = async (item: LibraryItem, watched: boolean) => {
  try {
    await update.mutateAsync({ id: item.id, watched });
  } catch {
    toast.error("Couldn't update — please try again");
  }
};
// كرر نفس النمط لـ handleRemoveRating و handleUnwatch و handleQuickUnwatch
```

### UX-10 🟠 زر حلقة بدون حماية ضغطة مزدوجة
**الملف:** `src/components/views/tv-detail-view.tsx:1069-1081`
**التصليح:** أضف للـ disabled:
```tsx
disabled={!released || (!isWatched && !watchPlanReady) || episodeToggle.isPending}
```

### UX-11 🟠 جلسات الإعادة تتراكم بالضغط المزدوج (تضخيم الإحصائيات)
**الملفات:** `src/app/api/library/watched-episodes/route.ts:471-487` (createMany غير شرطي عند `rewatch: true`) و `src/app/api/media/[id]/route.ts:71-88` (`rewatchCount: { increment: 1 }` بلا حماية).
**التصليح (خادمي):** احرس الإنشاء بوجود جلسة لنفس الحلقة بنفس اليوم:
```ts
// watched-episodes/route.ts — قبل createMany:
const today = new Date(); today.setHours(0, 0, 0, 0);
const existing = await tx.watchSession.findFirst({
  where: {
    userId, mediaId, season: episode.season, episode: episode.episode,
    watchedAt: { gte: today },
  },
  select: { id: true },
});
if (!existing) {
  await tx.watchSession.createMany({ data: [/* ...كما هو... */] });
}
```
```ts
// media/[id]/route.ts — حارس مشابه قبل increment: 
// إذا كانت آخر مشاهدة للفيلم اليوم → لا تزد العدّاد
```
والعميل (UX-10) يمنع أغلب الحالات أصلاً.

### UX-12 🟡 أزرار الصفحات Prev/Next تقفز صفحة عند الدبل-كلك
**الملفات:** `collection-world-view.tsx:612-623`، `tv-tracking-view.tsx:341-353`.
**التصليح** (نفس نمط discover الموجود):
```tsx
disabled={page <= 1 || query.isFetching}   // Prev
disabled={page >= totalPages || query.isFetching}  // Next
```

### UX-13 🟡 "Remove from watchlist" يهنئ حتى لو ما حذف شيئاً
**الملف:** `src/hooks/use-tmdb.ts:653-663` — عندما ماكو صف، الـ mutation ينجح والواجهة تقول "Removed".
**التصليح:** رجّع `{ removed: false }` من الـ API واعرض `toast.info("It wasn't in your watchlist")` عند false.

### UX-14 🟡 confirm() الأصلي بجانب dialogs مصممة
**الملفات:** `tv-detail-view.tsx:878`، `notification-center.tsx:113`، `profile-dialog.tsx:360`.
**التصليح:** استبدلها بـ `AlertDialog` الموجود أصلاً بالتطبيق (توحيد الشكل والموبايل).

---

## ج) تناقضات الأرقام والتسميات

### UX-15 🔴 الفوتر يعرض رقماً مختلفاً عن الهوم — على كل صفحة!
- **الفوتر:** `counts.watchedMovies` (أفلام العالم العادي فقط — `library-counts.ts:67`)
- **الهوم:** `counts.watchedMoviesAll` (كل العوالم — `library-counts.ts:45`)
**التصليح:** `src/components/layout/footer.tsx` — غيّر الحقل إلى:
```tsx
{counts.watchedMoviesAll}   // بدل counts.watchedMovies — نفس مصدر الهوم حرفياً
```

### UX-16 🔴 المسلسل المتوقف (stopped) بلا شارة بصفحة التفاصيل
**الملف:** `src/components/views/tv-detail-view.tsx:371-394` — الشارات تغطي finished/uptodate/watching/not_started/planned فقط.
**التصليح:** أضف داخل سلسلة الشارات:
```tsx
{effectiveLabel === "stopped" && (
  <span className="rounded-full bg-rose-500/20 px-3 py-1 text-xs font-medium text-rose-300">
    Stopped Watching
  </span>
)}
```

### UX-17 🟠 حرفياً "Up To Date" مقابل "Up to Date"
**الملفات:** `tv-tracking-view.tsx:53,81,159` و `tv-detail-view.tsx:380` ("Up To Date") مقابل `tv-hub-overview.tsx:73` و `watch-next-view.tsx:920` ("Up to Date").
**التصليح:** وحّد الكل إلى **"Up to Date"** (بحث واستبدال بالملفات الأربعة).

### UX-18 🟠 purple مقابل violet لحالة planned
**الملف:** `tv-tracking-view.tsx:59` يستخدم `purple-*` بينما `tv-detail-view.tsx:392` يستخدم `violet-*` — لونان مختلفان فعلياً بـ Tailwind.
**التصليح:** وحّد إلى violet بكل ملفات المسلسلات (tracking + StatCard).

### UX-19 🟠 آلات حالتين متضاربتين للمسلسلات القديمة
- `src/lib/tv-status-engine.ts:64`: `"watched" → "finished"` دائماً
- `tv-tracking-view.tsx:41`: `"watched" → isEnded ? "finished" : "uptodate"`
**الأثر:** نفس المسلسل "Finished" بمكان و"Up to Date" بمكان آخر.
**التصليح:** أضف دالة موحدة بالـ engine واستخدمها بالاثنين:
```ts
// src/lib/tv-status-engine.ts
export function normalizeLegacyWatched(status: string, isEndedByTmdb: boolean) {
  if (status !== "watched") return status;
  return isEndedByTmdb ? "finished" : "uptodate";
}
// tv-tracking-view.tsx deriveTrackingStatus → استدعِ normalizeLegacyWatched
// tv-status-engine.ts:64 → مرّر isEnded وطبّق نفس الدالة
```

### UX-20 🟠 متوسط التقييم: عشري هنا وعدد صحيح هناك
- Stats: `avgRating.toFixed(1)` → "84.3 / 100" (`stats-view.tsx:165`)
- Movies hub: `Math.round(...)` → "85" (`movie-hub/route.ts:162`)، وكذلك anime hub (`anime/hub/route.ts:265`)
**التصليح:** وحّد إلى رقم عشري واحد: `Math.round(x * 10) / 10` في مسارات الهاب.

### UX-21 🟡 سقف عدّاد الإشعارات غير متسق: "9+" بالهيدر و"99+" باللوحة
**الملفات:** `header.tsx:527` مقابل `notification-center.tsx:126`.
**التصليح:** وحّد الحد (99+ بالاثنين أنسب).

### UX-22 🟡 نفس المفهوم بثلاث أسماء
- Home: "All Movies Watched" · Stats: "All movies watched" · Profile: "Watched movies (all)"
- كذلك: "Up to Date" المسلسلات مقابل "In Progress" أفلام الأنمي مقابل "Watching" — **راجع القصد**: للمسلسلات وحّد "Watching"، وللأفلام "In Progress" مقبول كون المفهوم مختلف.
- تصحيح داخلي بملف واحد: `collection-world-view.tsx:325` "In progress" مقابل `:394` "In Progress" → وحّد الكابتل.

---

## د) التواريخ والأرقام والمدات

### UX-23 🔴 13 نمط تاريخ مختلف بالتطبيق
**أمثلة متضاربة يراها المستخدم بنفس الجلسة:**
- تفاصيل الفيلم: "5 September 2026" (en-GB — `movie-detail-view.tsx:79`)
- عيد ميلة الممثل: "September 5, 1965" (en-US — `person-detail-view.tsx:133`)
- تاريخ بث الحلقة: "Sep 5, 2026" (`tv-detail-view.tsx:1103`)
- **بلا locale إطلاقاً** (يتبع متصفح المستخدم!): `home-view.tsx:557` و `profile-dialog.tsx:432`
- التقويم بدون سنة (`calendar-view.tsx:68`) بينما كل الباقي بسنة.
**التصليح** — أنشئ ملف توحيد واستخدمه بكل المواضع:
```ts
// src/lib/format.ts (ملف جديد)
export function formatDate(
  date: string | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" },
  locale = "en-US",
): string | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(locale, opts).format(d);
}

export function formatRuntime(minutes?: number | null): string | null {
  if (!minutes || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}
```
ثم استبدل الـ 13 موضعاً (مذكورة بالتفصيل أعلاه) بنداءات `formatDate`.

### UX-24 🔴 "0h 45m" لفيلم 45 دقيقة
**الملف:** `src/components/views/movie-detail-view.tsx:78` — `${Math.floor(m.runtime/60)}h ${m.runtime%60}m`.
**التصليح:** `formatRuntime(m.runtime)` من UX-23 → "45m" للقصير و"2h 15m" للطويل.
**وكذلك** `tv-detail-view.tsx:1108` "45 min" → "45m" توحيداً مع شارة الحلقة (`:134`).

### UX-25 🟡 أرقام بفواصل هنا وبدونها هناك
`discover-view.tsx:820` و `profile-dialog.tsx` يستخدمان `toLocaleString()` ("1,234") بينما Home/Stats/TV tracking/search تعرض "1234" خام.
**التصليح:** `formatCount()` من UX-23 بكل عرض عدّادات.

### UX-26 🟡 وقت نسبي بأربع تطبيقات مختلفة
`notification-center.tsx:141` (عربي فقط لكل المستخدمين!) · `watch-next-view.tsx:1184` ("Released X days ago") · `tv-tracking-view.tsx:411` · `watch-next-view.tsx:1199` (countdown).
**التصليح:** أضف لـ `format.ts`:
```ts
export function formatRelativeDays(date: string | Date, now = new Date()): string {
  const d = new Date(date);
  const diff = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diff <= 0) return "today";
  if (diff === 1) return "yesterday";
  return `${diff} days ago`;
}
```
(الإشعارات العربية تبقى عربية إذا قرار المنتج عربي — انظر UX-33.)

---

## هـ) التحميل والفراغ والصور

### UX-27 🟠 وميض skeleton كامل عند كل تصفية/صفحة
**الملفات:** `src/hooks/use-tmdb.ts` — `useDiscoverMovies` (173-223)، `useFilteredDiscover`، `useMedia` (1598-1625) كلها بلا `placeholderData`، بينما `useTvTracking` (1357) عندها — عدم اتساق واضح.
**التصليح:**
```ts
import { keepPreviousData } from "@tanstack/react-query";
// أضف للاستعلامات الثلاثة:
placeholderData: keepPreviousData,
```
النتيجة: تغيير الفلتر/الصفحة يحدّث البطاقات مكانها بدل وميض كامل.

### UX-28 🟠 صف MediaRow الفارغ يعرض عنواناً ومساحة ميتة
**الملف:** `src/components/media/media-row.tsx:131-152` — عند قائمة فارغة يظهر العنوان والأسهم وشريط تمرير فاضي (و"Pick for Tonight" بالموفيز يترك فراغاً صامتاً كاملاً).
**التصليح:**
```tsx
if (!loading && items.length === 0) {
  if (hideHeading) return null;            // لا فراغ ميت
  return (
    <section className="mb-8">
      {/* العنوان كما هو */}
      <p className="px-4 text-sm text-zinc-500">Nothing here yet.</p>
    </section>
  );
}
```

### UX-29 🟡 Film Collections وCalendar بلا حالة تحميل إطلاقاً
**الملفات:** `film-series-view.tsx:30-72`، `calendar-view.tsx:41-89` — منطقة فارغة تماماً أثناء `isLoading`.
**التصليح:** أضف صف بطاقات skeleton (نفس نمط movie-hub-view) قبل وصول البيانات.

### UX-30 🟡 صفحة التفاصيل العربية تومض مرتين (EN → skeleton → AR)
**الملفات:** `movie-detail-view.tsx:35`، `tv-detail-view.tsx:42` — مفتاح الاستعلام يتغير من en إلى ar بعد وصول mediaState.
**التصليح (تخفيف):** أضف `placeholderData: keepPreviousData` لـ `useMovieDetail`/`useTvDetail` — تبقى الصفحة معروضة أثناء تبديل اللغة بدل وميض.

### UX-31 🟡 صور الأشخاص ببحث الأشخاص — `<img>` خام بلا fallback
**الملف:** `src/components/views/search-view.tsx:216-221` — الوحيدة بالتطبيق خارج SafeImage؛ صور TMDB المكسورة تظهر أيقونة المتصفح المكسورة.
**التصليح:** استبدل بـ `<SafeImage>` المستخدم بكل التطبيق.

### UX-32 🟡 Stats: هيكل للـ 6 مربعات فقط والبقية "تقفز"
**الملف:** `stats-view.tsx:18-27` — وسّع الـ skeleton ليغطي الرسوم ووقت المشاهدة والبطاقات (يمنع قفزة التخطيط).

---

## ز) اللغة والعربية (RTL)

### UX-33 🟠 نظام الإشعارات عربي بالكامل للجميع + أرقام هندية ٩٩ مختلطة بـ 99+
**الملفات:** `notification-center.tsx` كامل + `notification-sync-server.ts:231-304` + `notification-schedule.ts:78-85`.
**التقييم:** إذا المستخدم الأساسي عربي (حالتك) — **هذا مقبول ومقصود غالباً**، بس وحّد الأرقام: `notification-center.tsx:126` يمزج `٩٩` (ar-IQ) مع cap لاتيني `"99+"` والحدير `"9+"` لاتيني.
**التصليح الأدنى (توحيد الأرقام):**
```ts
// notification-center.tsx:126 — استخدم أرقاماً لاتينية متسقة مع الهيدر:
const countLabel = unread > 99 ? "99+" : String(unread); // بدل toLocaleString("ar-IQ")
```
**التصليح الكامل (لو تريد دعم غير العرب):** اربط اللغة بإعداد المستخدم ومرّرها للسيرفر عند توليد نصوص push.

### UX-34 🟠 عناوين عربية داخل قوائم LTR — علامات الترقيم بالجهة الغلط
**الملفات:** `media-card.tsx:157`، `tv-tracking-view.tsx:457`، `home-view.tsx:365` (هيرو!)، بطاقات البحث — كلها بلا `dir="auto"` بينما مركز الإشعارات يفعلها صح.
**التصليح:** أضف `dir="auto"` لعناصر العناوين الديناميكية:
```tsx
<h3 dir="auto" className="...">{title}</h3>
```

### UX-35 🟡 صفحة التفاصيل تقرر "عربي" بإشارتين مختلفتين
`mediaState.isArabic` (لغة جلب TMDB) مقابل `detectIsArabic(...)` (لغة الشارات) — ممكن الشارات عربية والنص إنجليزي لنفس العنوان (`movie-detail-view.tsx:35` مقابل `:82`).
**التصليح:** وحّد الإشارتين على مخرجات `mediaCollectionWorldForItem` (pipeline التصنيف الرسمي) — احسبه مرة واحدة واستخدم نتيجته للجميع.

---

## ح) التنقل والموبايل

### UX-36 🟠 dock الموبايل يفقد الـ active عند TV Shows أو Anime
**الملف:** `src/components/layout/header.tsx:98-103,317` — هذان القسمان غيران بالـ dock وغيران بالـ overflow → لا شيء يضيء.
**التصليح:**
```ts
// header.tsx قرب سطر 317 — أضفهما لمنطق إضاءة زر More:
const overflowActive =
  overflowViews.includes(view) || view === "tv-shows" || view === "anime";
```

### UX-37 🟠 عنوان تبويب المتصفح لا يتغير أبداً بالتنقل الداخلي
ماكو أي `document.title` بالتطبيق — كل الشاشات تعرض "Trakora — Movies, TV Shows & Anime".
**التصليح** — بأي مكوّن يقرأ view-metadata الحالي (app-shell):
```tsx
useEffect(() => {
  document.title = activeMeta ? `${activeMeta.title} — Trakora` : "Trakora";
}, [activeMeta?.title]);
```

### UX-38 🟡 عناصر dropdown "More" بلا حالة active لكل عنصر
**الملف:** `header.tsx:417-450` — أضف تمييزاً للعنصر المطابق للـ view الحالي (نفس نمط عناصر الهيدر الأساسية).

### UX-39 🟡 نسخ البحث يختلف ديسكتوب/موبايل
placeholder مختلف، تبويبات All/Movies/TV/People بالموبايل فقط، و"TV" مقابل "TV shows".
**التصليح:** وحّد النصوص والتبويبات بين `header.tsx:466,601-618` و `search-view.tsx:44-98`.

---

## ط) الأداء (يسرق التجربة بالثواني)

### UX-40 🔴 getCanonicalLibraryCounts يجلب جدول Media كاملاً بكل أعمدته — 4 مسارات ساخنة
**الملف:** `src/lib/library-counts.ts:24-27` — `findMany({ where: { userId } })` بلا select وبلا take: يجلب overview وposter وnotes... لكل صف، ثم يحسب ~35 عدّاداً بالذاكرة. يُستدعى من: `/api/library/counts` + `/api/library/stats` + `/api/movie-hub` + prefetch الإقلاع (`providers.tsx:168`).
**التصليح (سريع وفعال):** اجلب الأعمدة المستخدمة فقط:
```ts
const rows = await db.media.findMany({
  where: { userId },
  select: {
    id: true, type: true, watched: true, status: true,
    isAnime: true, isArabic: true, isFollowing: true,
    originalLanguage: true, originCountries: true,
    genres: true, runtime: true, userRating: true,
    ratingStatus: true, rewatch: true, tmdbId: true,
    // أضف أي حقل آخر يستخدمه أحد الـ 35 فلتر فعلياً — لا أكثر
  },
});
```
**(لاحقاً):** حوّل العدّادات لاستعلامات `groupBy`/`count` مجمّعة عند الحاجة لمقاييس أكثر.

### UX-41 🔴 movie-hub يقرأ الجدول مرتين بكل طلب
**الملف:** `src/app/api/movie-hub/route.ts:94-102` — findMany كامل (94) + getCanonicalLibraryCounts يجلب نفس الصفوف ثانية (102).
**التصليح:** اسمح بتمرير الصفوف الجاهزة:
```ts
// library-counts.ts — غيّر التوقيع:
export async function getCanonicalLibraryCounts(
  userId: string,
  preloadedRows?: Awaited<ReturnType<typeof loadMediaRows>>,
) {
  const rows = preloadedRows ?? await loadMediaRows(userId);
  // ...الباقي كما هو
}

// movie-hub/route.ts:
const ownRows = await db.media.findMany({ where: {...}, select: {...UX-40} });
const canonicalCounts = await getCanonicalLibraryCounts(user.id, ownRows);
```

### UX-42 🟠 anime hub و stats بنفس النمط (جلب كامل)
- `src/app/api/anime/hub/route.ts:120-123` — select نحيف + take غير مطلوب حالياً لكن الأعمدة كاملة.
- `src/app/api/library/stats/route.ts:16-23` — يجلب **كل** صفوف الحلقات والجلسات لحساب SUM/COUNT بالذاكرة.
**التصليح:** select نحيف للحلقات/الجلسات (`duration`, `watchedAt` فقط) وبالمدى الطويل `aggregate`.

### UX-43 🟡 endpoints بلا حدود (تتدهور مع نمو المكتبة)
`watchlist`، `following`، `watched-movies`، `ratings`، `film-series`، `watched-episodes` (بلا showId) — كلها ترجع كل الصفوف.
**التصليح:** أضف `take` افتراضياً (مثلاً 500) + معامل `limit` اختياري؛ الواجهة الحالية تمرر showId دائماً للحلقات فلا كسر.

### UX-44 🟡 upsert تسلسلي لكل حلقة داخل معاملة واحدة
**الملف:** `watched-episodes/route.ts:445-469` — موسم 24 حلقة = 24 round-trip متتالية داخل transaction.
**التصليح:** للحلقات الجديدة استخدم `createMany({ skipDuplicates: true` بدمة واحدة، ثم حدّث الأسماء/المدد المتغيرة باستعلام تحديث مجمّع.

---

## ي) بيانات القاعدة (تؤثر على ما يعرضه التطبيق)

### UX-45 🟠 2,151 فيلم مشاهد بلا runtime → وقت المشاهدة تقديري (120 دقيقة افتراضية لكل واحد)
**التحقق:** فحص Neon الفعلي — 2,151 صفاً. الإحصائيات تعتبر كل واحد 120 دقيقة → أيام وهمية بوقت المشاهدة.
**التصليح:** backfill من TMDB (سكربت جاهز أدناه — **يجب تشغيله مرة واحدة**):
```ts
// scripts/backfill-movie-runtimes.mjs — يتطلب NEON_DATABASE_URL و TMDB_API_KEY
import { Client } from "pg";
const TMDB = "https://api.themoviedb.org/3";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const db = new Client({ connectionString: process.env.NEON_DATABASE_URL });
await db.connect();
const { rows } = await db.query(
  `SELECT id, "tmdbId" FROM "Media"
   WHERE type = 'movie' AND watched = true AND ("runtime" IS NULL OR "runtime" <= 0)
     AND "tmdbId" IS NOT NULL`,
);
console.log(`Backfilling ${rows.length} movies…`);
let fixed = 0;
for (const [i, m] of rows.entries()) {
  try {
    const res = await fetch(`${TMDB}/movie/${m.tmdbId}?api_key=${process.env.TMDB_API_KEY}`);
    if (res.ok) {
      const detail = await res.json();
      if (detail.runtime > 0) {
        await db.query(`UPDATE "Media" SET runtime = $1 WHERE id = $2`, [detail.runtime, m.id]);
        fixed++;
      }
    }
  } catch { /* نتجاهل ونكمل */ }
  if (i % 50 === 0) { console.log(`${i}/${rows.length}…`); await sleep(1000); } // احترام حدود TMDB
}
console.log(`Done: ${fixed}/${rows.length} fixed`);
await db.end();
```

### UX-46 🟡 78 مسلسل بلا صف TvMetadataCache → تتبعهم/حلقاتهم القادمة يختلف بين الشاشات
**التصليح:** نفس نمط السكربت أعلاه لكن `GET /tv/{id}` ثم upsert لـ TvMetadataCache (الحقول يحدها `src/lib/tv-status-server.ts`) — أو ببساطة افتح كل مسلسل مرة من الواجهة (self-heal) — السكربت أسرع.

### UX-47 🟢 حذف endpoint الميت المكرر
`src/app/api/media/stats/route.ts` — لا مستهلك له إطلاقاً ويكرر `/api/library/stats`:
```bash
rm src/app/api/media/stats/route.ts
```

### UX-48 🟢 client يتجاهل رسائل الخطأ الودية من السيرفر
`use-tmdb.ts:18-26` يرمي `"TMDB 500"` بدل قراءة `{error}` من السيرفر؛ و `tmdb/[...path]/route.ts:288-292` يسرّب نصوصاً داخلية ("TMDB timed out after 8s for /discover/movie") للمستخدم.
**التصليح:**
```ts
// use-tmdb.ts tmdbGet:
if (!res.ok) {
  const body = await res.json().catch(() => null);
  throw new Error(body?.error ?? `TMDB request failed (${res.status})`);
}
```
```ts
// tmdb proxy — استبدل النص الخام برسالة آمنة:
catch (error) {
  return NextResponse.json(
    { error: "Couldn't reach the movie database — please try again." },
    { status: 502 },
  );
}
```

---

## ✅ نقاط قوة موجودة أصلاً (لا تحتاج تغييراً)
- شكل أخطاء API موحد (`{error}`) بكل المسارات + upsert على كل مسارات الإنشاء الأساسية.
- `Promise.allSettled + partial` بالهابّات، ميزانية صفحات مكتشف محدودة (8)، timeout 8 ثواني لـ TMDB.
- SafeImage بfallback لكل الصور تقريباً · skeletons + retry بمعظم الشاشات · toast نجاح/فشل بمعظم الإجراءات · undo للمراقبة.
- نظام الإشعارات deterministic IDs مع skipDuplicates · تصدير بcursor وbyte-budget.

---

## 🗓️ خطة تنفيذ مقترحة بالمراحل

| المرحلة | المحتوى | الملفات |
|---------|---------|---------|
| **1 — سلامة العرض** | UX-01→06, 08 | use-tmdb, stats-view, home-view, tv-tracking, notification-center, tv-detail, tmdb proxy |
| **2 — ردود الفعل** | UX-09→14 | collection-world-view, tv-detail, media/[id] |
| **3 — الاتساق** | UX-15→26 + format.ts جديد | footer, tv-detail/tracking, format.ts, 13 موضع تاريخ |
| **4 — التحميل والصور** | UX-27→32 | use-tmdb, media-row, film-series, calendar, search, stats |
| **5 — عربية/تنقل** | UX-33→39 | notification-center, media-card, header, app-shell |
| **6 — أداء + بيانات** | UX-40→48 | library-counts, movie-hub, سكربتا backfill |
