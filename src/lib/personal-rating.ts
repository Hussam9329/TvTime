export const PERSONAL_RATING_VERSION = 1 as const;

export const PERSONAL_RATING_KEYS = [
  "storyIdea",
  "writingLogic",
  "pacing",
  "characters",
  "acting",
  "direction",
  "atmosphere",
  "impact",
  "payoff",
  "ending",
] as const;

export type PersonalRatingKey = (typeof PERSONAL_RATING_KEYS)[number];
export type PersonalRatingKind = "movie" | "series";
export type PersonalRatingCriteriaValues = Record<PersonalRatingKey, number>;
export type PersonalRatingDraft = Partial<PersonalRatingCriteriaValues>;

export type PersonalRatingBreakdown = {
  version: typeof PERSONAL_RATING_VERSION;
  kind: PersonalRatingKind;
  criteria: PersonalRatingCriteriaValues;
};

export type PersonalRatingCriterion = {
  key: PersonalRatingKey;
  title: string;
  question: string;
};

export type PersonalRatingValidation =
  | { ok: true; breakdown: PersonalRatingBreakdown; score: number }
  | { ok: false; error: string };

export const MOVIE_RATING_CRITERIA: readonly PersonalRatingCriterion[] = [
  {
    key: "storyIdea",
    title: "القصة والفكرة",
    question: "هل الفكرة قوية؟ وهل القصة تستثمرها فعلًا؟",
  },
  {
    key: "writingLogic",
    title: "الكتابة والمنطق الداخلي",
    question: "هل الأحداث مترابطة وقواعد الفيلم ثابتة، لو أكو أشياء تصير فقط لخدمة الحبكة؟",
  },
  {
    key: "pacing",
    title: "الإيقاع",
    question: "هل الفيلم مشدود، لو بيه مطّ وملل أو استعجال؟",
  },
  {
    key: "characters",
    title: "الشخصيات وتطورها",
    question: "هل الشخصيات مكتوبة بشكل مقنع وتتغير بصورة طبيعية؟",
  },
  {
    key: "acting",
    title: "التمثيل",
    question: "قوة الأداء ومدى تصديقك للشخصيات.",
  },
  {
    key: "direction",
    title: "الإخراج والتنفيذ",
    question: "طريقة السرد، اختيار اللقطات، بناء المشاهد، وإدارة التوتر.",
  },
  {
    key: "atmosphere",
    title: "الأجواء والهوية",
    question: "الموسيقى، التصوير، الإحساس العام، وهل للفيلم شخصية خاصة.",
  },
  {
    key: "impact",
    title: "الأثر العاطفي / الذهني",
    question: "هل ترك بيك شعور أو فكرة بعد النهاية، لو خلص وانتهى أثره؟",
  },
  {
    key: "payoff",
    title: "الـPayoff",
    question: "الأشياء اللي بناها الفيلم: هل دفع ثمنها بالنهاية؟ وهل الأسئلة المهمة أخذت جوابًا مرضيًا؟",
  },
  {
    key: "ending",
    title: "النهاية",
    question: "وهل هي مستحقة ومقنعة ومتناسقة مع اللي سبقها، مو مجرد صدمة أو غموض مصطنع؟",
  },
] as const;

export const SERIES_RATING_CRITERIA: readonly PersonalRatingCriterion[] = [
  {
    key: "storyIdea",
    title: "القصة والفكرة",
    question: "هل كانت الفكرة الأساسية للمسلسل قوية؟ وهل استطاع المسلسل تطويرها واستثمارها عبر الحلقات والمواسم بدل ما يفقدها أو يكرر نفسه؟",
  },
  {
    key: "writingLogic",
    title: "الكتابة والمنطق الداخلي",
    question: "هل ظلت الأحداث مترابطة وقواعد عالم المسلسل ومنطقه ثابتة عبر المواسم، لو ظهرت تناقضات أو قرارات مكتوبة فقط لخدمة الحبكة؟",
  },
  {
    key: "pacing",
    title: "الإيقاع والاستمرارية",
    question: "هل حافظ المسلسل على إيقاع جيد طوال رحلته، لو كانت هناك حلقات أو مواسم فيها مطّ، حشو، ملل أو استعجال واضح؟",
  },
  {
    key: "characters",
    title: "الشخصيات وتطورها",
    question: "هل الشخصيات الرئيسية والثانوية مكتوبة بشكل مقنع؟ وهل تطورت وتغيرت عبر الحلقات والمواسم بصورة طبيعية ومبررة؟",
  },
  {
    key: "acting",
    title: "التمثيل والكاست",
    question: "ما مدى قوة أداء الممثلين وانسجامهم مع شخصياتهم ومع بعضهم؟ وهل حافظت الشخصيات على قدرتها على إقناعك طوال المسلسل؟",
  },
  {
    key: "direction",
    title: "الإخراج والتنفيذ",
    question: "كيف كان مستوى الإخراج، طريقة السرد، بناء المشاهد، التصوير، إدارة التوتر، وتنفيذ اللحظات الكبيرة طوال مواسم المسلسل؟",
  },
  {
    key: "atmosphere",
    title: "الأجواء والهوية",
    question: "هل صنع المسلسل لنفسه أجواء وهوية مميزة من خلال الموسيقى، التصوير، العالم، الأماكن والإحساس العام؟ وهل حافظ على هذه الهوية عبر المواسم؟",
  },
  {
    key: "impact",
    title: "الأثر العاطفي / الذهني",
    question: "بعد كل الوقت الذي قضيته مع المسلسل وشخصياته، هل ترك داخلك أثرًا حقيقيًا أو مشاعر أو أفكارًا بقيت معك بعد انتهاء الرحلة؟",
  },
  {
    key: "payoff",
    title: "الـPayoff وإغلاق الخطوط",
    question: "بعد كل ما بناه المسلسل من أحداث وأسرار وعلاقات وصراعات ووعود، هل حصلت الخطوط المهمة على Payoff مرضٍ؟ وهل أجاب عن الأسئلة التي كان من المفترض أن يجيب عنها؟",
  },
  {
    key: "ending",
    title: "النهاية والرحلة الكاملة",
    question: "هل كانت نهاية المسلسل مستحقة ومقنعة ومتناسقة مع الرحلة التي سبقتها؟ وهل شعرت أن القصة وصلت فعلًا إلى المكان الصحيح بدل نهاية متسرعة أو مفتعلة أو غير مرضية؟",
  },
] as const;

export function personalRatingCriteria(kind: PersonalRatingKind): readonly PersonalRatingCriterion[] {
  return kind === "movie" ? MOVIE_RATING_CRITERIA : SERIES_RATING_CRITERIA;
}

export function personalRatingScore(criteria: PersonalRatingDraft): number {
  return PERSONAL_RATING_KEYS.reduce((total, key) => total + (criteria[key] ?? 0), 0);
}

export function completedPersonalRatingCriteria(criteria: PersonalRatingDraft): number {
  return PERSONAL_RATING_KEYS.filter((key) => criteria[key] !== undefined).length;
}

export function buildPersonalRatingBreakdown(
  kind: PersonalRatingKind,
  criteria: PersonalRatingDraft,
): PersonalRatingBreakdown | null {
  if (completedPersonalRatingCriteria(criteria) !== PERSONAL_RATING_KEYS.length) return null;
  const completeCriteria = {} as PersonalRatingCriteriaValues;
  for (const key of PERSONAL_RATING_KEYS) {
    const value = criteria[key];
    if (!Number.isInteger(value) || value! < 0 || value! > 10) return null;
    completeCriteria[key] = value!;
  }
  return { version: PERSONAL_RATING_VERSION, kind, criteria: completeCriteria };
}

export function validatePersonalRatingBreakdown(
  value: unknown,
  expectedKind?: PersonalRatingKind,
): PersonalRatingValidation {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "Rating breakdown must be an object." };
  }
  const root = value as Record<string, unknown>;
  if (root.version !== PERSONAL_RATING_VERSION) {
    return { ok: false, error: `Rating breakdown version must be ${PERSONAL_RATING_VERSION}.` };
  }
  if (root.kind !== "movie" && root.kind !== "series") {
    return { ok: false, error: "Rating breakdown kind must be movie or series." };
  }
  if (expectedKind && root.kind !== expectedKind) {
    return { ok: false, error: `Rating breakdown kind must match ${expectedKind}.` };
  }
  if (!root.criteria || typeof root.criteria !== "object" || Array.isArray(root.criteria)) {
    return { ok: false, error: "Rating breakdown criteria must be an object." };
  }

  const rawCriteria = root.criteria as Record<string, unknown>;
  const keys = Object.keys(rawCriteria);
  if (keys.length !== PERSONAL_RATING_KEYS.length || keys.some((key) => !PERSONAL_RATING_KEYS.includes(key as PersonalRatingKey))) {
    return { ok: false, error: "Rating breakdown must contain exactly the 10 supported criteria." };
  }

  const criteria = {} as PersonalRatingCriteriaValues;
  for (const key of PERSONAL_RATING_KEYS) {
    const criterion = rawCriteria[key];
    if (!Number.isInteger(criterion) || (criterion as number) < 0 || (criterion as number) > 10) {
      return { ok: false, error: `Criterion ${key} must be a whole number from 0 to 10.` };
    }
    criteria[key] = criterion as number;
  }

  const breakdown: PersonalRatingBreakdown = {
    version: PERSONAL_RATING_VERSION,
    kind: root.kind,
    criteria,
  };
  return { ok: true, breakdown, score: personalRatingScore(criteria) };
}

export function personalRatingLabel(score: number): string {
  if (score >= 90) return "Masterpiece!";
  if (score >= 80) return "Excellent";
  if (score >= 70) return "Very good";
  if (score >= 60) return "Good";
  if (score >= 40) return "Average";
  if (score >= 20) return "Poor";
  return "Very bad";
}
