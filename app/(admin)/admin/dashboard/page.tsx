import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decrypt } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import {
  buildPeakHours,
  buildRevenueTrend,
  getDashboardPeriod,
} from "@/app/lib/dashboard";
import DashboardClient from "./DashboardClient";

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string | string[];
  }>;
}) {
  const token = (await cookies()).get("session")?.value;
  const session = token ? await decrypt(token).catch(() => null) : null;

  if (!session?.id || typeof session.id !== "string") {
    redirect("/login");
  }

  const user = await prisma.profile.findUnique({
    where: { id: session.id },
    select: { email: true, role: true },
  });

  if (!user || user.role !== "admin") {
    redirect("/terminal");
  }

  const params = await searchParams;
  const requestedRange = Array.isArray(params.range)
    ? params.range[0]
    : params.range;
  const now = new Date();
  const period = getDashboardPeriod(requestedRange, now);
  const today = getDashboardPeriod("today", now);
  const completedWhere = {
    status: "COMPLETED" as const,
    completedAt: { gte: period.start, lte: period.end },
  };

  const [
    periodOrders,
    todaySales,
    allTimeSales,
    topItemsRaw,
    categorySalesRaw,
    paymentMethodsRaw,
    liveOrdersRaw,
    inventoryAlertsRaw,
    recentOrdersRaw,
    activeProductCount,
    activeCategoryCount,
    activeDealsRaw,
  ] = await Promise.all([
    prisma.order.findMany({
      where: completedWhere,
      select: { completedAt: true, totalAmount: true },
      orderBy: { completedAt: "asc" },
    }),
    prisma.order.aggregate({
      where: {
        status: "COMPLETED",
        completedAt: { gte: today.start, lte: today.end },
      },
      _sum: { totalAmount: true },
    }),
    prisma.order.aggregate({
      where: { status: "COMPLETED" },
      _sum: { totalAmount: true },
      _count: { id: true },
    }),
    prisma.orderItem.groupBy({
      by: ["productName", "categoryName"],
      where: { order: completedWhere },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
    prisma.orderItem.groupBy({
      by: ["categoryName"],
      where: { order: completedWhere },
      _sum: { lineTotal: true },
      orderBy: { _sum: { lineTotal: "desc" } },
    }),
    prisma.order.groupBy({
      by: ["paymentMethod"],
      where: completedWhere,
      _sum: { totalAmount: true },
      orderBy: { _sum: { totalAmount: "desc" } },
    }),
    prisma.order.findMany({
      where: { status: { in: ["PENDING", "PREPARING", "READY"] } },
      orderBy: { createdAt: "asc" },
      take: 8,
      select: {
        id: true,
        createdAt: true,
        status: true,
        orderType: true,
        totalAmount: true,
        items: {
          select: { productName: true, quantity: true },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.product.findMany({
      where: {
        isArchived: false,
        stock: { lte: 10 },
        category: { isArchived: false },
      },
      orderBy: [{ stock: "asc" }, { name: "asc" }],
      take: 7,
      select: {
        id: true,
        name: true,
        stock: true,
        category: { select: { name: true } },
      },
    }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 7,
      select: {
        id: true,
        createdAt: true,
        status: true,
        orderType: true,
        paymentMethod: true,
        totalAmount: true,
        tableNumber: true,
        customerName: true,
        items: {
          select: { productName: true, quantity: true },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.product.count({
      where: { isArchived: false, category: { isArchived: false } },
    }),
    prisma.category.count({ where: { isArchived: false } }),
    prisma.deal.findMany({
      where: { isArchived: false, isActive: true },
      select: {
        id: true,
        items: {
          select: {
            quantity: true,
            product: {
              select: {
                stock: true,
                isAvailable: true,
                isArchived: true,
                category: { select: { isArchived: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  const periodRevenue = periodOrders.reduce(
    (sum, order) => sum + Number(order.totalAmount),
    0,
  );
  const periodOrderCount = periodOrders.length;
  const availableDealCount = activeDealsRaw.filter((deal) =>
    deal.items.every(
      (item) =>
        item.product.isAvailable &&
        !item.product.isArchived &&
        !item.product.category.isArchived &&
        item.product.stock >= item.quantity,
    ),
  ).length;

  return (
    <DashboardClient
      data={{
        range: period.key,
        periodLabel:
          period.key === "today"
            ? "Today"
            : period.key === "week"
              ? "Last 7 days"
              : "Last 30 days",
        generatedAt: now.toISOString(),
        metrics: {
          todayRevenue: Number(todaySales._sum.totalAmount ?? 0),
          revenue: periodRevenue,
          orderCount: periodOrderCount,
          averageOrder:
            periodOrderCount > 0 ? periodRevenue / periodOrderCount : 0,
          averagePerDay: periodRevenue / period.days,
        },
        allTime: {
          revenue: Number(allTimeSales._sum.totalAmount ?? 0),
          orders: allTimeSales._count.id,
        },
        trend: buildRevenueTrend(
          periodOrders.map((order) => ({
            completedAt: order.completedAt!,
            totalAmount: Number(order.totalAmount),
          })),
          period,
        ),
        topItems: topItemsRaw.map((item) => ({
          name: item.productName,
          category: item.categoryName,
          quantity: item._sum.quantity ?? 0,
          revenue: Number(item._sum.lineTotal ?? 0),
        })),
        categorySales: categorySalesRaw.map((category) => ({
          label: category.categoryName,
          value: Number(category._sum.lineTotal ?? 0),
        })),
        paymentSales: paymentMethodsRaw.map((method) => ({
          label: method.paymentMethod,
          value: Number(method._sum.totalAmount ?? 0),
        })),
        peakHours: buildPeakHours(
          periodOrders.map((order) => ({ completedAt: order.completedAt! })),
        ),
        liveOrders: liveOrdersRaw.map((order) => ({
          id: order.id,
          createdAt: order.createdAt.toISOString(),
          status: order.status,
          orderType: order.orderType,
          totalAmount: Number(order.totalAmount),
          itemSummary: order.items
            .map((item) => `${item.quantity}× ${item.productName}`)
            .join(", "),
        })),
        inventory: inventoryAlertsRaw.map((product) => ({
          id: product.id,
          name: product.name,
          stock: product.stock,
          category: product.category.name,
        })),
        recentOrders: recentOrdersRaw.map((order) => ({
          id: order.id,
          createdAt: order.createdAt.toISOString(),
          status: order.status,
          orderType: order.orderType,
          paymentMethod: order.paymentMethod,
          totalAmount: Number(order.totalAmount),
          tableNumber: order.tableNumber,
          customerName: order.customerName,
          itemCount: order.items.reduce(
            (sum, item) => sum + item.quantity,
            0,
          ),
          itemSummary: order.items
            .map((item) => `${item.quantity}× ${item.productName}`)
            .join(", "),
        })),
        catalog: {
          products: activeProductCount,
          categories: activeCategoryCount,
          availableDeals: availableDealCount,
        },
      }}
      adminEmail={user.email}
    />
  );
}
