"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { decrypt } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import {
  applyCouponCommand,
  CouponError,
  parseCouponCommand,
} from "@/app/lib/coupon-management";

export async function mutateCoupon(input: unknown) {
  try {
    const token = (await cookies()).get("session")?.value;
    const session = token ? await decrypt(token).catch(() => null) : null;
    if (typeof session?.id !== "string") throw new CouponError("Your session expired. Please sign in again.");
    const command = parseCouponCommand(input);
    const message = await prisma.$transaction(
      (tx) => applyCouponCommand(tx, session.id as string, command),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 15_000, timeout: 20_000 },
    );
    for (const path of ["/admin/coupons", "/terminal", "/admin/dashboard"]) revalidatePath(path);
    return { success: true as const, message };
  } catch (error) {
    if (error instanceof CouponError) return { success: false as const, error: error.message };
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { success: false as const, error: "Coupon no longer exists. Refresh the page." };
    }
    console.error("Coupon update failed", error);
    return { success: false as const, error: "Unable to save the coupon." };
  }
}
