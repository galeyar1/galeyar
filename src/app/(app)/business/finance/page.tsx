"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Wallet, Plus, Pencil } from "lucide-react";

import { db, type Local } from "@/lib/db/schema";
import { useAuth } from "@/lib/auth/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DeleteIconButton } from "@/components/confirm-dialog";
import { softDeleteRecord } from "@/lib/sync/repository";
import { formatJalali, toPersianDigits, todayIso } from "@/lib/jalali";
import {
  computeProfitLoss,
  debtorTransactions,
  creditorTransactions,
  costPerAnimal,
  INCOME_CATEGORY_LABELS,
  EXPENSE_CATEGORY_LABELS,
} from "@/lib/finance";
import type { ExpenseCategory, FinancialTransaction, IncomeCategory } from "@/lib/supabase/types";

function categoryLabel(type: "income" | "expense", category: string): string {
  if (type === "income") return INCOME_CATEGORY_LABELS[category as IncomeCategory] ?? category;
  return EXPENSE_CATEGORY_LABELS[category as ExpenseCategory] ?? category;
}

export default function FinancePage() {
  const { profile } = useAuth();
  const farmId = profile?.farm_id;
  const isOwner = profile?.role === "owner";
  const today = todayIso();
  const monthKey = today.slice(0, 7);

  const transactions = useLiveQuery(async () => {
    if (!farmId) return [];
    const rows = await db.financial_transactions.where("farm_id").equals(farmId).toArray();
    return rows.filter((r) => !r.deleted_at).sort((a, b) => (a.transaction_date < b.transaction_date ? 1 : -1));
  }, [farmId]);

  const activeAnimalCount = useLiveQuery(async () => {
    if (!farmId) return 0;
    const rows = await db.animals.where("farm_id").equals(farmId).toArray();
    return rows.filter((a) => !a.deleted_at && a.status === "active").length;
  }, [farmId]);

  const monthTransactions = useMemo(
    () => (transactions ?? []).filter((t) => t.transaction_date.slice(0, 7) === monthKey),
    [transactions, monthKey]
  );

  const monthPL = useMemo(() => computeProfitLoss(monthTransactions), [monthTransactions]);
  const yearPL = useMemo(
    () => computeProfitLoss((transactions ?? []).filter((t) => t.transaction_date.slice(0, 4) === monthKey.slice(0, 4))),
    [transactions, monthKey]
  );

  const debtors = useMemo(() => debtorTransactions(transactions ?? []), [transactions]);
  const creditors = useMemo(() => creditorTransactions(transactions ?? []), [transactions]);
  const totalDebtors = debtors.reduce((sum, t) => sum + Number(t.amount), 0);
  const totalCreditors = creditors.reduce((sum, t) => sum + Number(t.amount), 0);

  const dailyCostPerAnimal = useMemo(() => {
    if (!activeAnimalCount) return 0;
    const monthlyExpense = monthPL.expenses;
    return monthlyExpense / 30 / activeAnimalCount;
  }, [monthPL, activeAnimalCount]);
  const animalCost = costPerAnimal(dailyCostPerAnimal);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="size-6 text-primary" />
          <h1 className="text-xl font-bold">هوش مالی گله‌یار</h1>
        </div>
        {isOwner && (
          <Button asChild size="sm">
            <Link href="/register/finance">
              <Plus className="size-4" />
              تراکنش جدید
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>سود و زیان ماهانه</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-lg font-bold text-success">{toPersianDigits(monthPL.revenue.toLocaleString())}</div>
            <div className="text-xs text-muted-foreground">درآمد</div>
          </div>
          <div>
            <div className="text-lg font-bold text-destructive">{toPersianDigits(monthPL.expenses.toLocaleString())}</div>
            <div className="text-xs text-muted-foreground">هزینه</div>
          </div>
          <div>
            <div className={`text-lg font-bold ${monthPL.netProfit >= 0 ? "text-primary" : "text-destructive"}`}>
              {toPersianDigits(monthPL.netProfit.toLocaleString())}
            </div>
            <div className="text-xs text-muted-foreground">سود خالص</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>سود سالانه ({toPersianDigits(monthKey.slice(0, 4))})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${yearPL.netProfit >= 0 ? "text-primary" : "text-destructive"}`}>
            {toPersianDigits(yearPL.netProfit.toLocaleString())} تومان
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>هزینه به ازای هر دام</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-2 text-center text-sm">
          <div>
            <div className="font-bold">{toPersianDigits(Math.round(animalCost.daily).toLocaleString())}</div>
            <div className="text-xs text-muted-foreground">روزانه</div>
          </div>
          <div>
            <div className="font-bold">{toPersianDigits(Math.round(animalCost.monthly).toLocaleString())}</div>
            <div className="text-xs text-muted-foreground">ماهانه</div>
          </div>
          <div>
            <div className="font-bold">{toPersianDigits(Math.round(animalCost.annual).toLocaleString())}</div>
            <div className="text-xs text-muted-foreground">سالانه</div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-lg font-bold text-warning">{toPersianDigits(totalDebtors.toLocaleString())}</div>
            <div className="text-xs text-muted-foreground">بدهکاران ({toPersianDigits(debtors.length)})</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-lg font-bold text-destructive">{toPersianDigits(totalCreditors.toLocaleString())}</div>
            <div className="text-xs text-muted-foreground">بستانکاران ({toPersianDigits(creditors.length)})</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">تراکنش‌های اخیر</h2>
        {(transactions ?? []).length === 0 && (
          <p className="text-center text-muted-foreground">هنوز تراکنشی ثبت نشده است.</p>
        )}
        <ul className="flex flex-col gap-2">
          {(transactions ?? []).slice(0, 30).map((t: Local<FinancialTransaction>) => (
            <li key={t.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold">{categoryLabel(t.type, t.category)}</span>
                <span className="text-xs text-muted-foreground">
                  {formatJalali(t.transaction_date)}
                  {t.party_name ? ` · ${t.party_name}` : ""}
                  {!t.is_settled ? " · تسویه‌نشده" : ""}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className={t.type === "income" ? "text-success" : "text-destructive"}>
                  {t.type === "income" ? "+" : "-"}
                  {toPersianDigits(Number(t.amount).toLocaleString())}
                </span>
                {isOwner && (
                  <>
                    <Button variant="ghost" size="icon-sm" asChild aria-label="ویرایش">
                      <Link href={`/register/finance?id=${t.id}`}>
                        <Pencil className="size-4" />
                      </Link>
                    </Button>
                    <DeleteIconButton
                      description="آیا از حذف این تراکنش مطمئن هستید؟"
                      onDelete={() => softDeleteRecord("financial_transactions", t.id)}
                    />
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
