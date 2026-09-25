"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateOrderStatus } from "./action";
import OtaqBrand from "@/app/components/OtaqBrand";

import type { KitchenOrder } from "@/app/lib/client-data";

export default function KitchenClient({
  initialOrders,
}: {
  initialOrders: KitchenOrder[];
}) {
  const router = useRouter();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const clockInterval = setInterval(() => setNow(new Date()), 1000);
    const syncInterval = setInterval(() => router.refresh(), 5000);

    return () => {
      clearInterval(clockInterval);
      clearInterval(syncInterval);
    };
  }, [router]);

  const getWaitData = (createdAt: string) => {
    if (!now) return { text: "--:--", color: "bg-green-500" };
    const elapsed = Math.max(0, Math.floor(
      (now.getTime() - new Date(createdAt).getTime()) / 1000,
    ));
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;

    let color = "bg-green-500";
    if (mins >= 10) color = "bg-red-500";
    else if (mins >= 5) color = "bg-yellow-500";

    return {
      text: `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`,
      color,
    };
  };

  const handleStatusChange = async (
    orderId: string,
    newStatus: "PREPARING" | "READY" | "COMPLETED",
  ) => {
    await updateOrderStatus(orderId, newStatus);
  };

  return (
    <div className="min-h-screen bg-[#17110d] p-6 font-sans text-slate-100">
      <header className="mb-8 flex items-center justify-between border-b border-white/7 pb-4">
        <div className="flex items-center gap-5">
          <OtaqBrand />
          <div className="border-l border-white/10 pl-5">
            <h1 className="text-2xl font-bold text-white">Kitchen display</h1>
            <p className="text-slate-500">Live order queue</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 lg:items-start">
        {initialOrders.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-white/7 bg-[#211912] py-20 text-center text-xl text-slate-500 font-medium">
            No active orders. Kitchen is clear! 🎉
          </div>
        ) : (
          initialOrders.map((order) => {
            const waitData = getWaitData(order.createdAt);
            const cookingItems = order.items.filter(
              (item) => item.requiresPreparation,
            );

            if (cookingItems.length === 0) return null;

            return (
              <div
                key={order.id}
                className="flex max-h-150 flex-col overflow-hidden rounded-xl border border-white/8 bg-[#211912] shadow-xl shadow-black/20"
              >
                {/* Ticket Header */}
                <div
                  className={`${order.status === "READY" ? "bg-slate-600" : waitData.color} px-4 py-3 text-white flex justify-between items-center transition-colors duration-500`}
                >
                  <span className="text-lg font-bold">
                    #{order.id.split("-")[0].toUpperCase()}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xl font-bold tracking-wider">
                      {waitData.text}
                    </span>
                    <button
                      onClick={() =>
                        window.open(
                          `/kitchen-receipt/${order.id}`,
                          "_blank",
                          "width=400,height=600",
                        )
                      }
                      className="rounded bg-white/20 p-1.5 hover:bg-white/40 transition-colors"
                      title="Print Prep Ticket"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="flex items-center justify-between border-b border-white/7 bg-white/3 px-4 py-2">
                  <div><span className="text-xs font-bold uppercase tracking-wider text-slate-500">{order.orderType?.replace("_", "-") ?? "TYPE UNKNOWN"}</span>{order.tableNumber && <p className="text-xs font-bold text-orange-300">{order.tableNumber}</p>}{order.customerName && <p className="text-xs text-slate-400">{order.customerName}</p>}</div>
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-wider ${
                      order.status === "PENDING"
                        ? "bg-slate-400/15 text-slate-300"
                        : order.status === "PREPARING"
                          ? "bg-orange-400/15 text-orange-300 animate-pulse"
                          : "bg-emerald-400/15 text-emerald-300"
                    }`}
                  >
                    {order.status}
                  </span>
                </div>

                {/* Ticket Items */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {cookingItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between border-b border-white/7 pb-3 last:border-0 last:pb-0"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-orange-500/15 text-lg font-bold text-orange-300">
                          {item.quantity}
                        </span>
                        <span className="text-lg font-medium leading-tight text-slate-100">
                          {item.productName}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Updated Three-Stage Action Buttons */}
                <div className="mt-auto border-t border-white/7 bg-[#1b140f] p-4">
                  {order.status === "PENDING" ? (
                    <button
                      onClick={() => handleStatusChange(order.id, "PREPARING")}
                      className="w-full rounded-lg bg-orange-500 py-4 text-lg font-bold text-white hover:bg-orange-400 shadow-md transition-all active:scale-95"
                    >
                      Start Cooking
                    </button>
                  ) : order.status === "PREPARING" ? (
                    <button
                      onClick={() => handleStatusChange(order.id, "READY")}
                      className="w-full rounded-lg bg-amber-500 py-4 text-lg font-bold text-white hover:bg-amber-400 shadow-md transition-all active:scale-95"
                    >
                      Mark Ready
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStatusChange(order.id, "COMPLETED")}
                      className="w-full rounded-lg bg-emerald-500 py-4 text-lg font-bold text-white hover:bg-emerald-400 shadow-md transition-all active:scale-95"
                    >
                      Complete & Deliver
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
