"use client";

import { useState } from "react";
import { ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SafeImage } from "@/components/media/safe-image";
import { img } from "@/lib/tmdb";
import { userHeaders, withUserId } from "@/lib/client-user";

export function OfficialPosterPicker({ tmdbId, mediaType, title, posters }: {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  posters: Array<{ file_path?: string | null; vote_average?: number }>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const qc = useQueryClient();
  const official = [...new Map(posters.filter((p) => p.file_path).map((p) => [p.file_path!, p])).values()]
    .sort((a, b) => Number(b.vote_average || 0) - Number(a.vote_average || 0));

  const choose = async (posterPath: string) => {
    setSaving(posterPath);
    try {
      const response = await fetch(withUserId(new URL("/api/media/poster", window.location.origin)), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...userHeaders() },
        body: JSON.stringify({ tmdbId, mediaType, title, posterPath }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || "Failed to save poster");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["media-state"] }),
        qc.invalidateQueries({ queryKey: ["media"] }),
      ]);
      toast.success("Official poster saved");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save poster");
    } finally {
      setSaving(null);
    }
  };

  if (official.length === 0) return null;
  return <>
    <Button variant="outline" size="sm" onClick={() => setOpen(true)}><ImageIcon className="w-4 h-4 mr-1.5" /> Posters</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Choose official poster</DialogTitle><DialogDescription>Only official posters supplied by TMDB are shown.</DialogDescription></DialogHeader>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {official.map((poster) => <button key={poster.file_path} type="button" disabled={saving !== null} onClick={() => void choose(poster.file_path!)} className="relative aspect-[2/3] overflow-hidden rounded-lg border border-border hover:border-primary focus-visible:ring-2 focus-visible:ring-primary">
            <SafeImage src={img(poster.file_path!, "w342")} alt={`${title} official poster`} fill variant="poster" loading="lazy" />
            {saving === poster.file_path && <span className="absolute inset-0 grid place-items-center bg-black/65"><Loader2 className="animate-spin text-white" /></span>}
          </button>)}
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
