"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { Plus, Minus, Pencil, Wheat, AlertTriangle } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

import { db } from "@/lib/db/schema";
import { useAuth } from "@/lib/auth/auth-provider";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DeleteIconButton } from "@/components/confirm-dialog";
import { FEED_TYPE_LABELS, FEED_UNIT_LABELS, feedLabel } from "@/lib/feed-labels";
import { toPersianDigits, todayIso } from "@/lib/jalali";
import {
  monthlyFromDaily,
  annualFromDaily,
  daysRemaining as dailyRateDaysRemaining,
  costPerAnimalPerDay,
} from "@/lib/feed-forecast";
import { feedCostTrend, previousMonthKey } from "@/lib/feed-alerts";
import { RATION_TEMPLATES, suggestedDailyConsumption, type RationTemplateId, type Season, type RationAmounts } from "@/lib/ration-templates";
import type { FeedInventory, FeedConsumptionLog, FeedType, FeedUnit } from "@/lib/supabase/types";

const FEED_TYPES = Object.keys(FEED_TYPE_LABELS) as FeedType[];
const FEED_UNITS = Object.keys(FEED_UNIT_LABELS) as FeedUnit[];
const CONSUMPTION_WINDOW_DAYS = 30;
const PORTFOLIO_COLORS = ["#1B5E20", "#66BB6A", "#EF6C00", "#8D6E63", "#5D4037", "#A5D6A7", "#78909C"];

interface EditState {
  id: string;
  quantity: string;
  unit: FeedUnit;
  unitCost: string;
  customLabel: string;
}

/**
 * Quantity/percentage per feed type. Note: percentage mixes units
 * (kg/ton/bag) as raw numbers — meaningful when a farm keeps one unit per
 * type consistently, approximate otherwise. No unit-conversion table exists
 * to normalize this properly.
 */
function FeedPortfolioChart({ inventory }: { inventory: FeedInventory[] }) {
  const data = useMemo(() => {
    const total = inventory.reduce((sum, i) => sum + Number(i.quantity), 0);
    return inventory.map((item, index) => ({
      name: feedLabel(item),
      value: Number(item.quantity),
      unit: FEED_UNIT_LABELS[item.unit],
      percent: total > 0 ? (Number(item.quantity) / total) * 100 : 0,
      color: PORTFOLIO_COLORS[index % PORTFOLIO_COLORS.length],
    }));
  }, [inventory]);

  if (data.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>پرتفوی خوراک</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <ResponsiveContainer width="100%" height={180} className="sm:max-w-[180px]">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip formatter={(v, _n, item) => `${toPersianDigits(Number(v))} ${item.payload.unit}`} />
          </PieChart>
        </ResponsiveContainer>
        <ul className="flex flex-1 flex-col gap-1.5 text-sm">
          {data.map((d) => (
            <li key={d.name} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                {d.name}
              </span>
              <span className="text-muted-foreground">
                {toPersianDigits(d.value)} {d.unit} · {toPersianDigits(d.percent.toFixed(0))}٪
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

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
        <CardTitle>جیره‌های پیشنهادی</CardTitle>
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
            <label className="text-xs text-muted-foreground">فصل (جیره تابستان / زمستان)</label>
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

export default function FeedManagementPage() {
  const { profile } = useAuth();
  const farmId = profile?.farm_id;
  const isOwner = profile?.role === "owner";
  const today = todayIso();

  const [inventory, setInventory] = useState<FeedInventory[]>([]);
  const [consumption, setConsumption] = useState<FeedConsumptionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<EditState | null>(null);
  const [rateInputs, setRateInputs] = useState<Record<string, string>>({});
  const [savingRate, setSavingRate] = useState<string | null>(null);
  const [trendLogs, setTrendLogs] = useState<FeedConsumptionLog[]>([]);

  const [newType, setNewType] = useState<FeedType>("hay");
  const [newCustomLabel, setNewCustomLabel] = useState("");
  const [newQty, setNewQty] = useState("");
  const [newUnit, setNewUnit] = useState<FeedUnit>("kg");
  const [newCost, setNewCost] = useState("");

  const activeAnimalCount = useLiveQuery(async () => {
    if (!farmId) return 0;
    const rows = await db.animals.where("farm_id").equals(farmId).toArray();
    return rows.filter((a) => !a.deleted_at && a.status === "active").length;
  }, [farmId]);

  async function loadData() {
    if (!farmId) return;
    const since = new Date();
    since.setDate(since.getDate() - CONSUMPTION_WINDOW_DAYS);

    const [{ data: inv }, { data: cons }] = await Promise.all([
      supabase.from("feed_inventory").select("*").eq("farm_id", farmId),
      supabase
        .from("feed_consumption_log")
        .select("*")
        .eq("farm_id", farmId)
        .gte("log_date", since.toISOString().slice(0, 10)),
    ]);
    setInventory(inv ?? []);
    setConsumption(cons ?? []);
    setLoading(false);
  }

  async function loadTrendLogs() {
    if (!farmId) return;
    // Covers the current and previous calendar month, for the cost-trend
    // report card below — separate from the 30-day rolling window above so
    // that fixed range isn't disturbed (per-item cards depend on it).
    const currentMonthKey = today.slice(0, 7);
    const sinceMonth = previousMonthKey(currentMonthKey);
    const since = `${sinceMonth}-01`;
    const { data } = await supabase
      .from("feed_consumption_log")
      .select("*")
      .eq("farm_id", farmId)
      .gte("log_date", since);
    setTrendLogs(data ?? []);
  }

  useEffect(() => {
    void loadData();
    void loadTrendLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmId]);

  function monthlyConsumption(feedType: FeedType): number {
    return consumption
      .filter((c) => c.feed_type === feedType)
      .reduce((sum, c) => sum + Number(c.amount_used), 0);
  }

  /** Prefers the precise daily-rate projection when set; falls back to the trailing-30-day log average otherwise. */
  function effectiveDaysRemaining(item: FeedInventory): number | null {
    if (item.daily_rate) return dailyRateDaysRemaining(item.quantity, item.daily_rate);
    const monthly = monthlyConsumption(item.feed_type);
    const dailyAvg = monthly / CONSUMPTION_WINDOW_DAYS;
    return dailyAvg > 0 ? Math.floor(Number(item.quantity) / dailyAvg) : null;
  }

  const costTrend = useMemo(() => {
    const currentMonthKey = today.slice(0, 7);
    const unitCostByType: Partial<Record<FeedType, number>> = {};
    for (const item of inventory) {
      if (item.unit_cost) unitCostByType[item.feed_type] = item.unit_cost;
    }
    return feedCostTrend(trendLogs, unitCostByType, currentMonthKey, previousMonthKey(currentMonthKey));
  }, [trendLogs, inventory, today]);

  const totalInventoryValue = useMemo(
    () => inventory.reduce((sum, i) => sum + (i.unit_cost ? Number(i.quantity) * i.unit_cost : 0), 0),
    [inventory]
  );

  const urgentItems = useMemo(
    () =>
      inventory
        .map((item) => ({ item, remaining: effectiveDaysRemaining(item) }))
        .filter((x): x is { item: FeedInventory; remaining: number } => x.remaining !== null && x.remaining <= 14)
        .sort((a, b) => a.remaining - b.remaining),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inventory, consumption]
  );

  async function addStock(item: FeedInventory) {
    const delta = Number(amount[item.id] ?? 0);
    if (!delta) return;
    const { error } = await supabase
      .from("feed_inventory")
      .update({ quantity: item.quantity + delta })
      .eq("id", item.id);
    if (error) { toast.error(`خطا در به‌روزرسانی موجودی: ${error.message}`); return; }
    setAmount((a) => ({ ...a, [item.id]: "" }));
    toast.success("موجودی به‌روزرسانی شد");
    void loadData();
  }

  async function logConsumption(item: FeedInventory) {
    const delta = Number(amount[item.id] ?? 0);
    if (!delta || delta > item.quantity) { toast.error("مقدار مصرف نامعتبر است"); return; }

    const { error: consumptionError } = await supabase.from("feed_consumption_log").insert({
      farm_id: farmId,
      feed_type: item.feed_type,
      amount_used: delta,
      log_date: new Date().toISOString().slice(0, 10),
    });
    if (consumptionError) { toast.error(`خطا در ثبت مصرف: ${consumptionError.message}`); return; }

    const { error: updateError } = await supabase
      .from("feed_inventory")
      .update({ quantity: item.quantity - delta })
      .eq("id", item.id);
    if (updateError) { toast.error(`خطا در به‌روزرسانی موجودی: ${updateError.message}`); return; }

    setAmount((a) => ({ ...a, [item.id]: "" }));
    toast.success("مصرف ثبت شد");
    void loadData();
    void loadTrendLogs();
  }

  async function saveDailyRate(item: FeedInventory) {
    const value = rateInputs[item.id];
    if (value === undefined) return;
    setSavingRate(item.id);
    const rate = value === "" ? null : Number(value);
    const { error } = await supabase.from("feed_inventory").update({ daily_rate: rate }).eq("id", item.id);
    setSavingRate(null);
    if (error) {
      toast.error(`ذخیره نرخ مصرف ناموفق بود: ${error.message}`);
      return;
    }
    toast.success("نرخ مصرف روزانه ذخیره شد");
    void loadData();
  }

  async function addNewFeedType() {
    if (!farmId || !newQty) return;
    const { error } = await supabase.from("feed_inventory").insert({
      farm_id: farmId,
      feed_type: newType,
      custom_label: newType === "custom" ? newCustomLabel || null : null,
      quantity: Number(newQty),
      unit: newUnit,
      unit_cost: newCost ? Number(newCost) : null,
    });
    if (error) { toast.error(`این نوع خوراک قبلاً ثبت شده یا خطایی رخ داد: ${error.message}`); return; }
    setNewQty("");
    setNewCost("");
    setNewCustomLabel("");
    toast.success("خوراک جدید اضافه شد");
    void loadData();
  }

  async function saveEdit() {
    if (!editing) return;
    const { error } = await supabase
      .from("feed_inventory")
      .update({
        quantity: Number(editing.quantity) || 0,
        unit: editing.unit,
        unit_cost: editing.unitCost ? Number(editing.unitCost) : null,
        custom_label: editing.customLabel || null,
      })
      .eq("id", editing.id);
    if (error) { toast.error(`ذخیره ناموفق بود: ${error.message}`); return; }
    toast.success("ذخیره شد");
    setEditing(null);
    void loadData();
  }

  async function deleteFeed(id: string) {
    const { error } = await supabase.from("feed_inventory").delete().eq("id", id);
    if (error) { toast.error(`حذف ناموفق بود: ${error.message}`); return; }
    toast.success("خوراک حذف شد");
    void loadData();
  }

  if (!isOwner) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <h1 className="text-xl font-bold">خوراک</h1>
        <FeedPortfolioChart inventory={inventory} />
        {loading ? null : inventory.length === 0 ? (
          <p className="text-center text-muted-foreground">موجودی خوراکی ثبت نشده است.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {inventory.map((item) => (
              <li key={item.id} className="flex justify-between rounded-xl border border-border bg-card p-3">
                <span>{feedLabel(item)}</span>
                <span>
                  {toPersianDigits(item.quantity)} {FEED_UNIT_LABELS[item.unit]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-bold">خوراک</h1>

      {urgentItems.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-4" /> پیش‌بینی مصرف
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5 text-sm">
            {urgentItems.map(({ item, remaining }) => (
              <p key={item.id}>
                {feedLabel(item)} تا {toPersianDigits(remaining)} روز دیگر تمام می‌شود.
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>گزارش خوراک</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex flex-col rounded-lg bg-muted p-2">
            <span className="text-xs text-muted-foreground">ارزش کل موجودی</span>
            <span className="font-semibold">{toPersianDigits(totalInventoryValue.toLocaleString())} تومان</span>
          </div>
          <div className="flex flex-col rounded-lg bg-muted p-2">
            <span className="text-xs text-muted-foreground">هزینه خوراک این ماه</span>
            <span className="font-semibold">
              {toPersianDigits(costTrend.currentTotal.toLocaleString())} تومان
              {costTrend.changePercent !== null && (
                <span className={costTrend.changePercent > 0 ? "text-destructive" : "text-success"}>
                  {" "}
                  ({costTrend.changePercent > 0 ? "+" : ""}
                  {toPersianDigits(costTrend.changePercent)}٪)
                </span>
              )}
            </span>
          </div>
        </CardContent>
      </Card>

      <FeedPortfolioChart inventory={inventory} />

      <ul className="flex flex-col gap-3">
        {inventory.map((item) => {
          const remaining = effectiveDaysRemaining(item);
          const monthly = item.daily_rate ? monthlyFromDaily(item.daily_rate) : monthlyConsumption(item.feed_type);
          const annual = item.daily_rate ? annualFromDaily(item.daily_rate) : monthly * 12;
          const totalValue = item.unit_cost ? item.quantity * item.unit_cost : null;
          const costPerAnimal = item.daily_rate
            ? costPerAnimalPerDay(item.daily_rate, item.unit_cost, activeAnimalCount ?? 0)
            : null;
          return (
            <li key={item.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Wheat className="size-4 text-primary" />
                  <span className="text-lg font-semibold">{feedLabel(item)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-lg">
                    {toPersianDigits(item.quantity)} {FEED_UNIT_LABELS[item.unit]}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="ویرایش"
                    onClick={() =>
                      setEditing({
                        id: item.id,
                        quantity: String(item.quantity),
                        unit: item.unit,
                        unitCost: item.unit_cost?.toString() ?? "",
                        customLabel: item.custom_label ?? "",
                      })
                    }
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <DeleteIconButton
                    title="حذف خوراک"
                    description={`آیا از حذف ${feedLabel(item)} مطمئن هستید؟`}
                    onDelete={() => deleteFeed(item.id)}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  placeholder="مصرف روزانه"
                  value={rateInputs[item.id] ?? (item.daily_rate ?? "")}
                  onChange={(e) => setRateInputs((r) => ({ ...r, [item.id]: e.target.value }))}
                  className="h-10 flex-1"
                />
                <Button size="sm" variant="secondary" onClick={() => saveDailyRate(item)} disabled={savingRate === item.id}>
                  {savingRate === item.id ? "…" : "ذخیره نرخ"}
                </Button>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>مصرف ماهانه: {toPersianDigits(monthly.toFixed(1))} {FEED_UNIT_LABELS[item.unit]}</span>
                <span>مصرف سالانه: {toPersianDigits(annual.toFixed(1))} {FEED_UNIT_LABELS[item.unit]}</span>
                <span className={remaining !== null && remaining <= 14 ? "text-destructive" : ""}>
                  {remaining !== null ? `${toPersianDigits(remaining)} روز تا اتمام` : "پیش‌بینی: داده کافی نیست"}
                </span>
                {totalValue !== null && <span>ارزش موجودی: {toPersianDigits(totalValue.toLocaleString())} تومان</span>}
                {costPerAnimal !== null && <span>هزینه هر دام/روز: {toPersianDigits(costPerAnimal.toFixed(0))} تومان</span>}
              </div>

              <div className="flex gap-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  placeholder="مقدار"
                  value={amount[item.id] ?? ""}
                  onChange={(e) => setAmount((a) => ({ ...a, [item.id]: e.target.value }))}
                  className="h-11 flex-1"
                />
                <Button size="icon" variant="secondary" onClick={() => addStock(item)} aria-label="افزودن موجودی">
                  <Plus className="size-5" />
                </Button>
                <Button size="icon" variant="secondary" onClick={() => logConsumption(item)} aria-label="ثبت مصرف">
                  <Minus className="size-5" />
                </Button>
              </div>
            </li>
          );
        })}
        {!loading && inventory.length === 0 && (
          <p className="text-center text-muted-foreground">هنوز خوراکی ثبت نشده است.</p>
        )}
      </ul>

      <Card>
        <CardHeader>
          <CardTitle>افزودن نوع خوراک جدید</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Select value={newType} onValueChange={(v) => setNewType(v as FeedType)}>
            <SelectTrigger className="h-12 w-full text-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FEED_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {FEED_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {newType === "custom" && (
            <Input
              placeholder="نام خوراک سفارشی"
              value={newCustomLabel}
              onChange={(e) => setNewCustomLabel(e.target.value)}
              className="h-12 text-lg"
            />
          )}

          <div className="flex gap-2">
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              placeholder="مقدار اولیه"
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              className="h-12 flex-1 text-lg"
            />
            <Select value={newUnit} onValueChange={(v) => setNewUnit(v as FeedUnit)}>
              <SelectTrigger className="h-12 w-28 text-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FEED_UNITS.map((u) => (
                  <SelectItem key={u} value={u}>
                    {FEED_UNIT_LABELS[u]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Input
            type="number"
            inputMode="decimal"
            min="0"
            placeholder="قیمت هر واحد (تومان، اختیاری)"
            value={newCost}
            onChange={(e) => setNewCost(e.target.value)}
            className="h-12 text-lg"
          />

          <Button size="lg" className="h-12 text-lg" onClick={addNewFeedType} disabled={!newQty}>
            افزودن
          </Button>
        </CardContent>
      </Card>

      <RationCalculator activeAnimalCount={activeAnimalCount ?? 0} />

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ویرایش خوراک</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  value={editing.quantity}
                  onChange={(e) => setEditing({ ...editing, quantity: e.target.value })}
                  className="h-11 flex-1"
                  placeholder="مقدار"
                />
                <Select value={editing.unit} onValueChange={(v) => setEditing({ ...editing, unit: v as FeedUnit })}>
                  <SelectTrigger className="h-11 w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FEED_UNITS.map((u) => (
                      <SelectItem key={u} value={u}>{FEED_UNIT_LABELS[u]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                type="number"
                inputMode="decimal"
                value={editing.unitCost}
                onChange={(e) => setEditing({ ...editing, unitCost: e.target.value })}
                placeholder="قیمت هر واحد (تومان)"
                className="h-11"
              />
              <Input
                value={editing.customLabel}
                onChange={(e) => setEditing({ ...editing, customLabel: e.target.value })}
                placeholder="نام سفارشی (فقط برای نوع «سایر»)"
                className="h-11"
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>انصراف</Button>
            <Button onClick={saveEdit}>ذخیره</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
