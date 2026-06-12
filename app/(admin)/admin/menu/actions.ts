"use server";

import { prisma } from "@/app/lib/prisma";
import { revalidatePath } from "next/cache";

// --- CATEGORY ACTIONS ---

export async function getCategories() {
  return await prisma.category.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function createCategory(formData: FormData) {
  const name = formData.get("name") as string;
  if (!name) return { error: "Category name is required" };

  await prisma.category.create({
    data: { name },
  });

  revalidatePath("/admin/menu");
}

export async function deleteCategory(id: string) {
  try {
    await prisma.category.delete({
      where: { id },
    });
    revalidatePath("/admin/menu");
    revalidatePath("/terminal");
  } catch (error: any) {
    // P2003 is Prisma's code for "Foreign Key Constraint Failed"
    if (error.code === "P2003") {
      console.error("Blocked deletion: Category is tied to past orders.");
      // In a more complex UI, you would return this error to show a toast notification
      return {
        error:
          "Cannot delete: Products in this category are linked to past receipts.",
      };
    }
    throw error;
  }
}

// --- PRODUCT ACTIONS ---

export async function getProducts() {
  return await prisma.product.findMany({
    include: { category: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function createProduct(formData: FormData) {
  const name = formData.get("name") as string;
  const basePrice = parseFloat(formData.get("basePrice") as string);
  const categoryId = formData.get("categoryId") as string;
  const stock = parseInt(formData.get("stock") as string);
  const imageUrl = formData.get("imageUrl") as string;

  if (!name || isNaN(basePrice) || !categoryId || isNaN(stock)) {
    return { error: "Missing required product fields" };
  }

  await prisma.product.create({
    data: {
      name,
      basePrice,
      categoryId,
      stock,
      imageUrl: imageUrl || null,
      isAvailable: stock > 0,
    },
  });

  revalidatePath("/admin/menu");
  revalidatePath("/terminal");
}

export async function updateProductStock(formData: FormData) {
  const id = formData.get("productId") as string;
  const newStock = parseInt(formData.get("newStock") as string);

  if (!id || isNaN(newStock)) return { error: "Invalid stock data" };

  await prisma.product.update({
    where: { id },
    data: {
      stock: newStock,
      isAvailable: newStock > 0,
    },
  });

  revalidatePath("/admin/menu");
  revalidatePath("/terminal");
}

// Add this to the bottom of actions.ts
export async function updateProductImage(productId: string, imageUrl: string) {
  if (!productId || !imageUrl) return { error: 'Missing data' }

  await prisma.product.update({
    where: { id: productId },
    data: { imageUrl }
  })

  revalidatePath('/admin/menu')
  revalidatePath('/terminal')
}