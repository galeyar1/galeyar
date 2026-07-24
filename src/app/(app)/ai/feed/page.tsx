"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { Wheat } from "lucide-react";

import { db } from "@/lib/db/schema";
import { useAuth } from "@/lib/auth/auth-provider";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FEED_TYPE_LABELS, feedLabel } from "@/lib/feed-labels";
import { toPersianDigits } from "@/lib/jalali";
import { monthlyFromDaily, annualFromDaily, daysRemaining, costPerAnimalPerDay } from "@/lib/feed-forecast";
import { RATION_TEMPLATES, suggestedDailyConsumption, type RationTemplateId, type Season, type RationAmounts } from "@/lib/ration-templates";
import type { FeedInventory, FeedType } from "@/lib/supabase/types";

function RationCalculator({ activeAnimalCount }: { activeAnimalCount: number }) {
  const [templateId, setTemplateId] = useState<RationTemplateId | "custom">("traditional");
  const [headcount, setHeadcount] = useState(String(activeAnimalCount || ""));
  const [season, setSeason] = useState<Season>("summer");
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  const result: RationAmounts = useMemo(() => {
    if (templateId !== "custom") {
      return suggestedDailyConsumption(RATION_TEMPLATES[templateId], Number(headcount) || 0, season);
    }
    const amounts: RationAmounts = {};
    for (const [feedType, value] of Object.entries(customAmounts)) {
      if (value) amounts[feedType as FeedType] = (Number(value) || 0) * (Number(headcount) || 0);
    }
    return amounts;
  }, [templateId, headcount, season, customAmounts]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>جیره پیشنهادی</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Select value={templateId} onValueChange={(v) => setTemplateId(v as RationTemplateId)}>
          <SelectTrigger className="h-12 w-full text-lg"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.values(RATION_TEMPLATES).map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
            ))}
            <SelectItem value="custom">سفارشی</SelectItem>
          </SelectContent>
        </Select>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">تعداد دام</label>
            <Input
              type="number"
              inputMode="numeric"
              value={headcount}
              onChange={(e) => setHeadcount(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">فصل</label>
            <Select value={season} onValueChange={(v) => setSeason(v as Season)}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="summer">تابستان</SelectItem>
                <SelectItem value="winter">زمستان</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {templateId === "custom" && (
          <div className="flex flex-col gap-2 rounded-xl bg-muted p-3">
            <span className="text-xs text-muted-foreground">مقدار به ازای هر دام در روز (کیلوگرم)</span>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(FEED_TYPE_LABELS) as FeedType[])
                .filter((t) => t !== "custom")
                .map((t) => (
                  <div key={t} className="flex items-center gap-2">
                    <span className="w-16 shrink-0 text-sm">{FEED_TYPE_LABELS[t]}</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      className="h-9"
                      value={customAmounts[t] ?? ""}
                      onChange={(e) => setCustomAmounts((a) => ({ ...a, [t]: e.target.value }))}
                    />
                  </div>
                ))}
            </div>
          </div>
        )}

        {Object.keys(result).length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {(Object.entries(result) as [FeedType, number][]).map(([type, amount]) => (
              <li key={type} className="flex justify-between rounded-lg bg-muted p-2 text-sm">
                <span>{FEED_TYPE_LABELS[type]}</span>
                <span className="font-semibold">{toPersianDigits(amount.toFixed(1))} کیلوگرم/روز</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default function FeedAssistantPage() {
  const { profile } = useAuth();
  const farmId = profile?.farm_id;
  const [inventory, setInventory] = useState<FeedInventory[]>([]);
  const [rateInputs, setRateInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const activeAnimalCount = useLiveQuery(async () => {
    if (!farmId) return 0;
    const rows = await db.animals.where("farm_id").equals(farmId).toArray();
    return rows.filter((a) => !a.deleted_at && a.status === "active").length;
  }, [farmId]);

  async function loadInventory() {
    if (!farmId) return;
    const { data } = await supabase.from("feed_inventory").select("*").eq("farm_id", farmId);
    setInventory(data ?? []);
  }

  useEffect(() => {
    void loadInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmId]);

  async function saveDailyRate(item: FeedInventory) {
    const value = rateInputs[item.id];
    if (value === undefined) return;
    setSaving(item.id);
    const rate = value === "" ? null : Number(value);
    const { error } = await supabase.from("feed_inventory").update({ daily_rate: rate }).eq("id", item.id);
    setSaving(null);
    if (error) {
      toast.error(`ذخیره نرخ مصرف ناموفق بود: ${error.message}`);
      return;
    }
    toast.success("نرخ مصرف روزانه ذخیره شد");
    void loadInventory();
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Wheat className="size-6 text-primary" />
        <h1 className="text-xl font-bold">دستیار هوشمند خوراک و جیره</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        نرخ مصرف روزانه هر خوراک را فقط یک‌بار وارد کنید — نیازی به ثبت روزانه نیست. محاسبات ماهانه، سالانه و پیش‌بینی
        اتمام موجودی خودکار انجام می‌شود.
      </p>

      <div className="flex flex-col gap-3">
        {inventory.map((item) => {
          const rate = item.daily_rate;
          const remaining = daysRemaining(item.quantity, rate);
          const costPerAnimal = rate ? costPerAnimalPerDay(rate, item.unit_cost, activeAnimalCount ?? 0) : null;
          return (
            <Card key={item.id}>
              <CardContent className="flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold">{feedLabel(item)}</span>
                  <span className="text-sm text-muted-foreground">
                    موجودی: {toPersianDigits(item.quantity)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    placeholder="نرخ مصرف روزانه"
                    value={rateInputs[item.id] ?? (rate ?? "")}
                    onChange={(e) => setRateInputs((r) => ({ ...r, [item.id]: e.target.value }))}
                    className="h-10 flex-1"
                  />
                  <Button size="sm" onClick={() => saveDailyRate(item)} disabled={saving === item.id}>
                    {saving === item.id ? "…" : "ذخیره"}
                  </Button>
                </div>

                {rate ? (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>ماهانه: {toPersianDigits(monthlyFromDaily(rate).toFixed(0))}</span>
                    <span>سالانه: {toPersianDigits(annualFromDaily(rate).toFixed(0))}</span>
                    <span className={remaining !== null && remaining <= 14 ? "font-semibold text-destructive" : ""}>
                      {remaining !== null ? `${toPersianDigits(remaining)} روز تا اتمام` : "—"}
                    </span>
                    {costPerAnimal !== null && (
                      <span>هزینه هر دام/روز: {toPersianDigits(costPerAnimal.toFixed(0))} تومان</span>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">نرخ مصرف روزانه ثبت نشده است.</p>
                )}
              </CardContent>
            </Card>
          );
        })}
        {inventory.length === 0 && (
          <p className="text-center text-muted-foreground">
            هنوز خوراکی ثبت نشده — از صفحه «مدیریت خوراک» یک قلم اضافه کنید.
          </p>
        )}
      </div>

      <RationCalculator activeAnimalCount={activeAnimalCount ?? 0} />
    </div>
  );
}
