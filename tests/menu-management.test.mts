import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { applyMenuCommand, parseMenuCommand, toMenuProduct, validateImageUrl } from "../app/lib/menu-management.ts";

const fields = { name: " Burger ", categoryId: "food", basePrice: "200.50", imageUrl: "", isAvailable: false, requiresPreparation: null };

test("menu validation normalizes names and prices, permits removing an image and preserves manual availability", () => {
  const command = parseMenuCommand({ type: "createProduct", data: fields, stock: 5 });
  assert.equal(command.type, "createProduct");
  if (command.type !== "createProduct") throw new Error();
  assert.equal(command.data.name, "Burger");
  assert.equal(command.data.basePrice, "200.50");
  assert.equal(command.data.imageUrl, null);
  assert.equal(command.data.isAvailable, false);
});

test("invalid numbers, names, booleans and image hosts never reach persistence", () => {
  for (const basePrice of ["-1", "1.001", "1e3", Infinity, ""]) {
    assert.throws(() => parseMenuCommand({ type: "createProduct", data: { ...fields, basePrice }, stock: 0 }));
  }
  for (const stock of [-1, 1.5, NaN, Infinity, "3", 2147483648]) {
    assert.throws(() => parseMenuCommand({ type: "setStock", id: "product", stock, expectedStock: 0 }));
  }
  assert.throws(() => parseMenuCommand({ type: "saveCategory", name: "   ", requiresPreparation: true }));
  assert.throws(() => parseMenuCommand({ type: "setAvailability", id: "p", isAvailable: "false" }));
  for (const url of ["javascript:alert(1)", "https://example.com/image.jpg", "https://res.cloudinary.com.evil.test/a", "http://res.cloudinary.com/a", "https://user:pass@res.cloudinary.com/a"]) assert.throws(() => validateImageUrl(url));
  assert.equal(validateImageUrl("https://res.cloudinary.com/demo/image/upload/sample.jpg"), "https://res.cloudinary.com/demo/image/upload/sample.jpg");
});

function fixture() {
  const state = { role: "admin", categoryArchived: false, categoryProducts: 1, relatedDeals: [{ id: "deal" }], orders: 0, deals: 0, stockCount: 1, duplicate: false };
  const writes: { operation: string; args: unknown }[] = [];
  const write = (operation: string) => async (args: unknown) => { writes.push({ operation, args }); return {}; };
  const tx = {
    profile: { findUnique: async () => ({ role: state.role }) },
    category: {
      findFirst: async () => state.duplicate ? { id: "duplicate" } : null,
      findUnique: async () => ({ id: "category", isArchived: state.categoryArchived, _count: { products: state.categoryProducts } }),
      create: write("createCategory"), update: write("updateCategory"), delete: write("deleteCategory"),
    },
    product: {
      create: write("createProduct"), update: write("updateProduct"), delete: write("deleteProduct"),
      updateMany: async (args: unknown) => { writes.push({ operation: "updateStock", args }); return { count: state.stockCount }; },
      findUnique: async () => ({ category: { isArchived: state.categoryArchived }, _count: { orderItems: state.orders, dealItems: state.deals }, modifiers: [] }),
    },
    deal: {
      findMany: async () => state.relatedDeals,
      deleteMany: write("deleteDeals"),
    },
  } as unknown as Prisma.TransactionClient;
  return { state, writes, tx };
}

test("non-admin callers cannot change categories, products, availability or stock", async () => {
  const f = fixture(); f.state.role = "cashier";
  for (const input of [
    { type: "saveCategory", name: "Food", requiresPreparation: true },
    { type: "createProduct", data: fields, stock: 1 },
    { type: "deleteProduct", id: "p" },
    { type: "setAvailability", id: "p", isAvailable: true },
    { type: "setStock", id: "p", stock: 1, expectedStock: 0 },
  ]) await assert.rejects(applyMenuCommand(f.tx, "cashier", parseMenuCommand(input)), /administrator/);
  assert.equal(f.writes.length, 0);
});

test("category deletion removes related deals before cascading through its products", async () => {
  const f = fixture();
  const message = await applyMenuCommand(f.tx, "admin", { type: "deleteCategory", id: "c" });
  assert.deepEqual(f.writes.map((write) => write.operation), ["deleteDeals", "deleteCategory"]);
  assert.match(message, /1 product and 1 deal/);
});

test("products referenced by sales or deals are archived; unused products are deleted", async () => {
  for (const ref of ["orders", "deals"] as const) {
    const f = fixture(); f.state[ref] = 1;
    assert.match(await applyMenuCommand(f.tx, "admin", { type: "deleteProduct", id: "p" }), /archived/);
    assert.deepEqual(f.writes[0], { operation: "updateProduct", args: { where: { id: "p" }, data: { isArchived: true } } });
  }
  const f = fixture();
  await applyMenuCommand(f.tx, "admin", { type: "deleteProduct", id: "p" });
  assert.equal(f.writes[0].operation, "deleteProduct");
});

test("stock updates preserve availability and fail when the count is stale", async () => {
  const f = fixture();
  const command = parseMenuCommand({ type: "setStock", id: "p", stock: 8, expectedStock: 5 });
  await applyMenuCommand(f.tx, "admin", command);
  assert.deepEqual(f.writes[0].args, { where: { id: "p", stock: 5 }, data: { stock: 8 } });
  f.state.stockCount = 0;
  await assert.rejects(applyMenuCommand(f.tx, "admin", command), /Stock changed/);
});

test("product detail edits do not overwrite stock; archived categories cannot receive or restore products", async () => {
  const f = fixture();
  const command = parseMenuCommand({ type: "updateProduct", id: "p", data: fields, stock: 999 });
  await applyMenuCommand(f.tx, "admin", command);
  assert.equal(JSON.stringify(f.writes[0].args).includes('"stock"'), false);
  f.state.categoryArchived = true;
  await assert.rejects(applyMenuCommand(f.tx, "admin", command), /active category/);
  await assert.rejects(applyMenuCommand(f.tx, "admin", { type: "restoreProduct", id: "p" }), /category/);
});

test("duplicate category names are rejected and category archiving preserves individual products", async () => {
  const f = fixture(); f.state.duplicate = true;
  await assert.rejects(applyMenuCommand(f.tx, "admin", { type: "saveCategory", name: "Food", requiresPreparation: true }), /already exists/);
  await applyMenuCommand(f.tx, "admin", { type: "archiveCategory", id: "c" });
  assert.deepEqual(f.writes, [{ operation: "updateCategory", args: { where: { id: "c" }, data: { isArchived: true } } }]);
});

test("menu DTO sends formatted price strings and excludes unknown Decimal fields", () => {
  const product = { id: "p", name: "Food", categoryId: "c", basePrice: new Prisma.Decimal("200.5"),
    imageUrl: null, stock: 1, isAvailable: true, isArchived: false, requiresPreparation: null, extraAmount: new Prisma.Decimal(1) };
  const result = toMenuProduct(product);
  assert.equal(result.basePrice, "200.50");
  assert.equal("extraAmount" in result, false);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
});
