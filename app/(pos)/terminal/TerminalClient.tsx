"use client";

import { useState } from "react";
import { processCheckout } from "./actions";
import { logoutAction } from "@/app/(auth)/actions";
import Image from "next/image";

type Product = {
  id: string;
  name: string;
  basePrice: number;
  stock: number;
  imageUrl?: string | null;
};

type Category = {
  id: string;
  name: string;
  products: Product[];
};

type CartItem = {
  id: string;
  name: string;
  basePrice: number;
  quantity: number;
};

export default function TerminalClient({
  categories,
  cashier,
}: {
  categories: Category[];
  cashier: any;
}) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>(
    categories[0]?.id || "",
  );

  // --- CART LOGIC ---
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          basePrice: product.basePrice,
          quantity: 1,
        },
      ];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.id === id) {
            // Allow the quantity to drop temporarily...
            return { ...item, quantity: item.quantity + delta };
          }
          return item;
        })
        .filter((item) => item.quantity > 0); // ...so the filter can catch and remove it!
    });
  };

  // Instantly remove an item completely
  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const totalAmount = cart.reduce(
    (sum, item) => sum + item.basePrice * item.quantity,
    0,
  );

  // --- CHECKOUT LOGIC ---
  const handleCheckout = async (paymentMethod: string) => {
    if (cart.length === 0) return;
    setIsProcessing(true);

    const result = await processCheckout(
      cart,
      cashier.id,
      paymentMethod,
      totalAmount,
    );

    if (result.success) {
      setCart([]);
      const receiptWindow = window.open(
        `/receipt/${result.orderId}`,
        "_blank",
        "width=400,height=600",
      );
      if (receiptWindow) receiptWindow.focus();
    } else {
      alert(`Checkout failed: ${result.error}`);
    }

    setIsProcessing(false);
  };

  return (
    <div className="flex h-screen flex-col bg-gray-100">
      {/* Header */}
      <header className="flex items-center justify-between bg-white px-6 py-4 shadow-sm border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900">POS Terminal</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            Cashier: <span className="font-semibold">{cashier.email}</span>
          </span>
          <form action={logoutAction}>
            <button className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors">
              Log Out
            </button>
          </form>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PANEL */}
        <div className="flex flex-1 flex-col overflow-y-auto p-6">
          <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`whitespace-nowrap rounded-lg px-6 py-3 font-medium transition-colors ${
                  activeCategory === cat.id
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {categories
              .find((c) => c.id === activeCategory)
              ?.products.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="flex h-44 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white text-center shadow-sm transition-transform hover:scale-[1.02] active:scale-95"
                >
                  {product.imageUrl ? (
                    <div className="h-28 w-full bg-gray-100 border-b border-gray-100">
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        className="h-full w-full object-cover"
                        height={90}
                        width={90}
                      />
                    </div>
                  ) : (
                    <div className="h-28 w-full bg-linear-to-br from-blue-50 to-gray-100 border-b border-gray-100 flex items-center justify-center">
                      <span className="text-gray-400 text-xs font-medium">
                        No Image
                      </span>
                    </div>
                  )}

                  <div className="p-2 flex flex-col items-center justify-center flex-1 w-full bg-white">
                    <span className="font-semibold text-gray-800 text-sm truncate w-full px-1">
                      {product.name}
                    </span>
                    <div className="flex w-full justify-between px-2 mt-1 items-center">
                      <span className="text-sm font-bold text-blue-600">
                        Rs {product.basePrice.toFixed(2)}
                      </span>
                      <span className="text-xs font-medium text-gray-400">
                        Qty: {product.stock}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="flex w-96 flex-col border-l border-gray-200 bg-white shadow-xl">
          <div className="p-6 pb-4 border-b border-gray-100">
            <h2 className="text-xl font-bold text-gray-900">Current Order</h2>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-2">
            {cart.length === 0 ? (
              <div className="mt-10 text-center text-gray-400 italic">
                Cart is empty
              </div>
            ) : (
              <div className="space-y-4 mt-2">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between border-b border-gray-100 pb-4"
                  >
                    <div>
                      <div className="font-medium text-gray-900">
                        {item.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        Rs {item.basePrice.toFixed(2)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 font-bold text-gray-600 hover:bg-gray-200 transition-colors"
                      >
                        -
                      </button>
                      <span className="w-4 text-center font-semibold text-gray-900">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 font-bold text-gray-600 hover:bg-gray-200 transition-colors"
                      >
                        +
                      </button>

                      {/* Trash Button */}
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="ml-2 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                        title="Remove Item"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-gray-50 p-6 border-t border-gray-200">
            <div className="mb-6 flex justify-between items-end">
              <span className="text-gray-500 font-medium">Total:</span>
              <span className="text-3xl font-bold text-gray-900">
                Rs {totalAmount.toFixed(2)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                suppressHydrationWarning
                onClick={() => handleCheckout("cash")}
                disabled={cart.length === 0 || isProcessing}
                className="rounded-xl bg-green-600 py-4 font-bold text-white shadow-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isProcessing ? "Processing..." : "Cash"}
              </button>
              <button
                suppressHydrationWarning
                onClick={() => handleCheckout("card")}
                disabled={cart.length === 0 || isProcessing}
                className="rounded-xl bg-blue-600 py-4 font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isProcessing ? "Processing..." : "Card"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
