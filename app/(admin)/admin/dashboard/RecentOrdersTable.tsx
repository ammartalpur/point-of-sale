"use client";

import { useState } from "react";

// Define the types based on our safe, flattened data payload
type OrderItem = {
  id: string;
  quantity: number;
  priceAtTime: number;
  product: { name: string };
};

type Order = {
  id: string;
  createdAt: Date;
  paymentMethod: string;
  totalAmount: number;
  cashier: { email: string };
  items: OrderItem[];
};

export default function RecentOrdersTable({ orders }: { orders: Order[] }) {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  return (
    <>
      {/* --- THE MAIN TABLE --- */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Order ID
              </th>
              <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Time
              </th>
              <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Cashier
              </th>
              <th className="pb-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                Amount
              </th>
              <th className="pb-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-8 text-center text-sm text-gray-500 italic"
                >
                  No transactions found.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr
                  key={order.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="py-4 text-sm font-medium text-gray-900">
                    {order.id.split("-")[0].toUpperCase()}
                  </td>
                  <td
                    suppressHydrationWarning
                    className="py-4 text-sm text-gray-500"
                  >
                    {new Date(order.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="py-4 text-sm text-gray-500">
                    {order.cashier.email.split("@")[0]}
                  </td>
                  <td className="py-4 text-right text-sm font-bold text-gray-900">
                    Rs {order.totalAmount.toFixed(2)}
                  </td>
                  <td className="py-4 text-right">
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="rounded bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* --- THE MODAL POPUP --- */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Order Details
                </h3>
                <p className="text-xs text-gray-500">ID: {selectedOrder.id}</p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Modal Body: Itemized List */}
            <div className="max-h-60 overflow-y-auto pr-2">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="pb-2 font-medium">Item</th>
                    <th className="pb-2 font-medium text-center">Qty</th>
                    <th className="pb-2 font-medium text-right">Price</th>
                    <th className="pb-2 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selectedOrder.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-3 text-gray-900">
                        {item.product.name}
                      </td>
                      <td className="py-3 text-center text-gray-600">
                        x{item.quantity}
                      </td>
                      <td className="py-3 text-right text-gray-600">
                        Rs {item.priceAtTime.toFixed(2)}
                      </td>
                      <td className="py-3 text-right font-medium text-gray-900">
                        Rs {(item.priceAtTime * item.quantity).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="mt-6 rounded-xl bg-gray-50 p-4">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Payment Method</span>
                <span className="font-medium capitalize">
                  {selectedOrder.paymentMethod}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="text-lg font-bold text-gray-900">
                  <span>Grand Total: </span>
                  <span>Rs {selectedOrder.totalAmount.toFixed(2)}</span>
                </div>

                {/* Print Receipt Button */}
                <button
                  onClick={() => {
                    window.open(
                      `/receipt/${selectedOrder.id}`,
                      "_blank",
                      "width=400,height=600",
                    );
                  }}
                  className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-gray-800 transition-colors"
                >
                  Print Receipt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
