import type { Prisma } from "@prisma/client";
import {
  CheckoutError,
  minorToMoney,
  moneyToMinor,
  normalizeCouponCode,
} from "./order-calculations.ts";

export class CouponError extends Error {}

export type CouponCommand =
  | {
      type: "saveCoupon";
      id?: string;
      code: string;
      discountType: "FIXED" | "PERCENTAGE";
      value: string;
      minimumSubtotal: string;
      expiresAt?: string;
      isActive: boolean;
    }
  | { type: "setCouponActive"; id: string; isActive: boolean }
  | { type: "deleteCoupon"; id: string };

function requiredText(value: unknown, label: string, max = 100) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new CouponError(`${label} is required and must be at most ${max} characters.`);
  }
  return value.trim();
}

function money(value: unknown, label: string, allowZero = false) {
  try {
    const minor = moneyToMinor(value, label);
    if (!allowZero && minor === 0) throw new CouponError(`${label} must be greater than zero.`);
    return minorToMoney(minor);
  } catch (error) {
    if (error instanceof CouponError) throw error;
    if (error instanceof CheckoutError) throw new CouponError(error.message);
    throw error;
  }
}

function expiry(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new CouponError("Invalid expiry date.");
  const parsed = new Date(`${value}:00+05:00`);
  if (Number.isNaN(parsed.getTime())) throw new CouponError("Invalid expiry date.");
  return parsed;
}

export function parseCouponCommand(input: unknown): CouponCommand {
  if (!input || typeof input !== "object") throw new CouponError("Invalid coupon request.");
  const raw = input as Record<string, unknown>;
  const id = raw.id === undefined ? undefined : requiredText(raw.id, "Coupon ID");
  if (raw.type === "saveCoupon") {
    if (raw.discountType !== "FIXED" && raw.discountType !== "PERCENTAGE") {
      throw new CouponError("Choose a fixed or percentage discount.");
    }
    let code: string;
    try { code = normalizeCouponCode(requiredText(raw.code, "Coupon code", 40)); }
    catch (error) { throw new CouponError(error instanceof Error ? error.message : "Invalid coupon code."); }
    const value = money(raw.value, "Coupon value");
    if (raw.discountType === "PERCENTAGE" && moneyToMinor(value) > 10_000) {
      throw new CouponError("Percentage discount cannot exceed 100%.");
    }
    if (typeof raw.isActive !== "boolean") throw new CouponError("Invalid coupon status.");
    return {
      type: raw.type, id, code, discountType: raw.discountType, value,
      minimumSubtotal: money(raw.minimumSubtotal ?? 0, "Minimum subtotal", true),
      expiresAt: expiry(raw.expiresAt)?.toISOString(), isActive: raw.isActive,
    };
  }
  if (!id) throw new CouponError("Coupon ID is required.");
  if (raw.type === "setCouponActive") {
    if (typeof raw.isActive !== "boolean") throw new CouponError("Invalid coupon status.");
    return { type: raw.type, id, isActive: raw.isActive };
  }
  if (raw.type === "deleteCoupon") return { type: raw.type, id };
  throw new CouponError("Unknown coupon operation.");
}

export async function applyCouponCommand(
  tx: Prisma.TransactionClient,
  userId: string,
  command: CouponCommand,
) {
  const profile = await tx.profile.findUnique({ where: { id: userId }, select: { role: true } });
  if (profile?.role !== "admin") throw new CouponError("Only an administrator can manage coupons.");
  if (command.type === "saveCoupon") {
    const duplicate = await tx.coupon.findFirst({
      where: { code: command.code, ...(command.id ? { id: { not: command.id } } : {}) },
      select: { id: true },
    });
    if (duplicate) throw new CouponError("That coupon code already exists.");
    const data = {
      code: command.code, discountType: command.discountType, value: command.value,
      minimumSubtotal: command.minimumSubtotal,
      expiresAt: command.expiresAt ? new Date(command.expiresAt) : null,
      isActive: command.isActive,
    };
    if (command.id) {
      await tx.coupon.update({ where: { id: command.id }, data });
      return "Coupon updated.";
    }
    await tx.coupon.create({ data });
    return "Coupon created.";
  }
  const coupon = await tx.coupon.findUnique({
    where: { id: command.id }, select: { id: true, _count: { select: { orders: true } } },
  });
  if (!coupon) throw new CouponError("Coupon no longer exists.");
  if (command.type === "setCouponActive") {
    await tx.coupon.update({ where: { id: command.id }, data: { isActive: command.isActive } });
    return command.isActive ? "Coupon enabled." : "Coupon disabled.";
  }
  if (coupon._count.orders > 0) {
    await tx.coupon.update({ where: { id: command.id }, data: { isActive: false } });
    return "Used coupon disabled to preserve sales history.";
  }
  await tx.coupon.delete({ where: { id: command.id } });
  return "Unused coupon deleted.";
}

export const couponSelect = {
  id: true, code: true, discountType: true, value: true, minimumSubtotal: true,
  expiresAt: true, isActive: true, createdAt: true,
  _count: { select: { orders: true } },
} satisfies Prisma.CouponSelect;

export function toCouponData(coupon: Prisma.CouponGetPayload<{ select: typeof couponSelect }>) {
  return {
    id: coupon.id, code: coupon.code, discountType: coupon.discountType,
    value: coupon.value.toFixed(2), minimumSubtotal: coupon.minimumSubtotal.toFixed(2),
    expiresAt: coupon.expiresAt?.toISOString() ?? null, isActive: coupon.isActive,
    createdAt: coupon.createdAt.toISOString(), usageCount: coupon._count.orders,
  };
}

export type CouponData = ReturnType<typeof toCouponData>;
