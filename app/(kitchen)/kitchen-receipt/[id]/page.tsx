import { prisma } from "@/app/lib/prisma";
import { notFound } from "next/navigation";
import PrintHelper from "@/app/receipt/[id]/PrintHelper";

export default async function KitchenReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Fetch the order, now including the Cashier details
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      cashier: { select: { email: true } }, // <-- Added cashier fetch
      items: {
        include: {
          product: {
            include: { category: true },
          },
        },
      },
    },
  });

  if (!order) return notFound();

  // Filter items so the chef ONLY sees food that needs cooking
  const cookingItems = order.items.filter(
    (item) => item.product.category.requiresPreparation,
  );

  return (
    <div className="bg-gray-100 min-h-screen flex justify-center py-8 print:py-0 print:bg-white">
      <PrintHelper />

      {/* 80mm Thermal Printer Width */}
      <div className="w-full max-w-[80mm] bg-white p-4 shadow-xl print:shadow-none print:p-0 text-black font-mono text-sm">
        {/* Header */}
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold uppercase tracking-wider border-b-2 border-black pb-2 mb-2">
            KITCHEN TICKET
          </h1>
          <p className="text-xl font-bold">
            Order #{order.id.split("-")[0].toUpperCase()}
          </p>
        </div>

        {/* NEW: Meta Data Section (Date, Time, Cashier) */}
        <div className="border-b-2 border-black pb-3 mb-3 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="font-bold">Date:</span>
            <span>{new Date(order.createdAt).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-bold">Time:</span>
            <span>
              {new Date(order.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="font-bold">Cashier:</span>
            <span className="uppercase">
              {order.cashier.email.split("@")[0]}
            </span>
          </div>
        </div>

        {/* Itemized List - NO PRICES */}
        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="border-b border-dashed border-gray-400">
              <th className="text-center pb-2 font-bold w-12">QTY</th>
              <th className="text-left pb-2 font-bold pl-2">ITEM</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {cookingItems.map((item) => (
              <tr key={item.id}>
                <td className="py-4 text-center text-xl font-bold align-top">
                  {item.quantity}
                </td>
                <td className="py-4 pl-2 text-lg font-bold uppercase leading-tight">
                  {item.product.name}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* End of Ticket Marker */}
        <div className="text-center mt-8">
          <p className="font-bold border-t-2 border-dashed border-black pt-2">
            --- END OF TICKET ---
          </p>
        </div>
      </div>
    </div>
  );
}
