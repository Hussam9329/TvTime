"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Hash, ListChecks, Star, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { SafeImage } from "@/components/media/safe-image";
import { useWatchUndo } from "@/hooks/use-watch-undo";
import styles from "./structured-rating-dialog.module.css";
import {
  buildPersonalRatingBreakdown,
  completedPersonalRatingCriteria,
  isDirectPersonalRating,
  personalRatingCriteria,
  personalRatingLabel,
  personalRatingScore,
  validatePersonalRatingBreakdown,
  type PersonalRatingBreakdown,
  type PersonalRatingDraft,
  type PersonalRatingKey,
  type PersonalRatingKind,
} from "@/lib/personal-rating";

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
  submitLabel = (score) => `Save Rating · ${score}/100`,
  successMessage = (score) => `Rated ${score}/100`,
}: StructuredRatingDialogProps) {
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
  const scoreTone = mode === "direct" && !directValid ? "empty" : score >= 80 ? "high" : score >= 60 ? "good" : score >= 40 ? "average" : "low";
  const invalidDirectInput = directInput !== "" && !directValid;

  const setCriterion = (key: PersonalRatingKey, value: number) => {
    const normalized = Math.max(0, Math.min(10, Math.round(value)));
    setDraft((current) => ({ ...current, [key]: normalized }));
  };

  const handleSubmit = async () => {
    if (submitting) return;
    const breakdown = mode === "criteria" ? buildPersonalRatingBreakdown(kind, draft) : null;
    if (mode === "direct" ? !directValid : !breakdown) {
      toast.error(mode === "direct" ? "Enter a whole-number rating from 0 to 100." : "Complete all 10 rating criteria before saving.");
      return;
    }
    const finalScore = breakdown ? personalRatingScore(breakdown.criteria) : score;
    setSubmitting(true);
    try {
      const result = await onRate({ score: finalScore, breakdown });
      showWatchUndo(successMessage(finalScore), result as { undoToken?: string | null } | null | undefined);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save rating");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!submitting) onOpenChange(next); }}>
      <DialogContent
        className={`tvtime-structured-rating-dialog ${styles.dialog}`}
        dir="rtl"
        data-rating-mode={mode}
        data-score-tone={scoreTone}
        showCloseButton={false}
      >
        <div className={styles.header}>
          <div className={styles.poster}>
            {poster ? <SafeImage src={poster} alt="" fill variant="poster" /> : <Star aria-hidden="true" />}
          </div>
          <div className={styles.heading}>
            <p className={styles.eyebrow}>{kind === "movie" ? "تقييم الفيلم" : "تقييم المسلسل"}</p>
            <DialogTitle className={styles.title} dir="auto">{title}</DialogTitle>
          </div>
          <DialogClose asChild>
            <button type="button" className={styles.close} disabled={submitting} aria-label="إغلاق نافذة التقييم">
              <X aria-hidden="true" />
            </button>
          </DialogClose>
        </div>

        <div className={styles.methodArea}>
          <div role="group" aria-label="طريقة التقييم" className={styles.methods}>
            <button type="button" className={styles.method} aria-pressed={mode === "direct"} disabled={submitting} onClick={() => setMode("direct")}>
              <Hash aria-hidden="true" />
              <span><strong>تقييم مباشر</strong><small>درجة من 100</small></span>
            </button>
            <button type="button" className={styles.method} aria-pressed={mode === "criteria"} disabled={submitting} onClick={() => setMode("criteria")}>
              <ListChecks aria-hidden="true" />
              <span><strong>تقييم تفصيلي</strong><small>الأسئلة العشرة</small></span>
            </button>
          </div>
        </div>

        <div className={styles.body}>
          <DialogDescription className={styles.description}>
            {description ?? "اختر التقييم المباشر أو قيّم كل سؤال من 10."}
          </DialogDescription>
          {mode === "direct" ? (
            <section className={styles.direct} aria-labelledby={`${directInputId}-label`}>
              <label id={`${directInputId}-label`} htmlFor={directInputId} className={styles.inputLabel}>تقييمك من 100</label>
              <div className={styles.scoreInput} dir="ltr">
                <input
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
              <p className={styles.ratingLabel} aria-live="polite">{directValid ? personalRatingLabel(score) : "اختر الدرجة المناسبة"}</p>
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
                  aria-label="التقييم المباشر من 0 إلى 100"
                  className={styles.slider}
                />
                <div className={styles.scale} aria-hidden="true"><span>0</span><span>50</span><span>100</span></div>
              </div>
              <p id={`${directInputId}-hint`} className={styles.hint} data-error={invalidDirectInput}>
                {invalidDirectInput ? "أدخل رقمًا صحيحًا من 0 إلى 100." : "اكتب الدرجة أو حرّك المؤشر."}
              </p>
            </section>
          ) : (
            <div className={styles.criteria}>
              {!hasStructuredInitial && legacyInitialRating != null && (
                <p className={styles.previousRating}>تقييمك الحالي <bdi>{legacyInitialRating}/100</bdi>. أكمل الأسئلة لتحديثه.</p>
              )}
              {criteriaDefinitions.map((criterion, index) => {
                const value = draft[criterion.key];
                const rated = value !== undefined;
                const criterionId = `${directInputId}-${criterion.key}`;
                return (
                  <section key={criterion.key} className={styles.criterion} data-rated={rated} aria-labelledby={criterionId}>
                    <div className={styles.criterionHeader}>
                      <span className={styles.criterionNumber} aria-hidden="true">{index + 1}</span>
                      <h3 id={criterionId}>{criterion.title}</h3>
                      <span className={styles.criterionScore} dir="ltr">{rated ? value : "—"}<small>/10</small></span>
                    </div>
                    <p className={styles.question}>{criterion.question}</p>
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
                        aria-label={`${criterion.title}: rating from 0 to 10`}
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
                <span>{complete ? "اكتمل تقييمك" : `${completedCount} من 10 أسئلة مكتملة`}</span>
                <progress value={completedCount} max={10} aria-label="الأسئلة المكتملة" />
              </div>
              <div className={styles.total}>
                <span>المجموع</span>
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
              aria-label={complete ? submitLabel(score) : mode === "direct" ? "أدخل تقييمك من 100" : `Complete all criteria · ${completedCount}/10`}
            >
              {submitting ? "جارٍ الحفظ…" : "حفظ التقييم"}
            </Button>
            <Button type="button" variant="outline" className={styles.cancel} disabled={submitting} onClick={() => onOpenChange(false)}>إلغاء</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
