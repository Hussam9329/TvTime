# برومبت Agent جاهز

طبّق حزمة `TVM-01-02.patch` على نسخة نظيفة من مشروع TvTime، ثم نفّذ فحصًا كاملًا بدون تغيير الهدف المعماري التالي:

1. قاعدة البيانات الوحيدة المعتمدة هي SQLite عبر Prisma و`DATABASE_URL=file:../db/custom.db`.
2. `Media.libraryState` هو المصدر الوحيد لحالة الفيلم أو المسلسل.
3. الحالات المسموحة فقط: `none`, `planned`, `watching`, `up_to_date`, `completed`.
4. `userRating` مستقل عن المشاهدة؛ لا يجوز أن يغيّر التقييم `libraryState` أو `watchedAt`.
5. `status` و`watched` حقول توافقية مشتقة فقط، ولا يجوز لأي صفحة أو API قراءتهما كمصدر قرار.
6. جداول `WatchlistItem`, `WatchedMovie`, `FollowingShow`, `Rating` مخصصة للترحيل القديم فقط، ولا يجوز استخدامها في Runtime بعد الترحيل.
7. `WatchedEpisode` هو سجل الحقيقة على مستوى الحلقة، ويجب إعادة حساب حالة المسلسل بعد الإضافة والحذف وعمليات Bulk.
8. لا تعدّ الحلقات المستقبلية ضمن التقدم.
9. لا تحذف قاعدة المستخدم أو بياناته، ولا تشغّل reset.
10. لا تنفذ أي إصلاح إداري مدمر تلقائيًا؛ ابدأ دائمًا بـdry-run.

نفّذ بالترتيب:

```bash
bun install
bun run db:sync
bun run db:verify
bun run lint
bun run build
```

إذا لم يتوفر Bun استخدم npm بالأوامر المناظرة.

بعد التنفيذ افحص يدويًا وسجّل النتيجة لكل حالة:

- Rating-only لا يظهر Watched.
- Watched movie بدون Rating يبقى Completed.
- إزالة المشاهدة لا تحذف Rating.
- مسلسل بحلقة واحدة يظهر Watching.
- مسلسل مستمر مع كل الحلقات المتاحة يظهر Up to date.
- مسلسل منتهٍ مع كل الحلقات يظهر Completed.
- حذف حلقة يعيد الحالة فورًا.
- Home وLibrary وDetails وTracking تعرض الحالة نفسها.
- إعادة تشغيل التطبيق لا تغيّر الحالة.
- `db:verify` لا يعرض duplicate rows أو invalid states أو mirror mismatches.

لا تغيّر بنية الحالات ولا تعيد دعم PostgreSQL. إذا ظهر خطأ، أصلح السبب ضمن المعمارية أعلاه، ثم أعد جميع الفحوص. في النهاية أعطني تقريرًا يتضمن: الملفات المتغيرة، أوامر التنفيذ، نتيجة الترحيل، نتيجة build/lint، وأي ملاحظة متبقية بوضوح.
