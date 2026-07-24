import type { ExpenseCategory, FinancialTransaction, IncomeCategory } from "@/lib/supabase/types";

export const INCOME_CATEGORY_LABELS: Record<IncomeCategory, string> = {
  animal_sale: "فروش دام",
  milk_sale: "فروش شیر",
  wool_sale: "فروش پشم",
  breeding_service: "خدمات جفت‌گیری",
  other: "سایر",
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  feed: "خوراک",
  veterinary: "دامپزشکی",
  vaccines: "واکسن",
  transportation: "حمل‌ونقل",
  salaries: "حقوق",
  utilities: "قبوض",
  equipment: "تجهیزات",
  other: "سایر",
};

type Txn = Pick<FinancialTransaction, "type" | "amount" | "is_settled" | "transaction_date">;

export interface ProfitLoss {
  revenue: number;
  expenses: number;
  netProfit: number;
}

/** Revenue - Expenses over whichever transactions are passed in (caller filters by date range/farm). */
export function computeProfitLoss(transactions: Txn[]): ProfitLoss {
  const revenue = transactions.filter((t) => t.type === "income").reduce((sum, t) => sum + Number(t.amount), 0);
  const expenses = transactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0);
  return { revenue, expenses, netProfit: revenue - expenses };
}

/** Debtors: unsettled income (money owed *to* the farm). */
export function debtorTransactions<T extends Txn>(transactions: T[]): T[] {
  return transactions.filter((t) => t.type === "income" && !t.is_settled);
}

/** Creditors: unsettled expenses (money the farm owes). */
export function creditorTransactions<T extends Txn>(transactions: T[]): T[] {
  return transactions.filter((t) => t.type === "expense" && !t.is_settled);
}

export interface AnimalCost {
  daily: number;
  monthly: number;
  annual: number;
}

/** Matches the spec's worked example exactly: daily * 30 = monthly, monthly * 12 = annual. */
export function costPerAnimal(dailyCost: number): AnimalCost {
  const monthly = dailyCost * 30;
  return { daily: dailyCost, monthly, annual: monthly * 12 };
}
