"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  Check,
  ChevronRight,
  Crown,
  Edit3,
  Film,
  Globe,
  List as ListIcon,
  ListPlus,
  Loader2,
  Lock,
  Plus,
  Search,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { SafeImage } from "@/components/media/safe-image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { readApiJson } from "@/lib/api-response";
import {
  normalizeListSearchResults,
  type ListMediaType,
  type ListSearchResult,
} from "@/lib/custom-list-contract";
import { img, type MediaItem, type PaginatedResponse } from "@/lib/tmdb";

interface CustomListItem {
  id: string;
  tmdbId: number;
  mediaType: string;
  title: string;
  posterPath: string | null;
  addedAt: string;
}

interface CustomList {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  color: string;
  slug: string;
  items: CustomListItem[];
  createdAt: string;
}

type ListDraft = {
  name: string;
  description: string;
  color: string;
  isPublic: boolean;
};

const PRESET_COLORS = ["#f59e0b", "#10b981", "#3b82f6", "#ec4899", "#8b5cf6", "#ef4444", "#14b8a6", "#f97316"];
const EMPTY_DRAFT: ListDraft = { name: "", description: "", color: PRESET_COLORS[0], isPublic: false };
const TYPE_LABELS: Record<string, string> = { movie: "فيلم", tv: "مسلسل" };

export function ListsView() {
  const [lists, setLists] = useState<CustomList[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [shareList, setShareList] = useState<CustomList | null>(null);
  const [editing, setEditing] = useState(false);
  const [createDraft, setCreateDraft] = useState<ListDraft>(EMPTY_DRAFT);
  const [editDraft, setEditDraft] = useState<ListDraft>(EMPTY_DRAFT);

  const fetchLists = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await readApiJson<{ lists?: CustomList[] }>(
        await fetch("/api/lists", { cache: "no-store" }),
        "تعذر تحميل القوائم",
      );
      setLists(data.lists || []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "تعذر تحميل القوائم");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchLists(); }, [fetchLists]);

  const selectedList = lists.find((list) => list.id === selectedListId) || null;
  const totalItems = useMemo(() => lists.reduce((sum, list) => sum + list.items.length, 0), [lists]);

  const createList = async () => {
    if (!createDraft.name.trim() || pending) return;
    setPending("create");
    try {
      const data = await readApiJson<{ list: CustomList }>(
        await fetch("/api/lists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createDraft),
        }),
        "تعذر إنشاء القائمة",
      );
      setLists((current) => [data.list, ...current]);
      setCreateDraft(EMPTY_DRAFT);
      setCreateOpen(false);
      setSelectedListId(data.list.id);
      toast.success("تم إنشاء القائمة");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر إنشاء القائمة");
    } finally {
      setPending(null);
    }
  };

  const beginEdit = (list: CustomList) => {
    setEditDraft({
      name: list.name,
      description: list.description || "",
      color: list.color,
      isPublic: list.isPublic,
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!selectedList || !editDraft.name.trim() || pending) return;
    setPending(`edit:${selectedList.id}`);
    try {
      const data = await readApiJson<{ list: CustomList }>(
        await fetch(`/api/lists/${selectedList.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editDraft),
        }),
        "تعذر تحديث القائمة",
      );
      setLists((current) => current.map((list) => list.id === data.list.id ? data.list : list));
      setEditing(false);
      toast.success("تم تحديث القائمة");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر تحديث القائمة");
    } finally {
      setPending(null);
    }
  };

  const deleteList = async (list: CustomList) => {
    if (pending || !window.confirm(`هل تريد حذف قائمة «${list.name}»؟`)) return;
    setPending(`delete:${list.id}`);
    try {
      await readApiJson(
        await fetch(`/api/lists/${list.id}`, { method: "DELETE" }),
        "تعذر حذف القائمة",
      );
      setLists((current) => current.filter((item) => item.id !== list.id));
      if (selectedListId === list.id) setSelectedListId(null);
      if (shareList?.id === list.id) setShareList(null);
      toast.success("تم حذف القائمة");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر حذف القائمة");
    } finally {
      setPending(null);
    }
  };

  const addItem = async (item: ListSearchResult) => {
    if (!selectedList || pending) return;
    const action = `add:${item.mediaType}:${item.tmdbId}`;
    setPending(action);
    try {
      const data = await readApiJson<{ item: CustomListItem; duplicate: boolean }>(
        await fetch(`/api/lists/${selectedList.id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item),
        }),
        "تعذر إضافة العنصر",
      );
      setLists((current) => current.map((list) => {
        if (list.id !== selectedList.id) return list;
        const exists = list.items.some((currentItem) => currentItem.tmdbId === item.tmdbId && currentItem.mediaType === item.mediaType);
        return exists
          ? { ...list, items: list.items.map((currentItem) => currentItem.tmdbId === item.tmdbId && currentItem.mediaType === item.mediaType ? data.item : currentItem) }
          : { ...list, items: [...list.items, data.item] };
      }));
      toast.success(data.duplicate ? "العنصر موجود وتم تحديث معلوماته" : "تمت إضافة العنصر");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر إضافة العنصر");
      throw error;
    } finally {
      setPending(null);
    }
  };

  const removeItem = async (item: CustomListItem) => {
    if (!selectedList || pending) return;
    const action = `remove:${item.mediaType}:${item.tmdbId}`;
    setPending(action);
    try {
      const url = new URL(`/api/lists/${selectedList.id}/items`, window.location.origin);
      url.searchParams.set("tmdbId", String(item.tmdbId));
      url.searchParams.set("mediaType", item.mediaType);
      await readApiJson(await fetch(url, { method: "DELETE" }), "تعذر إزالة العنصر");
      setLists((current) => current.map((list) => list.id === selectedList.id
        ? { ...list, items: list.items.filter((currentItem) => !(currentItem.tmdbId === item.tmdbId && currentItem.mediaType === item.mediaType)) }
        : list));
      toast.success("تمت إزالة العنصر");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر إزالة العنصر");
    } finally {
      setPending(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center gap-2 p-12 text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" /> جاري تحميل القوائم...</div>;
  }

  if (loadError) {
    return (
      <div className="feedback-state feedback-state--error m-4 flex flex-col items-center justify-center rounded-xl border border-rose-500/30 p-12 text-center" role="alert">
        <AlertCircle className="mb-3 h-10 w-10 text-rose-400" />
        <h2 className="font-semibold">تعذر تحميل القوائم</h2>
        <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
        <button type="button" onClick={() => void fetchLists()} className="mt-4 rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">إعادة المحاولة</button>
      </div>
    );
  }

  if (selectedList) {
    return (
      <ListDetail
        list={selectedList}
        editing={editing}
        editDraft={editDraft}
        setEditDraft={setEditDraft}
        pending={pending}
        onBack={() => { setSelectedListId(null); setEditing(false); }}
        onEdit={() => beginEdit(selectedList)}
        onCancelEdit={() => setEditing(false)}
        onSaveEdit={() => void saveEdit()}
        onDelete={() => void deleteList(selectedList)}
        onShare={() => setShareList(selectedList)}
        onAdd={() => setAddOpen(true)}
        onRemove={(item) => void removeItem(item)}
      >
        <AddItemDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          existingItems={selectedList.items}
          pending={pending}
          onAdd={addItem}
        />
        <ShareDialog list={shareList} onClose={() => setShareList(null)} />
      </ListDetail>
    );
  }

  return (
    <div className="tvtime-lists-page space-y-6 p-4 md:p-6" dir="rtl">
      <div className="view-page-header flex items-end justify-between gap-3">
        <div>
          <h1 className="view-page-title flex items-center gap-2 text-2xl font-bold"><ListIcon size={24} /> قوائمي</h1>
          <p className="view-page-description mt-1 text-sm text-muted-foreground">{lists.length} قائمة • {totalItems} عنصر</p>
        </div>
        <button type="button" onClick={() => setCreateOpen(true)} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus size={16} /> قائمة جديدة
        </button>
      </div>

      {lists.length === 0 ? (
        <div className="feedback-state feedback-state--empty flex flex-col items-center justify-center p-12 text-center" role="status">
          <ListIcon className="mb-3 text-muted-foreground/40" size={48} />
          <h2 className="text-base font-medium text-muted-foreground">لا توجد قوائم بعد</h2>
          <p className="mt-1 text-xs text-muted-foreground/70">أنشئ قائمتك الأولى لتنظيم أعمالك</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {lists.map((list) => (
            <ListCard
              key={list.id}
              list={list}
              pending={pending}
              onOpen={() => setSelectedListId(list.id)}
              onEdit={() => { setSelectedListId(list.id); beginEdit(list); }}
              onDelete={() => void deleteList(list)}
              onShare={() => setShareList(list)}
            />
          ))}
        </div>
      )}

      <ListFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="إنشاء قائمة جديدة"
        description="اختر اسمًا ولونًا وحدد ما إذا كانت القائمة قابلة للمشاركة."
        draft={createDraft}
        setDraft={setCreateDraft}
        saving={pending === "create"}
        onSave={() => void createList()}
      />
      <ShareDialog list={shareList} onClose={() => setShareList(null)} />
    </div>
  );
}

function Poster({ title, posterPath, compact = false }: { title: string; posterPath: string | null; compact?: boolean }) {
  return (
    <div className={`relative shrink-0 overflow-hidden rounded bg-muted ${compact ? "h-14 w-10" : "aspect-[2/3] w-full"}`}>
      {posterPath ? (
        <SafeImage src={img(posterPath, compact ? "w92" : "w342")} alt={title} fill variant="poster" />
      ) : (
        <div className="flex h-full items-center justify-center text-muted-foreground"><Film className={compact ? "h-4 w-4" : "h-7 w-7"} /></div>
      )}
    </div>
  );
}

function ListCard({ list, pending, onOpen, onEdit, onDelete, onShare }: {
  list: CustomList;
  pending: string | null;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onShare: () => void;
}) {
  const previewItems = list.items.slice(0, 4);
  const remaining = list.items.length - previewItems.length;
  const isDeleting = pending === `delete:${list.id}`;
  return (
    <article className="group overflow-hidden rounded-xl border border-border bg-card">
      <button type="button" onClick={onOpen} className="block w-full text-right" aria-label={`فتح قائمة ${list.name}`}>
        <div className="h-1.5" style={{ backgroundColor: list.color }} />
        <div className="p-4">
          <div className="flex items-center gap-1.5">
            <h2 className="min-w-0 flex-1 truncate text-base font-bold">{list.name}</h2>
            {list.isPublic ? <Globe size={13} className="shrink-0 text-emerald-500" /> : <Lock size={13} className="shrink-0 text-muted-foreground" />}
          </div>
          {list.description && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{list.description}</p>}
          <div className="mt-3 flex items-center gap-1" aria-hidden="true">
            {previewItems.map((item) => <Poster key={item.id} title={item.title} posterPath={item.posterPath} compact />)}
            {remaining > 0 && <div className="flex h-14 w-10 items-center justify-center rounded bg-muted text-xs font-medium text-muted-foreground">+{remaining}</div>}
            {list.items.length === 0 && <span className="text-xs italic text-muted-foreground">لا توجد عناصر بعد</span>}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{list.items.length} عنصر</span>
            <ChevronRight size={14} className="text-muted-foreground" />
          </div>
        </div>
      </button>
      <div className="flex items-center gap-1 px-4 pb-3">
        <button type="button" onClick={onEdit} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"><Edit3 size={11} /> تعديل</button>
        <button type="button" onClick={onShare} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"><Share2 size={11} /> مشاركة</button>
        <button type="button" onClick={onDelete} disabled={isDeleting} className="mr-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs text-rose-500 hover:bg-rose-500/15 disabled:opacity-50">
          {isDeleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />} حذف
        </button>
      </div>
    </article>
  );
}

function ListDetail({ list, editing, editDraft, setEditDraft, pending, onBack, onEdit, onCancelEdit, onSaveEdit, onDelete, onShare, onAdd, onRemove, children }: {
  list: CustomList;
  editing: boolean;
  editDraft: ListDraft;
  setEditDraft: (draft: ListDraft) => void;
  pending: string | null;
  onBack: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
  onShare: () => void;
  onAdd: () => void;
  onRemove: (item: CustomListItem) => void;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4 p-4 md:p-6" dir="rtl">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ChevronRight size={12} /> العودة للقوائم</button>

      {editing ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <ListFormFields draft={editDraft} setDraft={setEditDraft} />
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={onSaveEdit} disabled={!editDraft.name.trim() || pending === `edit:${list.id}`} className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {pending === `edit:${list.id}` ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} حفظ
            </button>
            <button type="button" onClick={onCancelEdit} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">إلغاء</button>
          </div>
        </div>
      ) : (
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded" style={{ backgroundColor: list.color }} />
              <h1 className="truncate text-2xl font-bold">{list.name}</h1>
              {list.isPublic ? <Globe size={16} className="text-emerald-500" /> : <Lock size={16} className="text-muted-foreground" />}
            </div>
            {list.description && <p className="mt-1 text-sm text-muted-foreground">{list.description}</p>}
            <p className="mt-1 text-xs text-muted-foreground">{list.items.length} عنصر</p>
          </div>
          <div className="flex items-center gap-1">
            <IconButton label="تعديل القائمة" onClick={onEdit}><Edit3 size={15} /></IconButton>
            <IconButton label="مشاركة القائمة" onClick={onShare}><Share2 size={15} /></IconButton>
            <IconButton label="حذف القائمة" onClick={onDelete} danger><Trash2 size={15} /></IconButton>
          </div>
        </header>
      )}

      <button type="button" onClick={onAdd} className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"><ListPlus size={16} /> أضف عنصرًا للقائمة</button>

      {list.items.length === 0 ? (
        <div className="feedback-state feedback-state--empty flex flex-col items-center justify-center p-12 text-center" role="status">
          <ListPlus className="mb-3 text-muted-foreground/40" size={48} />
          <h2 className="text-base font-medium text-muted-foreground">القائمة فارغة</h2>
          <p className="mt-1 text-xs text-muted-foreground/70">أضف أفلامًا أو مسلسلات لتنظيمها هنا</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.items.map((item) => {
            const removing = pending === `remove:${item.mediaType}:${item.tmdbId}`;
            return (
              <article key={item.id} className="group flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                <Poster title={item.title} posterPath={item.posterPath} compact />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-medium">{item.title}</h2>
                  <span className="text-[11px] text-muted-foreground">{TYPE_LABELS[item.mediaType] || item.mediaType}</span>
                </div>
                <button type="button" onClick={() => onRemove(item)} disabled={removing} className="flex h-8 w-8 items-center justify-center rounded-md text-rose-500 hover:bg-rose-500/15 disabled:opacity-50" aria-label={`إزالة ${item.title} من القائمة`}>
                  {removing ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                </button>
              </article>
            );
          })}
        </div>
      )}
      {children}
    </div>
  );
}

function IconButton({ label, onClick, danger = false, children }: { label: string; onClick: () => void; danger?: boolean; children: ReactNode }) {
  return <button type="button" onClick={onClick} aria-label={label} title={label} className={`flex h-9 w-9 items-center justify-center rounded-md border ${danger ? "border-rose-500/30 text-rose-500 hover:bg-rose-500/15" : "border-border hover:bg-accent"}`}>{children}</button>;
}

function ListFormFields({ draft, setDraft }: { draft: ListDraft; setDraft: (draft: ListDraft) => void }) {
  return (
    <div className="space-y-4">
      <label className="block text-xs font-medium text-muted-foreground">
        اسم القائمة *
        <input value={draft.name} maxLength={120} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="مثال: أفلام العيد" className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
      </label>
      <label className="block text-xs font-medium text-muted-foreground">
        الوصف (اختياري)
        <textarea value={draft.description} maxLength={1000} onChange={(event) => setDraft({ ...draft, description: event.target.value })} rows={3} placeholder="وصف قصير للقائمة..." className="mt-1.5 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
      </label>
      <fieldset>
        <legend className="mb-1.5 text-xs font-medium text-muted-foreground">اللون</legend>
        <div className="flex flex-wrap items-center gap-2">
          {PRESET_COLORS.map((color) => (
            <button key={color} type="button" onClick={() => setDraft({ ...draft, color })} aria-label={`اختيار اللون ${color}`} aria-pressed={draft.color === color} className={`h-8 w-8 rounded-full transition-transform ${draft.color === color ? "scale-105 ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`} style={{ backgroundColor: color }} />
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-1.5 text-xs font-medium text-muted-foreground">الخصوصية</legend>
        <div className="flex items-center gap-2">
          <button type="button" aria-pressed={!draft.isPublic} onClick={() => setDraft({ ...draft, isPublic: false })} className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium ${!draft.isPublic ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"}`}><Lock size={14} /> خاصة</button>
          <button type="button" aria-pressed={draft.isPublic} onClick={() => setDraft({ ...draft, isPublic: true })} className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium ${draft.isPublic ? "border-emerald-500 bg-emerald-500/10 text-emerald-600" : "border-border hover:bg-accent"}`}><Globe size={14} /> عامة</button>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">{draft.isPublic ? "يمكن لأي شخص لديه الرابط رؤية القائمة" : "مرئية لك فقط"}</p>
      </fieldset>
    </div>
  );
}

function ListFormDialog({ open, onOpenChange, title, description, draft, setDraft, saving, onSave }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  draft: ListDraft;
  setDraft: (draft: ListDraft) => void;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving) onOpenChange(next); }}>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
        <ListFormFields draft={draft} setDraft={setDraft} />
        <div className="flex items-center gap-2 pt-1">
          <button type="button" onClick={onSave} disabled={!draft.name.trim() || saving} className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} حفظ
          </button>
          <button type="button" onClick={() => onOpenChange(false)} disabled={saving} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50">إلغاء</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddItemDialog({ open, onOpenChange, existingItems, pending, onAdd }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingItems: CustomListItem[];
  pending: string | null;
  onAdd: (item: ListSearchResult) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | ListMediaType>("all");
  const [results, setResults] = useState<ListSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !query.trim()) {
      setResults([]);
      setSearchError(null);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setSearchError(null);
      try {
        const url = new URL("/api/tmdb/search", window.location.origin);
        url.searchParams.set("q", query.trim());
        url.searchParams.set("page", "1");
        const data = await readApiJson<PaginatedResponse<MediaItem>>(
          await fetch(url, { signal: controller.signal }),
          "تعذر البحث في TMDB",
        );
        const normalized = normalizeListSearchResults(data.results || []);
        setResults((filterType === "all" ? normalized : normalized.filter((item) => item.mediaType === filterType)).slice(0, 20));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setResults([]);
        setSearchError(error instanceof Error ? error.message : "تعذر البحث");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [filterType, open, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>أضف للقائمة</DialogTitle><DialogDescription>ابحث عن فيلم أو مسلسل ثم أضفه مرة واحدة إلى القائمة.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث عن عمل..." autoFocus className="w-full rounded-md border border-border bg-background py-2 pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div className="flex items-center gap-1 overflow-x-auto">
            {([{ value: "all", label: "الكل" }, { value: "movie", label: "أفلام" }, { value: "tv", label: "مسلسلات" }] as const).map((option) => (
              <button key={option.value} type="button" aria-pressed={filterType === option.value} onClick={() => setFilterType(option.value)} className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${filterType === option.value ? "bg-primary text-primary-foreground" : "bg-accent"}`}>{option.label}</button>
            ))}
          </div>
          {loading && <div className="flex items-center justify-center gap-2 py-5 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" /> جاري البحث...</div>}
          {searchError && <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-500" role="alert">{searchError}</div>}
          {!loading && !searchError && query.trim() && results.length === 0 && <div className="py-5 text-center text-sm text-muted-foreground">لا توجد نتائج</div>}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {results.map((item) => {
              const isAdded = existingItems.some((existing) => existing.tmdbId === item.tmdbId && existing.mediaType === item.mediaType);
              const adding = pending === `add:${item.mediaType}:${item.tmdbId}`;
              return (
                <article key={`${item.mediaType}:${item.tmdbId}`} className="flex items-center gap-2 rounded-lg border border-border p-2 hover:bg-accent/50">
                  <Poster title={item.title} posterPath={item.posterPath} compact />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-medium">{item.title}</h3>
                    <p className="text-[11px] text-muted-foreground">{TYPE_LABELS[item.mediaType]}{item.year ? ` • ${item.year}` : ""}</p>
                  </div>
                  <button type="button" onClick={() => { void onAdd(item).catch(() => undefined); }} disabled={isAdded || Boolean(pending)} className={`rounded-md px-2.5 py-1 text-xs font-medium ${isAdded ? "cursor-not-allowed bg-muted text-muted-foreground" : "bg-primary/10 text-primary hover:bg-primary/20"}`}>
                    {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isAdded ? "✓ مضاف" : "+ إضافة"}
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ShareDialog({ list, onClose }: { list: CustomList | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const shareUrl = list && typeof window !== "undefined" ? `${window.location.origin}/list/${encodeURIComponent(list.slug)}` : "";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("تم نسخ الرابط");
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      toast.error("تعذر نسخ الرابط");
    }
  };

  return (
    <Dialog open={Boolean(list)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Share2 size={18} /> مشاركة القائمة</DialogTitle><DialogDescription>الرابط العام يعرض محتوى القائمة فقط ولا يكشف معلومات الحساب.</DialogDescription></DialogHeader>
        {list && (
          <div className="space-y-4">
            <div className="py-2 text-center">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ backgroundColor: list.color }}><Crown size={28} className="text-white" /></div>
              <h3 className="text-base font-bold">{list.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{list.items.length} عنصر • {list.isPublic ? "قائمة عامة" : "قائمة خاصة"}</p>
            </div>
            {list.isPublic ? (
              <>
                <div className="flex items-center gap-2 rounded-md border border-border bg-background p-3">
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" dir="ltr">{shareUrl}</span>
                  <button type="button" onClick={() => void copy()} className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium ${copied ? "bg-emerald-500 text-white" : "bg-primary text-primary-foreground"}`}>{copied ? "✓ تم النسخ" : "نسخ"}</button>
                </div>
                <a href={shareUrl} target="_blank" rel="noreferrer" className="block text-center text-xs text-primary hover:underline">فتح الصفحة العامة</a>
              </>
            ) : (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-center">
                <Lock className="mx-auto mb-2 text-amber-500" size={20} />
                <p className="text-sm font-medium text-amber-700 dark:text-amber-500">القائمة خاصة</p>
                <p className="mt-1 text-xs text-muted-foreground">غيّر إعداد الخصوصية إلى «عامة» لإنشاء رابط قابل للمشاركة.</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
