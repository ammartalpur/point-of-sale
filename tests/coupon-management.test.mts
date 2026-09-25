import assert from "node:assert/strict";
import test from "node:test";
import {
  applyCouponCommand,
  CouponError,
  parseCouponCommand,
} from "../app/lib/coupon-management.ts";

test("coupon input normalizes codes, money and Karachi expiry", () => {
  const command = parseCouponCommand({
    type: "saveCoupon", code: " save-10 ", discountType: "PERCENTAGE",
    value: "10", minimumSubtotal: "500", expiresAt: "2026-10-01T23:30",
    isActive: true,
  });
  assert.equal(command.type, "saveCoupon");
  if (command.type !== "saveCoupon") return;
  assert.equal(command.code, "SAVE-10");
  assert.equal(command.value, "10.00");
  assert.equal(command.minimumSubtotal, "500.00");
  assert.equal(command.expiresAt, "2026-10-01T18:30:00.000Z");
});

test("coupon validation rejects excessive percentages and invalid codes", () => {
  assert.throws(() => parseCouponCommand({ type: "saveCoupon", code: "bad code", discountType: "FIXED", value: "10", minimumSubtotal: "0", isActive: true }), CouponError);
  assert.throws(() => parseCouponCommand({ type: "saveCoupon", code: "BIG", discountType: "PERCENTAGE", value: "100.01", minimumSubtotal: "0", isActive: true }), CouponError);
});

test("used coupon deletion disables it and preserves history", async () => {
  const updates: unknown[] = [];
  const tx = {
    profile: { findUnique: async () => ({ role: "admin" }) },
    coupon: {
      findUnique: async () => ({ id: "coupon-1", _count: { orders: 3 } }),
      update: async (input: unknown) => { updates.push(input); },
      delete: async () => { throw new Error("must not delete used coupon"); },
    },
  };
  const message = await applyCouponCommand(tx as never, "admin-1", { type: "deleteCoupon", id: "coupon-1" });
  assert.match(message, /disabled/i);
  assert.deepEqual(updates, [{ where: { id: "coupon-1" }, data: { isActive: false } }]);
});
