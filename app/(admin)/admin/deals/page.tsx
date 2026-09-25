import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decrypt } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { dealSelect, toDealData } from "@/app/lib/deal-management";
import { menuProductSelect, toMenuProduct } from "@/app/lib/menu-management";
import DealManager from "./DealManager";

export default async function DealsPage() {
  const token = (await cookies()).get("session")?.value;
  const session = token ? await decrypt(token).catch(() => null) : null;
  if (typeof session?.id !== "string") redirect("/login");
  const profile = await prisma.profile.findUnique({ where: { id: session.id }, select: { role: true } });
  if (profile?.role !== "admin") redirect("/terminal");
  const [deals, products] = await Promise.all([
    prisma.deal.findMany({ select: dealSelect, orderBy: { name: "asc" } }),
    prisma.product.findMany({
      where: { isArchived: false, category: { isArchived: false } },
      select: menuProductSelect, orderBy: { name: "asc" },
    }),
  ]);
  return <DealManager deals={deals.map(toDealData)} products={products.map(toMenuProduct)} />;
}
