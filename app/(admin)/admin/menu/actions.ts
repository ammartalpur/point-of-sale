"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { decrypt } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { applyMenuCommand, MenuError, parseMenuCommand } from "@/app/lib/menu-management";

export async function mutateMenu(input: unknown) {
  try {
    const token = (await cookies()).get("session")?.value;
    const session = token ? await decrypt(token).catch(() => null) : null;
    if (typeof session?.id !== "string") throw new MenuError("Your session expired. Please sign in again.");
    const userId = session.id;
    const command = parseMenuCommand(input);
    let message = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        message = await prisma.$transaction((tx) => applyMenuCommand(tx, userId, command), {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 15_000, timeout: 15_000,
        });
        break;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2) continue;
        throw error;
      }
    }
    try {
      for (const path of ["/admin/menu", "/terminal", "/admin/dashboard", "/admin/deals"]) revalidatePath(path);
    } catch (error) { console.error("Menu saved; refresh failed", error); }
    return { success: true as const, message };
  } catch (error) {
    if (error instanceof MenuError) return { success: false as const, error: error.message };
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") return { success: false as const, error: "This item no longer exists. Refresh the menu." };
      if (error.code === "P2003") return { success: false as const, error: "This item is still in use. Archive it instead." };
      if (error.code === "P2034") return { success: false as const, error: "The menu changed at the same time. Refresh and try again." };
    }
    console.error("Menu update failed", error);
    return { success: false as const, error: "Unable to save the menu. Please try again." };
  }
}
