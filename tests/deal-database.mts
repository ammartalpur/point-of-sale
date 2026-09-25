// Opt-in integration test. The enclosing transaction always rolls back, so no
// users, products, deals or orders created here remain in the database.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import nextEnv from "@next/env";
import { applyDealCommand, parseDealCommand } from "../app/lib/deal-management.ts";

nextEnv.loadEnvConfig(process.cwd(), true);
neonConfig.webSocketConstructor = ws;
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for this opt-in test.");
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });
const rollback = new Error("ROLLBACK_SUCCESSFUL_TEST");
const tag = `Deal test ${randomUUID()}`;
let reachedEnd = false;
try {
  await prisma.$transaction(async (tx) => {
    const admin = await tx.profile.create({ data: { id: randomUUID(), email: `${randomUUID()}@example.test`, password: "unusable-test-password", role: "admin" } });
    const category = await tx.category.create({ data: { name: tag } });
    const first = await tx.product.create({ data: { categoryId: category.id, name: `${tag} burger`, basePrice: "500", stock: 8 } });
    const second = await tx.product.create({ data: { categoryId: category.id, name: `${tag} drink`, basePrice: "100", stock: 10 } });
    const run = (input: unknown) => applyDealCommand(tx, admin.id, parseDealCommand(input));
    const input = { type: "saveDeal", name: tag, price: "550", imageUrl: null, isActive: true,
      items: [{ productId: first.id, quantity: 1 }, { productId: second.id, quantity: 1 }] };
    await run(input);
    const deal = await tx.deal.findFirstOrThrow({ where: { name: tag }, include: { items: true } });
    assert.equal(deal.items.length, 2); assert.equal(deal.price.toString(), "550");
    await assert.rejects(run(input), /already exists/);
    await run({ ...input, id: deal.id, price: "525", items: [{ productId: first.id, quantity: 2 }] });
    const edited = await tx.deal.findUniqueOrThrow({ where: { id: deal.id }, include: { items: true } });
    assert.equal(edited.price.toString(), "525"); assert.equal(edited.items[0].quantity, 2);
    await run({ type: "setDealActive", id: deal.id, isActive: false });
    await run({ type: "archiveDeal", id: deal.id });
    await assert.rejects(run({ type: "setDealActive", id: deal.id, isActive: true }), /Restore/);
    await run({ type: "restoreDeal", id: deal.id });
    await run({ type: "deleteDeal", id: deal.id });
    assert.equal(await tx.deal.findUnique({ where: { id: deal.id } }), null);

    await run({ ...input, name: `${tag} sold` });
    const sold = await tx.deal.findFirstOrThrow({ where: { name: `${tag} sold` } });
    const order = await tx.order.create({ data: { cashierId: admin.id, subtotal: "550", totalAmount: "550", paymentMethod: "card" } });
    await tx.orderDeal.create({ data: { orderId: order.id, dealId: sold.id, name: sold.name, quantity: 1, unitPrice: "550" } });
    assert.match(await run({ type: "deleteDeal", id: sold.id }), /archived/);
    const archived = await tx.deal.findUniqueOrThrow({ where: { id: sold.id } });
    assert.equal(archived.isArchived, true); assert.equal(archived.isActive, false);
    reachedEnd = true;
    throw rollback;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 20_000, timeout: 60_000 });
} catch (error) {
  if (error !== rollback) throw error;
} finally { await prisma.$disconnect(); }
assert.ok(reachedEnd);
console.log("Deal database integration checks passed. All fixtures and changes rolled back.");
