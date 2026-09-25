// Money is calculated in integer paisa (100 paisa = Rs 1).
export const MAX_MONEY = 9_999_999_999; // PostgreSQL Decimal(10, 2).

export class CheckoutError extends Error {}

export function moneyToMinor(value: unknown, label = "Amount"): number {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new CheckoutError(`${label} must be a valid amount.`);
  }
  const text = String(value).trim();
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(text)) {
    throw new CheckoutError(`${label} must be non-negative with at most two decimal places.`);
  }
  const [whole, fraction = ""] = text.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount) || amount > MAX_MONEY) {
    throw new CheckoutError(`${label} is too large.`);
  }
  return amount;
}

export function minorToMoney(amount: number): string {
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > MAX_MONEY) {
    throw new CheckoutError("Order amount is outside the supported range.");
  }
  return `${Math.floor(amount / 100)}.${String(amount % 100).padStart(2, "0")}`;
}

export type Discount = { type: "FIXED" | "PERCENTAGE"; value: string | number };

export function calculateTotals(subtotal: number, discount?: Discount) {
  minorToMoney(subtotal);
  let discountAmount = 0;
  if (discount) {
    const value = moneyToMinor(discount.value, "Discount");
    if (discount.type === "FIXED") {
      if (value > subtotal) throw new CheckoutError("Discount cannot exceed the subtotal.");
      discountAmount = value;
    } else if (discount.type === "PERCENTAGE") {
      if (value > 10_000) throw new CheckoutError("Percentage discount cannot exceed 100%.");
      // BigInt multiplication avoids precision loss for large order totals.
      discountAmount = Number((BigInt(subtotal) * BigInt(value) + 5_000n) / 10_000n);
    } else {
      throw new CheckoutError("Invalid discount type.");
    }
  }
  return { subtotal, discountAmount, total: subtotal - discountAmount };
}

// Largest-remainder allocation keeps item revenue and discounts equal to order totals.
export function allocateAmount(amount: number, weights: number[]): number[] {
  minorToMoney(amount);
  if (weights.length === 0 || weights.some((w) => !Number.isSafeInteger(w) || w < 0)) {
    throw new CheckoutError("Invalid allocation weights.");
  }
  const effective = weights.some((w) => w > 0) ? weights : weights.map(() => 1);
  const totalWeight = effective.reduce((sum, w) => sum + BigInt(w), 0n);
  const parts = effective.map((w, index) => {
    const numerator = BigInt(amount) * BigInt(w);
    return { index, value: Number(numerator / totalWeight), remainder: numerator % totalWeight };
  });
  const left = amount - parts.reduce((sum, p) => sum + p.value, 0);
  const sorted = [...parts].sort((a, b) => a.remainder === b.remainder
    ? a.index - b.index : a.remainder > b.remainder ? -1 : 1);
  for (let i = 0; i < left; i++) sorted[i].value++;
  return parts.map((p) => p.value);
}

export function calculateCash(total: number, received: unknown) {
  minorToMoney(total);
  const cashReceived = moneyToMinor(received, "Cash received");
  return {
    cashReceived,
    changeGiven: Math.max(cashReceived - total, 0),
    remaining: Math.max(total - cashReceived, 0),
  };
}

export function normalizeCouponCode(code: unknown): string {
  if (typeof code !== "string" || !/^[A-Z0-9_-]{1,40}$/i.test(code.trim())) {
    throw new CheckoutError("Enter a valid coupon code (letters, numbers, hyphens or underscores).");
  }
  return code.trim().toUpperCase();
}

export function validateCoupon(coupon: {
  isActive: boolean; expiresAt: Date | null; minimumSubtotal: string;
}, subtotal: number, now = new Date()) {
  if (!coupon.isActive) throw new CheckoutError("This coupon is inactive.");
  if (coupon.expiresAt && coupon.expiresAt.getTime() <= now.getTime()) {
    throw new CheckoutError("This coupon has expired.");
  }
  if (subtotal < moneyToMinor(coupon.minimumSubtotal)) {
    throw new CheckoutError(`This coupon requires a subtotal of Rs ${coupon.minimumSubtotal}.`);
  }
}

export type CheckoutInput = {
  items: { kind: "PRODUCT" | "DEAL"; id: string; quantity: number }[];
  paymentMethod: "cash" | "card";
  orderType: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  tableNumber?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  discount?: Discount;
  couponCode?: string;
  cashReceived?: string | number;
};

function optionalText(value: unknown, label: string, max: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || value.trim().length > max) {
    throw new CheckoutError(`${label} is invalid or too long.`);
  }
  return value.trim() || undefined;
}

export function validateCheckoutInput(input: unknown): CheckoutInput {
  if (!input || typeof input !== "object") throw new CheckoutError("Invalid order.");
  const data = input as Record<string, unknown>;
  if (!Array.isArray(data.items) || data.items.length === 0 || data.items.length > 100) {
    throw new CheckoutError("An order must contain between 1 and 100 lines.");
  }
  const items: CheckoutInput["items"] = data.items.map((raw: unknown) => {
    if (!raw || typeof raw !== "object") throw new CheckoutError("Invalid order item.");
    const item = raw as Record<string, unknown>;
    if ((item.kind !== "PRODUCT" && item.kind !== "DEAL") ||
        typeof item.id !== "string" || !item.id.trim() || item.id.length > 100 ||
        typeof item.quantity !== "number" || !Number.isInteger(item.quantity) ||
        item.quantity < 1 || item.quantity > 10_000) {
      throw new CheckoutError("Each item needs a valid ID and a whole quantity between 1 and 10,000.");
    }
    return { kind: item.kind, id: item.id, quantity: item.quantity };
  });
  if (data.paymentMethod !== "cash" && data.paymentMethod !== "card") {
    throw new CheckoutError("Choose cash or card payment.");
  }
  if (data.orderType !== "DINE_IN" && data.orderType !== "TAKEAWAY" && data.orderType !== "DELIVERY") {
    throw new CheckoutError("Choose dine-in, takeaway or delivery.");
  }
  const tableNumber = optionalText(data.tableNumber, "Table number", 40);
  const customerName = optionalText(data.customerName, "Customer name", 120);
  const customerPhone = optionalText(data.customerPhone, "Customer phone", 40);
  const deliveryAddress = optionalText(data.deliveryAddress, "Delivery address", 500);
  if (data.orderType === "DINE_IN" && !tableNumber) throw new CheckoutError("Enter a table number.");
  if (data.orderType === "DELIVERY" && (!customerName || !customerPhone || !deliveryAddress)) {
    throw new CheckoutError("Delivery requires a customer name, phone and address.");
  }
  let discount: Discount | undefined;
  if (data.discount !== undefined) {
    if (!data.discount || typeof data.discount !== "object") throw new CheckoutError("Invalid discount.");
    const raw = data.discount as Record<string, unknown>;
    if (raw.type !== "FIXED" && raw.type !== "PERCENTAGE") throw new CheckoutError("Invalid discount type.");
    moneyToMinor(raw.value, "Discount");
    discount = { type: raw.type, value: raw.value as string | number };
  }
  const code = optionalText(data.couponCode, "Coupon code", 40);
  const couponCode = code ? normalizeCouponCode(code) : undefined;
  if (discount && couponCode) throw new CheckoutError("Use either a manual discount or a coupon, not both.");
  if (data.paymentMethod === "cash" && data.cashReceived !== undefined) moneyToMinor(data.cashReceived, "Cash received");
  return {
    items, paymentMethod: data.paymentMethod, orderType: data.orderType,
    tableNumber: data.orderType === "DINE_IN" ? tableNumber : undefined,
    customerName, customerPhone,
    deliveryAddress: data.orderType === "DELIVERY" ? deliveryAddress : undefined,
    discount, couponCode,
    cashReceived: data.paymentMethod === "cash" ? data.cashReceived as string | number | undefined : undefined,
  };
}
