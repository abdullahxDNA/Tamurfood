import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/shops/")({
  component: ShopsPage,
});

interface Shop {
  id: string;
  shopName: string;
  ownerName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
  userId: string;
}

async function fetchShops(): Promise<Shop[]> {
  const res = await api.api.v1.shops.$get();
  if (!res.ok) throw new Error("Failed to fetch shops");
  return res.json() as Promise<Shop[]>;
}

type DialogMode =
  | { type: "add" }
  | { type: "edit"; shop: Shop }
  | { type: "reset"; shopId: string }
  | null;

function ShopsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<DialogMode>(null);

  const {
    data: shops = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["shops"],
    queryFn: fetchShops,
  });

  const createMutation = useMutation({
    mutationFn: async (body: {
      shopName: string;
      ownerName: string;
      phone: string;
      email?: string;
      address?: string;
      password: string;
    }) => {
      const res = await api.api.v1.shops.$post({ json: body });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Failed to create shop");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shops"] });
      setDialog(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: string;
      shopName: string;
      ownerName: string;
      address?: string | null;
    }) => {
      const res = await api.api.v1.shops[":id"].$put({
        json: body,
        param: { id },
      });
      if (!res.ok) throw new Error("Failed to update shop");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shops"] });
      setDialog(null);
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.v1.shops[":id"].status.$patch({
        param: { id },
      });
      if (!res.ok) throw new Error("Failed to toggle status");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shops"] }),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({
      id,
      newPassword,
    }: {
      id: string;
      newPassword: string;
    }) => {
      const res = await api.api.v1.shops[":id"]["reset-password"].$post({
        json: { newPassword },
        param: { id },
      });
      if (!res.ok) throw new Error("Failed to reset password");
    },
    onSuccess: () => setDialog(null),
  });

  const filtered = shops.filter(
    (s) =>
      s.shopName.toLowerCase().includes(search.toLowerCase()) ||
      (s.phone ?? "").includes(search),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Shops</h1>
        <Button onClick={() => setDialog({ type: "add" })}>Add Shop</Button>
      </div>

      <Input
        placeholder="Search by name or phone..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {isLoading && <p className="text-muted-foreground">Loading...</p>}
      {isError && <p className="text-destructive">Failed to load shops.</p>}

      {!isLoading && !isError && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Shop Name</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground"
                >
                  No shops found.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((shop) => (
              <TableRow key={shop.id}>
                <TableCell className="font-medium">{shop.shopName}</TableCell>
                <TableCell>{shop.ownerName}</TableCell>
                <TableCell>{shop.phone ?? "—"}</TableCell>
                <TableCell className="max-w-[200px] truncate">
                  {shop.address ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={shop.isActive ? "default" : "secondary"}>
                    {shop.isActive ? "Active" : "Disabled"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDialog({ type: "edit", shop })}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setDialog({ type: "reset", shopId: shop.id })
                      }
                    >
                      Reset PW
                    </Button>
                    <Button
                      variant={shop.isActive ? "destructive" : "default"}
                      size="sm"
                      onClick={() => toggleStatusMutation.mutate(shop.id)}
                      disabled={toggleStatusMutation.isPending}
                    >
                      {shop.isActive ? "Disable" : "Enable"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Add / Edit Dialog */}
      {dialog && (dialog.type === "add" || dialog.type === "edit") && (
        <AddEditDialog
          mode={dialog.type}
          shop={dialog.type === "edit" ? dialog.shop : undefined}
          onClose={() => setDialog(null)}
          onSubmit={(data) => {
            if (dialog.type === "add") {
              createMutation.mutate(
                data as Parameters<typeof createMutation.mutate>[0],
              );
            } else {
              updateMutation.mutate({ id: dialog.shop.id, ...data });
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

      {/* Reset Password Dialog */}
      {dialog && dialog.type === "reset" && (
        <ResetPasswordDialog
          shopId={dialog.shopId}
          onClose={() => setDialog(null)}
          onSubmit={(newPassword) =>
            resetPasswordMutation.mutate({
              id: dialog.shopId,
              newPassword,
            })
          }
          isPending={resetPasswordMutation.isPending}
          error={(resetPasswordMutation.error as Error | null)?.message ?? null}
        />
      )}
    </div>
  );
}

function AddEditDialog({
  mode,
  shop,
  onClose,
  onSubmit,
  isPending,
  error,
}: {
  mode: "add" | "edit";
  shop?: Shop;
  onClose: () => void;
  onSubmit: (data: {
    shopName: string;
    ownerName: string;
    phone?: string;
    email?: string;
    address?: string | null;
    password?: string;
  }) => void;
  isPending: boolean;
  error: string | null;
}) {
  const [shopName, setShopName] = useState(shop?.shopName ?? "");
  const [ownerName, setOwnerName] = useState(shop?.ownerName ?? "");
  const [phone, setPhone] = useState(shop?.phone ?? "");
  const [email, setEmail] = useState(shop?.email ?? "");
  const [address, setAddress] = useState(shop?.address ?? "");
  const [password, setPassword] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      shopName,
      ownerName,
      ...(mode === "add" ? { phone, password } : { phone: phone || undefined }),
      ...(email ? { email } : {}),
      address: address || null,
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "Add Shop" : "Edit Shop"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="shopName">Shop Name</Label>
            <Input
              id="shopName"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ownerName">Owner Name</Label>
            <Input
              id="ownerName"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required={mode === "add"}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email (optional)</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address (optional)</Label>
            <Textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
            />
          </div>
          {mode === "add" && (
            <div className="space-y-2">
              <Label htmlFor="password">Temporary Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : mode === "add" ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  onClose,
  onSubmit,
  isPending,
  error,
}: {
  shopId: string;
  onClose: () => void;
  onSubmit: (newPassword: string) => void;
  isPending: boolean;
  error: string | null;
}) {
  const [newPassword, setNewPassword] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(newPassword);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Resetting..." : "Reset Password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
