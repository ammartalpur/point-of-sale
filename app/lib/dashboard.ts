export type DashboardRange = "today" | "week" | "month";

export type DashboardData = {
  range: DashboardRange;
  periodLabel: string;
  generatedAt: string;
  metrics: {
    todayRevenue: number;
    revenue: number;
    orderCount: number;
    averageOrder: number;
    averagePerDay: number;
  };
  allTime: { revenue: number; orders: number };
  trend: { label: string; value: number }[];
  peakHours: { label: string; value: number }[];
  topItems: { name: string; category: string; quantity: number; revenue: number }[];
  categorySales: { label: string; value: number }[];
  paymentSales: { label: string; value: number }[];
  liveOrders: {
    id: string;
    createdAt: string;
    status: string;
    orderType: string | null;
    totalAmount: number;
    itemSummary: string;
  }[];
  inventory: { id: string; name: string; stock: number; category: string }[];
  recentOrders: {
    id: string;
    createdAt: string;
    status: string;
    orderType: string | null;
    tableNumber: string | null;
    customerName: string | null;
    paymentMethod: string;
    totalAmount: number;
    itemCount: number;
    itemSummary: string;
  }[];
  catalog: { products: number; categories: number; availableDeals: number };
};

const KARACHI_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function karachiParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour") };
}

export function getDashboardPeriod(range: string | undefined, now = new Date()) {
  const key: DashboardRange = range === "today" || range === "month" ? range : "week";
  const days = key === "today" ? 1 : key === "week" ? 7 : 30;
  const parts = karachiParts(now);
  const todayStart = new Date(Date.UTC(parts.year, parts.month - 1, parts.day) - KARACHI_OFFSET_MS);
  return { key, days, start: new Date(todayStart.getTime() - (days - 1) * DAY_MS), end: now };
}

export function karachiDateKey(date: Date) {
  const parts = karachiParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function buildRevenueTrend(orders: { completedAt: Date | null; totalAmount: number }[], period: ReturnType<typeof getDashboardPeriod>) {
  if (period.key === "today") {
    const bins = Array.from({ length: 12 }, (_, index) => ({ label: `${String(index * 2).padStart(2, "0")}:00`, value: 0 }));
    for (const order of orders) if (order.completedAt) bins[Math.floor(karachiParts(order.completedAt).hour / 2)].value += order.totalAmount;
    return bins;
  }
  const values = new Map<string, number>();
  for (const order of orders) if (order.completedAt) {
    const key = karachiDateKey(order.completedAt);
    values.set(key, (values.get(key) ?? 0) + order.totalAmount);
  }
  return Array.from({ length: period.days }, (_, index) => {
    const date = new Date(period.start.getTime() + index * DAY_MS);
    const key = karachiDateKey(date);
    return { label: new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Karachi", month: "short", day: "numeric" }).format(date), value: values.get(key) ?? 0 };
  });
}

export function buildPeakHours(orders: { completedAt: Date | null }[]) {
  const bins = Array.from({ length: 12 }, (_, index) => ({ label: `${index * 2}:00`, value: 0 }));
  for (const order of orders) if (order.completedAt) bins[Math.floor(karachiParts(order.completedAt).hour / 2)].value++;
  return bins;
}
