import test from "node:test";
import assert from "node:assert/strict";
import type { Prisma } from "@prisma/client";
import { saveCheckout } from "../app/lib/checkout.ts";
import { validateCheckoutInput } from "../app/lib/order-calculations.ts";

// Transaction double exercises business rules without connecting to the user's DB.
// Real rollback/concurrency behavior still requires a migrated PostgreSQL test DB.
function fixture() {
  const burger = { id: "burger", name: "Burger", basePrice: "500", stock: 10,
    isAvailable: true, isArchived: false, requiresPreparation: null,
    category: { name: "Food", isArchived: false, requiresPreparation: true } };
  const drink = { ...burger, id: "drink", name: "Drink", basePrice: "100",
    category: { ...burger.category, name: "Drinks", requiresPreparation: false } };
  const products = [burger, drink];
  const writes = { stock: [] as { id: string; quantity: number }[],
    orders: [] as Record<string, unknown>[], items: [] as Record<string, unknown>[], deals: [] as Record<string, unknown>[] };
  const state = { role: "cashier", stockUpdateCount: 1, couponActive: true };
  const tx = {
    profile: { findUnique: async () => ({ role: state.role }) },
    product: {
      findMany: async () => products,
      updateMany: async ({ where, data }: { where: { id: string }; data: { stock: { decrement: number } } }) => {
        writes.stock.push({ id: where.id, quantity: data.stock.decrement });
        return { count: state.stockUpdateCount };
      },
    },
    deal: { findMany: async () => [{ id: "lunch", name: "Lunch Deal", price: "550", isActive: true, isArchived: false,
      items: [{ product: burger, quantity: 1 }, { product: drink, quantity: 1 }] }] },
    coupon: { findUnique: async () => ({ id: "coupon", code: "SAVE", discountType: "PERCENTAGE", value: "10",
      isActive: state.couponActive, minimumSubtotal: "500", expiresAt: null }) },
    order: { create: async ({ data }: { data: Record<string, unknown> }) => { writes.orders.push(data); return { id: "order" }; } },
    orderDeal: { create: async ({ data }: { data: Record<string, unknown> }) => { writes.deals.push(data); return { id: "sold-deal" }; } },
    orderItem: { createMany: async ({ data }: { data: Record<string, unknown>[] }) => { writes.items.push(...data); return { count: data.length }; } },
  } as unknown as Prisma.TransactionClient;
  return { tx, products, writes, state };
}

const base = { items: [{ kind: "PRODUCT", id: "burger", quantity: 1 }], paymentMethod: "card", orderType: "TAKEAWAY" };

test("checkout uses authoritative product prices and snapshots instead of client prices", async () => {
  const f = fixture();
  const input = validateCheckoutInput({ ...base, totalAmount: 1, items: [{ ...base.items[0], basePrice: 1 }] });
  const result = await saveCheckout(f.tx, input, "signed-in-cashier");
  assert.equal(result.totalAmount, 500);
  assert.equal(f.writes.orders[0].cashierId, "signed-in-cashier");
  assert.equal(f.writes.items[0].productName, "Burger");
  assert.equal(f.writes.items[0].lineTotal, "500.00");
  assert.equal(f.writes.orders[0].status, "PENDING");
});

test("mixed products and deals aggregate stock and allocate exact discounted revenue", async () => {
  const f = fixture();
  const result = await saveCheckout(f.tx, validateCheckoutInput({ ...base,
    items: [...base.items, { kind: "DEAL", id: "lunch", quantity: 2 }], couponCode: "save",
  }), "cashier");
  assert.equal(result.subtotal, 1600);
  assert.equal(result.discountAmount, 160);
  assert.equal(result.totalAmount, 1440);
  assert.deepEqual(f.writes.stock, [{ id: "burger", quantity: 3 }, { id: "drink", quantity: 2 }]);
  assert.equal(f.writes.deals[0].name, "Lunch Deal");
  const sum = (key: string) => f.writes.items.reduce((total, row) => total + Math.round(Number(row[key]) * 100), 0);
  assert.equal(sum("lineSubtotal"), 160000);
  assert.equal(sum("discountAmount"), 16000);
  assert.equal(sum("lineTotal"), 144000);
});

test("duplicate lines cannot collectively exceed inventory", async () => {
  const f = fixture();
  await assert.rejects(saveCheckout(f.tx, validateCheckoutInput({ ...base,
    items: [{ ...base.items[0], quantity: 6 }, { ...base.items[0], quantity: 6 }],
  }), "cashier"), /Not enough stock/);
  assert.equal(f.writes.orders.length, 0);
  assert.equal(f.writes.stock.length, 0);
});

test("unavailable products, coupons and unauthorized profiles cannot create an order", async () => {
  const unavailable = fixture();
  unavailable.products[0].isAvailable = false;
  await assert.rejects(saveCheckout(unavailable.tx, validateCheckoutInput(base), "cashier"), /unavailable/);
  const coupon = fixture();
  coupon.state.couponActive = false;
  await assert.rejects(saveCheckout(coupon.tx, validateCheckoutInput({ ...base, couponCode: "SAVE" }), "cashier"), /inactive/);
  const user = fixture();
  user.state.role = "guest";
  await assert.rejects(saveCheckout(user.tx, validateCheckoutInput(base), "guest"), /cannot create orders/);
});

test("failed conditional stock reservation prevents order creation", async () => {
  const f = fixture();
  f.state.stockUpdateCount = 0;
  await assert.rejects(saveCheckout(f.tx, validateCheckoutInput(base), "cashier"), /Not enough stock/);
  assert.equal(f.writes.orders.length, 0);
});

test("cash checkout rejects missing or insufficient cash and saves change", async () => {
  const f = fixture();
  const cash = { ...base, paymentMethod: "cash" };
  await assert.rejects(saveCheckout(f.tx, validateCheckoutInput(cash), "cashier"), /cash received/);
  await assert.rejects(saveCheckout(f.tx, validateCheckoutInput({ ...cash, cashReceived: 499 }), "cashier"), /still due/);
  assert.equal(f.writes.orders.length, 0);
  const result = await saveCheckout(f.tx, validateCheckoutInput({ ...cash, cashReceived: 1000 }), "cashier");
  assert.equal(result.changeGiven, 500);
  assert.equal(f.writes.orders[0].cashReceived, "1000.00");
});

test("non-preparation orders complete immediately with their order type", async () => {
  const f = fixture();
  await saveCheckout(f.tx, validateCheckoutInput({ ...base, items: [{ kind: "PRODUCT", id: "drink", quantity: 1 }] }), "cashier");
  assert.equal(f.writes.orders[0].orderType, "TAKEAWAY");
  assert.equal(f.writes.orders[0].status, "COMPLETED");
  assert.ok(f.writes.orders[0].completedAt instanceof Date);
});
