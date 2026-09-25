import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decrypt } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { couponSelect, toCouponData } from "@/app/lib/coupon-management";
import CouponManager from "./CouponManager";

export default async function CouponsPage() {
  const token = (await cookies()).get("session")?.value;
  const session = token ? await decrypt(token).catch(() => null) : null;
  if (typeof session?.id !== "string") redirect("/login");
  const profile = await prisma.profile.findUnique({ where: { id: session.id }, select: { role: true } });
  if (profile?.role !== "admin") redirect("/terminal");
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" }, select: couponSelect });
  return <CouponManager coupons={coupons.map(toCouponData)} generatedAt={new Date().toISOString()} />;
}
