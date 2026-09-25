"use server";

import { prisma } from "@/app/lib/prisma";
import { revalidatePath } from "next/cache";
import { kitchenOrderSelect, toKitchenOrder } from "@/app/lib/client-data";
import { cookies } from "next/headers";
import { decrypt } from "@/app/lib/auth";

async function requireStaff() {
  const token = (await cookies()).get("session")?.value;
  const session = token ? await decrypt(token).catch(() => null) : null;
  if (typeof session?.id !== "string") throw new Error("Please sign in again.");
  const profile = await prisma.profile.findUnique({ where: { id: session.id }, select: { role: true } });
  if (!profile || !["admin", "cashier"].includes(profile.role)) throw new Error("You cannot manage kitchen orders.");
}

// Fetch orders that are active in the kitchen pipeline
export async function getActiveKitchenOrders() {
  await requireStaff();
  const orders = await prisma.order.findMany({
    where: {
      status: {
        in: ["PENDING", "PREPARING", "READY"],
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    select: kitchenOrderSelect,
  });

  return orders.map(toKitchenOrder);
}
// Bump the order status forward through the entire pipeline
export async function updateOrderStatus(
  orderId: string,
  newStatus: "PREPARING" | "READY" | "COMPLETED",
) {
  await requireStaff();
  if (typeof orderId !== "string" || !/^[0-9a-f-]{36}$/i.test(orderId) || !["PREPARING", "READY", "COMPLETED"].includes(newStatus)) {
    throw new Error("Invalid kitchen update.");
  }
  const allowedPrevious = { PREPARING: "PENDING", READY: "PREPARING", COMPLETED: "READY" } as const;
  const updated = await prisma.order.updateMany({
    where: { id: orderId, status: allowedPrevious[newStatus] },
    data: { status: newStatus, completedAt: newStatus === "COMPLETED" ? new Date() : null },
  });
  if (updated.count !== 1) throw new Error("This order has already moved to another kitchen stage.");

  revalidatePath("/kitchen");
  revalidatePath("/terminal");
  revalidatePath("/admin/dashboard"); // Force dashboard metrics to refresh
}
