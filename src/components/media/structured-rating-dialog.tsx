"use client";

import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { Hash, ListChecks, Star, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { SafeImage } from "@/components/media/safe-image";
import { useWatchUndo } from "@/hooks/use-watch-undo";
import { ratingTone } from "@/lib/rating-tone";
import styles from "./structured-rating-dialog.module.css";
import {
  buildPersonalRatingBreakdown,
  completedPersonalRatingCriteria,
  isDirectPersonalRating,
  personalRatingCriteria,
  personalRatingScore,
  validatePersonalRatingBreakdown,
  type PersonalRatingBreakdown,
  type PersonalRatingDraft,
  type PersonalRatingKey,
  type PersonalRatingKind,
} from "@/lib/personal-rating";

export type StructuredRatingLocale = "en" | "ar";

type CriterionCopy = { title: string; question: string };

/**
 * English wording for the ten criteria. The Arabic wording lives with the
 * criteria definitions in personal-rating.ts and is used as-is for "ar".
 */
const ENGLISH_CRITERIA: Record<PersonalRatingKind, Record<PersonalRatingKey, CriterionCopy>> = {
  movie: {
    storyIdea: { title: "Story & idea", question: "Is the idea strong, and does the story actually make the most of it?" },
    writingLogic: { title: "Writing & internal logic", question: "Do the events connect and do the film’s rules hold, or do things happen just to serve the plot?" },
    pacing: { title: "Pacing", question: "Is the film tight, or does it drag, feel padded or rush?" },
    characters: { title: "Characters & development", question: "Are the characters convincingly written, and do they change naturally?" },
    acting: { title: "Acting", question: "The strength of the performances and how believable the characters feel." },
    direction: { title: "Direction & execution", question: "Storytelling, shot choices, scene construction and handling of tension." },
    atmosphere: { title: "Atmosphere & identity", question: "Music, cinematography, overall feel, and whether the film has a personality of its own." },
    impact: { title: "Emotional / intellectual impact", question: "Did it leave you with a feeling or an idea after the ending, or was it gone once it finished?" },
    payoff: { title: "Payoff", question: "Did the film pay off what it set up, and did the important questions get satisfying answers?" },
    ending: { title: "Ending", question: "Is the ending earned, convincing and consistent with what came before — not just a shock or artificial ambiguity?" },
  },
  series: {
    storyIdea: { title: "Story & idea", question: "Was the show’s core idea strong, and did it develop it across episodes and seasons instead of losing it or repeating itself?" },
    writingLogic: { title: "Writing & internal logic", question: "Did events stay connected and the world’s rules stay consistent across seasons, or were there contradictions and decisions written only to serve the plot?" },
    pacing: { title: "Pacing & consistency", question: "Did the show keep a good pace throughout, or were there episodes or seasons with obvious stretching, filler, boredom or rushing?" },
    characters: { title: "Characters & development", question: "Are the main and supporting characters convincingly written, and did they grow and change naturally across episodes and seasons?" },
    acting: { title: "Acting & cast", question: "How strong were the performances and the chemistry of the cast, and did the characters stay convincing for the whole show?" },
    direction: { title: "Direction & execution", question: "How were the direction, storytelling, scene construction, cinematography, tension and big moments across the seasons?" },
    atmosphere: { title: "Atmosphere & identity", question: "Did the show build a distinctive atmosphere and identity through its music, cinematography, world, locations and overall feel — and keep it across seasons?" },
    impact: { title: "Emotional / intellectual impact", question: "After all the time spent with the show and its characters, did it leave a real impression, feelings or ideas that stayed with you after the journey ended?" },
    payoff: { title: "Payoff & closing threads", question: "After everything it built — events, secrets, relationships, conflicts and promises — did the important threads get a satisfying payoff, and did it answer the questions it should have?" },
    ending: { title: "Ending & the full journey", question: "Was the ending earned, convincing and consistent with the journey before it — did the story land in the right place rather than a rushed, forced or unsatisfying finish?" },
  },
};

const COPY = {
  en: {
    eyebrow: (kind: PersonalRatingKind) => (kind === "movie" ? "Rate movie" : "Rate series"),
    close: "Close rating dialog",
    methodGroup: "Rating method",
    directTitle: "Direct score",
    directHint: "Score out of 100",
    criteriaTitle: "Detailed rating",
    criteriaHint: "Ten questions",
    description: "Choose a direct score or rate each question out of 10.",
    inputLabel: "Your score out of 100",
    chooseScore: "Choose a score",
    directSlider: "Direct rating from 0 to 100",
    invalidInput: "Enter a whole number from 0 to 100.",
    inputHint: "Type a score or drag the slider.",
    previousRating: (rating: ReactNode) => <>Your current rating is {rating}. Answer the questions to update it.</>,
    criterionSlider: (title: string) => `${title}: rating from 0 to 10`,
    complete: "Rating complete",
    progress: (count: number) => `${count} of 10 questions answered`,
    progressLabel: "Questions answered",
    total: "Total",
    enterDirect: "Enter your rating out of 100",
    completeCriteria: (count: number) => `Complete all criteria · ${count}/10`,
    saving: "Saving…",
    save: "Save rating",
    cancel: "Cancel",
    invalidDirectToast: "Enter a whole-number rating from 0 to 100.",
    incompleteToast: "Complete all 10 rating criteria before saving.",
    failed: "Failed to save rating",
    submitLabel: (score: number) => `Save Rating · ${score}/100`,
    successMessage: (score: number) => `Rated ${score}/100`,
    labels: ["Masterpiece!", "Excellent", "Very good", "Good", "Average", "Poor", "Very bad"],
  },
  ar: {
    eyebrow: (kind: PersonalRatingKind) => (kind === "movie" ? "تقييم الفيلم" : "تقييم المسلسل"),
    close: "إغلاق نافذة التقييم",
    methodGroup: "طريقة التقييم",
    directTitle: "تقييم مباشر",
    directHint: "درجة من 100",
    criteriaTitle: "تقييم تفصيلي",
    criteriaHint: "الأسئلة العشرة",
    description: "اختر التقييم المباشر أو قيّم كل سؤال من 10.",
    inputLabel: "تقييمك من 100",
    chooseScore: "اختر الدرجة المناسبة",
    directSlider: "التقييم المباشر من 0 إلى 100",
    invalidInput: "أدخل رقمًا صحيحًا من 0 إلى 100.",
    inputHint: "اكتب الدرجة أو حرّك المؤشر.",
    previousRating: (rating: ReactNode) => <>تقييمك الحالي {rating}. أكمل الأسئلة لتحديثه.</>,
    criterionSlider: (title: string) => `${title}: تقييم من 0 إلى 10`,
    complete: "اكتمل تقييمك",
    progress: (count: number) => `${count} من 10 أسئلة مكتملة`,
    progressLabel: "الأسئلة المكتملة",
    total: "المجموع",
    enterDirect: "أدخل تقييمك من 100",
    completeCriteria: (count: number) => `أكمل جميع الأسئلة · ${count}/10`,
    saving: "جارٍ الحفظ…",
    save: "حفظ التقييم",
    cancel: "إلغاء",
    invalidDirectToast: "أدخل تقييمًا صحيحًا من 0 إلى 100.",
    incompleteToast: "أكمل الأسئلة العشرة قبل حفظ التقييم.",
    failed: "تعذّر حفظ التقييم",
    submitLabel: (score: number) => `حفظ التقييم · ${score}/100`,
    successMessage: (score: number) => `تم التقييم ${score}/100`,
    labels: ["تحفة!", "ممتاز", "جيد جدًا", "جيد", "متوسط", "ضعيف", "سيئ جدًا"],
  },
} as const;

function ratingLabelIndex(score: number): number {
  if (score >= 90) return 0;
  if (score >= 80) return 1;
  if (score >= 70) return 2;
  if (score >= 60) return 3;
  if (score >= 40) return 4;
  if (score >= 20) return 5;
  return 6;
}

export type StructuredRatingResult = {
  score: number;
  breakdown: PersonalRatingBreakdown | null;
};

interface StructuredRatingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  poster: string | null;
  kind: PersonalRatingKind;
  onRate: (result: StructuredRatingResult) => Promise<unknown> | unknown;
  initialBreakdown?: unknown;
  legacyInitialRating?: number | null;
  description?: string;
  submitLabel?: (score: number) => string;
  successMessage?: (score: number) => string;
  /** Copy language and text direction. Defaults to English; Arabic titles pass "ar". */
  locale?: StructuredRatingLocale;
}

function draftFromBreakdown(value: unknown, kind: PersonalRatingKind): PersonalRatingDraft {
  const validation = validatePersonalRatingBreakdown(value, kind);
  return validation.ok ? { ...validation.breakdown.criteria } : {};
}

export function StructuredRatingDialog({
  open,
  onOpenChange,
  title,
  poster,
  kind,
  onRate,
  initialBreakdown,
  legacyInitialRating = null,
  description,
  submitLabel,
  successMessage,
  locale = "en",
}: StructuredRatingDialogProps) {
  const copy = COPY[locale];
  const isArabic = locale === "ar";
  const resolveSubmitLabel = submitLabel ?? copy.submitLabel;
  const resolveSuccessMessage = successMessage ?? copy.successMessage;
  const criteriaDefinitions = useMemo(() => personalRatingCriteria(kind), [kind]);
  const [draft, setDraft] = useState<PersonalRatingDraft>(() => draftFromBreakdown(initialBreakdown, kind));
  const [mode, setMode] = useState<"direct" | "criteria">(() => validatePersonalRatingBreakdown(initialBreakdown, kind).ok ? "criteria" : "direct");
  const [directInput, setDirectInput] = useState(() => isDirectPersonalRating(legacyInitialRating) ? String(legacyInitialRating) : "");
  const [submitting, setSubmitting] = useState(false);
  const directInputId = useId();
  const showWatchUndo = useWatchUndo();

  useEffect(() => {
    if (!open) return;
    setDraft(draftFromBreakdown(initialBreakdown, kind));
    const initial = validatePersonalRatingBreakdown(initialBreakdown, kind);
    setMode(initial.ok ? "criteria" : "direct");
    setDirectInput(initial.ok ? String(initial.score) : isDirectPersonalRating(legacyInitialRating) ? String(legacyInitialRating) : "");
  }, [open, initialBreakdown, kind, legacyInitialRating]);

  const completedCount = completedPersonalRatingCriteria(draft);
  const directScore = directInput.trim() === "" ? null : Number(directInput);
  const directValid = isDirectPersonalRating(directScore);
  const score = mode === "direct" ? (directValid ? directScore : 0) : personalRatingScore(draft);
  const complete = mode === "direct" ? directValid : completedCount === criteriaDefinitions.length;
  const displayScore = mode === "direct" && !directValid ? "—" : score;
  const hasStructuredInitial = validatePersonalRatingBreakdown(initialBreakdown, kind).ok;
  const scoreTone = mode === "direct" && !directValid ? "empty" : ratingTone(score);
  const invalidDirectInput = directInput !== "" && !directValid;

  const setCriterion = (key: PersonalRatingKey, value: number) => {
    const normalized = Math.max(0, Math.min(10, Math.round(value)));
    setDraft((current) => ({ ...current, [key]: normalized }));
  };

  const handleSubmit = async () => {
    if (submitting) return;
    const breakdown = mode === "criteria" ? buildPersonalRatingBreakdown(kind, draft) : null;
    if (mode === "direct" ? !directValid : !breakdown) {
      toast.error(mode === "direct" ? copy.invalidDirectToast : copy.incompleteToast);
      return;
    }
    const finalScore = breakdown ? personalRatingScore(breakdown.criteria) : score;
    setSubmitting(true);
    try {
      const result = await onRate({ score: finalScore, breakdown });
      showWatchUndo(resolveSuccessMessage(finalScore), result as { undoToken?: string | null } | null | undefined);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.failed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!submitting) onOpenChange(next); }}>
      <DialogContent
        className={`tvtime-structured-rating-dialog ${styles.dialog}`}
        dir={isArabic ? "rtl" : "ltr"}
        lang={locale}
        style={{ textAlign: "start" }}
        data-rating-mode={mode}
        data-score-tone={scoreTone}
        showCloseButton={false}
      >
        <div className={styles.header}>
          <div className={styles.poster}>
            {poster ? <SafeImage src={poster} alt="" fill variant="poster" /> : <Star aria-hidden="true" />}
          </div>
          <div className={styles.heading}>
            <p className={styles.eyebrow}>{copy.eyebrow(kind)}</p>
            <DialogTitle className={styles.title} dir="auto">{title}</DialogTitle>
          </div>
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="icon" className={styles.close} disabled={submitting} aria-label={copy.close}>
              <X aria-hidden="true" />
            </Button>
          </DialogClose>
        </div>

        <div className={styles.methodArea}>
          <div role="group" aria-label={copy.methodGroup} className={styles.methods}>
            <button type="button" className={styles.method} style={{ textAlign: "start" }} aria-pressed={mode === "direct"} disabled={submitting} onClick={() => setMode("direct")}>
              <Hash aria-hidden="true" />
              <span><strong>{copy.directTitle}</strong><small>{copy.directHint}</small></span>
            </button>
            <button type="button" className={styles.method} style={{ textAlign: "start" }} aria-pressed={mode === "criteria"} disabled={submitting} onClick={() => setMode("criteria")}>
              <ListChecks aria-hidden="true" />
              <span><strong>{copy.criteriaTitle}</strong><small>{copy.criteriaHint}</small></span>
            </button>
          </div>
        </div>

        <div className={styles.body}>
          <DialogDescription className={styles.description} style={{ textAlign: "start" }}>
            {description ?? copy.description}
          </DialogDescription>
          {mode === "direct" ? (
            <section className={styles.direct} aria-labelledby={`${directInputId}-label`}>
              <label id={`${directInputId}-label`} htmlFor={directInputId} className={styles.inputLabel}>{copy.inputLabel}</label>
              <div className={styles.scoreInput} dir="ltr">
                <Input
                  id={directInputId}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  step={1}
                  placeholder="—"
                  value={directInput}
                  onChange={(event) => setDirectInput(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void handleSubmit(); } }}
                  disabled={submitting}
                  aria-invalid={invalidDirectInput}
                  aria-describedby={`${directInputId}-hint`}
                  className={styles.numberInput}
                />
                <span className={styles.denominator}>/100</span>
              </div>
              <p className={styles.ratingLabel} aria-live="polite">{directValid ? copy.labels[ratingLabelIndex(score)] : copy.chooseScore}</p>
              <div className={styles.directSlider} dir="ltr">
                <Slider
                  value={[directValid ? directScore : 0]}
                  min={0}
                  max={100}
                  step={1}
                  disabled={submitting}
                  onPointerDown={() => { if (!directValid) setDirectInput("0"); }}
                  onKeyDown={(event) => { if (!directValid && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(event.key)) setDirectInput("0"); }}
                  onValueChange={(next) => setDirectInput(String(next[0] ?? 0))}
                  aria-label={copy.directSlider}
                  className={styles.slider}
                />
                <div className={styles.scale} aria-hidden="true"><span>0</span><span>50</span><span>100</span></div>
              </div>
              <p id={`${directInputId}-hint`} className={styles.hint} data-error={invalidDirectInput}>
                {invalidDirectInput ? copy.invalidInput : copy.inputHint}
              </p>
            </section>
          ) : (
            <div className={styles.criteria}>
              {!hasStructuredInitial && legacyInitialRating != null && (
                <p className={styles.previousRating}>{copy.previousRating(<bdi>{legacyInitialRating}/100</bdi>)}</p>
              )}
              {criteriaDefinitions.map((criterion, index) => {
                const value = draft[criterion.key];
                const rated = value !== undefined;
                const criterionId = `${directInputId}-${criterion.key}`;
                const englishCriterion = isArabic ? null : ENGLISH_CRITERIA[kind][criterion.key];
                const criterionTitle = englishCriterion?.title ?? criterion.title;
                const criterionQuestion = englishCriterion?.question ?? criterion.question;
                return (
                  <section key={criterion.key} className={styles.criterion} data-rated={rated} aria-labelledby={criterionId}>
                    <div className={styles.criterionHeader}>
                      <span className={styles.criterionNumber} aria-hidden="true">{index + 1}</span>
                      <h3 id={criterionId}>{criterionTitle}</h3>
                      <span className={styles.criterionScore} dir="ltr">{rated ? value : "—"}<small>/10</small></span>
                    </div>
                    <p className={styles.question}>{criterionQuestion}</p>
                    <div className={styles.criterionControl} dir="ltr">
                      <Slider
                        value={[value ?? 0]}
                        min={0}
                        max={10}
                        step={1}
                        disabled={submitting}
                        onPointerDown={() => { if (!rated) setCriterion(criterion.key, 0); }}
                        onKeyDown={(event) => {
                          if (!rated && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(event.key)) setCriterion(criterion.key, 0);
                        }}
                        onValueChange={(next) => setCriterion(criterion.key, next[0] ?? 0)}
                        aria-label={copy.criterionSlider(criterionTitle)}
                        className={styles.slider}
                      />
                      <div className={styles.scale} aria-hidden="true"><span>0</span><span>5</span><span>10</span></div>
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          {mode === "criteria" && (
            <div className={styles.summary} aria-live="polite">
              <div className={styles.progress}>
                <span>{complete ? copy.complete : copy.progress(completedCount)}</span>
                <progress value={completedCount} max={10} aria-label={copy.progressLabel} />
              </div>
              <div className={styles.total} style={{ textAlign: "end" }}>
                <span>{copy.total}</span>
                <strong dir="ltr">{displayScore}<small>/100</small></strong>
              </div>
            </div>
          )}
          <div className={styles.actions}>
            <Button
              type="button"
              className={styles.save}
              onClick={handleSubmit}
              disabled={!complete || submitting}
              aria-busy={submitting}
              aria-label={complete ? resolveSubmitLabel(score) : mode === "direct" ? copy.enterDirect : copy.completeCriteria(completedCount)}
            >
              {submitting ? copy.saving : complete ? resolveSubmitLabel(score) : copy.save}
            </Button>
            <Button type="button" variant="outline" className={styles.cancel} disabled={submitting} onClick={() => onOpenChange(false)}>{copy.cancel}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
