# برومبت Agent جاهز

طبّق الباتش `TVM-03-04-05.patch` حصراً على نسخة نظيفة مطابقة للملف الرسمي `TvTime-main (4)(2).zip` ذي بصمة SHA-256:

`4ca8686ca1e22cefc3da43f4ae05c4c6a291dd11c154840a09a2c49d8d89847f`

## قيود قطعية

1. ممنوع تغيير `prisma/schema.prisma` أو Prisma provider أو `DATABASE_URL`.
2. ممنوع تشغيل أو إضافة `prisma db push` أو migrate أو reset.
3. ممنوع إنشاء SQLite أو قاعدة بديلة أو نقل البيانات.
4. ممنوع حذف أو إعادة بناء بيانات الإنتاج.
5. لا تعدّل أي ملف خارج الباتش إلا لمعالجة خطأ build سببه الباتش نفسه، مع توثيق دقيق للتعديل الإضافي.
6. لا تعتبر التقييم مشاهدة، ولا تعتبر إزالة التقييم إزالة مشاهدة.
7. حالات TV التقدمية لا تُكتب يدوياً؛ يجب أن تشتق من سجلات الحلقات عبر المحرك المركزي.
8. لا تسمح بتسجيل حلقة مستقبلية كمشاهدة.

## خطوات التنفيذ

1. تحقق من بصمات الملفات المحمية الموجودة في `delivery/BASELINE-SHA256.txt`.
2. نفّذ:

```bash
git apply --check delivery/TVM-03-04-05.patch
git apply delivery/TVM-03-04-05.patch
```

3. أعد فحص بصمات الملفات المحمية.
4. نفّذ:

```bash
node --experimental-strip-types scripts/test-tv-status-engine.ts
node scripts/verify-tvm-03-04-05.mjs
npm install
npm run lint
npm run build
```

5. لا تنفذ أي أمر قاعدة بيانات عدا `prisma generate` الموجود أصلاً داخل build وبعد التأكد أن `DATABASE_URL` هو رابط PostgreSQL الإنتاجي الصحيح.
6. اختبر يدوياً الحالات الواردة في `delivery/EXPECTED-RESULTS-AR.md`.
7. في تقريرك النهائي اذكر صراحة:
   - بصمات الملفات المحمية قبل وبعد.
   - نتيجة اختبارات المحرك.
   - نتيجة الفاحص الثابت.
   - نتيجة lint وbuild.
   - عدم تنفيذ migration/db push/reset.
   - الصفحات التي تم فحصها يدوياً.
