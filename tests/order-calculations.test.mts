import test from "node:test";
import assert from "node:assert/strict";
import {
  allocateAmount, calculateCash, calculateTotals, moneyToMinor, minorToMoney,
  normalizeCouponCode, validateCheckoutInput, validateCoupon,
} from "../app/lib/order-calculations.ts";

test("money uses exact paisa and rejects invalid, negative, excessive and non-finite values", () => {
  assert.equal(moneyToMinor("0.29"), 29);
  assert.equal(moneyToMinor("123.4"), 12340);
  assert.equal(minorToMoney(29), "0.29");
  for (const value of ["-1", "1.234", "100000000", "1e3", NaN, Infinity, null, {}, ""]) {
    assert.throws(() => moneyToMinor(value));
  }
});

test("percentage discounts round half up to a paisa and fixed discounts cannot exceed subtotal", () => {
  assert.deepEqual(calculateTotals(100_000, { type: "PERCENTAGE", value: 10 }),
    { subtotal: 100_000, discountAmount: 10_000, total: 90_000 });
  assert.equal(calculateTotals(5, { type: "PERCENTAGE", value: 10 }).discountAmount, 1);
  assert.equal(calculateTotals(100, { type: "PERCENTAGE", value: 100 }).total, 0);
  assert.equal(calculateTotals(100, { type: "FIXED", value: "0.25" }).total, 75);
  assert.throws(() => calculateTotals(100, { type: "FIXED", value: 2 }));
  assert.throws(() => calculateTotals(100, { type: "PERCENTAGE", value: 101 }));
  assert.equal(calculateTotals(9_999_999_999, { type: "PERCENTAGE", value: "99.99" }).total, 1_000_000);
});

test("allocations preserve every paisa with deterministic rounding and zero-priced components", () => {
  assert.deepEqual(allocateAmount(100, [1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(allocateAmount(5, [0, 0]), [3, 2]);
  assert.deepEqual(allocateAmount(5, [1, 0]), [5, 0]);
  for (let amount = 0; amount < 150; amount++) {
    const weights = [amount + 1, 5, 11];
    const parts = allocateAmount(amount, weights);
    assert.equal(parts.reduce((a, b) => a + b, 0), amount);
    const discounts = allocateAmount(Math.floor(amount / 2), parts);
    discounts.forEach((discount, i) => assert.ok(discount <= parts[i]));
  }
});

test("cash reports correct change, exact payment and remaining balance", () => {
  assert.deepEqual(calculateCash(90_000, 1000), { cashReceived: 100_000, changeGiven: 10_000, remaining: 0 });
  assert.equal(calculateCash(90_000, 900).changeGiven, 0);
  assert.equal(calculateCash(90_000, 800).remaining, 10_000);
});

test("coupons normalize and enforce activity, expiry boundary and minimum subtotal", () => {
  assert.equal(normalizeCouponCode(" welcome10 "), "WELCOME10");
  assert.throws(() => normalizeCouponCode("welcome 10"));
  const now = new Date("2026-09-19T00:00:00Z");
  const coupon = { isActive: true, expiresAt: null, minimumSubtotal: "1000" };
  assert.doesNotThrow(() => validateCoupon(coupon, 100_000, now));
  assert.throws(() => validateCoupon(coupon, 99_999, now));
  assert.throws(() => validateCoupon({ ...coupon, isActive: false }, 100_000, now));
  assert.throws(() => validateCoupon({ ...coupon, expiresAt: now }, 100_000, now));
});

const valid = {
  items: [{ kind: "PRODUCT", id: "product-1", quantity: 1 }],
  paymentMethod: "card", orderType: "TAKEAWAY",
};

test("input validation rejects empty carts, invalid quantities, stacked discounts and unknown types", () => {
  assert.doesNotThrow(() => validateCheckoutInput(valid));
  for (const quantity of [0, -1, 1.5, 10001, "1"]) {
    assert.throws(() => validateCheckoutInput({ ...valid, items: [{ ...valid.items[0], quantity }] }));
  }
  assert.throws(() => validateCheckoutInput({ ...valid, items: [] }));
  assert.throws(() => validateCheckoutInput({ ...valid, paymentMethod: "unsupported" }));
  assert.throws(() => validateCheckoutInput({ ...valid, orderType: "unknown" }));
  assert.throws(() => validateCheckoutInput({ ...valid, discount: { type: "FIXED", value: 1 }, couponCode: "SAVE" }));
});

test("dine-in and delivery require their details; irrelevant address and cash fields are discarded", () => {
  assert.throws(() => validateCheckoutInput({ ...valid, orderType: "DINE_IN" }));
  assert.doesNotThrow(() => validateCheckoutInput({ ...valid, orderType: "DINE_IN", tableNumber: " 3 " }));
  assert.throws(() => validateCheckoutInput({ ...valid, orderType: "DELIVERY", customerName: "Ali" }));
  assert.doesNotThrow(() => validateCheckoutInput({ ...valid, orderType: "DELIVERY", customerName: "Ali", customerPhone: "03001234567", deliveryAddress: "Main Road" }));
  const input = validateCheckoutInput({ ...valid, tableNumber: "3", deliveryAddress: "Old address", cashReceived: 500 });
  assert.equal(input.tableNumber, undefined);
  assert.equal(input.deliveryAddress, undefined);
  assert.equal(input.cashReceived, undefined);
});
