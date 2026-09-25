import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { toRecentOrder, toKitchenOrder } from "../app/lib/client-data.ts";

function assertPlain(value: unknown) {
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) { value.forEach(assertPlain); return; }
  assert.equal(Object.getPrototypeOf(value), Object.prototype, "Only plain objects may cross the client boundary");
  Object.values(value).forEach(assertPlain);
}

test("dashboard excludes added Decimal fields, converts selected amounts, and preserves snapshots", () => {
  const record = {
    id: "order", createdAt: new Date("2026-09-19T00:00:00Z"), paymentMethod: "cash",
    totalAmount: new Prisma.Decimal("900.25"), subtotal: new Prisma.Decimal("1000.25"),
    discountAmount: new Prisma.Decimal("100"), cashReceived: new Prisma.Decimal("1000"),
    changeGiven: new Prisma.Decimal("99.75"), futureAmount: new Prisma.Decimal("1.99"),
    cashier: { email: "cashier@example.test", password: "must-not-leak" },
    items: [{ id: "item", quantity: 3, priceAtTime: new Prisma.Decimal("333.42"),
      lineTotal: new Prisma.Decimal("900.25"), lineSubtotal: new Prisma.Decimal("1000.25"),
      discountAmount: new Prisma.Decimal("100"), productName: "Original name",
      product: { name: "Renamed product" } }],
  };
  const result = toRecentOrder(record);
  assertPlain(result);
  assert.equal(result.totalAmount, 900.25);
  assert.equal(result.items[0].lineTotal, 900.25);
  assert.equal(result.items[0].productName, "Original name");
  assert.equal("subtotal" in result, false);
  assert.equal("password" in result.cashier, false);
  assert.equal("futureAmount" in result, false);
});

test("kitchen sends only ticket data and uses saved preparation flags", () => {
  const result = toKitchenOrder({
    id: "order", createdAt: new Date("2026-09-19T00:00:00Z"), status: "PENDING",
    orderType: "DINE_IN", tableNumber: "7", customerName: null,
    customerPhone: null, deliveryAddress: null,
    items: [{ id: "item", quantity: 1, productName: "Saved name", requiresPreparation: false }],
  });
  assertPlain(result);
  assert.equal(result.items[0].requiresPreparation, false);
  assert.equal(result.createdAt, "2026-09-19T00:00:00.000Z");
  assert.equal(result.orderType, "DINE_IN");
  assert.equal(result.tableNumber, "7");
});
