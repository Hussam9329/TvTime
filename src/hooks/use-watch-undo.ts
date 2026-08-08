"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { userHeaders, withUserId } from "@/lib/client-user";

export type WatchUndoResult = { undoToken?: string | null } | null | undefined;

let activeWatchUndoToast: string | number | null = null;

export function useWatchUndo() {
  const queryClient = useQueryClient();

  return useCallback((message: string, result?: WatchUndoResult) => {
    const token = result?.undoToken;
    if (!token) {
      toast.success(message);
      return;
    }

    if (activeWatchUndoToast !== null) toast.dismiss(activeWatchUndoToast);
    let used = false;
    const toastId = toast.success(message, {
      duration: 5_000,
      action: {
        label: "Undo",
        onClick: () => {
          if (used) return;
          used = true;
          toast.dismiss(toastId);
          activeWatchUndoToast = null;
          void (async () => {
            const loading = toast.loading("Undoing watch change…");
            try {
              const response = await fetch(withUserId(new URL("/api/library/watch-undo", window.location.origin)), {
                method: "POST",
                headers: { "Content-Type": "application/json", ...userHeaders() },
                body: JSON.stringify({ token }),
              });
              const payload = await response.json().catch(() => ({}));
              if (!response.ok) throw new Error(payload?.error || "Failed to undo watch change");
              await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["media"] }),
                queryClient.invalidateQueries({ queryKey: ["library-counts"] }),
                queryClient.invalidateQueries({ queryKey: ["lib"] }),
                queryClient.invalidateQueries({ queryKey: ["tv-tracking"] }),
                queryClient.invalidateQueries({ queryKey: ["tv-tracking-counts"] }),
                queryClient.invalidateQueries({ queryKey: ["episode-watch-plan"] }),
                queryClient.invalidateQueries({ queryKey: ["watch-next"] }),
                queryClient.invalidateQueries({ queryKey: ["movie-hub"] }),
                queryClient.invalidateQueries({ queryKey: ["notifications"] }),
              ]);
              toast.success("Watch change undone", { id: loading });
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Failed to undo watch change", { id: loading });
            }
          })();
        },
      },
      onDismiss: () => {
        if (activeWatchUndoToast === toastId) activeWatchUndoToast = null;
      },
      onAutoClose: () => {
        if (activeWatchUndoToast === toastId) activeWatchUndoToast = null;
      },
    });
    activeWatchUndoToast = toastId;
  }, [queryClient]);
}
