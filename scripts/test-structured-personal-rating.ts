import assert from "node:assert/strict";
import {
  MOVIE_RATING_CRITERIA,
  PERSONAL_RATING_KEYS,
  SERIES_RATING_CRITERIA,
  buildPersonalRatingBreakdown,
  personalRatingScore,
  validatePersonalRatingBreakdown,
  type PersonalRatingCriteriaValues,
} from "../src/lib/personal-rating.ts";

function values(list: number[]): PersonalRatingCriteriaValues {
  assert.equal(list.length, PERSONAL_RATING_KEYS.length);
  return Object.fromEntries(PERSONAL_RATING_KEYS.map((key, index) => [key, list[index]])) as PersonalRatingCriteriaValues;
}

const perfect = buildPersonalRatingBreakdown("movie", values(Array(10).fill(10)));
assert.ok(perfect);
assert.equal(personalRatingScore(perfect.criteria), 100);
assert.deepEqual(validatePersonalRatingBreakdown(perfect, "movie"), { ok: true, breakdown: perfect, score: 100 });

const zero = buildPersonalRatingBreakdown("series", values(Array(10).fill(0)));
assert.ok(zero);
assert.equal(personalRatingScore(zero.criteria), 0);

const mixed = buildPersonalRatingBreakdown("movie", values([9, 8, 7, 6, 5, 4, 3, 2, 1, 0]));
assert.ok(mixed);
assert.equal(personalRatingScore(mixed.criteria), 45);

assert.equal(buildPersonalRatingBreakdown("movie", { storyIdea: 10 }), null, "Incomplete draft must not be savable");

for (const invalidValue of [11, -1, 5.5]) {
  const invalid = {
    version: 1,
    kind: "movie",
    criteria: { ...values(Array(10).fill(7)), storyIdea: invalidValue },
  };
  assert.equal(validatePersonalRatingBreakdown(invalid, "movie").ok, false, `Invalid criterion ${invalidValue} must be rejected`);
}

const extra = {
  version: 1,
  kind: "movie",
  criteria: { ...values(Array(10).fill(7)), surpriseBonus: 10 },
};
assert.equal(validatePersonalRatingBreakdown(extra, "movie").ok, false, "Unknown criteria must be rejected");
assert.equal(validatePersonalRatingBreakdown(perfect, "series").ok, false, "Movie breakdown cannot rate a series");


const expectedMovieCopy = [
  ["القصة والفكرة", "هل الفكرة قوية؟ وهل القصة تستثمرها فعلًا؟"],
  ["الكتابة والمنطق الداخلي", "هل الأحداث مترابطة وقواعد الفيلم ثابتة، لو أكو أشياء تصير فقط لخدمة الحبكة؟"],
  ["الإيقاع", "هل الفيلم مشدود، لو بيه مطّ وملل أو استعجال؟"],
  ["الشخصيات وتطورها", "هل الشخصيات مكتوبة بشكل مقنع وتتغير بصورة طبيعية؟"],
  ["التمثيل", "قوة الأداء ومدى تصديقك للشخصيات."],
  ["الإخراج والتنفيذ", "طريقة السرد، اختيار اللقطات، بناء المشاهد، وإدارة التوتر."],
  ["الأجواء والهوية", "الموسيقى، التصوير، الإحساس العام، وهل للفيلم شخصية خاصة."],
  ["الأثر العاطفي / الذهني", "هل ترك بيك شعور أو فكرة بعد النهاية، لو خلص وانتهى أثره؟"],
  ["الـPayoff", "الأشياء اللي بناها الفيلم: هل دفع ثمنها بالنهاية؟ وهل الأسئلة المهمة أخذت جوابًا مرضيًا؟"],
  ["النهاية", "وهل هي مستحقة ومقنعة ومتناسقة مع اللي سبقها، مو مجرد صدمة أو غموض مصطنع؟"],
];

const expectedSeriesCopy = [
  ["القصة والفكرة", "هل كانت الفكرة الأساسية للمسلسل قوية؟ وهل استطاع المسلسل تطويرها واستثمارها عبر الحلقات والمواسم بدل ما يفقدها أو يكرر نفسه؟"],
  ["الكتابة والمنطق الداخلي", "هل ظلت الأحداث مترابطة وقواعد عالم المسلسل ومنطقه ثابتة عبر المواسم، لو ظهرت تناقضات أو قرارات مكتوبة فقط لخدمة الحبكة؟"],
  ["الإيقاع والاستمرارية", "هل حافظ المسلسل على إيقاع جيد طوال رحلته، لو كانت هناك حلقات أو مواسم فيها مطّ، حشو، ملل أو استعجال واضح؟"],
  ["الشخصيات وتطورها", "هل الشخصيات الرئيسية والثانوية مكتوبة بشكل مقنع؟ وهل تطورت وتغيرت عبر الحلقات والمواسم بصورة طبيعية ومبررة؟"],
  ["التمثيل والكاست", "ما مدى قوة أداء الممثلين وانسجامهم مع شخصياتهم ومع بعضهم؟ وهل حافظت الشخصيات على قدرتها على إقناعك طوال المسلسل؟"],
  ["الإخراج والتنفيذ", "كيف كان مستوى الإخراج، طريقة السرد، بناء المشاهد، التصوير، إدارة التوتر، وتنفيذ اللحظات الكبيرة طوال مواسم المسلسل؟"],
  ["الأجواء والهوية", "هل صنع المسلسل لنفسه أجواء وهوية مميزة من خلال الموسيقى، التصوير، العالم، الأماكن والإحساس العام؟ وهل حافظ على هذه الهوية عبر المواسم؟"],
  ["الأثر العاطفي / الذهني", "بعد كل الوقت الذي قضيته مع المسلسل وشخصياته، هل ترك داخلك أثرًا حقيقيًا أو مشاعر أو أفكارًا بقيت معك بعد انتهاء الرحلة؟"],
  ["الـPayoff وإغلاق الخطوط", "بعد كل ما بناه المسلسل من أحداث وأسرار وعلاقات وصراعات ووعود، هل حصلت الخطوط المهمة على Payoff مرضٍ؟ وهل أجاب عن الأسئلة التي كان من المفترض أن يجيب عنها؟"],
  ["النهاية والرحلة الكاملة", "هل كانت نهاية المسلسل مستحقة ومقنعة ومتناسقة مع الرحلة التي سبقتها؟ وهل شعرت أن القصة وصلت فعلًا إلى المكان الصحيح بدل نهاية متسرعة أو مفتعلة أو غير مرضية؟"],
];

assert.deepEqual(MOVIE_RATING_CRITERIA.map(({ title, question }) => [title, question]), expectedMovieCopy, "Movie copy must remain full and exact");
assert.deepEqual(SERIES_RATING_CRITERIA.map(({ title, question }) => [title, question]), expectedSeriesCopy, "Series copy must remain full and exact");

assert.equal(MOVIE_RATING_CRITERIA.length, 10);
assert.equal(SERIES_RATING_CRITERIA.length, 10);
assert.deepEqual(MOVIE_RATING_CRITERIA.map((criterion) => criterion.key), [...PERSONAL_RATING_KEYS]);
assert.deepEqual(SERIES_RATING_CRITERIA.map((criterion) => criterion.key), [...PERSONAL_RATING_KEYS]);

for (const criterion of MOVIE_RATING_CRITERIA) {
  assert.ok(criterion.title.trim().length > 0);
  assert.ok(criterion.question.trim().length >= 25, `Movie ${criterion.key} question should remain fully explanatory`);
}
for (const criterion of SERIES_RATING_CRITERIA) {
  assert.ok(criterion.title.trim().length > 0);
  assert.ok(criterion.question.trim().length >= 60, `Series ${criterion.key} question should remain journey-specific and explanatory`);
}

assert.notEqual(
  MOVIE_RATING_CRITERIA.find((criterion) => criterion.key === "pacing")?.question,
  SERIES_RATING_CRITERIA.find((criterion) => criterion.key === "pacing")?.question,
  "Series questions must be tailored instead of reusing movie wording",
);

console.log("Structured personal rating domain tests passed.");
