import { prisma } from "@/app/lib/prisma";
import { notFound } from "next/navigation";
import PrintHelper from "./PrintHelper";

// 1. In Next.js 15+, dynamic params are Promises that must be awaited.
export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // 2. Await the params to safely extract the ID
  const { id } = await params;

  // 3. Fetch the complete order details
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      cashier: { select: { email: true } },
      items: {
        include: { product: { select: { name: true } } },
      },
    },
  });

  // If someone types a random ID in the URL, show a 404
  if (!order) return notFound();

  // 4. Render the 80mm thermal receipt layout
  return (
    <div className="bg-gray-100 min-h-screen flex justify-center py-8 print:py-0 print:bg-white">
      {/* This automatically opens the print/PDF dialog */}
      <PrintHelper />

      {/* max-w-[80mm] forces the exact width of a standard thermal POS printer. */}
      <div className="w-full max-w-[80mm] bg-white p-4 shadow-xl print:shadow-none print:p-0 text-black font-mono text-sm">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold uppercase tracking-wider">
            My POS Store
          </h1>
          <p className="text-xs mt-1">123 Tech Street, Hyderabad</p>
          <p className="text-xs">Phone: +92 300 1234567</p>
        </div>

        {/* Order Meta Data */}
        <div className="border-b border-dashed border-gray-400 pb-3 mb-3 text-xs space-y-1">
          <div className="flex justify-between">
            <span>Order ID:</span>
            <span>{order.id.split("-")[0].toUpperCase()}</span>
          </div>
          <div className="flex justify-between">
            <span>Date:</span>
            <span>
              {new Date(order.createdAt).toLocaleDateString()}{" "}
              {new Date(order.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Cashier:</span>
            <span>{order.cashier.email.split("@")[0]}</span>
          </div>
        </div>

        {/* Itemized List */}
        <table className="w-full text-xs mb-3">
          <thead>
            <tr className="border-b border-dashed border-gray-400">
              <th className="text-left pb-1 font-semibold">Qty x Item</th>
              <th className="text-right pb-1 font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {order.items.map((item) => (
              <tr key={item.id}>
                <td className="py-2 pr-2">
                  <div className="font-medium">
                    {item.quantity} x {item.product.name}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    @ Rs {Number(item.priceAtTime).toFixed(2)}
                  </div>
                </td>
                <td className="py-2 text-right align-top">
                  Rs {(Number(item.priceAtTime) * item.quantity).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="border-t border-dashed border-gray-400 pt-3 mb-6">
          <div className="flex justify-between text-base font-bold">
            <span>TOTAL</span>
            <span>Rs {Number(order.totalAmount).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs mt-1 text-gray-600">
            <span>Payment Method</span>
            <span className="uppercase font-medium">{order.paymentMethod}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs space-y-1">
          <p className="font-bold">Thank you for your business!</p>
          <p>Please visit us again.</p>
          {/* Barcode Placeholder - Looks great on thermal paper */}
          <div className="mt-4 text-center font-mono text-2xl tracking-[0.2em] opacity-80">
            ||| ||| || ||| | ||
          </div>
        </div>
      </div>
    </div>
  );
}
