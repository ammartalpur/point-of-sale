import type { Prisma } from "@prisma/client";
import { CheckoutError, minorToMoney, moneyToMinor } from "./order-calculations.ts";

export class DealError extends Error {}

type DealComponent = { productId: string; quantity: number };
export type DealCommand =
  | { type: "saveDeal"; id?: string; name: string; price: string; imageUrl: string | null; isActive: boolean; items: DealComponent[] }
  | { type: "setDealActive"; id: string; isActive: boolean }
  | { type: "archiveDeal" | "restoreDeal" | "deleteDeal"; id: string };

function requiredText(value: unknown, label: string, max = 120) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new DealError(`${label} is required and must be at most ${max} characters.`);
  }
  return value.trim();
}

function booleanValue(value: unknown) {
  if (typeof value !== "boolean") throw new DealError("Invalid deal status.");
  return value;
}

function imageUrl(value: unknown): string | null {
  if (value === "" || value === null || value === undefined) return null;
  const raw = requiredText(value, "Image URL", 2000);
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com" || url.username || url.password) throw new Error();
  } catch { throw new DealError("Use an HTTPS image URL hosted on res.cloudinary.com."); }
  return raw;
}

function dealPrice(value: unknown) {
  try {
    const minor = moneyToMinor(value, "Deal price");
    if (minor === 0) throw new DealError("Deal price must be greater than zero.");
    return minorToMoney(minor);
  } catch (error) {
    if (error instanceof DealError) throw error;
    if (error instanceof CheckoutError) throw new DealError(error.message);
    throw error;
  }
}

function components(value: unknown): DealComponent[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 50) {
    throw new DealError("Add between 1 and 50 products to the deal.");
  }
  const seen = new Set<string>();
  let totalUnits = 0;
  const parsed = value.map((entry) => {
    if (!entry || typeof entry !== "object") throw new DealError("Invalid deal product.");
    const raw = entry as Record<string, unknown>;
    const productId = requiredText(raw.productId, "Product ID", 100);
    if (seen.has(productId)) throw new DealError("Each product can appear only once; increase its quantity instead.");
    seen.add(productId);
    if (typeof raw.quantity !== "number" || !Number.isInteger(raw.quantity) || raw.quantity < 1 || raw.quantity > 10_000) {
      throw new DealError("Every product quantity must be a whole number between 1 and 10,000.");
    }
    totalUnits += raw.quantity;
    return { productId, quantity: raw.quantity };
  });
  if (totalUnits < 2) throw new DealError("A deal must contain at least two total items.");
  return parsed;
}

export function parseDealCommand(input: unknown): DealCommand {
  if (!input || typeof input !== "object") throw new DealError("Invalid deal request.");
  const raw = input as Record<string, unknown>;
  if (raw.type === "saveDeal") return {
    type: raw.type,
    id: raw.id === undefined ? undefined : requiredText(raw.id, "Deal ID", 100),
    name: requiredText(raw.name, "Deal name"),
    price: dealPrice(raw.price),
    imageUrl: imageUrl(raw.imageUrl),
    isActive: booleanValue(raw.isActive),
    items: components(raw.items),
  };
  const id = requiredText(raw.id, "Deal ID", 100);
  if (raw.type === "setDealActive") return { type: raw.type, id, isActive: booleanValue(raw.isActive) };
  if (raw.type === "archiveDeal" || raw.type === "restoreDeal" || raw.type === "deleteDeal") return { type: raw.type, id };
  throw new DealError("Unknown deal operation.");
}

export async function applyDealCommand(tx: Prisma.TransactionClient, userId: string, command: DealCommand) {
  const profile = await tx.profile.findUnique({ where: { id: userId }, select: { role: true } });
  if (profile?.role !== "admin") throw new DealError("Only an administrator can manage deals.");

  if (command.type === "saveDeal") {
    const duplicate = await tx.deal.findFirst({ where: {
      name: { equals: command.name, mode: "insensitive" },
      ...(command.id ? { id: { not: command.id } } : {}),
    }, select: { id: true } });
    if (duplicate) throw new DealError("A deal with this name already exists, including archived deals.");
    const products = await tx.product.findMany({
      where: { id: { in: command.items.map((item) => item.productId) } },
      select: { id: true, isArchived: true, category: { select: { isArchived: true } } },
    });
    if (products.length !== command.items.length || products.some((product) => product.isArchived || product.category.isArchived)) {
      throw new DealError("Every deal component must be an active catalog product.");
    }
    const data = { name: command.name, price: command.price, imageUrl: command.imageUrl, isActive: command.isActive };
    if (command.id) {
      const exists = await tx.deal.findUnique({ where: { id: command.id }, select: { id: true } });
      if (!exists) throw new DealError("Deal no longer exists.");
      await tx.deal.update({ where: { id: command.id }, data });
      await tx.dealItem.deleteMany({ where: { dealId: command.id } });
      await tx.dealItem.createMany({ data: command.items.map((item) => ({ ...item, dealId: command.id! })) });
      return "Deal updated.";
    }
    await tx.deal.create({ data: { ...data, items: { create: command.items } } });
    return "Deal created.";
  }

  const deal = await tx.deal.findUnique({ where: { id: command.id }, select: { id: true, isArchived: true, _count: { select: { orderDeals: true } } } });
  if (!deal) throw new DealError("Deal no longer exists.");
  if (command.type === "setDealActive") {
    if (deal.isArchived) throw new DealError("Restore the deal before changing its availability.");
    await tx.deal.update({ where: { id: command.id }, data: { isActive: command.isActive } });
    return command.isActive ? "Deal enabled." : "Deal paused.";
  }
  if (command.type === "restoreDeal") {
    await tx.deal.update({ where: { id: command.id }, data: { isArchived: false } });
    return "Deal restored. Its active setting is unchanged.";
  }
  if (command.type === "deleteDeal" && deal._count.orderDeals === 0) {
    await tx.deal.delete({ where: { id: command.id } });
    return "Unused deal deleted.";
  }
  await tx.deal.update({ where: { id: command.id }, data: { isArchived: true, isActive: false } });
  return command.type === "deleteDeal" ? "Deal archived because it has sales history." : "Deal archived.";
}

export const dealSelect = {
  id: true, name: true, price: true, imageUrl: true, isActive: true, isArchived: true,
  items: { orderBy: { id: "asc" as const }, select: {
    id: true, productId: true, quantity: true,
    product: { select: { name: true, basePrice: true, stock: true, isAvailable: true, isArchived: true,
      category: { select: { name: true, isArchived: true } } } },
  } },
  _count: { select: { orderDeals: true } },
} satisfies Prisma.DealSelect;

export function toDealData(deal: Prisma.DealGetPayload<{ select: typeof dealSelect }>) {
  const available = !deal.isArchived && deal.isActive && deal.items.length > 0 && deal.items.every((item) =>
    !item.product.isArchived && !item.product.category.isArchived && item.product.isAvailable && item.product.stock >= item.quantity);
  const maxQuantity = deal.items.length === 0 ? 0 : Math.min(...deal.items.map((item) => Math.floor(item.product.stock / item.quantity)));
  return {
    id: deal.id, name: deal.name, price: deal.price.toFixed(2), imageUrl: deal.imageUrl,
    isActive: deal.isActive, isArchived: deal.isArchived, available, maxQuantity,
    salesCount: deal._count.orderDeals,
    items: deal.items.map((item) => ({ id: item.id, productId: item.productId, quantity: item.quantity,
      product: { name: item.product.name, basePrice: item.product.basePrice.toFixed(2), stock: item.product.stock,
        isAvailable: item.product.isAvailable, isArchived: item.product.isArchived,
        categoryName: item.product.category.name, categoryArchived: item.product.category.isArchived } })),
  };
}

export type DealData = ReturnType<typeof toDealData>;
