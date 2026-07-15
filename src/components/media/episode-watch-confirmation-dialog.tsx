"use client";

import { AlertTriangle, CheckCheck, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { EpisodeWatchPlan } from "@/lib/episode-watch-plan";

export function EpisodeWatchConfirmationDialog({
  plan,
  open,
  pending = false,
  onOpenChange,
  onSelectedOnly,
  onWithPrevious,
}: {
  plan: EpisodeWatchPlan | null;
  open: boolean;
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectedOnly: () => void | Promise<void>;
  onWithPrevious: () => void | Promise<void>;
}) {
  if (!plan) return null;

  const previousLabel = plan.previousUnwatched.length === 1
    ? "1 earlier released episode is still unwatched"
    : `${plan.previousUnwatched.length} earlier released episodes are still unwatched`;
  const seasonContext = plan.previousSeasonCount > 0
    ? ` across ${plan.previousSeasonCount} season${plan.previousSeasonCount === 1 ? "" : "s"}`
    : "";
  const selectedLabel = plan.kind === "episode"
    ? `Only ${plan.targetLabel}`
    : `Only ${plan.targetLabel}`;
  const allLabel = plan.kind === "episode"
    ? `Previous + ${plan.targetLabel}`
    : `Previous seasons + ${plan.targetLabel}`;

  return (
    <AlertDialog open={open} onOpenChange={pending ? undefined : onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            Earlier episodes are not watched
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 text-left">
            <span className="block">
              You are marking <strong className="text-foreground">{plan.targetLabel}</strong> as watched, but {previousLabel}{seasonContext}.
            </span>
            <span className="block rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-relaxed">
              Choose exactly what should change. Nothing earlier will be marked unless you select the option that includes previous episodes.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:grid sm:grid-cols-3">
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button variant="outline" disabled={pending} onClick={() => void onSelectedOnly()}>
            <ListChecks className="mr-2 h-4 w-4" /> {selectedLabel}
          </Button>
          <Button disabled={pending} onClick={() => void onWithPrevious()}>
            <CheckCheck className="mr-2 h-4 w-4" /> {allLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
