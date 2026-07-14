import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Clock, CheckCircle, XCircle, Check } from "lucide-react";
import { api } from "@/lib/api";
import { sessionQueryOptions } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/menu/")({
  component: MenuPage,
});

interface MenuCategory {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  imageUrl: string | null;
  isAvailable: boolean;
  isVisible: boolean;
  stockQuantity: number | null;
  sortOrder: number;
  createdAt: string;
}

interface PendingChange {
  id: string;
  type: "create" | "update" | "delete";
  proposedByName: string;
  menuItemId: string | null;
  proposedData: {
    name?: string;
    price?: number;
    category?: string;
    imageUrl?: string | null;
    sortOrder?: number;
  } | null;
  status: string;
  createdAt: string;
  // Current values of the item being edited/deleted (null for a create)
  currentName: string | null;
  currentPrice: number | null;
  currentCategory: string | null;
  currentImageUrl: string | null;
}

async function fetchMenu(): Promise<MenuItem[]> {
  const res = await api.api.v1.menu.$get();
  if (!res.ok) throw new Error("Failed to fetch menu");
  return res.json() as Promise<MenuItem[]>;
}

async function fetchCategories(): Promise<MenuCategory[]> {
  const res = await api.api.v1.menu.categories.$get();
  if (!res.ok) throw new Error("Failed to fetch categories");
  return res.json() as Promise<MenuCategory[]>;
}

async function fetchPendingChanges(): Promise<PendingChange[]> {
  const res = await api.api.v1.admin["pending-changes"].$get();
  if (!res.ok) throw new Error("Failed to fetch pending changes");
  return res.json() as Promise<PendingChange[]>;
}

type DialogMode = { type: "add" } | { type: "edit"; item: MenuItem } | null;

// ─── Draggable item card ──────────────────────────────────────────────────────
function SortableItem({
  item,
  isModerator,
  onEdit,
  onDelete,
  onToggle,
  onSetStock,
  onToggleVisibility,
  toggling,
  deleting,
  savingStock,
  togglingVisibility,
}: {
  item: MenuItem;
  isModerator: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onSetStock: (quantity: number | null) => void;
  onToggleVisibility: () => void;
  toggling: boolean;
  deleting: boolean;
  savingStock: boolean;
  togglingVisibility: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Local input mirrors the item's stock; empty string = untracked (unlimited).
  // Re-sync to the latest server value without an effect (adjust-on-render).
  const stockAsText =
    item.stockQuantity === null ? "" : String(item.stockQuantity);
  const [stockInput, setStockInput] = useState(stockAsText);
  const [prevStock, setPrevStock] = useState(item.stockQuantity);
  if (item.stockQuantity !== prevStock) {
    setPrevStock(item.stockQuantity);
    setStockInput(stockAsText);
  }

  const dirty = stockInput.trim() !== stockAsText;

  function commitStock() {
    const trimmed = stockInput.trim();
    const next =
      trimmed === "" ? null : Math.max(0, parseInt(trimmed, 10) || 0);
    if (next === item.stockQuantity) return;
    onSetStock(next);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`space-y-2 rounded-md border p-2.5 ${
        item.isVisible
          ? "bg-card"
          : "border-amber-400 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
      }`}
    >
      <div className="flex items-start justify-between gap-1.5">
        {!isModerator && (
          <button
            {...attributes}
            {...listeners}
            className="mt-0.5 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
            aria-label="Drag to reorder item"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium">{item.name}</span>
          {!item.isVisible && (
            <Badge variant="secondary" className="ml-1.5 text-[10px]">
              Hidden
            </Badge>
          )}
          <p className="mt-0.5 text-sm font-medium">৳{item.price}</p>
        </div>
        <Switch
          checked={item.isAvailable}
          onCheckedChange={onToggle}
          disabled={toggling}
        />
      </div>

      {/* Stock control — blank = unlimited; type a number then press ✓ to save */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Stock</span>
        <Input
          type="number"
          min={0}
          value={stockInput}
          onChange={(e) => setStockInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && dirty) commitStock();
            if (e.key === "Escape") setStockInput(stockAsText);
          }}
          placeholder="∞"
          disabled={savingStock}
          className="h-7 w-16 text-xs"
        />
        {dirty ? (
          <Button
            type="button"
            size="sm"
            className="h-7 px-2"
            onClick={commitStock}
            disabled={savingStock}
            title="Save stock"
            aria-label="Save stock"
          >
            <Check className="h-4 w-4" />
          </Button>
        ) : item.stockQuantity !== null ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={() => {
              setStockInput("");
              onSetStock(null);
            }}
            disabled={savingStock}
            title="Stop tracking stock (unlimited)"
          >
            Clear
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">unlimited</span>
        )}
      </div>

      <div className="flex gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="h-7 flex-1 text-xs"
          onClick={onEdit}
        >
          Edit
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className="h-7 flex-1 text-xs"
          onClick={onDelete}
          disabled={deleting}
        >
          {isModerator ? "Request Delete" : "Delete"}
        </Button>
      </div>

      {/* Hide/Show — admin only. Hidden items don't appear for shops/moderators */}
      {!isModerator && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-full text-xs"
          onClick={onToggleVisibility}
          disabled={togglingVisibility}
        >
          {item.isVisible ? "Hide from shops" : "Show to shops"}
        </Button>
      )}
    </div>
  );
}

// ─── Draggable category column ────────────────────────────────────────────────
function SortableColumn({
  id,
  count,
  disabled,
  children,
}: {
  id: string;
  count: number;
  disabled: boolean;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="w-[240px] min-w-[240px] flex-shrink-0"
    >
      <div className="mb-2 flex items-center justify-between border-b pb-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          {!disabled && (
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
              aria-label="Drag to reorder category"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}
          <h2 className="truncate text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {id}
          </h2>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {count}
        </span>
      </div>
      {children}
    </div>
  );
}

// One "before → after" row; highlights the change only when the value differs.
function FieldDiff({
  label,
  before,
  after,
}: {
  label: string;
  before: string | number | null;
  after: string | number | null | undefined;
}) {
  if (after == null || after === "") return null;
  const changed = String(before ?? "") !== String(after);
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-sm">
      <span className="text-xs text-muted-foreground">{label}:</span>
      {changed && before != null && before !== "" && (
        <>
          <span className="text-muted-foreground line-through">{before}</span>
          <span className="text-muted-foreground">→</span>
        </>
      )}
      <span className={changed ? "font-medium" : "text-muted-foreground"}>
        {after}
      </span>
    </p>
  );
}

// ─── Pending changes panel (admin only) ──────────────────────────────────────
function PendingChangesPanel() {
  const queryClient = useQueryClient();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const { data: pending = [], isLoading } = useQuery({
    queryKey: ["pending-changes"],
    queryFn: fetchPendingChanges,
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.v1.admin["pending-changes"][
        ":id"
      ].approve.$patch({
        param: { id },
      });
      if (!res.ok) throw new Error("Failed to approve");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-changes"] });
      queryClient.invalidateQueries({ queryKey: ["pending-changes-count"] });
      queryClient.invalidateQueries({ queryKey: ["menu"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note?: string }) => {
      const res = await api.api.v1.admin["pending-changes"][
        ":id"
      ].reject.$patch({
        param: { id },
        json: { note },
      });
      if (!res.ok) throw new Error("Failed to reject");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-changes"] });
      queryClient.invalidateQueries({ queryKey: ["pending-changes-count"] });
      setRejectingId(null);
      setRejectNote("");
    },
  });

  if (isLoading) return null;
  if (pending.length === 0) return null;

  function typeLabel(type: string) {
    if (type === "create") return "New Item";
    if (type === "update") return "Edit Item";
    return "Delete Item";
  }

  function typeBadgeVariant(
    type: string,
  ): "default" | "secondary" | "destructive" {
    if (type === "create") return "default";
    if (type === "update") return "secondary";
    return "destructive";
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <h2 className="font-semibold text-sm text-amber-900 dark:text-amber-200">
          Pending Requests ({pending.length})
        </h2>
      </div>
      <div className="space-y-2">
        {pending.map((change) => (
          <div
            key={change.id}
            className="rounded-md border bg-background p-3 space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={typeBadgeVariant(change.type)}>
                    {typeLabel(change.type)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    by {change.proposedByName}
                  </span>
                </div>
                {/* Create → just the new item */}
                {change.type === "create" && change.proposedData && (
                  <div className="text-sm space-y-0.5">
                    <p>
                      <span className="text-muted-foreground">New item:</span>{" "}
                      <span className="font-medium">
                        {change.proposedData.name}
                      </span>
                    </p>
                    {change.proposedData.price != null && (
                      <p>
                        <span className="text-muted-foreground">Price:</span> ৳
                        {change.proposedData.price}
                      </p>
                    )}
                    {change.proposedData.category && (
                      <p>
                        <span className="text-muted-foreground">Category:</span>{" "}
                        {change.proposedData.category}
                      </p>
                    )}
                    {change.proposedData.imageUrl && (
                      <img
                        src={change.proposedData.imageUrl}
                        alt="New"
                        className="h-12 w-12 rounded border object-cover"
                      />
                    )}
                  </div>
                )}

                {/* Update → before → after */}
                {change.type === "update" && change.proposedData && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Editing{" "}
                      <span className="font-medium text-foreground">
                        {change.currentName ?? "item"}
                      </span>
                    </p>
                    <FieldDiff
                      label="Name"
                      before={change.currentName}
                      after={change.proposedData.name}
                    />
                    <FieldDiff
                      label="Price"
                      before={
                        change.currentPrice != null
                          ? `৳${change.currentPrice}`
                          : null
                      }
                      after={
                        change.proposedData.price != null
                          ? `৳${change.proposedData.price}`
                          : null
                      }
                    />
                    <FieldDiff
                      label="Category"
                      before={change.currentCategory}
                      after={change.proposedData.category}
                    />
                    {(change.currentImageUrl ||
                      change.proposedData.imageUrl) && (
                      <div className="flex items-center gap-2 pt-0.5">
                        <span className="text-xs text-muted-foreground">
                          Image:
                        </span>
                        {change.currentImageUrl ? (
                          <img
                            src={change.currentImageUrl}
                            alt="Current"
                            className="h-10 w-10 rounded border object-cover opacity-60"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            none
                          </span>
                        )}
                        <span className="text-muted-foreground">→</span>
                        {change.proposedData.imageUrl ? (
                          <img
                            src={change.proposedData.imageUrl}
                            alt="Proposed"
                            className="h-10 w-10 rounded border object-cover"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            none
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Delete → the item being removed */}
                {change.type === "delete" && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Delete:</span>{" "}
                    <span className="font-medium">
                      {change.currentName ?? "item"}
                    </span>
                    {change.currentPrice != null && (
                      <span className="text-muted-foreground">
                        {" "}
                        (৳{change.currentPrice})
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>
            {rejectingId === change.id ? (
              <div className="space-y-2">
                <Input
                  placeholder="Rejection reason (optional)"
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  className="h-8 text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 text-xs"
                    disabled={rejectMutation.isPending}
                    onClick={() =>
                      rejectMutation.mutate({
                        id: change.id,
                        note: rejectNote || undefined,
                      })
                    }
                  >
                    {rejectMutation.isPending ? "Rejecting…" : "Confirm Reject"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => {
                      setRejectingId(null);
                      setRejectNote("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1"
                  disabled={approveMutation.isPending}
                  onClick={() => approveMutation.mutate(change.id)}
                >
                  <CheckCircle className="h-3 w-3" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => setRejectingId(change.id)}
                >
                  <XCircle className="h-3 w-3" />
                  Reject
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MenuPage() {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [manageCatsOpen, setManageCatsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: session } = useQuery(sessionQueryOptions);
  const isModerator = session?.role === "moderator";
  const isAdmin = session?.role === "admin";

  const {
    data: items = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["menu"],
    queryFn: fetchMenu,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["menu-categories"],
    queryFn: fetchCategories,
  });

  const createMutation = useMutation({
    mutationFn: async (body: {
      name: string;
      price: number;
      category: string;
      imageUrl?: string | null;
      sortOrder?: number;
      isVisible?: boolean;
    }) => {
      const res = await api.api.v1.menu.$post({ json: body });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Failed to create item");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu"] });
      setDialog(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: string;
      name?: string;
      price?: number;
      category?: string;
      imageUrl?: string | null;
      sortOrder?: number;
    }) => {
      const res = await api.api.v1.menu[":id"].$put({
        json: body,
        param: { id },
      });
      if (!res.ok) throw new Error("Failed to update item");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu"] });
      setDialog(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.v1.menu[":id"].$delete({ param: { id } });
      if (!res.ok) throw new Error("Failed to delete item");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["menu"] }),
  });

  // Moderator: submit change to pending queue
  const submitPendingMutation = useMutation({
    mutationFn: async (body: {
      type: "create" | "update" | "delete";
      menuItemId?: string;
      data?: object;
    }) => {
      const res = await fetch("/api/v1/menu/pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Failed to submit for review");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-changes-count"] });
      queryClient.invalidateQueries({ queryKey: ["my-requests"] });
      setDialog(null);
    },
  });

  const toggleAvailabilityMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.v1.menu[":id"].availability.$patch({
        param: { id },
      });
      if (!res.ok) throw new Error("Failed to toggle availability");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["menu"] }),
  });

  const setStockMutation = useMutation({
    mutationFn: async ({
      id,
      quantity,
    }: {
      id: string;
      quantity: number | null;
    }) => {
      const res = await api.api.v1.menu[":id"].stock.$patch({
        param: { id },
        json: { quantity },
      });
      if (!res.ok) throw new Error("Failed to update stock");
    },
    // Optimistic: reflect the new stock in the UI instantly, roll back on error.
    onMutate: async ({ id, quantity }) => {
      await queryClient.cancelQueries({ queryKey: ["menu"] });
      const prev = queryClient.getQueryData<MenuItem[]>(["menu"]);
      queryClient.setQueryData<MenuItem[]>(["menu"], (old) =>
        old?.map((i) => (i.id === id ? { ...i, stockQuantity: quantity } : i)),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["menu"], ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["menu"] }),
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.v1.menu[":id"].visibility.$patch({
        param: { id },
      });
      if (!res.ok) throw new Error("Failed to change visibility");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["menu"] }),
  });

  const reorderCategoriesMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await api.api.v1.menu.categories.reorder.$patch({
        json: { ids },
      });
      if (!res.ok) throw new Error("Failed to reorder categories");
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["menu-categories"] }),
  });

  const reorderItemsMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await api.api.v1.menu.reorder.$patch({ json: { ids } });
      if (!res.ok) throw new Error("Failed to reorder items");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["menu"] }),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const dbCatNames = categories.map((c) => c.name);

    if (dbCatNames.includes(activeId)) {
      const overCat = dbCatNames.includes(overId)
        ? overId
        : items.find((i) => i.id === overId)?.category;
      if (!overCat || overCat === activeId || !dbCatNames.includes(overCat))
        return;
      const from = dbCatNames.indexOf(activeId);
      const to = dbCatNames.indexOf(overCat);
      const newCats = arrayMove(categories, from, to);
      queryClient.setQueryData(["menu-categories"], newCats);
      reorderCategoriesMutation.mutate(newCats.map((c) => c.id));
      return;
    }

    const activeItem = items.find((i) => i.id === activeId);
    const overItem = items.find((i) => i.id === overId);
    if (activeItem && overItem && activeItem.category === overItem.category) {
      const cat = activeItem.category;
      const catItems = items.filter((i) => i.category === cat);
      const from = catItems.findIndex((i) => i.id === activeId);
      const to = catItems.findIndex((i) => i.id === overId);
      const reordered = arrayMove(catItems, from, to);
      const others = items.filter((i) => i.category !== cat);
      queryClient.setQueryData(["menu"], [...others, ...reordered]);
      reorderItemsMutation.mutate(reordered.map((i) => i.id));
    }
  }

  const catNames = categories.map((c) => c.name);
  const grouped: [string, MenuItem[]][] = [];
  for (const cat of catNames) {
    const catItems = items.filter((i) => i.category === cat);
    if (catItems.length > 0) grouped.push([cat, catItems]);
  }
  const otherCats = [
    ...new Set(
      items.map((i) => i.category).filter((c) => !catNames.includes(c)),
    ),
  ];
  for (const cat of otherCats) {
    grouped.push([cat, items.filter((i) => i.category === cat)]);
  }

  const q = search.trim().toLowerCase();
  const filtered: [string, MenuItem[]][] = q
    ? grouped
        .map(([cat, catItems]): [string, MenuItem[]] => {
          if (cat.toLowerCase().includes(q)) return [cat, catItems];
          return [
            cat,
            catItems.filter((i) => i.name.toLowerCase().includes(q)),
          ];
        })
        .filter(([, catItems]) => catItems.length > 0)
    : grouped;

  function handleDelete(id: string, name: string) {
    if (isModerator) {
      if (confirm(`Request deletion of "${name}"? Admin will review.`)) {
        submitPendingMutation.mutate({ type: "delete", menuItemId: id });
      }
    } else {
      if (confirm(`Delete "${name}"?`)) deleteMutation.mutate(id);
    }
  }

  function handleDialogSubmit(data: {
    name: string;
    price: number;
    category: string;
    imageUrl?: string | null;
    sortOrder?: number;
    isVisible?: boolean;
  }) {
    if (isModerator) {
      if (dialog?.type === "add") {
        submitPendingMutation.mutate({ type: "create", data });
      } else if (dialog?.type === "edit") {
        submitPendingMutation.mutate({
          type: "update",
          menuItemId: dialog.item.id,
          data,
        });
      }
    } else {
      if (dialog?.type === "add") {
        createMutation.mutate(data);
      } else if (dialog?.type === "edit") {
        updateMutation.mutate({ id: dialog.item.id, ...data });
      }
    }
  }

  const isDialogPending = isModerator
    ? submitPendingMutation.isPending
    : createMutation.isPending || updateMutation.isPending;

  const dialogError = isModerator
    ? ((submitPendingMutation.error as Error | null)?.message ?? null)
    : ((createMutation.error as Error | null)?.message ??
      (updateMutation.error as Error | null)?.message ??
      null);

  return (
    <div className="space-y-4">
      {/* Moderator info banner */}
      {isModerator && (
        <div className="rounded-md border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20 px-4 py-2.5 text-sm text-blue-800 dark:text-blue-200">
          Add / Edit / Delete requests go to admin for approval. Availability
          toggle is instant.
        </div>
      )}

      {/* Pending requests (admin only) */}
      {isAdmin && <PendingChangesPanel />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Menu</h1>
          {items.length > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {items.length} item{items.length !== 1 ? "s" : ""} total
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={() => setManageCatsOpen(true)}>
              Categories
            </Button>
          )}
          <Button onClick={() => setDialog({ type: "add" })}>
            {isModerator ? "Propose Item" : "Add Item"}
          </Button>
        </div>
      </div>

      {/* Search bar */}
      {!isLoading && !isError && items.length > 0 && (
        <div className="relative max-w-sm">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <Input
            placeholder="Search items or categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      )}

      {isLoading && <p className="text-muted-foreground">Loading...</p>}
      {isError && <p className="text-destructive">Failed to load menu.</p>}

      {!isLoading && !isError && items.length === 0 && (
        <p className="text-muted-foreground">
          No menu items yet. Add one to get started.
        </p>
      )}

      {q && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No items found for "{search}".
        </p>
      )}

      {filtered.length > 0 && !q && !isModerator && (
        <p className="text-xs text-muted-foreground">
          Drag the ⠿ handles to reorder categories and items — the shop shows
          them in this order.
        </p>
      )}

      {/* Column layout */}
      {filtered.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filtered.map(([category]) => category)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex items-start gap-4 overflow-x-auto pb-2">
              {filtered.map(([category, catItems]) => (
                <SortableColumn
                  key={category}
                  id={category}
                  count={catItems.length}
                  disabled={
                    !!q ||
                    isModerator ||
                    !categories.some((c) => c.name === category)
                  }
                >
                  <SortableContext
                    items={catItems.map((i) => i.id)}
                    strategy={verticalListSortingStrategy}
                    disabled={!!q || isModerator}
                  >
                    <div className="space-y-2">
                      {catItems.map((item) => (
                        <SortableItem
                          key={item.id}
                          item={item}
                          isModerator={!!isModerator}
                          onEdit={() => setDialog({ type: "edit", item })}
                          onDelete={() => handleDelete(item.id, item.name)}
                          onToggle={() =>
                            toggleAvailabilityMutation.mutate(item.id)
                          }
                          onSetStock={(quantity) =>
                            setStockMutation.mutate({ id: item.id, quantity })
                          }
                          onToggleVisibility={() =>
                            toggleVisibilityMutation.mutate(item.id)
                          }
                          togglingVisibility={
                            toggleVisibilityMutation.isPending &&
                            toggleVisibilityMutation.variables === item.id
                          }
                          toggling={
                            toggleAvailabilityMutation.isPending &&
                            toggleAvailabilityMutation.variables === item.id
                          }
                          deleting={
                            (deleteMutation.isPending &&
                              deleteMutation.variables === item.id) ||
                            (submitPendingMutation.isPending &&
                              submitPendingMutation.variables?.menuItemId ===
                                item.id)
                          }
                          savingStock={
                            setStockMutation.isPending &&
                            setStockMutation.variables?.id === item.id
                          }
                        />
                      ))}
                    </div>
                  </SortableContext>
                </SortableColumn>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Manage categories dialog (admin only) */}
      {isAdmin && (
        <CategoriesDialog
          open={manageCatsOpen}
          onClose={() => setManageCatsOpen(false)}
          categories={categories}
        />
      )}

      {/* Item dialog */}
      {(dialog?.type === "add" || dialog?.type === "edit") && (
        <MenuItemDialog
          mode={dialog.type}
          item={dialog.type === "edit" ? dialog.item : undefined}
          categories={categories}
          isModerator={!!isModerator}
          onClose={() => setDialog(null)}
          onSubmit={handleDialogSubmit}
          isPending={isDialogPending}
          error={dialogError}
        />
      )}
    </div>
  );
}

// ─── Item dialog ──────────────────────────────────────────────────────────────

function MenuItemDialog({
  mode,
  item,
  categories,
  isModerator,
  onClose,
  onSubmit,
  isPending,
  error,
}: {
  mode: "add" | "edit";
  item?: MenuItem;
  categories: MenuCategory[];
  isModerator: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    price: number;
    category: string;
    imageUrl?: string | null;
    sortOrder?: number;
    isVisible?: boolean;
  }) => void;
  isPending: boolean;
  error: string | null;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(item?.name ?? "");
  const [price, setPrice] = useState(item?.price.toString() ?? "");
  const [category, setCategory] = useState(
    item?.category ?? categories[0]?.name ?? "",
  );
  const [imageUrl, setImageUrl] = useState(item?.imageUrl ?? "");
  // New items: choose whether they go live immediately or start hidden.
  const [visible, setVisible] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newCatMode, setNewCatMode] = useState(false);
  const [newCatInput, setNewCatInput] = useState("");
  const [newCatError, setNewCatError] = useState<string | null>(null);

  const addCategoryMutation = useMutation({
    mutationFn: async (catName: string) => {
      const res = await api.api.v1.menu.categories.$post({
        json: { name: catName },
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Failed to add category");
      }
    },
    onSuccess: (_, catName) => {
      queryClient.invalidateQueries({ queryKey: ["menu-categories"] });
      setCategory(catName);
      setNewCatMode(false);
      setNewCatInput("");
      setNewCatError(null);
    },
    onError: (err: Error) => setNewCatError(err.message),
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/v1/menu/upload", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Upload failed");
      }
      const { url } = (await res.json()) as { url: string };
      setImageUrl(url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name,
      price: parseInt(price, 10),
      category,
      imageUrl: imageUrl || null,
      // Only meaningful when an admin adds a new item.
      ...(mode === "add" && !isModerator ? { isVisible: visible } : {}),
    });
  }

  const title = isModerator
    ? mode === "add"
      ? "Propose New Item"
      : "Propose Edit"
    : mode === "add"
      ? "Add Menu Item"
      : "Edit Menu Item";

  const submitLabel = isModerator
    ? isPending
      ? "Submitting…"
      : "Submit for Review"
    : isPending
      ? "Saving…"
      : mode === "add"
        ? "Add Item"
        : "Save";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="price">Price (৳)</Label>
            <Input
              id="price"
              type="number"
              min={1}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            {newCatMode ? (
              <div className="space-y-1.5">
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    placeholder="New category name"
                    value={newCatInput}
                    onChange={(e) => {
                      setNewCatInput(e.target.value);
                      setNewCatError(null);
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={
                      !newCatInput.trim() || addCategoryMutation.isPending
                    }
                    onClick={() =>
                      addCategoryMutation.mutate(newCatInput.trim())
                    }
                  >
                    {addCategoryMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setNewCatMode(false);
                      setNewCatInput("");
                      setNewCatError(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
                {newCatError && (
                  <p className="text-sm text-destructive">{newCatError}</p>
                )}
              </div>
            ) : (
              <Select
                value={category}
                onValueChange={(v) => {
                  if (v === "__new__") {
                    setNewCatMode(true);
                  } else {
                    setCategory(v);
                  }
                }}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.name}>
                      {cat.name}
                    </SelectItem>
                  ))}
                  {!isModerator && (
                    <SelectItem
                      value="__new__"
                      className="text-primary font-medium"
                    >
                      + New category
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2">
            <Label>Image (optional)</Label>
            <div className="flex items-center gap-3">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt="Menu item"
                  className="h-16 w-16 rounded border object-cover"
                />
              ) : (
                <div className="h-16 w-16 rounded border bg-muted" />
              )}
              <div className="flex flex-col gap-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? "Uploading..." : "Choose Image"}
                </Button>
                {imageUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setImageUrl("")}
                    disabled={uploading}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
            {uploadError && (
              <p className="text-sm text-destructive">{uploadError}</p>
            )}
          </div>
          {mode === "add" && !isModerator && (
            <div className="flex items-center justify-between rounded-md border p-2.5">
              <div className="space-y-0.5">
                <Label htmlFor="visible">Show to shops now</Label>
                <p className="text-xs text-muted-foreground">
                  Turn off to add it hidden and reveal it later.
                </p>
              </div>
              <Switch
                id="visible"
                checked={visible}
                onCheckedChange={setVisible}
              />
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || uploading || newCatMode}
            >
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Manage categories dialog ─────────────────────────────────────────────────

function SortableCatRow({
  id,
  children,
}: {
  id: string;
  children: (handle: React.HTMLAttributes<HTMLElement>) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children({
        ...attributes,
        ...listeners,
      } as React.HTMLAttributes<HTMLElement>)}
    </div>
  );
}

function CategoriesDialog({
  open,
  onClose,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  categories: MenuCategory[];
}) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const reorderMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await api.api.v1.menu.categories.reorder.$patch({
        json: { ids },
      });
      if (!res.ok) throw new Error("Failed to reorder categories");
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["menu-categories"] }),
  });

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = categories.findIndex((c) => c.id === active.id);
    const to = categories.findIndex((c) => c.id === over.id);
    if (from === -1 || to === -1) return;
    const newCats = arrayMove(categories, from, to);
    queryClient.setQueryData(["menu-categories"], newCats);
    reorderMutation.mutate(newCats.map((c) => c.id));
  }

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.v1.menu.categories[":id"].$delete({
        param: { id },
      });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["menu-categories"] }),
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await api.api.v1.menu.categories[":id"].$put({
        param: { id },
        json: { name },
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Failed to rename");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-categories"] });
      setEditingId(null);
      setEditError(null);
    },
    onError: (err: Error) => setEditError(err.message),
  });

  function startEdit(cat: MenuCategory) {
    setEditingId(cat.id);
    setEditValue(cat.name);
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValue("");
    setEditError(null);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Manage Categories</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-1">
          {categories.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No categories yet. Add one from the Add Item dialog.
            </p>
          )}
          {categories.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground">
                Drag the ⠿ handles to reorder — the shop shows categories in
                this order.
              </p>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={categories.map((c) => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {categories.map((cat) => (
                      <SortableCatRow key={cat.id} id={cat.id}>
                        {(handle) =>
                          editingId === cat.id ? (
                            <div className="space-y-1.5">
                              <div className="flex gap-2">
                                <Input
                                  autoFocus
                                  value={editValue}
                                  onChange={(e) => {
                                    setEditValue(e.target.value);
                                    setEditError(null);
                                  }}
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={
                                    !editValue.trim() ||
                                    renameMutation.isPending
                                  }
                                  onClick={() =>
                                    renameMutation.mutate({
                                      id: cat.id,
                                      name: editValue.trim(),
                                    })
                                  }
                                >
                                  {renameMutation.isPending
                                    ? "Saving..."
                                    : "Save"}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={cancelEdit}
                                >
                                  Cancel
                                </Button>
                              </div>
                              {editError && (
                                <p className="text-xs text-destructive">
                                  {editError}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                              <div className="flex min-w-0 items-center gap-2">
                                <button
                                  {...handle}
                                  type="button"
                                  className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
                                  aria-label="Drag to reorder category"
                                >
                                  <GripVertical className="h-4 w-4" />
                                </button>
                                <span className="truncate text-sm font-medium">
                                  {cat.name}
                                </span>
                              </div>
                              <div className="flex shrink-0 gap-1.5">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => startEdit(cat)}
                                >
                                  Rename
                                </Button>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  className="h-7 text-xs"
                                  disabled={deleteMutation.isPending}
                                  onClick={() => {
                                    if (
                                      confirm(`Delete category "${cat.name}"?`)
                                    ) {
                                      deleteMutation.mutate(cat.id);
                                    }
                                  }}
                                >
                                  Delete
                                </Button>
                              </div>
                            </div>
                          )
                        }
                      </SortableCatRow>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
