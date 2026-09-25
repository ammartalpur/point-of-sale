import type { Prisma } from "@prisma/client";
import {
  allocateAmount, calculateCash, calculateTotals, CheckoutError,
  minorToMoney, moneyToMinor, validateCoupon,
  type CheckoutInput,
} from "./order-calculations.ts";

type Product = Prisma.ProductGetPayload<{ include: { category: true } }>;
type Line = {
  product: Product; quantity: number; subtotal: number; dealIndex?: number;
};

// Called only inside a serializable transaction. The action obtains cashierId
// from the signed session; no client-provided prices or identity are accepted.
export async function saveCheckout(
  tx: Prisma.TransactionClient,
  input: CheckoutInput,
  cashierId: string,
) {
  const cashier = await tx.profile.findUnique({ where: { id: cashierId }, select: { role: true } });
  if (!cashier || !["admin", "cashier"].includes(cashier.role)) {
    throw new CheckoutError("Your account cannot create orders. Please sign in again.");
  }
  const products = await tx.product.findMany({
    where: { id: { in: input.items.filter((i) => i.kind === "PRODUCT").map((i) => i.id) } },
    include: { category: true },
  });
  const deals = await tx.deal.findMany({
    where: { id: { in: input.items.filter((i) => i.kind === "DEAL").map((i) => i.id) } },
    include: { items: { include: { product: { include: { category: true } } }, orderBy: { id: "asc" } } },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));
  const dealMap = new Map(deals.map((d) => [d.id, d]));
  const lines: Line[] = [];
  const soldDeals: { dealId: string; name: string; quantity: number; unitPrice: string }[] = [];
  const stock = new Map<string, { product: Product; quantity: number }>();

  function addLine(product: Product, quantity: number, subtotal: number, dealIndex?: number) {
    if (product.isArchived || product.category.isArchived || !product.isAvailable) {
      throw new CheckoutError(`${product.name} is unavailable.`);
    }
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 2_147_483_647) {
      throw new CheckoutError("Invalid component quantity.");
    }
    minorToMoney(subtotal);
    const needed = (stock.get(product.id)?.quantity ?? 0) + quantity;
    if (needed > product.stock) throw new CheckoutError(`Not enough stock for ${product.name}.`);
    stock.set(product.id, { product, quantity: needed });
    lines.push({ product, quantity, subtotal, dealIndex });
  }

  for (const item of input.items) {
    if (item.kind === "PRODUCT") {
      const product = productMap.get(item.id);
      if (!product) throw new CheckoutError("A selected product no longer exists.");
      addLine(product, item.quantity, moneyToMinor(product.basePrice.toString()) * item.quantity);
    } else {
      const deal = dealMap.get(item.id);
      if (!deal || deal.isArchived || !deal.isActive || deal.items.length === 0) {
        throw new CheckoutError("A selected deal is unavailable.");
      }
      const subtotal = moneyToMinor(deal.price.toString()) * item.quantity;
      const allocation = allocateAmount(subtotal, deal.items.map((part) =>
        moneyToMinor(part.product.basePrice.toString()) * part.quantity));
      const dealIndex = soldDeals.length;
      soldDeals.push({ dealId: deal.id, name: deal.name, quantity: item.quantity, unitPrice: deal.price.toString() });
      deal.items.forEach((part, index) => addLine(part.product, part.quantity * item.quantity, allocation[index], dealIndex));
    }
  }

  const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0);
  minorToMoney(subtotal);
  let discount = input.discount;
  let coupon: Awaited<ReturnType<typeof tx.coupon.findUnique>> = null;
  if (input.couponCode) {
    coupon = await tx.coupon.findUnique({ where: { code: input.couponCode } });
    if (!coupon) throw new CheckoutError("Coupon code was not found.");
    validateCoupon({ ...coupon, minimumSubtotal: coupon.minimumSubtotal.toString() }, subtotal);
    discount = { type: coupon.discountType, value: coupon.value.toString() };
  }
  const totals = calculateTotals(subtotal, discount);
  let cash: ReturnType<typeof calculateCash> | undefined;
  if (input.paymentMethod === "cash") {
    if (input.cashReceived === undefined) throw new CheckoutError("Enter the cash received.");
    if (input.cashReceived !== undefined) {
      cash = calculateCash(totals.total, input.cashReceived);
      if (cash.remaining > 0) throw new CheckoutError(`Rs ${minorToMoney(cash.remaining)} is still due.`);
    }
  }
  const discounts = allocateAmount(totals.discountAmount, lines.map((line) => line.subtotal));
  const needsPreparation = lines.some((line) => line.product.requiresPreparation ?? line.product.category.requiresPreparation);

  // Aggregate products shared by multiple deals/regular lines, and lock in a
  // consistent order. Conditional decrement prevents concurrent overselling.
  for (const [id, entry] of [...stock.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const result = await tx.product.updateMany({
      where: { id, stock: { gte: entry.quantity }, isAvailable: true, isArchived: false },
      data: { stock: { decrement: entry.quantity } },
    });
    if (result.count !== 1) throw new CheckoutError(`Not enough stock for ${entry.product.name}.`);
    // Stock and the manual availability switch are independent.
  }

  const order = await tx.order.create({
    data: {
      cashierId, paymentMethod: input.paymentMethod,
      subtotal: minorToMoney(subtotal), totalAmount: minorToMoney(totals.total),
      discountAmount: minorToMoney(totals.discountAmount),
      discountType: discount?.type, discountValue: discount ? String(discount.value) : undefined,
      couponId: coupon?.id, couponCode: coupon?.code,
      orderType: input.orderType,
      tableNumber: input.tableNumber, customerName: input.customerName,
      customerPhone: input.customerPhone, deliveryAddress: input.deliveryAddress,
      cashReceived: cash ? minorToMoney(cash.cashReceived) : null,
      changeGiven: cash ? minorToMoney(cash.changeGiven) : null,
      status: needsPreparation ? "PENDING" : "COMPLETED",
      completedAt: needsPreparation ? null : new Date(),
    },
  });
  const dealIds: string[] = [];
  for (const deal of soldDeals) {
    const saved = await tx.orderDeal.create({ data: { ...deal, orderId: order.id } });
    dealIds.push(saved.id);
  }
  await tx.orderItem.createMany({
    data: lines.map((line, index) => ({
      orderId: order.id, productId: line.product.id,
      productName: line.product.name, categoryName: line.product.category.name,
      requiresPreparation: line.product.requiresPreparation ?? line.product.category.requiresPreparation,
      quantity: line.quantity,
      priceAtTime: line.dealIndex === undefined ? line.product.basePrice :
        minorToMoney(Math.round(line.subtotal / line.quantity)),
      lineSubtotal: minorToMoney(line.subtotal), discountAmount: minorToMoney(discounts[index]),
      lineTotal: minorToMoney(line.subtotal - discounts[index]),
      orderDealId: line.dealIndex === undefined ? null : dealIds[line.dealIndex],
    })),
  });
  return {
    orderId: order.id, subtotal: subtotal / 100, discountAmount: totals.discountAmount / 100,
    totalAmount: totals.total / 100, changeGiven: cash ? cash.changeGiven / 100 : null,
  };
}
