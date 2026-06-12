import { prisma } from "@/app/lib/prisma";
import { logoutAction } from "@/app/(auth)/actions";
import Link from "next/link";
import RecentOrdersTable from "./RecentOrdersTable"; // <-- NEW IMPORT

export default async function AdminDashboard() {
  // 1. Fetch KPI Metrics
const [revenueData, orderCount] = await Promise.all([
  prisma.order.aggregate({
    _sum: { totalAmount: true },
    where: { status: "COMPLETED" }, // <-- UPDATED to match Enum
  }),
  prisma.order.count({
    where: { status: "COMPLETED" }, // <-- UPDATED to match Enum
  }),
]);

  const totalRevenue = Number(revenueData._sum.totalAmount || 0);

  // 2. Fetch Top Selling Products
  const topItemsAgg = await prisma.orderItem.groupBy({
    by: ["productId"],
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: 5,
  });

  const topItemIds = topItemsAgg.map((item) => item.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: topItemIds } },
    select: { id: true, name: true },
  });

  const topProducts = topItemsAgg.map((agg) => ({
    name: products.find((p) => p.id === agg.productId)?.name || "Unknown Item",
    sold: agg._sum.quantity || 0,
  }));

  // 3. Fetch Recent Transactions WITH Nested Items
  const rawRecentOrders = await prisma.order.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    include: {
      cashier: { select: { email: true } },
      items: {
        // <-- WE NEED TO FETCH THE ITEMS NOW
        include: { product: { select: { name: true } } },
      },
    },
  });

  // 4. Flatten Decimals for the Client Component
  const safeRecentOrders = rawRecentOrders.map((order) => ({
    ...order,
    totalAmount: Number(order.totalAmount),
    items: order.items.map((item) => ({
      ...item,
      priceAtTime: Number(item.priceAtTime),
    })),
  }));

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header & Navigation */}
        <div className="mb-8 flex items-center justify-between rounded-xl bg-white p-6 shadow-sm border border-gray-200">
          {/* ... (Keep your existing Header JSX) ... */}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Admin Dashboard
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Live sales analytics and system overview.
            </p>
          </div>
          <div className="flex gap-4">
            <Link
              href="/admin/menu"
              className="rounded-lg bg-blue-50 px-4 py-2 font-medium text-blue-700 hover:bg-blue-100 transition-colors"
            >
              Manage Menu
            </Link>
            <form action={logoutAction}>
              <button className="rounded-lg bg-red-50 px-4 py-2 font-medium text-red-600 hover:bg-red-100 transition-colors">
                Log Out
              </button>
            </form>
          </div>
        </div>

        {/* KPI Cards */}
        {/* ... (Keep your existing KPI Cards JSX) ... */}
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">Total Revenue</h3>
            <p className="mt-2 text-4xl font-bold text-gray-900">
              Rs {totalRevenue.toFixed(2)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">
              Total Orders Processed
            </h3>
            <p className="mt-2 text-4xl font-bold text-gray-900">
              {orderCount}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">
              Average Order Value
            </h3>
            <p className="mt-2 text-4xl font-bold text-gray-900">
              Rs {(orderCount > 0 ? totalRevenue / orderCount : 0).toFixed(2)}
            </p>
          </div>
        </div>

        {/* Charts & Tables Section */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Left Column: Top Items */}
          {/* ... (Keep your existing Top Items JSX) ... */}
          <div className="col-span-1 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-6 text-xl font-bold text-gray-900">
              Top Selling Items
            </h2>
            <div className="space-y-6">
              {topProducts.length === 0 ? (
                <p className="text-sm text-gray-500 italic">
                  No sales data yet.
                </p>
              ) : (
                topProducts.map((item, index) => {
                  const maxSold = topProducts[0].sold;
                  const widthPercent = Math.max(
                    (item.sold / maxSold) * 100,
                    10,
                  );
                  return (
                    <div key={index}>
                      <div className="mb-1 flex justify-between text-sm font-medium text-gray-700">
                        <span>{item.name}</span>
                        <span>{item.sold} sold</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-gray-100">
                        <div
                          className="h-2 rounded-full bg-blue-600"
                          style={{ width: `${widthPercent}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Recent Transactions Table */}
          <div className="col-span-1 lg:col-span-2 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-6 text-xl font-bold text-gray-900">
              Recent Transactions
            </h2>

            {/* NEW: Use the Client Component instead of the raw HTML table */}
            <RecentOrdersTable orders={safeRecentOrders} />
          </div>
        </div>
      </div>
    </div>
  );
}
