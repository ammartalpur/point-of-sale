"use server";

import { prisma } from "@/app/lib/prisma";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { decrypt } from "@/app/lib/auth";
import { Prisma } from "@prisma/client";
import { saveCheckout } from "@/app/lib/checkout";
import { CheckoutError, validateCheckoutInput } from "@/app/lib/order-calculations";

// 1. Fetch only available products
export async function getTerminalMenu() {
  const [categories, deals, coupons] = await Promise.all([prisma.category.findMany({
    where: { isArchived: false },
    include: {
      products: {
        where: {
          isAvailable: true,
          isArchived: false,
          stock: { gt: 0 },
        },
      },
    },
  }), prisma.deal.findMany({
    where: { isActive: true, isArchived: false, items: { some: {} } },
    orderBy: { name: "asc" },
    include: { items: { orderBy: { id: "asc" }, include: { product: { include: { category: true } } } } },
  }), prisma.coupon.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
    select: { code: true, discountType: true, value: true, minimumSubtotal: true, expiresAt: true },
  })]);

  return { categories: categories.map((category) => ({
    id: category.id,
    name: category.name,
    products: category.products.map((product) => ({
      id: product.id,
      name: product.name,
      basePrice: Number(product.basePrice),
      stock: product.stock,
      categoryId: product.categoryId,
      imageUrl: product.imageUrl,
    })),
  })), deals: deals.flatMap((deal) => {
    const available = deal.items.every((item) => item.product.isAvailable && !item.product.isArchived &&
      !item.product.category.isArchived && item.product.stock >= item.quantity);
    if (!available) return [];
    return [{
      id: deal.id, name: deal.name, price: Number(deal.price), imageUrl: deal.imageUrl,
      maxQuantity: Math.min(...deal.items.map((item) => Math.floor(item.product.stock / item.quantity))),
      items: deal.items.map((item) => ({ productId: item.productId, name: item.product.name, quantity: item.quantity })),
    }];
  }), coupons: coupons.map((coupon) => ({
    code: coupon.code, discountType: coupon.discountType,
    value: Number(coupon.value), minimumSubtotal: Number(coupon.minimumSubtotal),
    expiresAt: coupon.expiresAt?.toISOString() ?? null,
  })) };
}

export async function submitCheckout(input: unknown) {
  return checkout(input);
}

async function checkout(raw: unknown) {
  try {
    const token = (await cookies()).get("session")?.value;
    const session = token ? await decrypt(token).catch(() => null) : null;
    if (!session || typeof session.id !== "string") {
      throw new CheckoutError("Please sign in before creating an order.");
    }
    const input = validateCheckoutInput(raw);
    let result: Awaited<ReturnType<typeof saveCheckout>> | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        result = await prisma.$transaction((tx) => saveCheckout(tx, input, session.id as string), {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5_000, timeout: 20_000,
        });
        break;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2) continue;
        throw error;
      }
    }
    if (!result) throw new CheckoutError("The order could not be saved. Please try again.");
    // A refresh failure after commit must not be reported as a failed sale.
    try {
      for (const path of ["/terminal", "/admin/menu", "/admin/deals", "/admin/dashboard", "/kitchen"]) revalidatePath(path);
    } catch (error) { console.error("Order saved, but page refresh failed", error); }
    return { success: true as const, ...result };
  } catch (error) {
    if (error instanceof CheckoutError) return { success: false as const, error: error.message };
    console.error("Checkout failed", error);
    return { success: false as const, error: "Unable to save the order. Refresh and try again." };
  }
}
