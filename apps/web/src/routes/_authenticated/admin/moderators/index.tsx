import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/moderators/")({
  component: ModeratorsPage,
});

interface Moderator {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
}

async function fetchModerators(): Promise<Moderator[]> {
  const res = await api.api.v1.admin.moderators.$get();
  if (!res.ok) throw new Error("Failed to fetch moderators");
  return res.json() as Promise<Moderator[]>;
}

function ModeratorsPage() {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [resetPasswordId, setResetPasswordId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);

  const { data: moderators = [], isLoading } = useQuery({
    queryKey: ["moderators"],
    queryFn: fetchModerators,
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.v1.admin.moderators[":id"].status.$patch({
        param: { id },
      });
      if (!res.ok) throw new Error("Failed to toggle status");
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["moderators"] }),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({
      id,
      newPassword,
    }: {
      id: string;
      newPassword: string;
    }) => {
      const res = await api.api.v1.admin.moderators[":id"][
        "reset-password"
      ].$post({
        param: { id },
        json: { newPassword },
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Failed to reset password");
      }
    },
    onSuccess: () => {
      setResetPasswordId(null);
      setNewPassword("");
      setResetError(null);
    },
    onError: (err: Error) => setResetError(err.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Moderators</h1>
        <Button onClick={() => setAddOpen(true)}>Add Moderator</Button>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading...</p>}

      {!isLoading && moderators.length === 0 && (
        <p className="text-muted-foreground">
          No moderators yet. Add one to get started.
        </p>
      )}

      {moderators.length > 0 && (
        <div className="rounded-md border divide-y">
          {moderators.map((mod) => (
            <div
              key={mod.id}
              className="flex items-center justify-between p-4 gap-4"
            >
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{mod.name}</span>
                  <Badge variant={mod.isActive ? "default" : "secondary"}>
                    {mod.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                {mod.phone && (
                  <p className="text-sm text-muted-foreground">{mod.phone}</p>
                )}
                {mod.email && !mod.email.endsWith("@tamurfood.local") && (
                  <p className="text-sm text-muted-foreground">{mod.email}</p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                {resetPasswordId === mod.id ? (
                  <div className="flex gap-2 items-center">
                    <Input
                      type="password"
                      placeholder="New password"
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setResetError(null);
                      }}
                      className="h-8 w-40 text-sm"
                    />
                    {resetError && (
                      <p className="text-xs text-destructive">{resetError}</p>
                    )}
                    <Button
                      size="sm"
                      className="h-8"
                      disabled={
                        newPassword.length < 6 ||
                        resetPasswordMutation.isPending
                      }
                      onClick={() =>
                        resetPasswordMutation.mutate({
                          id: mod.id,
                          newPassword,
                        })
                      }
                    >
                      {resetPasswordMutation.isPending ? "Saving…" : "Save"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => {
                        setResetPasswordId(null);
                        setNewPassword("");
                        setResetError(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => setResetPasswordId(mod.id)}
                    >
                      Reset Password
                    </Button>
                    <Button
                      size="sm"
                      variant={mod.isActive ? "destructive" : "outline"}
                      className="h-8 text-xs"
                      disabled={toggleStatusMutation.isPending}
                      onClick={() => {
                        if (
                          confirm(
                            `${mod.isActive ? "Deactivate" : "Activate"} ${mod.name}?`,
                          )
                        ) {
                          toggleStatusMutation.mutate(mod.id);
                        }
                      }}
                    >
                      {mod.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {addOpen && (
        <AddModeratorDialog
          onClose={() => setAddOpen(false)}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ["moderators"] });
            setAddOpen(false);
          }}
        />
      )}
    </div>
  );
}

function AddModeratorDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await api.api.v1.admin.moderators.$post({
        json: {
          name,
          phone,
          email: email || null,
          password,
        },
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Failed to create moderator");
      }
    },
    onSuccess: onCreated,
    onError: (err: Error) => setError(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    createMutation.mutate();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Moderator</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mod-name">Name</Label>
            <Input
              id="mod-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mod-phone">Phone</Label>
            <Input
              id="mod-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mod-email">Email (optional)</Label>
            <Input
              id="mod-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mod-password">Password</Label>
            <Input
              id="mod-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
