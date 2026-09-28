import type { Prisma } from "@prisma/client";
import { CheckoutError, moneyToMinor, minorToMoney } from "./order-calculations.ts";

export class MenuError extends Error {}
type ProductFields = {
  name: string; categoryId: string; basePrice: string; imageUrl: string | null;
  isAvailable: boolean; requiresPreparation: boolean | null;
};
export type MenuCommand =
  | { type: "saveCategory"; id?: string; name: string; requiresPreparation: boolean }
  | { type: "archiveCategory" | "restoreCategory" | "deleteCategory"; id: string }
  | { type: "createProduct"; data: ProductFields; stock: number }
  | { type: "updateProduct"; id: string; data: ProductFields }
  | { type: "setStock"; id: string; stock: number; expectedStock: number }
  | { type: "setAvailability"; id: string; isAvailable: boolean }
  | { type: "archiveProduct" | "restoreProduct" | "deleteProduct"; id: string };

function text(value: unknown, label: string, limit = 120) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > limit) {
    throw new MenuError(`${label} is required and must be at most ${limit} characters.`);
  }
  return value.trim();
}
function bool(value: unknown): boolean {
  if (typeof value !== "boolean") throw new MenuError("Invalid availability or preparation setting.");
  return value;
}
function stockValue(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 2_147_483_647) {
    throw new MenuError("Stock must be a whole number between 0 and 2,147,483,647.");
  }
  return value;
}
export function validateImageUrl(value: unknown): string | null {
  if (value === "" || value === null || value === undefined) return null;
  const raw = text(value, "Image URL", 2000);
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com" || url.username || url.password) throw new Error();
  } catch { throw new MenuError("Use an HTTPS image URL hosted on res.cloudinary.com."); }
  return raw;
}
export function parseMenuCommand(input: unknown): MenuCommand {
  if (!input || typeof input !== "object") throw new MenuError("Invalid menu request.");
  const raw = input as Record<string, unknown>;
  if (raw.type === "saveCategory") return {
    type: raw.type, id: raw.id === undefined ? undefined : text(raw.id, "Category ID"),
    name: text(raw.name, "Category name", 80), requiresPreparation: bool(raw.requiresPreparation),
  };
  if (raw.type === "createProduct" || raw.type === "updateProduct") {
    if (!raw.data || typeof raw.data !== "object") throw new MenuError("Missing product details.");
    const fields = raw.data as Record<string, unknown>;
    let basePrice: string;
    try { basePrice = minorToMoney(moneyToMinor(fields.basePrice, "Price")); }
    catch (error) { if (error instanceof CheckoutError) throw new MenuError(error.message); throw error; }
    const data = {
      name: text(fields.name, "Product name"), categoryId: text(fields.categoryId, "Category"), basePrice,
      imageUrl: validateImageUrl(fields.imageUrl), isAvailable: bool(fields.isAvailable),
      requiresPreparation: fields.requiresPreparation === null ? null : bool(fields.requiresPreparation),
    };
    return raw.type === "createProduct"
      ? { type: raw.type, data, stock: stockValue(raw.stock) }
      : { type: raw.type, data, id: text(raw.id, "Product ID") };
  }
  const id = text(raw.id, "ID");
  switch (raw.type) {
    case "setStock": return { type: raw.type, id, stock: stockValue(raw.stock), expectedStock: stockValue(raw.expectedStock) };
    case "setAvailability": return { type: raw.type, id, isAvailable: bool(raw.isAvailable) };
    case "archiveCategory": case "restoreCategory": case "deleteCategory":
    case "archiveProduct": case "restoreProduct": case "deleteProduct": return { type: raw.type, id };
    default: throw new MenuError("Unknown menu operation.");
  }
}

export async function requireMenuAdmin(tx: Pick<Prisma.TransactionClient, "profile">, userId: string) {
  const profile = await tx.profile.findUnique({ where: { id: userId }, select: { role: true } });
  if (profile?.role !== "admin") throw new MenuError("Only an administrator can manage the menu.");
}

// Serializable transactions keep category cascades atomic, and conditional stock
// edits prevent overwriting concurrent checkouts.
export async function applyMenuCommand(tx: Prisma.TransactionClient, userId: string, command: MenuCommand) {
  await requireMenuAdmin(tx, userId);
  if (command.type === "saveCategory") {
    const duplicate = await tx.category.findFirst({ where: {
      name: { equals: command.name, mode: "insensitive" },
      ...(command.id ? { id: { not: command.id } } : {}),
    } });
    if (duplicate) throw new MenuError("A category with this name already exists, including archived categories.");
    const data = { name: command.name, requiresPreparation: command.requiresPreparation };
    if (command.id) await tx.category.update({ where: { id: command.id }, data });
    else await tx.category.create({ data });
    return command.id ? "Category updated." : "Category created.";
  }
  if (command.type === "archiveCategory" || command.type === "restoreCategory" || command.type === "deleteCategory") {
    const category = await tx.category.findUnique({ where: { id: command.id }, include: { _count: { select: { products: true } } } });
    if (!category) throw new MenuError("Category no longer exists.");
    if (command.type === "deleteCategory") {
      const relatedDeals = await tx.deal.findMany({
        where: { items: { some: { product: { categoryId: command.id } } } },
        select: { id: true },
      });
      if (relatedDeals.length > 0) {
        await tx.deal.deleteMany({ where: { id: { in: relatedDeals.map((deal) => deal.id) } } });
      }
      await tx.category.delete({ where: { id: command.id } });
      const productLabel = `${category._count.products} product${category._count.products === 1 ? "" : "s"}`;
      const dealLabel = `${relatedDeals.length} deal${relatedDeals.length === 1 ? "" : "s"}`;
      return `Category deleted with ${productLabel} and ${dealLabel}. Completed order history was preserved.`;
    }
    const isArchived = command.type === "archiveCategory";
    await tx.category.update({ where: { id: command.id }, data: { isArchived } });
    return isArchived ? "Category archived. Its products are hidden from checkout." : "Category restored. Individual product settings are unchanged.";
  }
  if (command.type === "createProduct" || command.type === "updateProduct") {
    const category = await tx.category.findUnique({ where: { id: command.data.categoryId } });
    if (!category || category.isArchived) throw new MenuError("Choose an active category. Restore the category first if needed.");
    if (command.type === "createProduct") await tx.product.create({ data: { ...command.data, stock: command.stock } });
    else await tx.product.update({ where: { id: command.id }, data: command.data });
    return command.type === "createProduct" ? "Product created." : "Product details updated. Stock is unchanged.";
  }
  if (command.type === "setStock") {
    const changed = await tx.product.updateMany({
      where: { id: command.id, stock: command.expectedStock }, data: { stock: command.stock },
    });
    if (changed.count !== 1) throw new MenuError("Stock changed while you were editing. Refresh the page and enter the new count again.");
    return "Stock updated. Availability setting is unchanged.";
  }
  if (command.type === "setAvailability") {
    await tx.product.update({ where: { id: command.id }, data: { isAvailable: command.isAvailable } });
    return command.isAvailable ? "Product enabled. It can be sold when in stock and not archived." : "Product marked unavailable.";
  }
  const product = await tx.product.findUnique({ where: { id: command.id }, include: {
    category: true, _count: { select: { orderItems: true, dealItems: true } },
    modifiers: { select: { _count: { select: { orderItems: true } } } },
  } });
  if (!product) throw new MenuError("Product no longer exists.");
  if (command.type === "restoreProduct") {
    if (product.category.isArchived) throw new MenuError("Restore or change the category before restoring this product.");
    await tx.product.update({ where: { id: command.id }, data: { isArchived: false } });
    return "Product restored. Stock and availability settings are unchanged.";
  }
  const hasReferences = product._count.orderItems > 0 || product._count.dealItems > 0 ||
    product.modifiers.some((modifier) => modifier._count.orderItems > 0);
  if (command.type === "deleteProduct" && !hasReferences) {
    await tx.product.delete({ where: { id: command.id } });
    return "Unused product deleted.";
  }
  await tx.product.update({ where: { id: command.id }, data: { isArchived: true } });
  return command.type === "deleteProduct" ? "Product archived because it is linked to sales or deals. History is preserved." : "Product archived. History and stock are preserved.";
}

export const menuCategorySelect = {
  id: true, name: true, requiresPreparation: true, isArchived: true,
  _count: { select: { products: true } },
} satisfies Prisma.CategorySelect;
export const menuProductSelect = {
  id: true, name: true, categoryId: true, basePrice: true, imageUrl: true,
  stock: true, isAvailable: true, isArchived: true, requiresPreparation: true,
} satisfies Prisma.ProductSelect;
export function toMenuProduct(product: Prisma.ProductGetPayload<{ select: typeof menuProductSelect }>) {
  return { id: product.id, name: product.name, categoryId: product.categoryId,
    basePrice: product.basePrice.toFixed(2), imageUrl: product.imageUrl, stock: product.stock,
    isAvailable: product.isAvailable, isArchived: product.isArchived, requiresPreparation: product.requiresPreparation };
}
export type MenuCategory = Prisma.CategoryGetPayload<{ select: typeof menuCategorySelect }>;
export type MenuProduct = ReturnType<typeof toMenuProduct>;
