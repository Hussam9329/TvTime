# سجل التغييرات — TVM-01 + TVM-02

## TVM-01 — توحيد قاعدة البيانات

- تغيير Prisma datasource من PostgreSQL إلى SQLite.
- توحيد `.env` و`.env.example` وسكربتات dev/build/start على `db/custom.db`.
- تحويل حقول القوائم غير المدعومة في SQLite إلى JSON text مع نفس أسماء الأعمدة عبر `@map`.
- إضافة `AppMeta` لتسجيل تنفيذ عمليات الترحيل مرة واحدة.
- إضافة نسخة احتياطية تلقائية قبل مزامنة الـschema.
- إضافة Preflight يدمج صفوف `Media` المكررة قبل إنشاء القيد الفريد.
- إضافة فاحص سلامة للـschema، سلامة SQLite، المفاتيح الخارجية، الحالات، والمرايا التوافقية.
- تثبيت أمر `db:sync` كمسار النشر الصحيح.

## TVM-02 — مصدر حقيقة واحد للحالة

- إضافة `Media.libraryState` و`stateChangedAt`.
- اعتماد الحالات: `none`, `planned`, `watching`, `up_to_date`, `completed`.
- إضافة مكتبة مركزية للحالة في `src/lib/media-state.ts`.
- إضافة Repository مركزي في `src/lib/media-repository.ts`.
- فصل `userRating` عن حالة المشاهدة.
- جعل `status` و`watched` مرايا توافقية فقط.
- توحيد APIs الخاصة بـMedia وWatchlist وWatched Movies وFollowing وRatings وEpisodes.
- توحيد Library وHome وRecently Watched وTV Tracking والإحصائيات.
- ترحيل بيانات الجداول القديمة مرة واحدة بدون اعتبار التقييم مشاهدة.
- منع استعادة بيانات Legacy إلى Runtime بعد نجاح الترحيل.
- إصلاح Bulk episode updates ومنع race conditions.
- احتساب الحلقات المعروضة فقط دون الحلقات المستقبلية.
- إنشاء سجل `Media` تلقائيًا عند تسجيل حلقة لمسلسل غير مضاف.
- إعادة حساب حالة المسلسل عند إضافة أو حذف الحلقات.
- تحديث الاستيراد والتصدير وسكربتات الصيانة للمصدر المركزي.
- حذف مساعد localStorage القديم الخاص بحالة المكتبة؛ localStorage المتبقي يخص واجهة التنقل وهوية المستخدم فقط.

## حماية إضافية

- مسار `reset-accidental-watched` أصبح Dry-run افتراضيًا.
- إصلاح البوسترات يعمل على `Media` فقط.
- مسح المكتبة يحذف المصدر المركزي والجداول القديمة عمدًا لمنع إعادة ترحيل بيانات محذوفة.
