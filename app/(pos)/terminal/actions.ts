"use server";

import { prisma } from "@/app/lib/prisma";
import { revalidatePath } from "next/cache";

// 1. Fetch only available products
export async function getTerminalMenu() {
  const categories = await prisma.category.findMany({
    include: {
      products: {
        where: {
          isAvailable: true,
          stock: { gt: 0 },
        },
      },
    },
  });

  return categories.map((category) => ({
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
  }));
}

// 2. Process the order
export async function processCheckout(
  cart: any[],
  cashierId: string,
  paymentMethod: string,
  totalAmount: number,
) {
  try {
    const createdOrderId = await prisma.$transaction(async (tx) => {
      // A. Create the main Order record
      const order = await tx.order.create({
        data: {
          cashierId,
          totalAmount,
          paymentMethod,
          status: "PENDING", // <-- CHANGED from 'completed'
        },
      });

      for (const item of cart) {
        const product = await tx.product.findUnique({ where: { id: item.id } });
        if (!product || product.stock < item.quantity) {
          throw new Error(`Not enough stock for ${item.name}`);
        }

        await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: item.id,
            quantity: item.quantity,
            priceAtTime: item.basePrice,
          },
        });

        await tx.product.update({
          where: { id: item.id },
          data: {
            stock: product.stock - item.quantity,
            isAvailable: product.stock - item.quantity > 0,
          },
        });
      }

      return order.id;
    });

    revalidatePath("/terminal");
    revalidatePath("/admin/menu");
    revalidatePath("/admin/dashboard");

    return { success: true, orderId: createdOrderId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
