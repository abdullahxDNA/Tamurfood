import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
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
  sortOrder: number;
  createdAt: string;
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

type DialogMode =
  | { type: "add" }
  | { type: "edit"; item: MenuItem }
  | null;

function MenuPage() {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [manageCatsOpen, setManageCatsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: items = [], isLoading, isError } = useQuery({
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
    }) => {
      const res = await api.api.v1.menu.$post({ json: body });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
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
      const res = await api.api.v1.menu[":id"].$put({ json: body, param: { id } });
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

  const toggleAvailabilityMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.v1.menu[":id"].availability.$patch({ param: { id } });
      if (!res.ok) throw new Error("Failed to toggle availability");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["menu"] }),
  });

  // Column-wise grouping: DB-ordered categories first, then any uncategorized
  const catNames = categories.map((c) => c.name);
  const grouped: [string, MenuItem[]][] = [];
  for (const cat of catNames) {
    const catItems = items.filter((i) => i.category === cat);
    if (catItems.length > 0) grouped.push([cat, catItems]);
  }
  const otherCats = [...new Set(items.map((i) => i.category).filter((c) => !catNames.includes(c)))];
  for (const cat of otherCats) {
    grouped.push([cat, items.filter((i) => i.category === cat)]);
  }

  const q = search.trim().toLowerCase();
  const filtered: [string, MenuItem[]][] = q
    ? grouped
        .map(([cat, catItems]): [string, MenuItem[]] => {
          // category name matches → show all its items
          if (cat.toLowerCase().includes(q)) return [cat, catItems];
          // otherwise filter items by name
          return [cat, catItems.filter((i) => i.name.toLowerCase().includes(q))];
        })
        .filter(([, catItems]) => catItems.length > 0)
    : grouped;

  function handleDelete(id: string, name: string) {
    if (confirm(`Delete "${name}"?`)) deleteMutation.mutate(id);
  }

  return (
    <div className="space-y-4">
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
          <Button variant="outline" onClick={() => setManageCatsOpen(true)}>
            Categories
          </Button>
          <Button onClick={() => setDialog({ type: "add" })}>Add Item</Button>
        </div>
      </div>

      {/* Search bar */}
      {!isLoading && !isError && items.length > 0 && (
        <div className="relative max-w-sm">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
            xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
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
        <p className="text-muted-foreground">No menu items yet. Add one to get started.</p>
      )}

      {/* No results */}
      {q && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">No items found for "{search}".</p>
      )}

      {/* Column layout */}
      {filtered.length > 0 && (
        <div className="flex gap-4 overflow-x-auto pb-2 items-start">
          {filtered.map(([category, catItems]) => (
            <div key={category} className="min-w-[240px] w-[240px] flex-shrink-0">
              <div className="flex items-center justify-between border-b pb-1.5 mb-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {category}
                </h2>
                <span className="text-xs font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                  {catItems.length}
                </span>
              </div>
              <div className="space-y-2">
                {catItems.map((item) => (
                  <div key={item.id} className="rounded-md border p-2.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-sm">{item.name}</span>
                        </div>
                        <p className="text-sm font-medium mt-0.5">৳{item.price}</p>
                      </div>
                      <Switch
                        checked={item.isAvailable}
                        onCheckedChange={() => toggleAvailabilityMutation.mutate(item.id)}
                        disabled={toggleAvailabilityMutation.isPending}
                      />
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-7 text-xs"
                        onClick={() => setDialog({ type: "edit", item })}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="flex-1 h-7 text-xs"
                        onClick={() => handleDelete(item.id, item.name)}
                        disabled={deleteMutation.isPending}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Manage categories dialog */}
      <CategoriesDialog
        open={manageCatsOpen}
        onClose={() => setManageCatsOpen(false)}
        categories={categories}
      />

      {/* Item dialog */}
      {(dialog?.type === "add" || dialog?.type === "edit") && (
        <MenuItemDialog
          mode={dialog.type}
          item={dialog.type === "edit" ? dialog.item : undefined}
          categories={categories}
          onClose={() => setDialog(null)}
          onSubmit={(data) => {
            if (dialog.type === "add") {
              createMutation.mutate(data);
            } else {
              updateMutation.mutate({ id: dialog.item.id, ...data });
            }
          }}
          isPending={createMutation.isPending || updateMutation.isPending}
          error={
            (createMutation.error as Error | null)?.message ??
            (updateMutation.error as Error | null)?.message ??
            null
          }
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
  onClose,
  onSubmit,
  isPending,
  error,
}: {
  mode: "add" | "edit";
  item?: MenuItem;
  categories: MenuCategory[];
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    price: number;
    category: string;
    imageUrl?: string | null;
    sortOrder?: number;
  }) => void;
  isPending: boolean;
  error: string | null;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(item?.name ?? "");
  const [price, setPrice] = useState(item?.price.toString() ?? "");
  const [category, setCategory] = useState(item?.category ?? categories[0]?.name ?? "");
  const [imageUrl, setImageUrl] = useState(item?.imageUrl ?? "");
  const [sortOrder, setSortOrder] = useState(item?.sortOrder?.toString() ?? "0");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inline new category state
  const [newCatMode, setNewCatMode] = useState(false);
  const [newCatInput, setNewCatInput] = useState("");
  const [newCatError, setNewCatError] = useState<string | null>(null);

  const addCategoryMutation = useMutation({
    mutationFn: async (catName: string) => {
      const res = await api.api.v1.menu.categories.$post({ json: { name: catName } });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
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
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? "Upload failed");
      }
      const { url } = await res.json() as { url: string };
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
      sortOrder: parseInt(sortOrder, 10) || 0,
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "add" ? "Add Menu Item" : "Edit Menu Item"}
          </DialogTitle>
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
                    onChange={(e) => { setNewCatInput(e.target.value); setNewCatError(null); }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={!newCatInput.trim() || addCategoryMutation.isPending}
                    onClick={() => addCategoryMutation.mutate(newCatInput.trim())}
                  >
                    {addCategoryMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => { setNewCatMode(false); setNewCatInput(""); setNewCatError(null); }}
                  >
                    Cancel
                  </Button>
                </div>
                {newCatError && <p className="text-sm text-destructive">{newCatError}</p>}
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
                  <SelectItem value="__new__" className="text-primary font-medium">
                    + New category
                  </SelectItem>
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
            {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="sortOrder">Sort Order</Label>
            <Input
              id="sortOrder"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || uploading || newCatMode}>
              {isPending ? "Saving..." : mode === "add" ? "Add Item" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Manage categories dialog ─────────────────────────────────────────────────

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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.v1.menu.categories[":id"].$delete({ param: { id } });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["menu-categories"] }),
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await api.api.v1.menu.categories[":id"].$put({ param: { id }, json: { name } });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
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
          {categories.map((cat) => (
            <div key={cat.id}>
              {editingId === cat.id ? (
                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <Input
                      autoFocus
                      value={editValue}
                      onChange={(e) => { setEditValue(e.target.value); setEditError(null); }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={!editValue.trim() || renameMutation.isPending}
                      onClick={() => renameMutation.mutate({ id: cat.id, name: editValue.trim() })}
                    >
                      {renameMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={cancelEdit}>
                      Cancel
                    </Button>
                  </div>
                  {editError && <p className="text-xs text-destructive">{editError}</p>}
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                  <span className="text-sm font-medium">{cat.name}</span>
                  <div className="flex gap-1.5">
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
                        if (confirm(`Delete category "${cat.name}"?`)) {
                          deleteMutation.mutate(cat.id);
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
