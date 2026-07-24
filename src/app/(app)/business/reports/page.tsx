"use client";

import { useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { FileText, Download, Image as ImageIcon } from "lucide-react";

import { db } from "@/lib/db/schema";
import { useAuth } from "@/lib/auth/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatJalali, toPersianDigits, todayIso } from "@/lib/jalali";
import { toCsv, downloadCsv, type CsvColumn } from "@/lib/csv-export";
import { exportReportPdf } from "@/lib/report-export";
import { INCOME_CATEGORY_LABELS, EXPENSE_CATEGORY_LABELS } from "@/lib/finance";
import type { ExpenseCategory, IncomeCategory } from "@/lib/supabase/types";

type ReportType = "financial" | "health" | "birth" | "vaccination" | "monthly" | "annual";

const REPORT_LABELS: Record<ReportType, string> = {
  monthly: "گزارش ماهانه",
  annual: "گزارش سالانه",
  financial: "گزارش مالی",
  health: "گزارش سلامت",
  birth: "گزارش زایمان",
  vaccination: "گزارش واکسیناسیون",
};

const DISEASE_LABELS: Record<string, string> = {
  respiratory: "تنفسی",
  digestive: "گوارشی",
  fever: "تب",
  infectious: "عفونی",
  lameness: "لنگش",
  other: "سایر",
};

interface ReportRow {
  date: string;
  title: string;
  detail: string;
  amount?: string;
}

export default function AdvancedReportsPage() {
  const { profile } = useAuth();
  const farmId = profile?.farm_id;
  const today = todayIso();
  const [reportType, setReportType] = useState<ReportType>("monthly");
  const [exporting, setExporting] = useState<"pdf" | "png" | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const rows = useLiveQuery(async (): Promise<ReportRow[]> => {
    if (!farmId) return [];
    const isAnnual = reportType === "annual";
    const cutoff = isAnnual ? `${today.slice(0, 4)}-01-01` : `${today.slice(0, 7)}-01`;

    if (reportType === "financial") {
      const txns = await db.financial_transactions.where("farm_id").equals(farmId).toArray();
      return txns
        .filter((t) => !t.deleted_at && t.transaction_date >= cutoff)
        .map((t) => ({
          date: t.transaction_date,
          title: t.type === "income" ? INCOME_CATEGORY_LABELS[t.category as IncomeCategory] ?? t.category : EXPENSE_CATEGORY_LABELS[t.category as ExpenseCategory] ?? t.category,
          detail: t.party_name ?? (t.type === "income" ? "درآمد" : "هزینه"),
          amount: `${t.type === "income" ? "+" : "-"}${Number(t.amount).toLocaleString()}`,
        }));
    }
    if (reportType === "health") {
      const rows = await db.disease_records.where("farm_id").equals(farmId).toArray();
      const animals = await db.animals.where("farm_id").equals(farmId).toArray();
      const earTagOf = new Map(animals.map((a) => [a.id, a.ear_tag]));
      return rows
        .filter((r) => !r.deleted_at && r.record_date >= cutoff)
        .map((r) => ({
          date: r.record_date,
          title: earTagOf.get(r.animal_id) ?? "؟",
          detail: DISEASE_LABELS[r.disease_type] ?? r.disease_type,
        }));
    }
    if (reportType === "birth") {
      const rows = await db.birth_records.where("farm_id").equals(farmId).toArray();
      const animals = await db.animals.where("farm_id").equals(farmId).toArray();
      const earTagOf = new Map(animals.map((a) => [a.id, a.ear_tag]));
      return rows
        .filter((r) => !r.deleted_at && r.birth_date >= cutoff)
        .map((r) => ({
          date: r.birth_date,
          title: earTagOf.get(r.mother_id) ?? "؟",
          detail: `${r.male_offspring_count} نر، ${r.female_offspring_count} ماده`,
        }));
    }
    if (reportType === "vaccination") {
      const rows = await db.vaccinations.where("farm_id").equals(farmId).toArray();
      const animals = await db.animals.where("farm_id").equals(farmId).toArray();
      const earTagOf = new Map(animals.map((a) => [a.id, a.ear_tag]));
      return rows
        .filter((r) => !r.deleted_at && r.date_given >= cutoff)
        .map((r) => ({
          date: r.date_given,
          title: earTagOf.get(r.animal_id) ?? "؟",
          detail: r.vaccine_name,
        }));
    }

    // monthly / annual: a combined overview across every module.
    const [milk, weight, disease, births, vaccinations] = await Promise.all([
      db.milk_records.where("farm_id").equals(farmId).toArray(),
      db.weight_records.where("farm_id").equals(farmId).toArray(),
      db.disease_records.where("farm_id").equals(farmId).toArray(),
      db.birth_records.where("farm_id").equals(farmId).toArray(),
      db.vaccinations.where("farm_id").equals(farmId).toArray(),
    ]);
    const inPeriod = <T extends { deleted_at: string | null }>(list: T[], dateOf: (t: T) => string) =>
      list.filter((r) => !r.deleted_at && dateOf(r) >= cutoff);

    const totalMilk = inPeriod(milk, (r) => r.record_date).reduce((s, r) => s + Number(r.morning_milk ?? 0) + Number(r.evening_milk ?? 0), 0);
    const weightCount = inPeriod(weight, (r) => r.record_date).length;
    const diseaseCount = inPeriod(disease, (r) => r.record_date).length;
    const birthCount = inPeriod(births, (r) => r.birth_date).reduce((s, r) => s + r.male_offspring_count + r.female_offspring_count, 0);
    const vaccinationCount = inPeriod(vaccinations, (r) => r.date_given).length;

    return [
      { date: cutoff, title: "شیر تولیدشده", detail: `${totalMilk.toFixed(1)} لیتر` },
      { date: cutoff, title: "ثبت وزن", detail: `${weightCount} مورد` },
      { date: cutoff, title: "موارد بیماری", detail: `${diseaseCount} مورد` },
      { date: cutoff, title: "نوزادان متولدشده", detail: `${birthCount} رأس` },
      { date: cutoff, title: "واکسیناسیون انجام‌شده", detail: `${vaccinationCount} مورد` },
    ];
  }, [farmId, reportType, today]);

  const columns: CsvColumn<ReportRow>[] = useMemo(
    () => [
      { key: "date", label: "تاریخ", value: (r) => formatJalali(r.date) },
      { key: "title", label: "عنوان", value: (r) => r.title },
      { key: "detail", label: "جزئیات", value: (r) => r.detail },
      { key: "amount", label: "مبلغ", value: (r) => r.amount ?? "" },
    ],
    []
  );

  function handleExportCsv() {
    const csv = toCsv(rows ?? [], columns);
    downloadCsv(`${REPORT_LABELS[reportType]}.csv`, csv);
    toast.success("فایل CSV/Excel دانلود شد");
  }

  async function handleExportPdf() {
    if (!tableRef.current) return;
    setExporting("pdf");
    try {
      await exportReportPdf(tableRef.current, REPORT_LABELS[reportType]);
      toast.success("PDF دانلود شد");
    } catch (error) {
      console.error("[business/reports] pdf export failed", error);
      toast.error("ساخت PDF ناموفق بود");
    } finally {
      setExporting(null);
    }
  }

  async function handleExportPng() {
    if (!tableRef.current) return;
    setExporting("png");
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(tableRef.current, { pixelRatio: 2, backgroundColor: "#ffffff" });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${REPORT_LABELS[reportType]}.png`;
      a.click();
    } catch (error) {
      console.error("[business/reports] png export failed", error);
      toast.error("دانلود تصویر ناموفق بود");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <FileText className="size-6 text-primary" />
        <h1 className="text-xl font-bold">گزارشات پیشرفته</h1>
      </div>

      <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
        <SelectTrigger className="h-12 w-full text-lg"><SelectValue /></SelectTrigger>
        <SelectContent>
          {(Object.keys(REPORT_LABELS) as ReportType[]).map((r) => (
            <SelectItem key={r} value={r}>{REPORT_LABELS[r]}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exporting !== null}>
          <Download className="size-4" /> دانلود PDF
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={exporting !== null}>
          <Download className="size-4" /> دانلود Excel/CSV
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportPng} disabled={exporting !== null}>
          <ImageIcon className="size-4" /> دانلود PNG
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>{REPORT_LABELS[reportType]}</CardTitle></CardHeader>
        <CardContent>
          <div ref={tableRef} className="flex flex-col gap-1.5 bg-card p-1">
            {(rows ?? []).length === 0 && <p className="text-center text-muted-foreground">داده‌ای برای این بازه یافت نشد.</p>}
            {(rows ?? []).map((r, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-muted p-2 text-sm">
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold">{r.title}</span>
                  <span className="text-xs text-muted-foreground">{formatJalali(r.date)} · {r.detail}</span>
                </div>
                {r.amount && (
                  <span className={r.amount.startsWith("+") ? "text-success" : "text-destructive"}>
                    {toPersianDigits(r.amount)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
