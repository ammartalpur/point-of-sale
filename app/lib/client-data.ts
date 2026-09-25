import type { Prisma } from "@prisma/client";

// Explicit selection prevents new Prisma fields from leaking across the
// server/client boundary when the database schema grows.
export const recentOrderSelect = {
  id: true,
  createdAt: true,
  paymentMethod: true,
  totalAmount: true,
  cashier: { select: { email: true } },
  items: { select: {
    id: true, quantity: true, priceAtTime: true, lineTotal: true, productName: true,
  } },
} satisfies Prisma.OrderSelect;

export function toRecentOrder(order: Prisma.OrderGetPayload<{ select: typeof recentOrderSelect }>) {
  return {
    id: order.id,
    createdAt: order.createdAt.toISOString(),
    paymentMethod: order.paymentMethod,
    totalAmount: Number(order.totalAmount),
    cashier: { email: order.cashier.email },
    items: order.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      priceAtTime: Number(item.priceAtTime),
      lineTotal: Number(item.lineTotal),
      productName: item.productName,
    })),
  };
}

export type RecentOrder = ReturnType<typeof toRecentOrder>;

export const kitchenOrderSelect = {
  id: true, createdAt: true, status: true, orderType: true,
  tableNumber: true, customerName: true, customerPhone: true, deliveryAddress: true,
  items: { select: { id: true, quantity: true, productName: true, requiresPreparation: true } },
} satisfies Prisma.OrderSelect;

export function toKitchenOrder(order: Prisma.OrderGetPayload<{ select: typeof kitchenOrderSelect }>) {
  return {
    id: order.id,
    createdAt: order.createdAt.toISOString(),
    status: order.status, orderType: order.orderType,
    tableNumber: order.tableNumber, customerName: order.customerName,
    customerPhone: order.customerPhone, deliveryAddress: order.deliveryAddress,
    items: order.items.map((item) => ({
      id: item.id, quantity: item.quantity,
      productName: item.productName, requiresPreparation: item.requiresPreparation,
    })),
  };
}

export type KitchenOrder = ReturnType<typeof toKitchenOrder>;
