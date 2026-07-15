import { EventEmitter } from "events";

export const orderEvents = new EventEmitter();

export type NewOrderEvent = {
  orderId: string;
  orderNumber: number;
  shopId: string;
  shopName: string;
  totalAmount: number;
  placedAt: string;
};

// Emitted when an order's status changes (staff accept/cancel, or a shop cancels
// its own order). Powers the shop's live status tracker — subscribers filter by
// shopId so a shop only receives events for its own orders.
export type OrderStatusEvent = {
  orderId: string;
  shopId: string;
  status: "accepted" | "cancelled";
};
