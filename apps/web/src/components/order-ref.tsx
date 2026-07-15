import { cn } from "@/lib/utils";

// Standard way to show an order's identity everywhere: the friendly daily number
// ("Order #5 today") prominently, with the permanent reference number smaller and
// muted next to it. Falls back to the reference alone for older orders that have
// no daily number.
export function OrderRef({
  dailyNumber,
  orderNumber,
  withLabel = false,
  className,
}: {
  dailyNumber?: number | null;
  orderNumber: number;
  withLabel?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-baseline gap-1.5", className)}>
      <span className="font-semibold">
        {withLabel ? "Order " : ""}#{dailyNumber ?? orderNumber}
      </span>
      {dailyNumber != null && (
        <span className="whitespace-nowrap text-[10px] font-normal text-muted-foreground">
          Ref #{orderNumber}
        </span>
      )}
    </span>
  );
}
