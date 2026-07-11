"use client";

import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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
import { Settings, User, Trash2, AlertTriangle, Loader2, Check, Download, Upload, Globe, Clock, Star } from "lucide-react";
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const onExport = async () => {
    setExporting(true);
    try {
      const res = await fetch(withUserId(new URL("/api/library/export", window.location.origin)), {
        headers: userHeaders(),
      });
      if (!res.ok) throw new Error("Failed to export");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cinetrack-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Collection exported");
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
      const res = await fetch(withUserId(new URL("/api/library/import", window.location.origin)), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...userHeaders() },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Import failed");
      const result = await res.json();
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["lib"] }),
        qc.invalidateQueries({ queryKey: ["media"] }),
        qc.invalidateQueries({ queryKey: ["library-counts"] }),
        qc.invalidateQueries({ queryKey: ["tv-tracking"] }),
        qc.invalidateQueries({ queryKey: ["tv-tracking-counts"] }),
      ]);
      const imported = result?.imported || {};
      const total = (imported.watchlist || 0) + (imported.watchedMovies || 0) + (imported.watchedEpisodes || 0) + (imported.following || 0) + (imported.ratings || 0) + (imported.episodeRatings || 0) + (imported.media || 0);
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
                <p className="text-xs text-muted-foreground">Export your complete collection to a JSON file or import a backup.</p>
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

          {/* TVM-35/36/37: Preferences — timezone, country, platform preferences */}
          <PreferencesSection />

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
                <button onClick={() => removePlatform(p)} className="ml-0.5 hover:text-rose-400">✕</button>
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
