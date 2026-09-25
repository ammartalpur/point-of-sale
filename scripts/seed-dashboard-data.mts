// Creates a small, repeatable set of real catalog and order records through the
// same checkout service used by the cashier. Re-running skips existing sales.
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import nextEnv from "@next/env";
import { saveCheckout } from "../app/lib/checkout.ts";
import { validateCheckoutInput, type CheckoutInput } from "../app/lib/order-calculations.ts";

nextEnv.loadEnvConfig(process.cwd(), true);
neonConfig.webSocketConstructor = ws;
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });

async function category(name: string, requiresPreparation: boolean) {
  const existing = await prisma.category.findFirst({ where: { name } });
  return existing
    ? prisma.category.update({ where: { id: existing.id }, data: { isArchived: false, requiresPreparation } })
    : prisma.category.create({ data: { name, requiresPreparation } });
}

async function product(categoryId: string, name: string, basePrice: string, requiresPreparation?: boolean) {
  const existing = await prisma.product.findFirst({ where: { name } });
  return existing
    ? prisma.product.update({
        where: { id: existing.id },
        data: { categoryId, basePrice, stock: Math.max(existing.stock, 250), isAvailable: true, isArchived: false, requiresPreparation },
      })
    : prisma.product.create({
        data: { categoryId, name, basePrice, stock: 250, isAvailable: true, requiresPreparation },
      });
}

try {
  const cashier = await prisma.profile.findFirst({
    where: { role: { in: ["admin", "cashier"] } },
    orderBy: { createdAt: "asc" },
  });
  if (!cashier) throw new Error("Create or sign in with an admin/cashier account before seeding sales.");

  const [burgers, pizza, sides, drinks] = await Promise.all([
    category("Burgers", true), category("Pizza", true), category("Sides", true), category("Drinks", false),
  ]);
  const [beefBurger, chickenBurger, margherita, fries, cola, lemonade] = await Promise.all([
    product(burgers.id, "Classic Beef Burger", "650"),
    product(burgers.id, "Crispy Chicken Burger", "590"),
    product(pizza.id, "Margherita Pizza", "850"),
    product(sides.id, "Loaded Masala Fries", "320"),
    product(drinks.id, "Cola 330ml", "150", false),
    product(drinks.id, "Mint Lemonade", "240", false),
  ]);

  const existingDeal = await prisma.deal.findFirst({ where: { name: "Classic Burger Meal" } });
  const deal = existingDeal
    ? await prisma.deal.update({
        where: { id: existingDeal.id },
        data: {
          price: "999", isActive: true, isArchived: false,
          items: { deleteMany: {}, create: [
            { productId: beefBurger.id, quantity: 1 },
            { productId: fries.id, quantity: 1 },
            { productId: cola.id, quantity: 1 },
          ] },
        },
      })
    : await prisma.deal.create({
        data: {
          name: "Classic Burger Meal", price: "999",
          items: { create: [
            { productId: beefBurger.id, quantity: 1 },
            { productId: fries.id, quantity: 1 },
            { productId: cola.id, quantity: 1 },
          ] },
        },
      });

  const coupon = await prisma.coupon.upsert({
    where: { code: "LAUNCH10" },
    update: { discountType: "PERCENTAGE", value: "10", minimumSubtotal: "500", expiresAt: null, isActive: true },
    create: { code: "LAUNCH10", discountType: "PERCENTAGE", value: "10", minimumSubtotal: "500", isActive: true },
  });

  const p = (id: string, quantity = 1) => ({ kind: "PRODUCT" as const, id, quantity });
  const d = (quantity = 1) => ({ kind: "DEAL" as const, id: deal.id, quantity });
  const plans: Array<{
    daysAgo: number; hour: number; items: CheckoutInput["items"];
    paymentMethod: CheckoutInput["paymentMethod"]; orderType: CheckoutInput["orderType"];
    discount?: CheckoutInput["discount"]; couponCode?: string; keepPending?: boolean;
  }> = [
    { daysAgo: 6, hour: 12, items: [p(beefBurger.id, 2), p(cola.id, 2)], paymentMethod: "cash", orderType: "DINE_IN" },
    { daysAgo: 6, hour: 19, items: [p(margherita.id), p(lemonade.id, 2)], paymentMethod: "card", orderType: "TAKEAWAY" },
    { daysAgo: 5, hour: 13, items: [d(), p(chickenBurger.id)], paymentMethod: "cash", orderType: "DELIVERY", couponCode: coupon.code },
    { daysAgo: 5, hour: 20, items: [p(chickenBurger.id, 2), p(fries.id)], paymentMethod: "card", orderType: "DINE_IN" },
    { daysAgo: 4, hour: 11, items: [p(beefBurger.id), p(lemonade.id)], paymentMethod: "cash", orderType: "TAKEAWAY", discount: { type: "FIXED", value: "100" } },
    { daysAgo: 4, hour: 18, items: [d(2)], paymentMethod: "card", orderType: "DELIVERY" },
    { daysAgo: 3, hour: 14, items: [p(margherita.id, 2), p(cola.id, 3)], paymentMethod: "cash", orderType: "DINE_IN" },
    { daysAgo: 3, hour: 21, items: [p(chickenBurger.id), p(fries.id), p(lemonade.id)], paymentMethod: "card", orderType: "TAKEAWAY" },
    { daysAgo: 2, hour: 12, items: [d(), p(margherita.id)], paymentMethod: "cash", orderType: "DELIVERY", couponCode: coupon.code },
    { daysAgo: 2, hour: 19, items: [p(beefBurger.id, 3), p(cola.id, 3)], paymentMethod: "card", orderType: "DINE_IN", discount: { type: "PERCENTAGE", value: "5" } },
    { daysAgo: 1, hour: 16, items: [p(chickenBurger.id, 2), p(fries.id, 2)], paymentMethod: "cash", orderType: "TAKEAWAY" },
    { daysAgo: 0, hour: 10, items: [p(margherita.id), p(lemonade.id)], paymentMethod: "card", orderType: "DINE_IN" },
    { daysAgo: 0, hour: 13, items: [d(), p(chickenBurger.id)], paymentMethod: "cash", orderType: "DELIVERY", couponCode: coupon.code },
    { daysAgo: 0, hour: 15, items: [p(beefBurger.id), p(fries.id), p(cola.id)], paymentMethod: "cash", orderType: "DINE_IN", keepPending: true },
  ];

  const created: string[] = [];
  for (const [index, plan] of plans.entries()) {
    const customerPhone = `0300900${String(index + 1).padStart(4, "0")}`;
    const exists = await prisma.order.findFirst({ where: { customerPhone } });
    if (exists) continue;
    const input = validateCheckoutInput({
      items: plan.items,
      paymentMethod: plan.paymentMethod,
      orderType: plan.orderType,
      tableNumber: plan.orderType === "DINE_IN" ? String((index % 8) + 1) : undefined,
      customerName: `Walk-in Customer ${String(index + 1).padStart(2, "0")}`,
      customerPhone,
      deliveryAddress: plan.orderType === "DELIVERY" ? `${20 + index} Main Boulevard, Karachi` : undefined,
      discount: plan.discount,
      couponCode: plan.couponCode,
      cashReceived: plan.paymentMethod === "cash" ? "10000" : undefined,
    });
    const completedAt = new Date();
    completedAt.setDate(completedAt.getDate() - plan.daysAgo);
    completedAt.setHours(plan.hour, 15 + (index % 4) * 10, 0, 0);
    const result = await prisma.$transaction(async (tx) => {
      const sale = await saveCheckout(tx, input, cashier.id);
      await tx.order.update({
        where: { id: sale.orderId },
        data: plan.keepPending
          ? { createdAt: completedAt, status: "PENDING", completedAt: null }
          : { createdAt: completedAt, status: "COMPLETED", completedAt },
      });
      return sale;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 20_000, timeout: 60_000 });
    created.push(result.orderId);
  }

  const summary = await prisma.order.aggregate({
    where: { status: "COMPLETED", completedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    _count: { id: true }, _sum: { totalAmount: true },
  });
  console.log(JSON.stringify({
    catalog: { categories: 4, products: 6, deal: deal.name, coupon: coupon.code },
    newOrderIds: created,
    lastSevenDays: { completedOrders: summary._count.id, revenue: Number(summary._sum.totalAmount ?? 0) },
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
