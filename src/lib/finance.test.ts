import { describe, it, expect } from "vitest";
import { computeProfitLoss, debtorTransactions, creditorTransactions, costPerAnimal } from "@/lib/finance";

function txn(type: "income" | "expense", amount: number, isSettled = true) {
  return { type, amount, is_settled: isSettled, transaction_date: "2026-01-01" };
}

describe("computeProfitLoss", () => {
  it("matches the spec's worked example (120M revenue, 45M expenses, 75M profit)", () => {
    const result = computeProfitLoss([txn("income", 120_000_000), txn("expense", 45_000_000)]);
    expect(result).toEqual({ revenue: 120_000_000, expenses: 45_000_000, netProfit: 75_000_000 });
  });

  it("handles a net loss", () => {
    const result = computeProfitLoss([txn("income", 10), txn("expense", 30)]);
    expect(result.netProfit).toBe(-20);
  });
});

describe("debtorTransactions / creditorTransactions", () => {
  const transactions = [
    txn("income", 100, false), // debtor
    txn("income", 200, true), // settled, not a debtor
    txn("expense", 50, false), // creditor
    txn("expense", 80, true), // settled, not a creditor
  ];

  it("finds unsettled income as debtors", () => {
    expect(debtorTransactions(transactions)).toEqual([txn("income", 100, false)]);
  });

  it("finds unsettled expenses as creditors", () => {
    expect(creditorTransactions(transactions)).toEqual([txn("expense", 50, false)]);
  });
});

describe("costPerAnimal", () => {
  it("matches the spec's worked example (38,000/day -> 1,140,000/month -> 13,680,000/year)", () => {
    expect(costPerAnimal(38_000)).toEqual({ daily: 38_000, monthly: 1_140_000, annual: 13_680_000 });
  });
});
