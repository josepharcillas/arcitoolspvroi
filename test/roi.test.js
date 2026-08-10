import { test } from "node:test";
import assert from "node:assert/strict";
import { computeRoi, DEFAULT_RATE_PHP_PER_KWH } from "../src/lib/roi.js";

test("computes savings at the retail rate when nothing is exported", () => {
  const r = computeRoi({
    investmentPhp: 100000,
    ratePhpPerKwh: 10,
    entries: [{ period: "2026-01", kwh: 500 }],
  });
  assert.equal(r.totalSavingsPhp, 5000);
  assert.equal(r.remainingPhp, 95000);
  assert.equal(r.percentRecovered, 5);
});

test("credits exported energy at the lower rate", () => {
  // 300 self-used at 10, 200 exported at half of 10 = 3000 + 1000
  const r = computeRoi({
    investmentPhp: 100000,
    ratePhpPerKwh: 10,
    exportCreditRatio: 0.5,
    entries: [{ period: "2026-01", kwh: 500, exportedKwh: 200 }],
  });
  assert.equal(r.totalSavingsPhp, 4000);
});

test("reports the period break-even was reached", () => {
  const r = computeRoi({
    investmentPhp: 10000,
    ratePhpPerKwh: 10,
    entries: [
      { period: "2026-01", kwh: 500 }, // 5000 cumulative
      { period: "2026-02", kwh: 500 }, // 10000 - reaches it
      { period: "2026-03", kwh: 500 },
    ],
  });
  assert.equal(r.breakEvenPeriod, "2026-02");
  assert.equal(r.monthsToBreakEven, 0);
  assert.equal(r.remainingPhp, 0);
});

test("never reports negative remaining once past break-even", () => {
  const r = computeRoi({
    investmentPhp: 1000,
    ratePhpPerKwh: 10,
    entries: [{ period: "2026-01", kwh: 500 }],
  });
  assert.equal(r.remainingPhp, 0);
  assert.equal(r.percentRecovered, 100, "recovery is capped at 100%");
});

test("projects remaining months from this system's own average", () => {
  const r = computeRoi({
    investmentPhp: 30000,
    ratePhpPerKwh: 10,
    entries: [
      { period: "2026-01", kwh: 500 }, // 5000
      { period: "2026-02", kwh: 500 }, // 5000, average 5000/mo
    ],
  });
  assert.equal(r.totalSavingsPhp, 10000);
  assert.equal(r.remainingPhp, 20000);
  assert.equal(r.monthsToBreakEven, 4);
});

test("returns no projection when there is no history to project from", () => {
  const r = computeRoi({ investmentPhp: 50000, entries: [] });
  assert.equal(r.monthsToBreakEven, null, "must not invent a figure from nothing");
  assert.equal(r.costPerKwhPhp, null);
  assert.equal(r.monthsRecorded, 0);
});

test("orders entries by period regardless of input order", () => {
  const r = computeRoi({
    investmentPhp: 10000,
    ratePhpPerKwh: 10,
    entries: [
      { period: "2026-03", kwh: 100 },
      { period: "2026-01", kwh: 100 },
      { period: "2026-02", kwh: 100 },
    ],
  });
  assert.deepEqual(r.timeline.map((t) => t.period), ["2026-01", "2026-02", "2026-03"]);
});

test("ignores malformed entries rather than producing NaN", () => {
  const r = computeRoi({
    investmentPhp: 10000,
    ratePhpPerKwh: 10,
    entries: [
      { period: "2026-01", kwh: 100 },
      { period: "2026-02", kwh: "not a number" },
      null,
      { kwh: 50 }, // no period
    ],
  });
  assert.equal(r.monthsRecorded, 1);
  assert.equal(r.totalSavingsPhp, 1000);
});

test("caps exported energy at total generation", () => {
  // A typo claiming more exported than generated must not inflate savings.
  const r = computeRoi({
    investmentPhp: 10000,
    ratePhpPerKwh: 10,
    exportCreditRatio: 0.5,
    entries: [{ period: "2026-01", kwh: 100, exportedKwh: 500 }],
  });
  assert.equal(r.totalSavingsPhp, 500, "all 100 kWh treated as exported, none double counted");
});

test("computes effective cost per kWh generated so far", () => {
  const r = computeRoi({
    investmentPhp: 10000,
    ratePhpPerKwh: 10,
    entries: [{ period: "2026-01", kwh: 1000 }],
  });
  assert.equal(r.costPerKwhPhp, 10);
});

test("defaults to the documented Meralco rate", () => {
  const r = computeRoi({ investmentPhp: 1000, entries: [{ period: "2026-01", kwh: 1 }] });
  assert.equal(r.ratePhpPerKwh, DEFAULT_RATE_PHP_PER_KWH);
});
