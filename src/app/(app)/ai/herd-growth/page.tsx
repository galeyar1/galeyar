"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

import { db } from "@/lib/db/schema";
import { useAuth } from "@/lib/auth/auth-provider";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toPersianDigits } from "@/lib/jalali";
import {
  projectHerdGrowth,
  projectMilestones,
  DEFAULT_MORTALITY_RATES,
  MORTALITY_PRESET_LABELS,
  type MortalityPreset,
} from "@/lib/herd-growth";

const DEFAULT_TWIN_RATE = 1.3;

export default function HerdGrowthAssistantPage() {
  const { profile } = useAuth();
  const farmId = profile?.farm_id;

  const [twinRate, setTwinRate] = useState(String(DEFAULT_TWIN_RATE));
  const [mortalityPreset, setMortalityPreset] = useState<MortalityPreset>("average");
  const [saving, setSaving] = useState(false);

  const currentCount = useLiveQuery(async () => {
    if (!farmId) return 0;
    const rows = await db.animals.where("farm_id").equals(farmId).toArray();
    return rows.filter((a) => !a.deleted_at && a.status === "active").length;
  }, [farmId]);

  useEffect(() => {
    if (!farmId) return;
    supabase
      .from("farms")
      .select("twin_rate, mortality_rate")
      .eq("id", farmId)
      .single()
      .then(({ data }) => {
        if (data?.twin_rate) setTwinRate(String(data.twin_rate));
        if (data?.mortality_rate) {
          const preset = (Object.entries(DEFAULT_MORTALITY_RATES) as [MortalityPreset, number][]).find(
            ([, rate]) => rate === data.mortality_rate
          );
          setMortalityPreset(preset?.[0] ?? "average");
        }
      });
  }, [farmId]);

  const mortalityRate = DEFAULT_MORTALITY_RATES[mortalityPreset];

  const projections = useMemo(
    () => projectHerdGrowth(currentCount ?? 0, Number(twinRate) || 0, mortalityRate, 10),
    [currentCount, twinRate, mortalityRate]
  );
  const milestones = useMemo(
    () => projectMilestones(currentCount ?? 0, Number(twinRate) || 0, mortalityRate),
    [currentCount, twinRate, mortalityRate]
  );

  async function saveAssumptions() {
    if (!farmId) return;
    setSaving(true);
    const { error } = await supabase
      .from("farms")
      .update({ twin_rate: Number(twinRate) || null, mortality_rate: mortalityRate })
      .eq("id", farmId);
    setSaving(false);
    if (error) {
      toast.error(`ذخیره تنظیمات ناموفق بود: ${error.message}`);
      return;
    }
    toast.success("تنظیمات ذخیره شد");
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="size-6 text-primary" />
        <h1 className="text-xl font-bold">دستیار هوشمند رشد گله</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>فرضیات محاسبه</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between rounded-xl bg-muted p-3">
            <span className="text-muted-foreground">جمعیت فعلی</span>
            <span className="text-lg font-bold text-primary">{toPersianDigits(currentCount ?? 0)}</span>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm text-muted-foreground">نرخ دوقلوزایی (به ازای هر مادر در سال)</label>
            <Input type="number" inputMode="decimal" step="0.1" value={twinRate} onChange={(e) => setTwinRate(e.target.value)} className="h-11" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm text-muted-foreground">نرخ تلفات</label>
            <Select value={mortalityPreset} onValueChange={(v) => setMortalityPreset(v as MortalityPreset)}>
              <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(MORTALITY_PRESET_LABELS) as MortalityPreset[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {MORTALITY_PRESET_LABELS[p]} ({toPersianDigits(Math.round(DEFAULT_MORTALITY_RATES[p] * 100))}٪)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={saveAssumptions} disabled={saving} variant="outline">
            {saving ? "در حال ذخیره…" : "ذخیره به عنوان پیش‌فرض این مزرعه"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "سال ۱", value: milestones.year1 },
          { label: "سال ۲", value: milestones.year2 },
          { label: "سال ۳", value: milestones.year3 },
          { label: "سال ۵", value: milestones.year5 },
        ].map((m) => (
          <Card key={m.label}>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">{toPersianDigits(m.value)}</div>
              <div className="text-xs text-muted-foreground">پیش‌بینی {m.label}</div>
            </CardContent>
          </Card>
        ))}
        <Card className="col-span-2">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{toPersianDigits(milestones.year10)}</div>
            <div className="text-xs text-muted-foreground">پیش‌بینی ۱۰ ساله</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>روند رشد پیش‌بینی‌شده</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={projections}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" tickFormatter={(y) => `سال ${toPersianDigits(y)}`} fontSize={11} />
              <YAxis fontSize={11} allowDecimals={false} />
              <Tooltip formatter={(v) => toPersianDigits(Number(v))} labelFormatter={(y) => `سال ${toPersianDigits(Number(y))}`} />
              <Line type="monotone" dataKey="count" stroke="#1B5E20" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
