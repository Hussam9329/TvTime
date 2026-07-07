"use client";

import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useStats } from "@/hooks/use-tmdb";
import { useNav } from "@/lib/store";
import { useQueryClient } from "@tanstack/react-query";
import { libStorage } from "@/lib/local-storage";
import { Settings, User, Trash2, AlertTriangle, Loader2, Check, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function ProfileDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { userId, userName, setUserName } = useNav();
  const stats = useStats();
  const qc = useQueryClient();
  const [name, setName] = useState(userName);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(userName);
  }, [userName, open]);

  const onSaveName = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/user?userId=${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Failed");
      setUserName(name);
      toast.success("Profile updated");
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const onClearData = async () => {
    setClearing(true);
    try {
      libStorage.clearAll();
      qc.invalidateQueries({ queryKey: ["lib"] });
      toast.success("All library data cleared");
      onOpenChange(false);
    } catch {
      toast.error("Failed to clear data");
    } finally {
      setClearing(false);
    }
  };

  const onExport = async () => {
    setExporting(true);
    try {
      const data = libStorage.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cinetrack-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Library exported");
    } catch {
      toast.error("Failed to export data");
    } finally {
      setExporting(false);
    }
  };

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const result = libStorage.importAll(data);
      qc.invalidateQueries({ queryKey: ["lib"] });
      const total = result.watchlist + result.watchedMovies + result.watchedEpisodes + result.following + result.ratings;
      toast.success(`Imported ${total} items`);
      onOpenChange(false);
    } catch {
      toast.error("Failed to import. Check the file format.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const counts = stats.data?.counts;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" /> Profile & Settings
          </DialogTitle>
          <DialogDescription>Manage your account and library data</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Avatar + name */}
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16 border-2 border-primary/40">
              <AvatarFallback className="bg-primary/15 text-primary text-lg font-bold">
                {(name || "C").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <Label htmlFor="name" className="text-xs text-muted-foreground">Display name</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-9"
                  maxLength={30}
                />
                <Button size="sm" className="h-9" onClick={onSaveName} disabled={saving || name === userName || !name.trim()}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Account info */}
          <div className="rounded-lg bg-muted/40 p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> User ID</span>
              <code className="text-xs font-mono text-foreground/70">{userId.slice(0, 16)}...</code>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Member since</span>
              <span className="text-xs">{stats.data?.user?.createdAt ? new Date(stats.data.user.createdAt).toLocaleDateString() : "—"}</span>
            </div>
          </div>

          {/* Library stats summary */}
          {counts && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Your library</p>
              <div className="grid grid-cols-2 gap-2">
                <StatBox label="Watchlist" value={counts.watchlist} />
                <StatBox label="Watched movies" value={counts.watchedMovies} />
                <StatBox label="Following" value={counts.following} />
                <StatBox label="Ratings" value={counts.ratings} />
              </div>
            </div>
          )}

          {/* Backup & restore */}
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
            <div className="flex items-start gap-2 mb-2">
              <Download className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">Backup & Restore</p>
                <p className="text-xs text-muted-foreground">Export your library to a JSON file or import a backup.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={onExport} disabled={exporting}>
                {exporting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
                Export
              </Button>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing}>
                {importing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                Import
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={onImport}
              className="hidden"
            />
          </div>

          {/* Danger zone */}
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <div className="flex items-start gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-destructive">Danger zone</p>
                <p className="text-xs text-muted-foreground">Clear all your library data. This cannot be undone.</p>
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="w-full" disabled={clearing}>
                  {clearing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
                  Clear all data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all library data?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete your watchlist, watched movies, watched episodes, followed shows, and ratings. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onClearData} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Yes, clear everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-card border border-border/40 p-2.5">
      <p className="text-lg font-bold text-primary">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
