import test from "node:test";
import assert from "node:assert/strict";
import type { Prisma } from "@prisma/client";
import { applyDealCommand, parseDealCommand, toDealData } from "../app/lib/deal-management.ts";

test("deal input normalizes money and validates components", () => {
  const command = parseDealCommand({ type: "saveDeal", name: " Family Box ", price: "1250.5", imageUrl: "",
    isActive: true, items: [{ productId: "burger", quantity: 1 }, { productId: "drink", quantity: 2 }] });
  assert.equal(command.type, "saveDeal");
  if (command.type === "saveDeal") {
    assert.equal(command.name, "Family Box");
    assert.equal(command.price, "1250.50");
    assert.equal(command.imageUrl, null);
  }
  assert.throws(() => parseDealCommand({ type: "saveDeal", name: "Solo", price: "1", isActive: true,
    items: [{ productId: "burger", quantity: 1 }] }), /at least two/);
  assert.throws(() => parseDealCommand({ type: "saveDeal", name: "Duplicate", price: "1", isActive: true,
    items: [{ productId: "burger", quantity: 1 }, { productId: "burger", quantity: 1 }] }), /only once/);
  assert.throws(() => parseDealCommand({ type: "saveDeal", name: "Free", price: "0", isActive: true,
    items: [{ productId: "burger", quantity: 2 }] }), /greater than zero/);
});

function fixture() {
  const writes = { updates: [] as Record<string, unknown>[], creates: [] as Record<string, unknown>[],
    itemCreates: [] as Record<string, unknown>[], itemDeletes: 0, deletes: 0 };
  const state = { role: "admin", duplicate: false, productsFound: 2, productArchived: false,
    dealExists: true, sales: 0, dealArchived: false };
  const tx = {
    profile: { findUnique: async () => ({ role: state.role }) },
    deal: {
      findFirst: async () => state.duplicate ? { id: "duplicate" } : null,
      findUnique: async () => state.dealExists ? { id: "deal", isArchived: state.dealArchived, _count: { orderDeals: state.sales } } : null,
      create: async ({ data }: { data: Record<string, unknown> }) => { writes.creates.push(data); return { id: "deal" }; },
      update: async ({ data }: { data: Record<string, unknown> }) => { writes.updates.push(data); return { id: "deal" }; },
      delete: async () => { writes.deletes++; return { id: "deal" }; },
    },
    product: { findMany: async () => Array.from({ length: state.productsFound }, (_, index) => ({
      id: `p${index}`, isArchived: state.productArchived, category: { isArchived: false },
    })) },
    dealItem: {
      deleteMany: async () => { writes.itemDeletes++; return { count: 2 }; },
      createMany: async ({ data }: { data: Record<string, unknown>[] }) => { writes.itemCreates.push(...data); return { count: data.length }; },
    },
  } as unknown as Prisma.TransactionClient;
  return { tx, state, writes };
}

const save = parseDealCommand({ type: "saveDeal", id: "deal", name: "Lunch", price: "550", imageUrl: null,
  isActive: true, items: [{ productId: "p0", quantity: 1 }, { productId: "p1", quantity: 1 }] });

test("only admins can mutate deals and duplicate names are rejected", async () => {
  const unauthorized = fixture(); unauthorized.state.role = "cashier";
  await assert.rejects(applyDealCommand(unauthorized.tx, "user", save), /Only an administrator/);
  assert.equal(unauthorized.writes.updates.length, 0);
  const duplicate = fixture(); duplicate.state.duplicate = true;
  await assert.rejects(applyDealCommand(duplicate.tx, "admin", save), /already exists/);
});

test("saving a deal requires active products and replaces components atomically", async () => {
  const missing = fixture(); missing.state.productsFound = 1;
  await assert.rejects(applyDealCommand(missing.tx, "admin", save), /active catalog product/);
  const archived = fixture(); archived.state.productArchived = true;
  await assert.rejects(applyDealCommand(archived.tx, "admin", save), /active catalog product/);
  const valid = fixture();
  assert.equal(await applyDealCommand(valid.tx, "admin", save), "Deal updated.");
  assert.equal(valid.writes.updates.length, 1);
  assert.equal(valid.writes.itemDeletes, 1);
  assert.equal(valid.writes.itemCreates.length, 2);
});

test("sold deals archive on delete while unused deals are permanently deleted", async () => {
  const unused = fixture();
  assert.equal(await applyDealCommand(unused.tx, "admin", { type: "deleteDeal", id: "deal" }), "Unused deal deleted.");
  assert.equal(unused.writes.deletes, 1);
  const sold = fixture(); sold.state.sales = 3;
  assert.match(await applyDealCommand(sold.tx, "admin", { type: "deleteDeal", id: "deal" }), /archived/);
  assert.deepEqual(sold.writes.updates[0], { isArchived: true, isActive: false });
});

test("deal DTO computes live availability and maximum sellable quantity", () => {
  const data = toDealData({ id: "deal", name: "Lunch", price: { toFixed: () => "550.00" }, imageUrl: null,
    isActive: true, isArchived: false, _count: { orderDeals: 2 }, items: [
      { id: "a", productId: "p1", quantity: 2, product: { name: "Burger", basePrice: { toFixed: () => "500.00" }, stock: 5,
        isAvailable: true, isArchived: false, category: { name: "Food", isArchived: false } } },
      { id: "b", productId: "p2", quantity: 1, product: { name: "Drink", basePrice: { toFixed: () => "100.00" }, stock: 8,
        isAvailable: true, isArchived: false, category: { name: "Drinks", isArchived: false } } },
    ] } as never);
  assert.equal(data.available, true);
  assert.equal(data.maxQuantity, 2);
  assert.equal(data.salesCount, 2);
});
