"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  List as ListIcon,
  Plus,
  Trash2,
  Edit3,
  X,
  Check,
  Globe,
  Lock,
  Share2,
  ChevronRight,
  Search,
  ListPlus,
  Crown,
} from "lucide-react";
import { toast } from "sonner";

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

const PRESET_COLORS = ["#f59e0b", "#10b981", "#3b82f6", "#ec4899", "#8b5cf6", "#ef4444", "#14b8a6", "#f97316"];
const TYPE_LABELS: Record<string, string> = {
  movie: "فيلم",
  tv: "مسلسل",
  anime: "أنمي",
  arabic_movie: "فيلم عربي",
  arabic_tv: "مسلسل عربي",
  series: "مسلسل",
};

export function ListsView() {
  const [lists, setLists] = useState<CustomList[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingList, setEditingList] = useState<string | null>(null);
  const [shareList, setShareList] = useState<CustomList | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);

  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [newPublic, setNewPublic] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editColor, setEditColor] = useState(PRESET_COLORS[0]);
  const [editPublic, setEditPublic] = useState(false);

  const fetchLists = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/lists");
      if (res.ok) {
        const data = await res.json();
        setLists(data.lists || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const res = await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, description: newDesc, color: newColor, isPublic: newPublic }),
    });
    if (res.ok) {
      const data = await res.json();
      setLists((prev) => [data.list, ...prev]);
      setNewName(""); setNewDesc(""); setNewColor(PRESET_COLORS[0]); setNewPublic(false);
      setShowCreate(false);
      setSelectedListId(data.list.id);
      toast.success("تم إنشاء القائمة");
    }
  };

  const handleStartEdit = (l: CustomList) => {
    setEditingList(l.id);
    setEditName(l.name); setEditDesc(l.description || ""); setEditColor(l.color); setEditPublic(l.isPublic);
  };

  const handleSaveEdit = async () => {
    if (!editingList || !editName.trim()) return;
    const res = await fetch(`/api/lists/${editingList}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, description: editDesc, color: editColor, isPublic: editPublic }),
    });
    if (res.ok) {
      const data = await res.json();
      setLists((prev) => prev.map((l) => (l.id === editingList ? data.list : l)));
      setEditingList(null);
      toast.success("تم تحديث القائمة");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل تريد حذف هذه القائمة؟")) return;
    await fetch(`/api/lists/${id}`, { method: "DELETE" });
    setLists((prev) => prev.filter((l) => l.id !== id));
    setSelectedListId(null);
    toast.success("تم حذف القائمة");
  };

  const handleAddItem = async (listId: string, item: { tmdbId: number; mediaType: string; title: string; posterPath?: string }) => {
    const res = await fetch(`/api/lists/${listId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    if (res.ok) {
      const data = await res.json();
      setLists((prev) => prev.map((l) => {
        if (l.id !== listId) return l;
        const exists = l.items.some((i) => i.tmdbId === item.tmdbId && i.mediaType === item.mediaType);
        if (exists) return l;
        return { ...l, items: [...l.items, data.item] };
      }));
    }
  };

  const handleRemoveItem = async (listId: string, tmdbId: number, mediaType: string) => {
    await fetch(`/api/lists/${listId}/items?tmdbId=${tmdbId}&mediaType=${mediaType}`, { method: "DELETE" });
    setLists((prev) => prev.map((l) => {
      if (l.id !== listId) return l;
      return { ...l, items: l.items.filter((i) => !(i.tmdbId === tmdbId && i.mediaType === mediaType)) };
    }));
  };

  const totalItems = useMemo(() => lists.reduce((sum, l) => sum + l.items.length, 0), [lists]);
  const selectedList = lists.find((l) => l.id === selectedListId) || null;

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">جاري تحميل القوائم...</div>;
  }

  if (selectedList) {
    return (
      <ListView
        list={selectedList}
        onBack={() => setSelectedListId(null)}
        onEdit={() => handleStartEdit(selectedList)}
        onDelete={() => handleDelete(selectedList.id)}
        onShare={() => setShareList(selectedList)}
        onAddItem={() => setShowAddItem(true)}
        onRemoveItem={(tmdbId, mediaType) => handleRemoveItem(selectedList.id, tmdbId, mediaType)}
        showAddItem={showAddItem}
        onCloseAddItem={() => setShowAddItem(false)}
        onAddToThisList={(item) => handleAddItem(selectedList.id, item)}
        editingList={editingList}
        editName={editName}
        editDesc={editDesc}
        editColor={editColor}
        editPublic={editPublic}
        setEditName={setEditName}
        setEditDesc={setEditDesc}
        setEditColor={setEditColor}
        setEditPublic={setEditPublic}
        onSaveEdit={handleSaveEdit}
        onCancelEdit={() => setEditingList(null)}
      />
    );
  }

  return (
    <div className="tvtime-lists-page space-y-6 p-4 md:p-6">
      <div className="view-page-header flex items-end justify-between">
        <div>
          <h1 className="view-page-title text-2xl font-bold flex items-center gap-2">
            <ListIcon size={24} /> قوائمي
          </h1>
          <p className="view-page-description text-sm text-muted-foreground mt-1">
            {lists.length} قائمة • {totalItems} عنصر
          </p>
        </div>
        <button
          type="button"
          data-ui-action="primary"
          onClick={() => setShowCreate(true)}
          className="bg-primary text-primary-foreground px-3 py-2 rounded-md text-sm font-medium flex items-center gap-1.5 hover:bg-primary/90"
        >
          <Plus size={16} /> قائمة جديدة
        </button>
      </div>

      {lists.length === 0 ? (
        <div className="feedback-state feedback-state--empty flex flex-col items-center justify-center p-12 text-center" role="status">
          <ListIcon className="text-muted-foreground/40 mx-auto mb-3" size={48} />
          <h3 className="text-base font-medium text-muted-foreground">لا توجد قوائم بعد</h3>
          <p className="text-xs text-muted-foreground/70 mt-1">أنشئ قائمتك الأولى لتنظيم أعمالك</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {lists.map((l) => (
            <ListCard
              key={l.id}
              list={l}
              onClick={() => setSelectedListId(l.id)}
              onEdit={() => handleStartEdit(l)}
              onDelete={() => handleDelete(l.id)}
              onShare={() => setShareList(l)}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <ListFormDialog
          title="إنشاء قائمة جديدة"
          name={newName}
          desc={newDesc}
          color={newColor}
          isPublic={newPublic}
          setName={setNewName}
          setDesc={setNewDesc}
          setColor={setNewColor}
          setIsPublic={setNewPublic}
          onSave={handleCreate}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {shareList && <ShareDialog list={shareList} onClose={() => setShareList(null)} />}
    </div>
  );
}

function ListCard({ list, onClick, onEdit, onDelete, onShare }: { list: CustomList; onClick: () => void; onEdit: () => void; onDelete: () => void; onShare: () => void; }) {
  const previewItems = list.items.slice(0, 4);
  const remaining = list.items.length - previewItems.length;
  return (
    <div data-ui-surface="card" className="card-hover bg-card border border-border rounded-xl overflow-hidden group">
      <button type="button" data-ui-action="surface" onClick={onClick} className="block w-full text-right" aria-label={`فتح قائمة ${list.name}`}>
        <div className="h-1.5" style={{ background: list.color }} />
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-base truncate">{list.name}</h3>
                {list.isPublic ? <Globe size={13} className="text-emerald-500 shrink-0" /> : <Lock size={13} className="text-muted-foreground shrink-0" />}
              </div>
              {list.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{list.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1 mt-3">
            {previewItems.map((item, i) => (
              <div key={i} className="w-10 h-14 rounded bg-muted shrink-0" />
            ))}
            {remaining > 0 && (
              <div className="w-10 h-14 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground font-medium">+{remaining}</div>
            )}
            {list.items.length === 0 && <div className="text-xs text-muted-foreground italic">لا توجد عناصر بعد</div>}
          </div>
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-muted-foreground">{list.items.length} عنصر</span>
            <ChevronRight size={14} className="text-muted-foreground" />
          </div>
        </div>
      </button>
      <div className="px-4 pb-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button type="button" data-ui-action="secondary" onClick={onEdit} className="text-xs px-2 py-1 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-1">
          <Edit3 size={11} /> تعديل
        </button>
        <button type="button" data-ui-action="secondary" onClick={onShare} className="text-xs px-2 py-1 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-1">
          <Share2 size={11} /> مشاركة
        </button>
        <button type="button" data-ui-action="danger" onClick={onDelete} className="text-xs px-2 py-1 rounded-md text-rose-500 hover:bg-rose-500/15 flex items-center gap-1 mr-auto">
          <Trash2 size={11} /> حذف
        </button>
      </div>
    </div>
  );
}

function ListView(props: {
  list: CustomList;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onShare: () => void;
  onAddItem: () => void;
  onRemoveItem: (tmdbId: number, mediaType: string) => void;
  showAddItem: boolean;
  onCloseAddItem: () => void;
  onAddToThisList: (item: { tmdbId: number; mediaType: string; title: string; posterPath?: string }) => void;
  editingList: string | null;
  editName: string;
  editDesc: string;
  editColor: string;
  editPublic: boolean;
  setEditName: (v: string) => void;
  setEditDesc: (v: string) => void;
  setEditColor: (v: string) => void;
  setEditPublic: (v: boolean) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
}) {
  const { list, onBack, onEdit, onDelete, onShare, onAddItem, onRemoveItem, showAddItem, onCloseAddItem, onAddToThisList, editingList, editName, editDesc, editColor, editPublic, setEditName, setEditDesc, setEditColor, setEditPublic, onSaveEdit, onCancelEdit } = props;
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <button type="button" data-ui-action="link" onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2">
            <ChevronRight size={12} /> العودة للقوائم
          </button>
          {editingList === list.id ? (
            <ListFormDialog
              title="تعديل القائمة"
              name={editName}
              desc={editDesc}
              color={editColor}
              isPublic={editPublic}
              setName={setEditName}
              setDesc={setEditDesc}
              setColor={setEditColor}
              setIsPublic={setEditPublic}
              onSave={onSaveEdit}
              onCancel={onCancelEdit}
              inline
            />
          ) : (
            <>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ background: list.color }} />
                <h1 className="text-2xl font-bold">{list.name}</h1>
                {list.isPublic ? <Globe size={16} className="text-emerald-500" /> : <Lock size={16} className="text-muted-foreground" />}
              </div>
              {list.description && <p className="text-sm text-muted-foreground mt-1">{list.description}</p>}
              <p className="text-xs text-muted-foreground mt-1">{list.items.length} عنصر</p>
            </>
          )}
        </div>
        {editingList !== list.id && (
          <div className="flex items-center gap-1">
            <button type="button" data-ui-action="icon" onClick={onEdit} className="w-9 h-9 rounded-md border border-border hover:bg-accent flex items-center justify-center" title="تعديل" aria-label="تعديل القائمة">
              <Edit3 size={15} />
            </button>
            <button type="button" data-ui-action="icon" onClick={onShare} className="w-9 h-9 rounded-md border border-border hover:bg-accent flex items-center justify-center" title="مشاركة" aria-label="مشاركة القائمة">
              <Share2 size={15} />
            </button>
            <button type="button" data-ui-action="danger-icon" onClick={onDelete} className="w-9 h-9 rounded-md border border-rose-500/30 text-rose-500 hover:bg-rose-500/15 flex items-center justify-center" title="حذف" aria-label="حذف القائمة">
              <Trash2 size={15} />
            </button>
          </div>
        )}
      </div>

      <button type="button" data-ui-action="secondary" onClick={onAddItem} className="w-full py-2.5 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2">
        <ListPlus size={16} /> أضف عنصرًا للقائمة
      </button>

      {list.items.length === 0 ? (
        <div className="feedback-state feedback-state--empty flex flex-col items-center justify-center p-12 text-center" role="status">
          <ListPlus className="text-muted-foreground/40 mx-auto mb-3" size={48} />
          <h3 className="text-base font-medium text-muted-foreground">القائمة فارغة</h3>
          <p className="text-xs text-muted-foreground/70 mt-1">أضف أفلامًا أو مسلسلات لتنظيمها هنا</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.items.map((item) => (
            <div key={`${item.tmdbId}-${item.mediaType}`} className="bg-card border border-border rounded-lg p-3 flex items-center gap-3 group">
              <div className="w-10 h-14 rounded bg-muted shrink-0" />
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium truncate">{item.title}</h4>
                <span className="text-[10px] text-muted-foreground">{TYPE_LABELS[item.mediaType] || item.mediaType}</span>
              </div>
              <button type="button" data-ui-action="danger-icon" onClick={() => onRemoveItem(item.tmdbId, item.mediaType)} className="w-7 h-7 rounded-md text-rose-500 hover:bg-rose-500/15 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" title="إزالة" aria-label={`إزالة ${item.title} من القائمة`}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showAddItem && (
        <AddItemDialog
          existingItems={list.items}
          onAdd={onAddToThisList}
          onClose={onCloseAddItem}
        />
      )}
    </div>
  );
}

function ListFormDialog(props: {
  title: string;
  name: string;
  desc: string;
  color: string;
  isPublic: boolean;
  setName: (v: string) => void;
  setDesc: (v: string) => void;
  setColor: (v: string) => void;
  setIsPublic: (v: boolean) => void;
  onSave: () => void;
  onCancel: () => void;
  inline?: boolean;
}) {
  const { title, name, desc, color, isPublic, setName, setDesc, setColor, setIsPublic, onSave, onCancel, inline } = props;
  const content = (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1.5">اسم القائمة *</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: أفلام العيد، أفضل رعب..." className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1.5">الوصف (اختياري)</label>
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="وصف قصير للقائمة..." rows={2} className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1.5">اللون</label>
        <div className="flex items-center gap-2 flex-wrap">
          {PRESET_COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} aria-label={`اختيار اللون ${c}`} aria-pressed={color === c} className={`w-8 h-8 rounded-full transition-transform ${color === c ? "ring-2 ring-offset-2 ring-offset-background ring-primary scale-105" : ""}`} style={{ background: c }} />
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1.5">الخصوصية</label>
        <div className="flex items-center gap-2">
          <button type="button" data-ui-action="choice" aria-pressed={!isPublic} onClick={() => setIsPublic(false)} className={`flex-1 px-3 py-2 rounded-md text-sm font-medium border flex items-center justify-center gap-1.5 ${!isPublic ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"}`}>
            <Lock size={14} /> خاصة
          </button>
          <button type="button" data-ui-action="choice" aria-pressed={isPublic} onClick={() => setIsPublic(true)} className={`flex-1 px-3 py-2 rounded-md text-sm font-medium border flex items-center justify-center gap-1.5 ${isPublic ? "border-emerald-500 bg-emerald-500/10 text-emerald-600" : "border-border hover:bg-accent"}`}>
            <Globe size={14} /> عامة
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          {isPublic ? "يمكن لأي شخص لديه الرابط رؤية القائمة" : "مرئية لك فقط"}
        </p>
      </div>
      <div className="flex items-center gap-2 pt-2">
        <button type="button" data-ui-action="primary" onClick={onSave} disabled={!name.trim()} className="flex-1 bg-primary text-primary-foreground py-2 rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5">
          <Check size={15} /> حفظ
        </button>
        <button type="button" data-ui-action="secondary" onClick={onCancel} className="px-4 py-2 border border-border rounded-md text-sm hover:bg-accent">إلغاء</button>
      </div>
    </div>
  );

  if (inline) return <div className="bg-card border border-border rounded-xl p-4">{content}</div>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div data-ui-surface="dialog" onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md bg-card rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">{title}</h2>
          <button type="button" data-ui-action="icon" onClick={onCancel} aria-label="إغلاق نافذة القائمة" className="w-8 h-8 rounded-md hover:bg-accent flex items-center justify-center"><X size={16} /></button>
        </div>
        {content}
      </div>
    </div>
  );
}

function AddItemDialog({ existingItems, onAdd, onClose }: { existingItems: CustomListItem[]; onAdd: (item: { tmdbId: number; mediaType: string; title: string; posterPath?: string }) => void; onClose: () => void; }) {
  const [query, setQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const search = async () => {
      if (!query.trim()) { setResults([]); return; }
      setLoading(true);
      try {
        const types = filterType === "all" ? "movie,tv" : filterType;
        const res = await fetch(`/api/tmdb/search/multi?query=${encodeURIComponent(query)}&page=1`);
        if (res.ok) {
          const data = await res.json();
          const items = (data.results || []).filter((r: any) => types.includes(r.mediaType)).slice(0, 20);
          setResults(items);
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    const t = setTimeout(search, 300);
    return () => clearTimeout(t);
  }, [query, filterType]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div data-ui-surface="dialog" onClick={(e) => e.stopPropagation()} className="relative w-full max-w-2xl bg-card rounded-2xl p-5 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">أضف للقائمة</h2>
          <button type="button" data-ui-action="icon" onClick={onClose} aria-label="إغلاق النافذة" className="w-8 h-8 rounded-md hover:bg-accent flex items-center justify-center"><X size={16} /></button>
        </div>
        <div className="space-y-3">
          <div className="relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث عن عمل..." autoFocus className="w-full pr-9 pl-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {[
              { v: "all", l: "الكل" },
              { v: "movie", l: "أفلام" },
              { v: "tv", l: "مسلسلات" },
            ].map((t) => (
              <button type="button" data-ui-action="choice" key={t.v} aria-pressed={filterType === t.v} onClick={() => setFilterType(t.v)} className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${filterType === t.v ? "bg-primary text-primary-foreground" : "bg-accent"}`}>
                {t.l}
              </button>
            ))}
          </div>
          {loading && <div className="text-center py-4 text-sm text-muted-foreground">جاري البحث...</div>}
          {!loading && results.length === 0 && query.trim() && (
            <div className="text-center py-4 text-sm text-muted-foreground">لا توجد نتائج</div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {results.map((m) => {
              const isAdded = existingItems.some((i) => i.tmdbId === m.id && i.mediaType === m.mediaType);
              return (
                <div key={`${m.id}-${m.mediaType}`} className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-accent/50">
                  <div className="w-9 h-12 rounded bg-muted shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{m.title || m.name}</div>
                    <div className="text-[10px] text-muted-foreground">{TYPE_LABELS[m.mediaType] || m.mediaType}</div>
                  </div>
                  <button
                    type="button"
                    data-ui-action="secondary"
                    onClick={() => onAdd({ tmdbId: m.id, mediaType: m.mediaType, title: m.title || m.name, posterPath: m.posterPath })}
                    disabled={isAdded}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium ${isAdded ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-primary/10 text-primary hover:bg-primary/20"}`}
                  >
                    {isAdded ? "✓ مضاف" : "+ إضافة"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ShareDialog({ list, onClose }: { list: CustomList; onClose: () => void }) {
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/list/${list.slug}` : "";
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopied(true);
        toast.success("تم نسخ الرابط");
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div data-ui-surface="dialog" onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md bg-card rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg flex items-center gap-2"><Share2 size={18} /> مشاركة القائمة</h2>
          <button type="button" data-ui-action="icon" onClick={onClose} aria-label="إغلاق النافذة" className="w-8 h-8 rounded-md hover:bg-accent flex items-center justify-center"><X size={16} /></button>
        </div>
        <div className="text-center py-4">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: list.color }}>
            <Crown size={28} className="text-white" />
          </div>
          <h3 className="font-bold text-base">{list.name}</h3>
          <p className="text-xs text-muted-foreground mt-1">{list.items.length} عنصر • {list.isPublic ? "قائمة عامة" : "قائمة خاصة"}</p>
        </div>
        {list.isPublic ? (
          <>
            <div className="bg-background border border-border rounded-md p-3 flex items-center gap-2">
              <span className="text-xs text-muted-foreground truncate flex-1" dir="ltr">{shareUrl}</span>
              <button type="button" data-ui-action="primary" onClick={handleCopy} className={`px-3 py-1.5 rounded-md text-xs font-medium shrink-0 ${copied ? "bg-emerald-500 text-white" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}>
                {copied ? "✓ تم النسخ" : "نسخ"}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground text-center mt-3">يمكن لأي شخص لديه الرابط رؤية محتوى هذه القائمة</p>
          </>
        ) : (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-3 text-center">
            <Lock className="text-amber-500 mx-auto mb-2" size={20} />
            <p className="text-sm text-amber-700 dark:text-amber-500 font-medium">القائمة خاصة</p>
            <p className="text-xs text-muted-foreground mt-1">غيّر الإعداد إلى "عامة" للسماح بالمشاركة عبر الرابط</p>
          </div>
        )}
      </div>
    </div>
  );
}
