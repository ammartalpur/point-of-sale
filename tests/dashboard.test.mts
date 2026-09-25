import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPeakHours,
  buildRevenueTrend,
  getDashboardPeriod,
  karachiDateKey,
} from "../app/lib/dashboard.ts";

test("dashboard periods use Karachi midnight and default to seven days", () => {
  const now = new Date("2026-09-23T04:30:00.000Z");
  const today = getDashboardPeriod("today", now);
  const week = getDashboardPeriod(undefined, now);
  const month = getDashboardPeriod("month", now);

  assert.equal(today.start.toISOString(), "2026-09-22T19:00:00.000Z");
  assert.equal(today.end.toISOString(), now.toISOString());
  assert.equal(week.key, "week");
  assert.equal(week.days, 7);
  assert.equal(week.start.toISOString(), "2026-09-16T19:00:00.000Z");
  assert.equal(month.days, 30);
});

test("daily revenue trend includes empty days and groups by Karachi date", () => {
  const now = new Date("2026-09-23T12:00:00.000Z");
  const period = getDashboardPeriod("week", now);
  const trend = buildRevenueTrend(
    [
      { completedAt: new Date("2026-09-17T01:00:00.000Z"), totalAmount: 500 },
      { completedAt: new Date("2026-09-23T03:00:00.000Z"), totalAmount: 900 },
    ],
    period,
  );

  assert.equal(trend.length, 7);
  assert.equal(trend[0].value, 500);
  assert.equal(trend[5].value, 0);
  assert.equal(trend[6].value, 900);
  assert.equal(karachiDateKey(new Date("2026-09-22T20:00:00.000Z")), "2026-09-23");
});

test("today trend and peak hours use two-hour Karachi bins", () => {
  const period = getDashboardPeriod(
    "today",
    new Date("2026-09-23T12:00:00.000Z"),
  );
  const orders = [
    { completedAt: new Date("2026-09-22T20:15:00.000Z"), totalAmount: 300 },
    { completedAt: new Date("2026-09-23T03:00:00.000Z"), totalAmount: 700 },
  ];
  const trend = buildRevenueTrend(orders, period);
  const peak = buildPeakHours(orders);

  assert.equal(trend.length, 12);
  assert.equal(trend[0].value, 300);
  assert.equal(trend[4].value, 700);
  assert.equal(peak[0].value, 1);
  assert.equal(peak[4].value, 1);
});
