# TVM-03 + TVM-04 + TVM-05 — الحزمة الموحدة

هذه الحزمة مطبقة حصراً فوق النسخة الأم الرسمية:

`TvTime-main (4)(2).zip`

بصمة SHA-256 للنسخة الأم:

`4ca8686ca1e22cefc3da43f4ae05c4c6a291dd11c154840a09a2c49d8d89847f`

## ما تنفذه الحزمة

- TVM-03: فصل المشاهدة عن التقييم بالكامل.
- TVM-04: محرك مركزي واحد لحالات المسلسلات.
- TVM-05: استبعاد الحلقات المستقبلية من الإنجاز والحلقة التالية للمشاهدة.

## ضمان قاعدة البيانات

لم يتم تغيير أي من الآتي:

- `prisma/schema.prisma`
- Prisma provider: يبقى `postgresql`.
- `DATABASE_URL` ومصدر قاعدة الإنتاج.
- `package.json` وسكربت البناء.
- `scripts/assert-production-db.mjs`.
- `next.config.ts`.

لا تحتوي الحزمة على `prisma db push` أو migrate أو reset، ولا تحتاج إلى ترحيل قاعدة بيانات.

## محتويات التسليم

- المشروع الكامل المعدل.
- `TVM-03-04-05.patch`.
- `TVM-03-04-05.diff`.
- `AGENT-PROMPT-AR.md`.
- `APPLY-COMMANDS.sh`.
- `ROLLBACK.sh`.
- `WHAT-CHANGED-AR.md`.
- `EXPECTED-RESULTS-AR.md`.
- `VERIFICATION-REPORT.md`.
- `BASELINE-SHA256.txt`.
- `FILES-CHANGED.txt`.

## التطبيق

الطريقة الأكثر أماناً هي تطبيق الباتش على نسخة نظيفة من النسخة الأم:

```bash
chmod +x delivery/APPLY-COMMANDS.sh
./delivery/APPLY-COMMANDS.sh /path/to/clean/TvTime-main
```

السكربت:

1. يتحقق من بصمات ملفات قاعدة البيانات والبناء المحمية.
2. يتأكد أن الباتش قابل للتطبيق قبل تغيير أي ملف.
3. يطبق الباتش فقط على كود المشروع.
4. يعيد فحص البصمات.
5. يشغل اختبارات المحرك والفاحص الثابت.
6. يشغل `npm install` ثم lint وbuild عند توفر الشبكة والاعتماديات.

## ملاحظة مهمة

لا تستبدل `DATABASE_URL` ولا تنشئ قاعدة جديدة. استعمل نفس إعدادات PostgreSQL الحالية في Vercel/الإنتاج.
