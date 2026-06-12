"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateOrderStatus } from "./action";

type Order = any;

export default function KitchenClient({
  initialOrders,
}: {
  initialOrders: Order[];
}) {
  const router = useRouter();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const clockInterval = setInterval(() => setNow(new Date()), 1000);
    const syncInterval = setInterval(() => router.refresh(), 5000);

    return () => {
      clearInterval(clockInterval);
      clearInterval(syncInterval);
    };
  }, [router]);

  const getWaitData = (createdAt: Date) => {
    const elapsed = Math.floor(
      (now.getTime() - new Date(createdAt).getTime()) / 1000,
    );
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
    <div className="min-h-screen bg-gray-900 p-6 font-sans">
      <header className="mb-8 flex items-center justify-between border-b border-gray-700 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Kitchen Display System
          </h1>
          <p className="text-gray-400">Live order queue</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 lg:items-start">
        {initialOrders.length === 0 ? (
          <div className="col-span-full py-20 text-center text-xl text-gray-500 font-medium">
            No active orders. Kitchen is clear! 🎉
          </div>
        ) : (
          initialOrders.map((order) => {
            const waitData = getWaitData(order.createdAt);
            const cookingItems = order.items.filter(
              (item: any) => item.product.category.requiresPreparation,
            );

            if (cookingItems.length === 0) return null;

            return (
              <div
                key={order.id}
                className="overflow-hidden rounded-xl bg-white shadow-xl flex flex-col max-h-150"
              >
                {/* Ticket Header */}
                <div
                  className={`${order.status === "READY" ? "bg-gray-600" : waitData.color} px-4 py-3 text-white flex justify-between items-center transition-colors duration-500`}
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
                <div className="bg-gray-100 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Status:
                  </span>
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-wider ${
                      order.status === "PENDING"
                        ? "bg-gray-200 text-gray-700"
                        : order.status === "PREPARING"
                          ? "bg-blue-100 text-blue-700 animate-pulse"
                          : "bg-green-100 text-green-700"
                    }`}
                  >
                    {order.status}
                  </span>
                </div>

                {/* Ticket Items */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {cookingItems.map((item: any) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between border-b border-gray-100 pb-3 last:border-0 last:pb-0"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded bg-gray-900 text-lg font-bold text-white shrink-0">
                          {item.quantity}
                        </span>
                        <span className="text-lg font-medium text-gray-900 leading-tight">
                          {item.product.name}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Updated Three-Stage Action Buttons */}
                <div className="p-4 bg-gray-50 border-t border-gray-200 mt-auto">
                  {order.status === "PENDING" ? (
                    <button
                      onClick={() => handleStatusChange(order.id, "PREPARING")}
                      className="w-full rounded-lg bg-blue-600 py-4 text-lg font-bold text-white hover:bg-blue-700 shadow-md transition-all active:scale-95"
                    >
                      Start Cooking
                    </button>
                  ) : order.status === "PREPARING" ? (
                    <button
                      onClick={() => handleStatusChange(order.id, "READY")}
                      className="w-full rounded-lg bg-yellow-500 py-4 text-lg font-bold text-white hover:bg-yellow-600 shadow-md transition-all active:scale-95"
                    >
                      Mark Ready
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStatusChange(order.id, "COMPLETED")}
                      className="w-full rounded-lg bg-green-600 py-4 text-lg font-bold text-white hover:bg-green-700 shadow-md transition-all active:scale-95"
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
