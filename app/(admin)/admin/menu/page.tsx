import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decrypt } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { menuCategorySelect, menuProductSelect, toMenuProduct } from "@/app/lib/menu-management";
import MenuManager from "./MenuManager";

export default async function MenuManagementPage() {
  const token = (await cookies()).get("session")?.value;
  const session = token ? await decrypt(token).catch(() => null) : null;
  if (typeof session?.id !== "string") redirect("/login");
  const profile = await prisma.profile.findUnique({ where: { id: session.id }, select: { role: true } });
  if (profile?.role !== "admin") redirect("/terminal");
  const [categories, products] = await Promise.all([
    prisma.category.findMany({ select: menuCategorySelect, orderBy: { name: "asc" } }),
    prisma.product.findMany({ select: menuProductSelect, orderBy: { name: "asc" } }),
  ]);
  return <MenuManager categories={categories} products={products.map(toMenuProduct)} />;
}
