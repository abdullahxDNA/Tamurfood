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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export const Route = createFileRoute("/_authenticated/admin/payments/")({
  component: PaymentsPage,
});

interface Payment {
  id: string;
  shopId: string;
  shopName: string;
  amount: number;
  paymentDate: string;
  note: string | null;
  recordedByName: string;
  createdAt: string;
}

interface Shop {
  id: string;
  shopName: string;
  ownerName: string;
  isActive: boolean;
}

async function fetchPayments(): Promise<Payment[]> {
  const res = await api.api.v1.admin.payments.$get();
  if (!res.ok) throw new Error("Failed to fetch payments");
  return res.json() as Promise<Payment[]>;
}

async function fetchShops(): Promise<Shop[]> {
  const res = await api.api.v1.shops.$get();
  if (!res.ok) throw new Error("Failed to fetch shops");
  return res.json() as Promise<Shop[]>;
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function PaymentsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const {
    data: payments = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["admin/payments"],
    queryFn: fetchPayments,
  });

  const { data: shops = [] } = useQuery({
    queryKey: ["shops"],
    queryFn: fetchShops,
  });

  const createMutation = useMutation({
    mutationFn: async (body: {
      shopId: string;
      amount: number;
      paymentDate: string;
      note?: string;
    }) => {
      const res = await api.api.v1.admin.payments.$post({ json: body });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Failed to record payment");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin/payments"] });
      setDialogOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.v1.admin.payments[":id"].$delete({
        param: { id },
      });
      if (!res.ok) throw new Error("Failed to delete payment");
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin/payments"] }),
  });

  function handleDelete(id: string) {
    if (confirm("Delete this payment record?")) {
      deleteMutation.mutate(id);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Payments</h1>
        <Button onClick={() => setDialogOpen(true)}>Record Payment</Button>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading...</p>}
      {isError && <p className="text-destructive">Failed to load payments.</p>}

      {!isLoading && !isError && payments.length === 0 && (
        <p className="text-muted-foreground">No payments recorded yet.</p>
      )}

      {payments.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Shop</TableHead>
              <TableHead>Amount (৳)</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>Recorded By</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div>{p.paymentDate}</div>
                  <div className="text-xs text-muted-foreground">
                    recorded{" "}
                    {new Date(p.createdAt).toLocaleTimeString("en-BD", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </TableCell>
                <TableCell>{p.shopName}</TableCell>
                <TableCell>৳{p.amount.toLocaleString()}</TableCell>
                <TableCell className="text-muted-foreground">
                  {p.note ?? "—"}
                </TableCell>
                <TableCell>{p.recordedByName}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(p.id)}
                    disabled={deleteMutation.isPending}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {dialogOpen && (
        <RecordPaymentDialog
          shops={shops}
          onClose={() => setDialogOpen(false)}
          onSubmit={(data) => createMutation.mutate(data)}
          isPending={createMutation.isPending}
          error={(createMutation.error as Error | null)?.message ?? null}
        />
      )}
    </div>
  );
}

function RecordPaymentDialog({
  shops,
  onClose,
  onSubmit,
  isPending,
  error,
}: {
  shops: Shop[];
  onClose: () => void;
  onSubmit: (data: {
    shopId: string;
    amount: number;
    paymentDate: string;
    note?: string;
  }) => void;
  isPending: boolean;
  error: string | null;
}) {
  const [shopId, setShopId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayString());
  const [note, setNote] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      shopId,
      amount: parseInt(amount, 10),
      paymentDate,
      note: note || undefined,
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Shop</Label>
            <Select value={shopId} onValueChange={setShopId} required>
              <SelectTrigger>
                <SelectValue placeholder="Select a shop" />
              </SelectTrigger>
              <SelectContent>
                {shops.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.shopName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (৳)</Label>
            <Input
              id="amount"
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="paymentDate">Payment Date</Label>
            <Input
              id="paymentDate"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
              className="dark:[color-scheme:dark]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              rows={2}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !shopId}>
              {isPending ? "Saving..." : "Record"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
