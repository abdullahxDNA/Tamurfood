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
