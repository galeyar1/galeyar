"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { PersianDatePicker } from "@/components/ui/persian-date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AnimalPicker } from "@/components/animal-picker";
import { db } from "@/lib/db/schema";
import { useAuth } from "@/lib/auth/auth-provider";
import { createRecord, updateRecord } from "@/lib/sync/repository";
import { todayIso } from "@/lib/jalali";
import { INCOME_CATEGORY_LABELS, EXPENSE_CATEGORY_LABELS } from "@/lib/finance";
import type { ExpenseCategory, FinancialTransactionType, IncomeCategory } from "@/lib/supabase/types";

function FinanceForm({ recordId }: { recordId: string | null }) {
  const router = useRouter();
  const { profile, session } = useAuth();
  const [type, setType] = useState<FinancialTransactionType>("income");
  const [category, setCategory] = useState<string>("animal_sale");
  const [amount, setAmount] = useState("");
  const [transactionDate, setTransactionDate] = useState(todayIso());
  const [description, setDescription] = useState("");
  const [animalId, setAnimalId] = useState("");
  const [partyName, setPartyName] = useState("");
  const [isSettled, setIsSettled] = useState(true);
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const existing = useLiveQuery(
    () => (recordId ? db.financial_transactions.get(recordId) : undefined),
    [recordId]
  );

  useEffect(() => {
    if (existing) {
      setType(existing.type);
      setCategory(existing.category);
      setAmount(String(existing.amount));
      setTransactionDate(existing.transaction_date);
      setDescription(existing.description ?? "");
      setAnimalId(existing.animal_id ?? "");
      setPartyName(existing.party_name ?? "");
      setIsSettled(existing.is_settled);
      setDueDate(existing.due_date ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id]);

  const categoryLabels = type === "income" ? INCOME_CATEGORY_LABELS : EXPENSE_CATEGORY_LABELS;
  const canSubmit = Number(amount) > 0 && category;

  async function onSubmit() {
    if (!profile?.farm_id || !session || !canSubmit) return;
    setSubmitting(true);
    console.log("[register/finance] submitting", { recordId, type, category, amount, isSettled });

    const payload = {
      type,
      category,
      amount: Number(amount),
      transaction_date: transactionDate,
      description: description || null,
      animal_id: animalId || null,
      party_name: partyName || null,
      is_settled: isSettled,
      due_date: !isSettled ? dueDate || null : null,
    };

    try {
      if (recordId) {
        await updateRecord("financial_transactions", recordId, payload);
        toast.success("تراکنش به‌روزرسانی شد");
      } else {
        await createRecord("financial_transactions", profile.farm_id, session.user.id, payload);
        toast.success("تراکنش با موفقیت ثبت شد");
      }
      router.push("/business/finance");
    } catch (error) {
      console.error("[register/finance] failed", error);
      toast.error(error instanceof Error ? error.message : "ثبت تراکنش با خطا مواجه شد. لطفاً دوباره تلاش کنید.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      <h1 className="text-xl font-bold">{recordId ? "ویرایش تراکنش" : "ثبت تراکنش مالی"}</h1>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            setType("income");
            setCategory("animal_sale");
          }}
          className={`h-12 rounded-xl border text-lg font-semibold ${
            type === "income" ? "border-success bg-success/10 text-success" : "border-border"
          }`}
        >
          درآمد
        </button>
        <button
          type="button"
          onClick={() => {
            setType("expense");
            setCategory("feed");
          }}
          className={`h-12 rounded-xl border text-lg font-semibold ${
            type === "expense" ? "border-destructive bg-destructive/10 text-destructive" : "border-border"
          }`}
        >
          هزینه
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-base">دسته‌بندی</label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-12 w-full text-lg"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(categoryLabels) as (IncomeCategory | ExpenseCategory)[]).map((c) => (
              <SelectItem key={c} value={c}>{categoryLabels[c as keyof typeof categoryLabels]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-base">مبلغ (تومان) *</label>
        <Input
          type="number"
          inputMode="numeric"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="h-14 text-xl"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-base">تاریخ</label>
        <PersianDatePicker value={transactionDate} onChange={(iso) => setTransactionDate(iso ?? todayIso())} className="h-12 text-lg" />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-base">دام مرتبط (اختیاری)</label>
        <AnimalPicker farmId={profile?.farm_id} value={animalId} onChange={setAnimalId} allowNone />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-base">طرف حساب (اختیاری)</label>
        <Input
          value={partyName}
          onChange={(e) => setPartyName(e.target.value)}
          className="h-12 text-lg"
          placeholder="نام مشتری یا فروشنده"
        />
      </div>

      <div className="flex items-center justify-between rounded-xl bg-muted p-3">
        <span>{type === "income" ? "دریافت شده" : "پرداخت شده"}</span>
        <Switch checked={isSettled} onCheckedChange={setIsSettled} />
      </div>

      {!isSettled && (
        <div className="flex flex-col gap-2">
          <label className="text-base">
            {type === "income" ? "سررسید دریافت (بدهکار)" : "سررسید پرداخت (بستانکار)"}
          </label>
          <PersianDatePicker value={dueDate} onChange={(iso) => setDueDate(iso ?? "")} className="h-12 text-lg" />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label className="text-base">یادداشت</label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      </div>

      <Button size="lg" className="h-14 text-lg" disabled={!canSubmit || submitting} onClick={onSubmit}>
        {submitting ? "در حال ثبت…" : recordId ? "ذخیره تغییرات" : "ثبت تراکنش"}
      </Button>
    </div>
  );
}

function FinanceFormInner() {
  const params = useSearchParams();
  return <FinanceForm recordId={params.get("id")} />;
}

export default function NewFinanceRecordPage() {
  return (
    <Suspense fallback={null}>
      <FinanceFormInner />
    </Suspense>
  );
}
