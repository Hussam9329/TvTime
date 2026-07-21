"use client";

import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStats } from "@/hooks/use-tmdb";
import { useNav } from "@/lib/store";
import { useQueryClient } from "@tanstack/react-query";
import { getClientUserId, userHeaders, withUserId } from "@/lib/client-user";
import { getUserPreferences, setUserPreferences, COUNTRY_OPTIONS, TIMEZONE_OPTIONS } from "@/lib/user-preferences";
import { downloadLibraryBackup, restoreLibraryBackup } from "@/lib/library-backup-client";
import { Settings, User, Trash2, AlertTriangle, Loader2, Check, Download, Upload, Globe, Clock, Star, LogOut } from "lucide-react";
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
  const { userName, setUserName } = useNav();
  const userId = getClientUserId();
  const stats = useStats();
  const qc = useQueryClient();
  const [name, setName] = useState(userName);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [transferProgress, setTransferProgress] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [authEnabled, setAuthEnabled] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    if (!open) return;
    fetch("/api/auth/status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setAuthEnabled(Boolean(data.authEnabled));
      })
      .catch(() => { /* best-effort */ });
    return () => { cancelled = true; };
  }, [open]);

  const onSignOut = async () => {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      toast.success("Signed out");
      onOpenChange(false);
      // Hard reload so client-side caches (Zustand, React Query) are dropped.
      window.location.href = "/login";
    } catch {
      toast.error("Failed to sign out");
    } finally {
      setSigningOut(false);
    }
  };

  // Sync name from store when dialog opens. Uses "adjust state during render"
  // pattern to avoid setState-in-effect lint violation.
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setName(userName);
  }

  const onSaveName = async () => {
    setSaving(true);
    try {
      const res = await fetch(withUserId(new URL("/api/user", window.location.origin)), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...userHeaders() },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to update profile");
      }
      const payload = await res.json();
      const savedName = String(payload?.user?.name || name).trim();
      setName(savedName);
      setUserName(savedName);
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
      const res = await fetch(withUserId(new URL("/api/library/clear", window.location.origin)), {
        method: "DELETE",
        headers: { ...userHeaders(), "x-confirm-delete": "DELETE EVERYTHING" },
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to clear");
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["lib"] }),
        qc.invalidateQueries({ queryKey: ["media"] }),
        qc.invalidateQueries({ queryKey: ["library-counts"] }),
        qc.invalidateQueries({ queryKey: ["tv-tracking"] }),
        qc.invalidateQueries({ queryKey: ["tv-tracking-counts"] }),
      ]);
      toast.success("All collection data cleared");
      onOpenChange(false);
    } catch {
      toast.error("Failed to clear data");
    } finally {
      setClearing(false);
    }
  };

  const invalidateLibraryQueries = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["lib"] }),
      qc.invalidateQueries({ queryKey: ["media"] }),
      qc.invalidateQueries({ queryKey: ["library-counts"] }),
      qc.invalidateQueries({ queryKey: ["tv-tracking"] }),
      qc.invalidateQueries({ queryKey: ["tv-tracking-counts"] }),
    ]);
  };

  const onExport = async () => {
    setExporting(true);
    setTransferProgress("Preparing backup manifest");
    try {
      const result = await downloadLibraryBackup((progress) => setTransferProgress(progress.message));
      toast.success(`Exported ${result.totalRecords.toLocaleString()} records`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to export data");
    } finally {
      setExporting(false);
      setTransferProgress("");
    }
  };

  const onImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setTransferProgress("Reading backup manifest");
    try {
      const result = await restoreLibraryBackup(file, {
        onProgress: (progress) => setTransferProgress(progress.message),
        confirmPreview: (preview) => {
          const counts = (preview.counts ?? {}) as Record<string, number>;
          const duplicates = (preview.duplicateRecordsThatWillMerge ?? {}) as Record<string, number>;
          const warnings = Array.isArray(preview.warnings) ? preview.warnings.map(String) : [];
          const lines = [
            "Restore this validated backup?",
            "",
            `Media: ${Number(counts.media ?? 0).toLocaleString()}`,
            `Watched episodes: ${Number(counts.watchedEpisodes ?? 0).toLocaleString()}`,
            `Episode ratings: ${Number(counts.episodeRatings ?? 0).toLocaleString()}`,
            `Existing media to merge: ${Number(preview.existingMediaThatWillMerge ?? 0).toLocaleString()}`,
            `Duplicate backup rows to merge: ${(Number(duplicates.media ?? 0) + Number(duplicates.watchedEpisodes ?? 0)).toLocaleString()}`,
            "",
            "The final database update is atomic: it either completes fully or leaves your library unchanged.",
            ...warnings.map((warning) => `Warning: ${warning}`),
          ];
          return window.confirm(lines.join("\n"));
        },
      });

      if (result.cancelled) {
        toast.info("Restore cancelled; staged data was removed");
        return;
      }
      await invalidateLibraryQueries();
      const imported = result.imported ?? {};
      const affected = Number(imported.mediaRowsAffected ?? 0)
        + Number(imported.watchedEpisodeRowsAffected ?? 0)
        + Number(imported.episodeRatingRowsAffected ?? 0);
      toast.success(`Restore completed atomically (${affected.toLocaleString()} rows merged)`);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to import backup");
    } finally {
      setImporting(false);
      setTransferProgress("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const counts = stats.data?.counts;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="tvtime-profile-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" /> Profile & Settings
          </DialogTitle>
          <DialogDescription>Manage your account and collection data</DialogDescription>
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

          {/* Collection stats summary */}
          {counts && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Your collection</p>
              <div className="grid grid-cols-2 gap-2">
                <StatBox label="Watchlist" value={counts.watchlist} />
                <StatBox label="Watched movies" value={counts.watchedMovies} />
                <StatBox label="TV Following" value={counts.following} />
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
                <p className="text-xs text-muted-foreground">Export a paged NDJSON backup or restore a JSON/NDJSON backup through validated staging.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={onExport} disabled={exporting || importing}>
                {exporting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
                Export
              </Button>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing || exporting}>
                {importing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                Import
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/x-ndjson,application/json,.ndjson,.json"
              onChange={onImport}
              className="hidden"
            />
            {transferProgress && (
              <p className="mt-2 text-[11px] text-muted-foreground" role="status" aria-live="polite">
                {transferProgress}
              </p>
            )}
          </div>

          {/* TVM-35/36/37: Preferences — timezone, country, platform preferences */}
          <PreferencesSection />

          {/* Sign out (only when auth is enabled on this deployment) */}
          {authEnabled && (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <div className="flex items-start gap-2 mb-2">
                <LogOut className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold">Session</p>
                  <p className="text-xs text-muted-foreground">End your signed-in session on this device.</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={onSignOut}
                disabled={signingOut}
              >
                {signingOut ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <LogOut className="w-4 h-4 mr-1" />}
                Sign out
              </Button>
            </div>
          )}

          {/* Danger zone */}
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <div className="flex items-start gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-destructive">Danger zone</p>
                <p className="text-xs text-muted-foreground">Clear all your collection data. This cannot be undone.</p>
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
                  <AlertDialogTitle>Clear all collection data?</AlertDialogTitle>
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

// TVM-35/36/37: User preferences section — timezone, country, platform prefs
function PreferencesSection() {
  const [prefs, setPrefs] = useState({ timezone: "Asia/Baghdad", country: "IQ", preferredPlatforms: [] as string[] });
  const [platformInput, setPlatformInput] = useState("");
  const [initialized, setInitialized] = useState(false);

  // Load preferences on first render (client-side) using "adjust state during
  // render" pattern to avoid setState-in-effect lint violation.
  if (!initialized) {
    setInitialized(true);
    setPrefs(getUserPreferences());
  }

  const updatePref = (key: keyof typeof prefs, value: any) => {
    const updated = setUserPreferences({ [key]: value });
    setPrefs(updated);
    toast.success("Preference saved");
  };

  const addPlatform = () => {
    const name = platformInput.trim();
    if (!name) return;
    if (prefs.preferredPlatforms.includes(name)) {
      toast.info("Already in your preferences");
      return;
    }
    const updated = setUserPreferences({ preferredPlatforms: [...prefs.preferredPlatforms, name] });
    setPrefs(updated);
    setPlatformInput("");
    toast.success(`Added "${name}" to preferred platforms`);
  };

  const removePlatform = (name: string) => {
    const updated = setUserPreferences({ preferredPlatforms: prefs.preferredPlatforms.filter((p) => p !== name) });
    setPrefs(updated);
  };

  if (!initialized) return null;

  return (
    <div className="rounded-lg border border-border/50 bg-card/50 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Settings className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold">Preferences</p>
      </div>

      {/* TVM-35: Timezone */}
      <div className="space-y-1.5">
        <Label className="text-xs flex items-center gap-1">
          <Clock className="w-3 h-3" /> Timezone
        </Label>
        <Select value={prefs.timezone} onValueChange={(v) => updatePref("timezone", v)}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONE_OPTIONS.map((tz) => (
              <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground">Episode air dates display in this timezone</p>
      </div>

      {/* TVM-36: Country for Watch Providers */}
      <div className="space-y-1.5">
        <Label className="text-xs flex items-center gap-1">
          <Globe className="w-3 h-3" /> Country (Where to Watch)
        </Label>
        <Select value={prefs.country} onValueChange={(v) => updatePref("country", v)}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COUNTRY_OPTIONS.map((c) => (
              <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground">Streaming platforms shown for this country</p>
      </div>

      {/* TVM-37: Preferred platforms */}
      <div className="space-y-1.5">
        <Label className="text-xs flex items-center gap-1">
          <Star className="w-3 h-3" /> Preferred Platforms
        </Label>
        <div className="flex gap-2">
          <Input
            value={platformInput}
            onChange={(e) => setPlatformInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPlatform(); } }}
            placeholder="e.g. Netflix, Shahid, Prime Video"
            className="h-9 text-sm flex-1"
          />
          <Button size="sm" variant="outline" className="h-9" onClick={addPlatform}>Add</Button>
        </div>
        {prefs.preferredPlatforms.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {prefs.preferredPlatforms.map((p) => (
              <Badge key={p} variant="secondary" className="text-[10px] gap-1">
                <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                {p}
                <button type="button" data-ui-action="danger-link" onClick={() => removePlatform(p)} className="ml-0.5 hover:text-rose-400" aria-label={`Remove ${p}`}>✕</button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground">Add platforms to highlight them in Where to Watch</p>
        )}
      </div>
    </div>
  );
}
