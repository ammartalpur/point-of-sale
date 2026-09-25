"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { logoutAction } from "@/app/(auth)/actions";
import { submitCheckout } from "./actions";

type Product = { id: string; name: string; basePrice: number; stock: number; imageUrl?: string | null };
type Category = { id: string; name: string; products: Product[] };
type Deal = { id: string; name: string; price: number; maxQuantity: number; imageUrl?: string | null; items: { productId: string; name: string; quantity: number }[] };
type Coupon = { code: string; discountType: "FIXED" | "PERCENTAGE"; value: number; minimumSubtotal: number; expiresAt: string | null };
type CartItem = { id: string; kind: "PRODUCT" | "DEAL"; name: string; basePrice: number; quantity: number; maxQuantity: number };
type OrderType = "DINE_IN" | "TAKEAWAY" | "DELIVERY";
type DiscountMode = "NONE" | "FIXED" | "PERCENTAGE" | "COUPON";

const inputStyle = "w-full rounded-lg border border-white/10 bg-[#07111f] px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-sky-400";
const money = (minor: number) => `Rs ${(minor / 100).toFixed(2)}`;

export default function TerminalClient({ categories, deals, coupons, generatedAt, cashier }: { categories: Category[]; deals: Deal[]; coupons: Coupon[]; generatedAt: string; cashier: { id: string; email: string } }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState(deals.length ? "__deals" : categories[0]?.id ?? "");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderType, setOrderType] = useState<OrderType>("TAKEAWAY");
  const [tableNumber, setTableNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [discountMode, setDiscountMode] = useState<DiscountMode>("NONE");
  const [discountValue, setDiscountValue] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("cash");
  const [cashReceived, setCashReceived] = useState("");
  const [error, setError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const selectedCategory = categories.find((category) => category.id === activeCategory);
  const subtotalMinor = cart.reduce((sum, item) => sum + Math.round(item.basePrice * 100) * item.quantity, 0);

  const preview = useMemo(() => {
    let discount = 0;
    let message = "";
    if (discountMode === "FIXED" || discountMode === "PERCENTAGE") {
      const value = Number(discountValue);
      if (discountValue && (!Number.isFinite(value) || value < 0)) message = "Enter a valid discount.";
      else if (discountMode === "FIXED") {
        discount = Math.round(value * 100);
        if (discount > subtotalMinor) message = "Fixed discount cannot exceed subtotal.";
      } else if (value > 100) message = "Percentage cannot exceed 100%.";
      else discount = Math.round(subtotalMinor * value / 100);
    }
    if (discountMode === "COUPON" && couponCode.trim()) {
      const coupon = coupons.find((item) => item.code === couponCode.trim().toUpperCase());
      if (!coupon) message = "Coupon code is not active or does not exist.";
      else if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() <= new Date(generatedAt).getTime()) message = "This coupon has expired.";
      else if (subtotalMinor < Math.round(coupon.minimumSubtotal * 100)) message = `Minimum subtotal is Rs ${coupon.minimumSubtotal.toFixed(2)}.`;
      else discount = coupon.discountType === "FIXED" ? Math.round(coupon.value * 100) : Math.round(subtotalMinor * coupon.value / 100);
      if (discount > subtotalMinor) message = "Coupon discount exceeds subtotal.";
    }
    const total = Math.max(subtotalMinor - discount, 0);
    const received = Math.max(Math.round((Number(cashReceived) || 0) * 100), 0);
    return { discount: Math.max(discount, 0), total, received, change: Math.max(received - total, 0), remaining: Math.max(total - received, 0), message };
  }, [cashReceived, couponCode, coupons, discountMode, discountValue, generatedAt, subtotalMinor]);

  function addToCart(item: Omit<CartItem, "quantity" | "basePrice"> & { price: number }) {
    setCart((current) => {
      const existing = current.find((row) => row.id === item.id && row.kind === item.kind);
      if (existing) return existing.quantity >= item.maxQuantity ? current : current.map((row) => row === existing ? { ...row, quantity: row.quantity + 1 } : row);
      return [...current, { id: item.id, kind: item.kind, name: item.name, basePrice: item.price, quantity: 1, maxQuantity: item.maxQuantity }];
    });
  }
  function updateQuantity(item: CartItem, delta: number) {
    setCart((current) => current.map((row) => row === item ? { ...row, quantity: Math.min(row.quantity + delta, row.maxQuantity) } : row).filter((row) => row.quantity > 0));
  }
  function resetCheckout() {
    setCheckoutOpen(false); setError(""); setCashReceived(""); setDiscountMode("NONE"); setDiscountValue(""); setCouponCode("");
  }
  async function completeCheckout() {
    if (preview.message) { setError(preview.message); return; }
    setError(""); setIsProcessing(true);
    const input = {
      items: cart.map(({ id, kind, quantity }) => ({ id, kind, quantity })), paymentMethod, orderType,
      tableNumber, customerName, customerPhone, deliveryAddress,
      discount: discountMode === "FIXED" || discountMode === "PERCENTAGE" ? { type: discountMode, value: discountValue } : undefined,
      couponCode: discountMode === "COUPON" ? couponCode : undefined,
      cashReceived: paymentMethod === "cash" ? cashReceived : undefined,
    };
    try {
      const result = await submitCheckout(input);
      if (!result.success) { setError(result.error); return; }
      setCart([]); resetCheckout();
      const receipt = window.open(`/receipt/${result.orderId}`, "_blank", "width=420,height=720");
      receipt?.focus();
    } catch { setError("Checkout could not be confirmed. Check recent orders before trying again."); }
    finally { setIsProcessing(false); }
  }

  return <div className="flex h-screen flex-col bg-[#07111f] text-slate-100">
    <header className="flex items-center justify-between border-b border-white/7 bg-[#091522] px-5 py-4"><div><h1 className="text-xl font-bold text-white">POS Terminal</h1><p className="text-xs text-slate-500">Cashier: {cashier.email}</p></div><div className="flex gap-2"><Link href="/admin/dashboard" className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300">Dashboard</Link><form action={logoutAction}><button className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-300">Log out</button></form></div></header>
    <div className="flex min-h-0 flex-1"><main className="min-w-0 flex-1 overflow-y-auto p-5"><div className="mb-5 flex gap-2 overflow-x-auto pb-2">{deals.length > 0 && <CategoryButton active={activeCategory === "__deals"} onClick={() => setActiveCategory("__deals")}>Combos & Deals</CategoryButton>}{categories.map((category) => <CategoryButton key={category.id} active={activeCategory === category.id} onClick={() => setActiveCategory(category.id)}>{category.name}</CategoryButton>)}</div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">{activeCategory === "__deals" ? deals.map((deal) => <MenuCard key={deal.id} name={deal.name} price={deal.price} stock={deal.maxQuantity} imageUrl={deal.imageUrl} deal onClick={() => addToCart({ id: deal.id, kind: "DEAL", name: deal.name, price: deal.price, maxQuantity: deal.maxQuantity })} />) : selectedCategory?.products.map((product) => <MenuCard key={product.id} name={product.name} price={product.basePrice} stock={product.stock} imageUrl={product.imageUrl} onClick={() => addToCart({ id: product.id, kind: "PRODUCT", name: product.name, price: product.basePrice, maxQuantity: product.stock })} />)}</div>
    </main><aside className="flex w-100 shrink-0 flex-col border-l border-white/7 bg-[#0d1b2a]"><div className="border-b border-white/7 p-5"><h2 className="text-lg font-bold">Current order</h2><p className="text-xs text-slate-500">{cart.reduce((sum, item) => sum + item.quantity, 0)} items</p></div><div className="flex-1 space-y-3 overflow-y-auto p-5">{cart.length === 0 ? <p className="py-12 text-center text-sm text-slate-600">Cart is empty</p> : cart.map((item) => <div key={`${item.kind}:${item.id}`} className="border-b border-white/7 pb-3"><div className="flex justify-between gap-2"><div><p className="font-medium text-slate-100">{item.name}</p><p className="text-xs text-slate-500">{money(Math.round(item.basePrice * 100))}{item.kind === "DEAL" ? " · Deal" : ""}</p></div><button onClick={() => setCart((current) => current.filter((row) => row !== item))} className="text-rose-400">×</button></div><div className="mt-2 flex items-center justify-end gap-2"><button onClick={() => updateQuantity(item, -1)} className="h-7 w-7 rounded-full bg-white/7">−</button><span>{item.quantity}</span><button disabled={item.quantity >= item.maxQuantity} onClick={() => updateQuantity(item, 1)} className="h-7 w-7 rounded-full bg-white/7 disabled:opacity-30">+</button></div></div>)}</div><div className="border-t border-white/7 bg-[#091522] p-5"><div className="mb-4 flex justify-between"><span className="text-slate-500">Subtotal</span><strong className="text-2xl">{money(subtotalMinor)}</strong></div><button disabled={!cart.length} onClick={() => setCheckoutOpen(true)} className="w-full rounded-xl bg-emerald-500 py-3 font-bold text-white disabled:opacity-40">Continue to checkout</button></div></aside></div>
    {checkoutOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4"><section role="dialog" aria-modal="true" className="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0d1b2a] p-6 shadow-2xl"><div className="flex justify-between"><div><h2 className="text-xl font-bold">Complete order</h2><p className="text-xs text-slate-500">Details, discount and payment</p></div><button onClick={resetCheckout} className="h-9 w-9 rounded-lg border border-white/10">×</button></div>
      <CheckoutSection title="Order type"><div className="grid grid-cols-3 gap-2">{(["DINE_IN", "TAKEAWAY", "DELIVERY"] as const).map((type) => <button key={type} onClick={() => setOrderType(type)} className={`rounded-lg border px-3 py-2 text-sm ${orderType === type ? "border-sky-400 bg-sky-400/15 text-sky-300" : "border-white/10 text-slate-400"}`}>{type.replace("_", "-")}</button>)}</div>{orderType === "DINE_IN" && <label className="mt-3 block text-xs text-slate-400">Table number<input value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} className={inputStyle} /></label>}{orderType === "DELIVERY" && <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs text-slate-400">Customer name<input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={inputStyle} /></label><label className="text-xs text-slate-400">Phone<input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className={inputStyle} /></label><label className="text-xs text-slate-400 sm:col-span-2">Delivery address<textarea value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} className={inputStyle} rows={2} /></label></div>}</CheckoutSection>
      <CheckoutSection title="Discount"><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{(["NONE", "FIXED", "PERCENTAGE", "COUPON"] as const).map((mode) => <button key={mode} onClick={() => { setDiscountMode(mode); setError(""); }} className={`rounded-lg border px-2 py-2 text-xs ${discountMode === mode ? "border-violet-400 bg-violet-400/15 text-violet-300" : "border-white/10 text-slate-400"}`}>{mode}</button>)}</div>{(discountMode === "FIXED" || discountMode === "PERCENTAGE") && <input type="number" min="0" step="0.01" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder={discountMode === "FIXED" ? "Amount in Rs" : "Percentage"} className={`mt-3 ${inputStyle}`} />}{discountMode === "COUPON" && <input value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder="Coupon code" className={`mt-3 font-mono uppercase ${inputStyle}`} />}{preview.message && <p className="mt-2 text-xs text-amber-300">{preview.message}</p>}</CheckoutSection>
      <CheckoutSection title="Payment"><div className="grid grid-cols-2 gap-2">{(["cash", "card"] as const).map((method) => <button key={method} onClick={() => setPaymentMethod(method)} className={`rounded-lg border px-3 py-2 text-sm capitalize ${paymentMethod === method ? "border-emerald-400 bg-emerald-400/15 text-emerald-300" : "border-white/10 text-slate-400"}`}>{method}</button>)}</div>{paymentMethod === "cash" && <div className="mt-3"><label className="text-xs text-slate-400">Cash received<input type="number" min="0" step="0.01" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} className={inputStyle} /></label><div className="mt-2 flex gap-2">{[preview.total, Math.ceil(preview.total / 50_000) * 50_000, Math.ceil(preview.total / 100_000) * 100_000].filter((value, index, all) => value > 0 && all.indexOf(value) === index).map((value) => <button key={value} onClick={() => setCashReceived((value / 100).toFixed(2))} className="rounded-lg bg-white/5 px-3 py-1.5 text-xs">{money(value)}</button>)}</div></div>}</CheckoutSection>
      <div className="rounded-xl bg-[#07111f] p-4 text-sm"><Row label="Subtotal" value={money(subtotalMinor)} /><Row label="Discount" value={`− ${money(preview.discount)}`} /><Row label="Final payable" value={money(preview.total)} strong />{paymentMethod === "cash" && <><Row label="Cash received" value={money(preview.received)} /><Row label={preview.remaining ? "Remaining due" : "Change"} value={money(preview.remaining || preview.change)} warning={preview.remaining > 0} /></>}</div>{error && <p role="alert" className="mt-3 rounded-lg bg-rose-400/10 p-3 text-sm text-rose-300">{error}</p>}<button disabled={isProcessing || Boolean(preview.message)} onClick={() => void completeCheckout()} className="mt-4 w-full rounded-xl bg-emerald-500 py-3 font-bold text-white disabled:opacity-40">{isProcessing ? "Processing…" : `Pay ${money(preview.total)}`}</button>
    </section></div>}
  </div>;
}

function CategoryButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button onClick={onClick} className={`whitespace-nowrap rounded-lg px-5 py-2.5 text-sm font-medium ${active ? "bg-sky-500 text-white" : "border border-white/8 bg-[#0d1b2a] text-slate-400"}`}>{children}</button>; }
function MenuCard({ name, price, stock, imageUrl, deal, onClick }: { name: string; price: number; stock: number; imageUrl?: string | null; deal?: boolean; onClick: () => void }) { return <button onClick={onClick} className={`flex h-46 flex-col overflow-hidden rounded-xl border bg-[#0d1b2a] text-left transition hover:-translate-y-0.5 ${deal ? "border-violet-400/25" : "border-white/8 hover:border-sky-400/35"}`}>{imageUrl ? <Image src={imageUrl} alt={name} width={240} height={112} className="h-28 w-full object-cover" /> : <div className={`grid h-28 place-items-center ${deal ? "bg-violet-400/10 text-violet-300" : "bg-sky-400/5 text-slate-600"}`}>{deal ? "COMBO" : "No image"}</div>}<div className="w-full p-3"><p className="truncate text-sm font-semibold text-white">{name}</p><div className="mt-1 flex justify-between text-xs"><span className={deal ? "text-violet-300" : "text-sky-400"}>Rs {price.toFixed(2)}</span><span className="text-slate-500">Qty {stock}</span></div></div></button>; }
function CheckoutSection({ title, children }: { title: string; children: React.ReactNode }) { return <div className="mt-5 border-t border-white/7 pt-4"><h3 className="mb-3 text-sm font-bold text-white">{title}</h3>{children}</div>; }
function Row({ label, value, strong, warning }: { label: string; value: string; strong?: boolean; warning?: boolean }) { return <div className={`flex justify-between py-1 ${strong ? "mt-1 border-t border-white/7 pt-2 text-base font-bold text-white" : warning ? "text-rose-300" : "text-slate-400"}`}><span>{label}</span><span>{value}</span></div>; }
