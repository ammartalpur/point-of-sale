// Opt-in integration test against the configured PostgreSQL database. The
// enclosing transaction always rolls back, so every fixture and sale disappears.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import nextEnv from "@next/env";
import { saveCheckout } from "../app/lib/checkout.ts";
import { validateCheckoutInput } from "../app/lib/order-calculations.ts";

nextEnv.loadEnvConfig(process.cwd(), true);
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for this opt-in test.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const rollback = new Error("ROLLBACK_SUCCESSFUL_TEST");
let reachedEnd = false;

try {
  await prisma.$transaction(async (tx) => {
    const tag = randomUUID();
    const cashier = await tx.profile.create({
      data: { id: randomUUID(), email: `${tag}@example.test`, password: "unusable-test-password", role: "cashier" },
    });
    const category = await tx.category.create({ data: { name: `Checkout test ${tag}`, requiresPreparation: true } });
    const burger = await tx.product.create({
      data: { categoryId: category.id, name: `Burger ${tag}`, basePrice: "500", stock: 10 },
    });
    const drink = await tx.product.create({
      data: { categoryId: category.id, name: `Drink ${tag}`, basePrice: "100", stock: 10, requiresPreparation: false },
    });
    const deal = await tx.deal.create({
      data: {
        name: `Meal ${tag}`, price: "550",
        items: { create: [{ productId: burger.id, quantity: 1 }, { productId: drink.id, quantity: 1 }] },
      },
    });
    const coupon = await tx.coupon.create({
      data: { code: `T${tag.replaceAll("-", "").slice(0, 20).toUpperCase()}`, discountType: "PERCENTAGE", value: "10", minimumSubtotal: "500" },
    });

    await assert.rejects(
      saveCheckout(tx, validateCheckoutInput({
        items: [{ kind: "PRODUCT", id: burger.id, quantity: 1 }], paymentMethod: "cash",
        orderType: "TAKEAWAY", cashReceived: "100",
      }), cashier.id),
      /still due/,
    );
    assert.equal(await tx.order.count({ where: { cashierId: cashier.id } }), 0);

    const result = await saveCheckout(tx, validateCheckoutInput({
      items: [{ kind: "DEAL", id: deal.id, quantity: 1 }, { kind: "PRODUCT", id: burger.id, quantity: 1 }],
      paymentMethod: "cash", orderType: "DELIVERY", customerName: "Ayesha Khan",
      customerPhone: "03001234567", deliveryAddress: "12 Main Road, Karachi",
      couponCode: coupon.code, cashReceived: "1000",
    }), cashier.id);

    assert.equal(result.subtotal, 1050);
    assert.equal(result.discountAmount, 105);
    assert.equal(result.totalAmount, 945);
    assert.equal(result.changeGiven, 55);
    const saved = await tx.order.findUniqueOrThrow({
      where: { id: result.orderId }, include: { items: true, deals: true, coupon: true },
    });
    assert.equal(saved.orderType, "DELIVERY");
    assert.equal(saved.customerName, "Ayesha Khan");
    assert.equal(saved.customerPhone, "03001234567");
    assert.equal(saved.deliveryAddress, "12 Main Road, Karachi");
    assert.equal(saved.couponCode, coupon.code);
    assert.equal(saved.cashReceived?.toString(), "1000");
    assert.equal(saved.changeGiven?.toString(), "55");
    assert.equal(saved.status, "PENDING");
    assert.equal(saved.deals[0].name, `Meal ${tag}`);
    assert.equal(saved.items.length, 3);
    assert.equal(saved.items.reduce((sum, item) => sum + Number(item.lineTotal), 0), 945);
    assert.equal((await tx.product.findUniqueOrThrow({ where: { id: burger.id } })).stock, 8);
    assert.equal((await tx.product.findUniqueOrThrow({ where: { id: drink.id } })).stock, 9);

    reachedEnd = true;
    throw rollback;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 20_000, timeout: 60_000 });
} catch (error) {
  if (error !== rollback) throw error;
} finally {
  await prisma.$disconnect();
}

assert.ok(reachedEnd);
console.log("Checkout database integration checks passed. All fixtures and changes rolled back.");
