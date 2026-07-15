"use client";

import { useState, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { pickGradient, allMedia } from "@/lib/mock-data";
import type { CustomList, MediaType } from "@/lib/types";
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
  ExternalLink,
  Search,
  ListPlus,
  Crown,
} from "lucide-react";

const PRESET_COLORS = [
  "#f59e0b", "#10b981", "#3b82f6", "#ec4899",
  "#8b5cf6", "#ef4444", "#14b8a6", "#f97316",
];

const TYPE_LABELS: Record<MediaType, string> = {
  movie: "فيلم",
  tv: "مسلسل",
  anime: "أنمي",
  arabic_movie: "فيلم عربي",
  arabic_tv: "مسلسل عربي",
};

export function ListsView() {
  const { lists, createList, deleteList, updateList, addToList, removeFromList } = useAppStore();
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingList, setEditingList] = useState<string | null>(null);
  const [shareList, setShareList] = useState<CustomList | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);

  // Create form
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [newPublic, setNewPublic] = useState(false);

  // Edit form
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editColor, setEditColor] = useState(PRESET_COLORS[0]);
  const [editPublic, setEditPublic] = useState(false);

  const selectedList = lists.find((l) => l.id === selectedListId) || null;

  const handleCreate = () => {
    if (!newName.trim()) return;
    const id = createList(newName.trim(), newDesc.trim(), newColor, newPublic);
    setNewName("");
    setNewDesc("");
    setNewColor(PRESET_COLORS[0]);
    setNewPublic(false);
    setShowCreate(false);
    setSelectedListId(id);
  };

  const handleStartEdit = (l: CustomList) => {
    setEditingList(l.id);
    setEditName(l.name);
    setEditDesc(l.description || "");
    setEditColor(l.color);
    setEditPublic(l.isPublic);
  };

  const handleSaveEdit = () => {
    if (!editingList || !editName.trim()) return;
    updateList(editingList, {
      name: editName.trim(),
      description: editDesc.trim(),
      color: editColor,
      isPublic: editPublic,
    });
    setEditingList(null);
  };

  // Aggregate stats
  const totalItems = useMemo(() => lists.reduce((sum, l) => sum + l.items.length, 0), [lists]);

  if (selectedList) {
    return (
      <>
        <ListView
          list={selectedList}
          onBack={() => setSelectedListId(null)}
          onEdit={() => handleStartEdit(selectedList)}
          onDelete={() => {
            deleteList(selectedList.id);
            setSelectedListId(null);
          }}
          onShare={() => setShareList(selectedList)}
          onAddItem={() => setShowAddItem(true)}
          onRemoveItem={(tmdbId, mediaType) => removeFromList(selectedList.id, tmdbId, mediaType)}
          showAddItem={showAddItem}
          onCloseAddItem={() => setShowAddItem(false)}
          onAddToThisList={(item) => {
            addToList(selectedList.id, item);
          }}
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
        {/* Share dialog (rendered here so it shows above the ListView) */}
        {shareList && (
          <ShareDialog list={shareList} onClose={() => setShareList(null)} />
        )}
      </>
    );
  }

  return (
    <div className="space-y-6 pb-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ListIcon size={24} /> قوائمي
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lists.length} قائمة • {totalItems} عنصر
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-primary text-primary-foreground px-3 py-2 rounded-md text-sm font-medium flex items-center gap-1.5 hover:bg-primary/90"
        >
          <Plus size={16} /> قائمة جديدة
        </button>
      </div>

      {/* Lists grid */}
      {lists.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
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
              onDelete={() => deleteList(l.id)}
              onShare={() => setShareList(l)}
            />
          ))}
        </div>
      )}

      {/* Create dialog */}
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

      {/* Share dialog */}
      {shareList && (
        <ShareDialog list={shareList} onClose={() => setShareList(null)} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// List card (in the lists grid)
// ─────────────────────────────────────────────────────────────

function ListCard({
  list,
  onClick,
  onEdit,
  onDelete,
  onShare,
}: {
  list: CustomList;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onShare: () => void;
}) {
  // Show up to 4 mini posters as preview
  const previewItems = list.items.slice(0, 4);
  const remaining = list.items.length - previewItems.length;

  return (
    <div className="card-hover bg-card border border-border rounded-xl overflow-hidden group">
      <button onClick={onClick} className="block w-full text-right">
        {/* Color strip */}
        <div className="h-1.5" style={{ background: list.color }} />
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-base truncate">{list.name}</h3>
                {list.isPublic ? (
                  <Globe size={13} className="text-emerald-500 shrink-0" />
                ) : (
                  <Lock size={13} className="text-muted-foreground shrink-0" />
                )}
              </div>
              {list.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{list.description}</p>
              )}
            </div>
          </div>

          {/* Posters preview */}
          <div className="flex items-center gap-1 mt-3">
            {previewItems.map((item, i) => (
              <div
                key={i}
                className={cn(
                  "w-10 h-14 rounded bg-gradient-to-br shrink-0",
                  pickGradient(item.tmdbId)
                )}
              />
            ))}
            {remaining > 0 && (
              <div className="w-10 h-14 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground font-medium">
                +{remaining}
              </div>
            )}
            {list.items.length === 0 && (
              <div className="text-xs text-muted-foreground italic">لا توجد عناصر بعد</div>
            )}
          </div>

          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-muted-foreground">{list.items.length} عنصر</span>
            <ChevronRight size={14} className="text-muted-foreground flip-x" />
          </div>
        </div>
      </button>

      {/* Actions on hover */}
      <div className="px-4 pb-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="text-xs px-2 py-1 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-1"
        >
          <Edit3 size={11} /> تعديل
        </button>
        <button
          onClick={onShare}
          className="text-xs px-2 py-1 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-1"
        >
          <Share2 size={11} /> مشاركة
        </button>
        <button
          onClick={onDelete}
          className="text-xs px-2 py-1 rounded-md text-rose-500 hover:bg-rose-500/15 flex items-center gap-1 mr-auto"
        >
          <Trash2 size={11} /> حذف
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// List view (when a list is selected)
// ─────────────────────────────────────────────────────────────

function ListView({
  list,
  onBack,
  onEdit,
  onDelete,
  onShare,
  onAddItem,
  onRemoveItem,
  showAddItem,
  onCloseAddItem,
  onAddToThisList,
  editingList,
  editName,
  editDesc,
  editColor,
  editPublic,
  setEditName,
  setEditDesc,
  setEditColor,
  setEditPublic,
  onSaveEdit,
  onCancelEdit,
}: {
  list: CustomList;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onShare: () => void;
  onAddItem: () => void;
  onRemoveItem: (tmdbId: number, mediaType: MediaType) => void;
  showAddItem: boolean;
  onCloseAddItem: () => void;
  onAddToThisList: (item: { tmdbId: number; mediaType: MediaType; title: string; posterPath?: string }) => void;
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
  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <button
            onClick={onBack}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"
          >
            <ChevronRight size={12} className="flip-x" /> العودة للقوائم
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
                {list.isPublic ? (
                  <Globe size={16} className="text-emerald-500" />
                ) : (
                  <Lock size={16} className="text-muted-foreground" />
                )}
              </div>
              {list.description && (
                <p className="text-sm text-muted-foreground mt-1">{list.description}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">{list.items.length} عنصر</p>
            </>
          )}
        </div>
        {editingList !== list.id && (
          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              className="w-9 h-9 rounded-md border border-border hover:bg-accent flex items-center justify-center"
              title="تعديل"
            >
              <Edit3 size={15} />
            </button>
            <button
              onClick={onShare}
              className="w-9 h-9 rounded-md border border-border hover:bg-accent flex items-center justify-center"
              title="مشاركة"
            >
              <Share2 size={15} />
            </button>
            <button
              onClick={onDelete}
              className="w-9 h-9 rounded-md border border-rose-500/30 text-rose-500 hover:bg-rose-500/15 flex items-center justify-center"
              title="حذف"
            >
              <Trash2 size={15} />
            </button>
          </div>
        )}
      </div>

      {/* Add item button */}
      <button
        onClick={onAddItem}
        className="w-full py-2.5 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
      >
        <ListPlus size={16} /> أضف عنصرًا للقائمة
      </button>

      {/* Items */}
      {list.items.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <ListPlus className="text-muted-foreground/40 mx-auto mb-3" size={48} />
          <h3 className="text-base font-medium text-muted-foreground">القائمة فارغة</h3>
          <p className="text-xs text-muted-foreground/70 mt-1">أضف أفلامًا أو مسلسلات لتنظيمها هنا</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {list.items.map((item) => (
            <div
              key={`${item.tmdbId}-${item.mediaType}`}
              className="card-hover relative w-full overflow-hidden rounded-xl bg-card border border-border group"
            >
              <div className={cn("relative aspect-[2/3] bg-gradient-to-br", pickGradient(item.tmdbId))}>
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-2">
                  <h3 className="text-white font-bold text-xs line-clamp-2 leading-tight">{item.title}</h3>
                  <span className="text-white/70 text-[10px]">{TYPE_LABELS[item.mediaType]}</span>
                </div>
              </div>
              <button
                onClick={() => onRemoveItem(item.tmdbId, item.mediaType)}
                className="absolute top-1 left-1 w-6 h-6 rounded-full bg-black/60 text-white hover:bg-rose-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                title="إزالة"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add item dialog */}
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

// ─────────────────────────────────────────────────────────────
// List form (create/edit)
// ─────────────────────────────────────────────────────────────

function ListFormDialog({
  title,
  name,
  desc,
  color,
  isPublic,
  setName,
  setDesc,
  setColor,
  setIsPublic,
  onSave,
  onCancel,
  inline,
}: {
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
  const content = (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1.5">اسم القائمة *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="مثال: أفلام العيد، أفضل رعب..."
          className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1.5">الوصف (اختياري)</label>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="وصف قصير للقائمة..."
          rows={2}
          className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1.5">اللون</label>
        <div className="flex items-center gap-2 flex-wrap">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={cn(
                "w-8 h-8 rounded-full transition-transform",
                color === c ? "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110" : ""
              )}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1.5">الخصوصية</label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPublic(false)}
            className={cn(
              "flex-1 px-3 py-2 rounded-md text-sm font-medium border flex items-center justify-center gap-1.5",
              !isPublic ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"
            )}
          >
            <Lock size={14} /> خاصة
          </button>
          <button
            onClick={() => setIsPublic(true)}
            className={cn(
              "flex-1 px-3 py-2 rounded-md text-sm font-medium border flex items-center justify-center gap-1.5",
              isPublic ? "border-emerald-500 bg-emerald-500/10 text-emerald-600" : "border-border hover:bg-accent"
            )}
          >
            <Globe size={14} /> عامة
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          {isPublic ? "يمكن لأي شخص لديه الرابط رؤية القائمة" : "مرئية لك فقط"}
        </p>
      </div>
      <div className="flex items-center gap-2 pt-2">
        <button
          onClick={onSave}
          disabled={!name.trim()}
          className="flex-1 bg-primary text-primary-foreground py-2 rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          <Check size={15} /> حفظ
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-border rounded-md text-sm hover:bg-accent"
        >
          إلغاء
        </button>
      </div>
    </div>
  );

  if (inline) {
    return <div className="bg-card border border-border rounded-xl p-4">{content}</div>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-card rounded-2xl p-5 max-h-[90vh] overflow-y-auto scroll-thin"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">{title}</h2>
          <button onClick={onCancel} className="w-8 h-8 rounded-md hover:bg-accent flex items-center justify-center">
            <X size={16} />
          </button>
        </div>
        {content}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Add item dialog (search + add)
// ─────────────────────────────────────────────────────────────

function AddItemDialog({
  existingItems,
  onAdd,
  onClose,
}: {
  existingItems: { tmdbId: number; mediaType: MediaType }[];
  onAdd: (item: { tmdbId: number; mediaType: MediaType; title: string; posterPath?: string }) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filterType, setFilterType] = useState<MediaType | "all">("all");

  const results = useMemo(() => {
    let items = [...allMedia];
    if (filterType !== "all") items = items.filter((m) => m.mediaType === filterType);
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      items = items.filter((m) => m.title.toLowerCase().includes(q));
    }
    return items.slice(0, 30);
  }, [query, filterType]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-card rounded-2xl p-5 max-h-[85vh] overflow-y-auto scroll-thin"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">أضف للقائمة</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-md hover:bg-accent flex items-center justify-center">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث عن عمل..."
              autoFocus
              className="w-full pr-9 pl-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setFilterType("all")}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap",
                filterType === "all" ? "bg-primary text-primary-foreground" : "bg-accent"
              )}
            >
              الكل
            </button>
            {(Object.keys(TYPE_LABELS) as MediaType[]).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap",
                  filterType === t ? "bg-primary text-primary-foreground" : "bg-accent"
                )}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {results.map((m) => {
              const isAdded = existingItems.some((i) => i.tmdbId === m.tmdbId && i.mediaType === m.mediaType);
              return (
                <div
                  key={`${m.id}-${m.tmdbId}`}
                  className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-accent/50"
                >
                  <div className={cn("w-9 h-12 rounded bg-gradient-to-br shrink-0", pickGradient(m.tmdbId))} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{m.title}</div>
                    <div className="text-[10px] text-muted-foreground">{TYPE_LABELS[m.mediaType]}</div>
                  </div>
                  <button
                    onClick={() =>
                      onAdd({ tmdbId: m.tmdbId, mediaType: m.mediaType, title: m.title, posterPath: m.posterPath })
                    }
                    disabled={isAdded}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-xs font-medium",
                      isAdded
                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                        : "bg-primary/10 text-primary hover:bg-primary/20"
                    )}
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

// ─────────────────────────────────────────────────────────────
// Share dialog
// ─────────────────────────────────────────────────────────────

function ShareDialog({ list, onClose }: { list: CustomList; onClose: () => void }) {
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/list/${list.slug}` : "";
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-card rounded-2xl p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Share2 size={18} /> مشاركة القائمة
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-md hover:bg-accent flex items-center justify-center">
            <X size={16} />
          </button>
        </div>

        <div className="text-center py-4">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: list.color }}>
            <Crown size={28} className="text-white" />
          </div>
          <h3 className="font-bold text-base">{list.name}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {list.items.length} عنصر • {list.isPublic ? "قائمة عامة" : "قائمة خاصة"}
          </p>
        </div>

        {list.isPublic ? (
          <>
            <div className="bg-background border border-border rounded-md p-3 flex items-center gap-2">
              <span className="text-xs text-muted-foreground truncate flex-1" dir="ltr">{shareUrl}</span>
              <button
                onClick={handleCopy}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium shrink-0",
                  copied ? "bg-emerald-500 text-white" : "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
              >
                {copied ? "✓ تم النسخ" : "نسخ"}
              </button>
            </div>
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 w-full py-2 border border-border rounded-md text-sm hover:bg-accent flex items-center justify-center gap-1.5"
              onClick={(e) => e.preventDefault()}
            >
              <ExternalLink size={14} /> فتح الرابط
            </a>
            <p className="text-[11px] text-muted-foreground text-center mt-3">
              يمكن لأي شخص لديه الرابط رؤية محتوى هذه القائمة
            </p>
          </>
        ) : (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-3 text-center">
            <Lock className="text-amber-500 mx-auto mb-2" size={20} />
            <p className="text-sm text-amber-700 dark:text-amber-500 font-medium">القائمة خاصة</p>
            <p className="text-xs text-muted-foreground mt-1">
              غيّر الإعداد إلى "عامة" للسماح بالمشاركة عبر الرابط
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
