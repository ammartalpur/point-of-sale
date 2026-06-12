"use server";

import { prisma } from "@/app/lib/prisma";
import { revalidatePath } from "next/cache";

// Fetch orders that are active in the kitchen pipeline
export async function getActiveKitchenOrders() {
  const orders = await prisma.order.findMany({
    where: {
      status: {
        in: ["PENDING", "PREPARING", "READY"],
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    include: {
      items: {
        include: {
          product: {
            include: {
              category: {
                select: { requiresPreparation: true },
              },
            },
          },
        },
      },
    },
  });

  // NEW: This strips the complex Prisma Decimal objects into safe JSON strings
  return JSON.parse(JSON.stringify(orders));
}
// Bump the order status forward through the entire pipeline
export async function updateOrderStatus(
  orderId: string,
  newStatus: "PREPARING" | "READY" | "COMPLETED",
) {
  // <-- UPDATED Type
  await prisma.order.update({
    where: { id: orderId },
    data: { status: newStatus },
  });

  revalidatePath("/kitchen");
  revalidatePath("/terminal");
  revalidatePath("/admin/dashboard"); // Force dashboard metrics to refresh
}
