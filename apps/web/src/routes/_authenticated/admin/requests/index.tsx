import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/requests/")({
  component: RequestsPage,
});

interface MyRequest {
  id: string;
  type: "create" | "update" | "delete";
  menuItemId: string | null;
  proposedData: { name?: string; price?: number; category?: string } | null;
  status: "pending" | "approved" | "rejected";
  reviewNote: string | null;
  createdAt: string;
  currentName: string | null;
}

async function fetchMyRequests(): Promise<MyRequest[]> {
  const res = await api.api.v1.menu.pending.mine.$get();
  if (!res.ok) throw new Error("Failed to fetch your requests");
  return res.json() as Promise<MyRequest[]>;
}

function typeLabel(type: string) {
  if (type === "create") return "New item";
  if (type === "update") return "Edit";
  return "Delete";
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved")
    return (
      <Badge className="border-green-400 bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-950/40 dark:text-green-300">
        Approved
      </Badge>
    );
  if (status === "rejected")
    return <Badge variant="destructive">Rejected</Badge>;
  return <Badge variant="secondary">Pending</Badge>;
}

function RequestsPage() {
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["my-requests"],
    queryFn: fetchMyRequests,
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">My Requests</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Menu changes you submitted and their approval status.
        </p>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}

      {!isLoading && requests.length === 0 && (
        <p className="text-muted-foreground">
          You haven't submitted any requests yet. Add or edit an item on the
          Menu page to send it for approval.
        </p>
      )}

      <div className="space-y-2">
        {requests.map((r) => {
          const name = r.proposedData?.name ?? r.currentName ?? "item";
          return (
            <div
              key={r.id}
              className="flex items-start justify-between gap-3 rounded-lg border p-4"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {typeLabel(r.type)}
                  </span>
                  <span className="font-medium">{name}</span>
                </div>
                {r.proposedData?.price != null && (
                  <p className="text-sm text-muted-foreground">
                    ৳{r.proposedData.price}
                    {r.proposedData.category
                      ? ` · ${r.proposedData.category}`
                      : ""}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {new Date(r.createdAt).toLocaleString("en-GB", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                {r.status === "rejected" && r.reviewNote && (
                  <p className="text-sm text-destructive">
                    Reason: {r.reviewNote}
                  </p>
                )}
              </div>
              <StatusBadge status={r.status} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
