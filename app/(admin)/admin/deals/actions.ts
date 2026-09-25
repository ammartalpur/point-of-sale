"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { decrypt } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { applyDealCommand, DealError, parseDealCommand } from "@/app/lib/deal-management";

export async function mutateDeal(input: unknown) {
  try {
    const token = (await cookies()).get("session")?.value;
    const session = token ? await decrypt(token).catch(() => null) : null;
    if (typeof session?.id !== "string") throw new DealError("Your session expired. Please sign in again.");
    const command = parseDealCommand(input);
    let message = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        message = await prisma.$transaction((tx) => applyDealCommand(tx, session.id as string, command), {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 15_000, timeout: 20_000,
        });
        break;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2) continue;
        throw error;
      }
    }
    try {
      for (const path of ["/admin/deals", "/terminal", "/admin/dashboard"]) revalidatePath(path);
    } catch (error) { console.error("Deal saved; refresh failed", error); }
    return { success: true as const, message };
  } catch (error) {
    if (error instanceof DealError) return { success: false as const, error: error.message };
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") return { success: false as const, error: "This deal no longer exists. Refresh the page." };
      if (error.code === "P2034") return { success: false as const, error: "The catalog changed at the same time. Refresh and try again." };
    }
    console.error("Deal update failed", error);
    return { success: false as const, error: "Unable to save the deal. Please try again." };
  }
}
