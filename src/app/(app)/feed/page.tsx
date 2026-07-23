"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Minus, Pencil, Wheat } from "lucide-react";

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
import { toPersianDigits } from "@/lib/jalali";
import type { FeedInventory, FeedConsumptionLog, FeedType, FeedUnit } from "@/lib/supabase/types";

const FEED_TYPES = Object.keys(FEED_TYPE_LABELS) as FeedType[];
const FEED_UNITS = Object.keys(FEED_UNIT_LABELS) as FeedUnit[];
const CONSUMPTION_WINDOW_DAYS = 30;

interface EditState {
  id: string;
  quantity: string;
  unit: FeedUnit;
  unitCost: string;
  customLabel: string;
}

export default function FeedManagementPage() {
  const { profile } = useAuth();
  const farmId = profile?.farm_id;
  const isOwner = profile?.role === "owner";

  const [inventory, setInventory] = useState<FeedInventory[]>([]);
  const [consumption, setConsumption] = useState<FeedConsumptionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<EditState | null>(null);

  const [newType, setNewType] = useState<FeedType>("hay");
  const [newCustomLabel, setNewCustomLabel] = useState("");
  const [newQty, setNewQty] = useState("");
  const [newUnit, setNewUnit] = useState<FeedUnit>("kg");
  const [newCost, setNewCost] = useState("");

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

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmId]);

  function monthlyConsumption(feedType: FeedType): number {
    return consumption
      .filter((c) => c.feed_type === feedType)
      .reduce((sum, c) => sum + Number(c.amount_used), 0);
  }

  function daysRemaining(item: FeedInventory): number | null {
    const monthly = monthlyConsumption(item.feed_type);
    const dailyAvg = monthly / CONSUMPTION_WINDOW_DAYS;
    return dailyAvg > 0 ? Math.floor(Number(item.quantity) / dailyAvg) : null;
  }

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
        <h1 className="text-xl font-bold">مدیریت خوراک</h1>
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
      <h1 className="text-xl font-bold">مدیریت خوراک</h1>

      <ul className="flex flex-col gap-3">
        {inventory.map((item) => {
          const remaining = daysRemaining(item);
          const monthly = monthlyConsumption(item.feed_type);
          const totalValue = item.unit_cost ? item.quantity * item.unit_cost : null;
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

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>مصرف ماهانه: {toPersianDigits(monthly.toFixed(1))} {FEED_UNIT_LABELS[item.unit]}</span>
                <span className={remaining !== null && remaining <= 14 ? "text-destructive" : ""}>
                  {remaining !== null ? `${toPersianDigits(remaining)} روز تا اتمام` : "پیش‌بینی: داده کافی نیست"}
                </span>
                {totalValue !== null && <span>ارزش موجودی: {toPersianDigits(totalValue.toLocaleString())} تومان</span>}
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
