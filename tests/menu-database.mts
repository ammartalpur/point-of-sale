// Opt-in integration test. Every fixture and mutation is rolled back, including
// the successful case; no test products, users or orders remain in the database.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import nextEnv from "@next/env";
import { applyMenuCommand, parseMenuCommand } from "../app/lib/menu-management.ts";

nextEnv.loadEnvConfig(process.cwd(), true);
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for this opt-in test.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const rollback = new Error("ROLLBACK_SUCCESSFUL_TEST");
const tag = `Menu test ${randomUUID()}`;
let reachedEnd = false;
try {
  await prisma.$transaction(async (tx) => {
    const user = await tx.profile.create({ data: { id: randomUUID(), email: `${randomUUID()}@example.test`, password: "unusable-test-password", role: "admin" } });
    const run = (input: unknown) => applyMenuCommand(tx, user.id, parseMenuCommand(input));
    await run({ type: "saveCategory", name: tag, requiresPreparation: true });
    const category = await tx.category.findFirstOrThrow({ where: { name: tag } });
    await assert.rejects(run({ type: "saveCategory", name: tag.toUpperCase(), requiresPreparation: true }), /already exists/);
    const fields = { name: tag, categoryId: category.id, basePrice: "100.25", imageUrl: "", isAvailable: false, requiresPreparation: null };
    await run({ type: "createProduct", stock: 5, data: fields });
    const product = await tx.product.findFirstOrThrow({ where: { name: tag } });
    await run({ type: "setStock", id: product.id, stock: 9, expectedStock: 5 });
    assert.equal((await tx.product.findUniqueOrThrow({ where: { id: product.id } })).isAvailable, false);
    await assert.rejects(run({ type: "setStock", id: product.id, stock: 10, expectedStock: 5 }), /Stock changed/);
    await run({ type: "updateProduct", id: product.id, data: { ...fields, name: `${tag} edited`, basePrice: "125.75", requiresPreparation: false } });
    const edited = await tx.product.findUniqueOrThrow({ where: { id: product.id } });
    assert.equal(edited.stock, 9); assert.equal(edited.basePrice.toString(), "125.75");
    await assert.rejects(run({ type: "deleteCategory", id: category.id }), /Move or delete/);
    await run({ type: "archiveCategory", id: category.id });
    await run({ type: "archiveProduct", id: product.id });
    await assert.rejects(run({ type: "restoreProduct", id: product.id }), /category/);
    await run({ type: "restoreCategory", id: category.id });
    await run({ type: "restoreProduct", id: product.id });
    await run({ type: "setAvailability", id: product.id, isAvailable: true });
    const order = await tx.order.create({ data: { cashierId: user.id, subtotal: "100.25", totalAmount: "100.25", paymentMethod: "cash", items: { create: {
      productId: product.id, quantity: 1, priceAtTime: "100.25", productName: "Original receipt name", categoryName: tag,
      requiresPreparation: true, lineSubtotal: "100.25", lineTotal: "100.25",
    } } } });
    assert.match(await run({ type: "deleteProduct", id: product.id }), /archived/);
    const original = await tx.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    assert.equal(original.productName, "Original receipt name"); assert.equal(original.priceAtTime.toString(), "100.25");
    await run({ type: "createProduct", stock: 0, data: { ...fields, name: `${tag} unused` } });
    const unused = await tx.product.findFirstOrThrow({ where: { name: `${tag} unused` } });
    await run({ type: "deleteProduct", id: unused.id });
    assert.equal(await tx.product.findUnique({ where: { id: unused.id } }), null);
    const empty = await tx.category.create({ data: { name: `${tag} empty` } });
    await run({ type: "deleteCategory", id: empty.id });
    await tx.profile.update({ where: { id: user.id }, data: { role: "cashier" } });
    await assert.rejects(run({ type: "setAvailability", id: product.id, isAvailable: false }), /administrator/);
    reachedEnd = true;
    throw rollback;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 20_000, timeout: 60_000 });
} catch (error) {
  if (error !== rollback) throw error;
} finally { await prisma.$disconnect(); }
assert.ok(reachedEnd);
console.log("Menu database integration checks passed. All fixtures and changes rolled back.");
