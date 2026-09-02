# BAT-05 — Backfill Genres القديمة

## الهدف

BAT-04 يمنع إنشاء سجلات TMDB جديدة بدون أسماء Genres. BAT-05 ينظف السجلات القديمة الموجودة مسبقاً في جدول `Media` والتي ما زال الحقل `genres` فيها مصفوفة فارغة `[]`.

هذا **سكربت صيانة مرة واحدة** وليس Feature يومية، ولا يوجد Cron ولا Migration ولا تغيير في Schema.

## ما الذي أضافه الباتش؟

- ملف جديد: `prisma/scripts/backfill-genres.ts`
- أوامر npm آمنة:
  - `npm run db:backfill:genres` — Dry Run فقط، لا يكتب شيئاً.
  - `npm run db:backfill:genres:apply` — ينفذ الإصلاح الفعلي.
  - `npm run db:verify:genres` — فحص نهائي لعدد السجلات التي بقيت فارغة.
- يجلب Genres الرسمية من TMDB حسب `tmdbId` ونوع العمل.
- يعالج الأفلام (`movie`) والمسلسلات (`series`/`tv`).
- يعمل على دفعات افتراضياً: 25 سجلاً في الدفعة.
- ينتظر 300ms بين طلبات TMDB و1s بين الدفعات.
- يعيد المحاولة تلقائياً عند 429 و5xx وأخطاء الشبكة/Timeout.
- لا يكتب `genres=[]` إذا TMDB رجع بدون Genres.
- لا يكتب فوق سجل تم إصلاحه يدوياً أثناء تشغيل السكربت.
- يعطي سبباً واضحاً لكل استثناء متبقٍ.
- بعد `--apply` يعيد العد من قاعدة البيانات، ويعتبر المهمة مكتملة فقط إذا صار العدد صفر.

## المتطلبات

لازم تكون Environment Variables الخاصة بالمشروع متوفرة في نفس البيئة التي تشغل منها السكربت:

- `DATABASE_URL`
- `TMDB_API_KEY`

> مهم: شغّل السكربت على نفس قاعدة البيانات التي تريد تنظيفها. لا تنسخ مفاتيح الإنتاج داخل الكود أو ملف الباتش.

## 1) تطبيق الباتش

من جذر المشروع:

```bash
git apply --check BAT-05.patch
git apply BAT-05.patch
```

ثم ثبّت الاعتماديات/ولّد Prisma Client إذا احتجت:

```bash
npm install
npx prisma generate
```

## 2) خذ Backup قبل أي كتابة

BAT-05 لا يحذف سجلات، لكنه يعدل بيانات فعلية. خذ Backup موثوق قبل `--apply` حسب آلية النسخ الاحتياطي المعتادة عندك.

## 3) Dry Run أولاً — إلزامي

```bash
npm run db:backfill:genres -- --report=BAT-05-dry-run.json
```

هذا الأمر:

1. يحسب كل `Media` التي `genres=[]`.
2. يراجع TMDB لكل سجل قابل للإصلاح.
3. **لا يكتب أي شيء في الداتابيس.**
4. ينشئ تقرير JSON إذا مررت `--report=...`.

إذا ظهرت Exceptions، راجع أسبابها قبل التطبيق.

### أسباب الاستثناءات الممكنة

- `MISSING_TMDB_ID`: السجل لا يملك TMDB ID، لذلك لا يمكن جلب Genre موثوق تلقائياً.
- `UNSUPPORTED_MEDIA_TYPE`: قيمة `Media.type` غير `movie/series/tv`.
- `TMDB_NOT_FOUND`: TMDB رجع 404 لهذا ID.
- `TMDB_NO_GENRES`: العمل موجود في TMDB لكن TMDB نفسه رجع Genres فارغة.
- `TMDB_RATE_LIMITED`: بقي 429 حتى بعد Retry.
- `TMDB_REQUEST_FAILED`: Network/Timeout/5xx أو خطأ TMDB آخر بعد المحاولات.
- `DATABASE_UPDATE_FAILED`: جلب TMDB نجح لكن تحديث Prisma فشل.

## 4) التطبيق الفعلي

إذا الـDry Run منطقي وعندك Backup:

```bash
npm run db:backfill:genres:apply -- --report=BAT-05-apply.json
```

السلوك الافتراضي:

```text
Batch size      = 25
Delay/request   = 300ms
Pause/batch     = 1000ms
Retries         = 3
TMDB timeout    = 10000ms
```

يمكنك جعل التشغيل أهدأ، مثلاً دفعات 10 وتأخير نصف ثانية:

```bash
npm run db:backfill:genres:apply -- \
  --batch-size=10 \
  --delay-ms=500 \
  --batch-pause-ms=1500 \
  --report=BAT-05-apply.json
```

## 5) شرط النجاح — لا تنتقل للمرحلة التالية قبله

بعد التطبيق شغّل:

```bash
npm run db:verify:genres -- --report=BAT-05-verify.json
```

### النتيجة المثالية

```json
{
  "missingGenres": 0,
  "success": true,
  "unresolved": []
}
```

ويمكن التأكد مباشرة بـSQL في Neon/PostgreSQL:

```sql
SELECT COUNT(*) AS empty_genres
FROM "Media"
WHERE cardinality("genres") = 0;
```

المفروض:

```text
empty_genres = 0
```

## إذا بقيت سجلات فارغة

هذا ليس نجاحاً صامتاً. السكربت بعد `--apply` يرجع exit code `2` ويطبع/يسجل السجلات المتبقية.

استخرجها أيضاً بـSQL:

```sql
SELECT "id", "tmdbId", "title", "type", "genres"
FROM "Media"
WHERE cardinality("genres") = 0
ORDER BY "addedAt" ASC;
```

لكل سجل متبقٍ يجب أن يكون عندنا سبب معروف. مثلاً إذا `tmdbId IS NULL`، يحتاج إصلاح TMDB ID أو معالجة يدوية منفصلة قبل اعتبار المرحلة منتهية.

## مثال المستخدم

قبل:

```text
The Conjuring
Genre = []
```

السكربت يطلب تفاصيل TMDB، ثم يحفظ مثلاً:

```text
Horror • Thriller
```

## خيارات السكربت

```text
--apply                 تنفيذ الكتابة الفعلية. بدونه التشغيل Dry Run.
--verify-only           عدّ السجلات الفارغة فقط بدون TMDB وبدون كتابة.
--batch-size=N          حجم الدفعة، من 1 إلى 100. الافتراضي 25.
--delay-ms=N            انتظار بين طلبات TMDB. الافتراضي 300ms.
--batch-pause-ms=N      انتظار بين الدفعات. الافتراضي 1000ms.
--max-retries=N         عدد إعادة المحاولة. الافتراضي 3.
--timeout-ms=N          Timeout لكل طلب TMDB. الافتراضي 10000ms.
--report=FILE.json      حفظ التقرير النهائي كـJSON.
```

## التراجع عن الكود

```bash
git apply -R BAT-05.patch
```

هذا يحذف السكربت وأوامر npm فقط.

### ملاحظة مهمة عن تراجع البيانات

بعد تشغيل `--apply`، حذف السكربت **لا يرجع Genres التي تم تعبئتها إلى فارغة**، وهذا مقصود لأن البيانات الجديدة هي التصحيح. إذا احتجت Rollback للبيانات نفسها، استخدم Backup أخذته قبل التشغيل.

## النطاق

BAT-05 يصلح فقط السجلات القديمة ذات `genres=[]`.

لا يضيف Genre Filter للواجهة أو API؛ تلك مراحل BAT-01/BAT-02/BAT-03 اللاحقة. ولا يشغل نفسه يومياً.
