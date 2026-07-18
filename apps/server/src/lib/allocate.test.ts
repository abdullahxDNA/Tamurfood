import { test, expect, describe } from "bun:test";
import { allocatePayments } from "./allocate";

const noTied = new Set<string>();
const ord = (...a: [string, number][]) =>
  a.map(([id, amount]) => ({ id, amount }));

// These cases are the exact scenarios that surfaced (and were fixed) while
// building the Khata payment reconcile — locked down so they can't regress.

describe("allocatePayments", () => {
  test("clears an order once the pool covers it, not before", () => {
    expect(allocatePayments(30, noTied, ord(["A", 30])).toPay).toEqual(["A"]);
    expect(allocatePayments(29, noTied, ord(["A", 30])).toPay).toEqual([]);
  });

  test("several small payments add up (cumulative pool, oldest first)", () => {
    // pool 40 covers A(30) but not A+B(50)
    const r = allocatePayments(40, noTied, ord(["A", 30], ["B", 20]));
    expect(r.toPay).toEqual(["A"]);
    expect(r.toUnpay).toEqual(["B"]);
  });

  test("full payment clears everything", () => {
    const r = allocatePayments(50, noTied, ord(["A", 30], ["B", 20]));
    expect(r.toPay).toEqual(["A", "B"]);
    expect(r.toUnpay).toEqual([]);
  });

  test("overpayment clears the orders (no crash, no double-count here)", () => {
    const r = allocatePayments(999, noTied, ord(["A", 30], ["B", 20]));
    expect(r.toPay).toEqual(["A", "B"]);
    expect(r.toUnpay).toEqual([]);
  });

  test("button-settled (tied) orders are skipped, pool goes to the rest", () => {
    // A was paid individually via the per-order button; the ৳20 pool clears B.
    const r = allocatePayments(20, new Set(["A"]), ord(["A", 30], ["B", 20]));
    expect(r.toPay).toEqual(["B"]);
    expect(r.toUnpay).toEqual([]);
  });

  test("empty pool clears nothing", () => {
    const r = allocatePayments(0, noTied, ord(["A", 30]));
    expect(r.toPay).toEqual([]);
    expect(r.toUnpay).toEqual(["A"]);
  });

  test("partial payment caveat: a bigger oldest order blocks later ones", () => {
    // pool 25 can't cover oldest A(30), so nothing clears even though B(10) alone
    // would fit — the balance is still correct, the list just lags (documented).
    const r = allocatePayments(25, noTied, ord(["A", 30], ["B", 10]));
    expect(r.toPay).toEqual([]);
    expect(r.toUnpay).toEqual(["A", "B"]);
  });
});
