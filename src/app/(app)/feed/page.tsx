"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Minus } from "lucide-react";

import { useAuth } from "@/lib/auth/auth-provider";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FEED_TYPE_LABELS, FEED_UNIT_LABELS } from "@/lib/feed-labels";
import { toPersianDigits } from "@/lib/jalali";
import type { FeedInventory, FeedType, FeedUnit } from "@/lib/supabase/types";

const FEED_TYPES = Object.keys(FEED_TYPE_LABELS) as FeedType[];
const FEED_UNITS = Object.keys(FEED_UNIT_LABELS) as FeedUnit[];

export default function FeedManagementPage() {
  const { profile } = useAuth();
  const farmId = profile?.farm_id;
  const isOwner = profile?.role === "owner";

  const [inventory, setInventory] = useState<FeedInventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState<Record<string, string>>({});

  const [newType, setNewType] = useState<FeedType>("hay");
  const [newQty, setNewQty] = useState("");
  const [newUnit, setNewUnit] = useState<FeedUnit>("kg");

  async function loadInventory() {
    if (!farmId) return;
    const { data } = await supabase.from("feed_inventory").select("*").eq("farm_id", farmId);
    setInventory(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void loadInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmId]);

  async function addStock(item: FeedInventory) {
    const delta = Number(amount[item.id] ?? 0);
    if (!delta) return;
    const { error } = await supabase
      .from("feed_inventory")
      .update({ quantity: item.quantity + delta })
      .eq("id", item.id);
    if (error) return toast.error("خطا در به‌روزرسانی موجودی");
    setAmount((a) => ({ ...a, [item.id]: "" }));
    toast.success("موجودی به‌روزرسانی شد");
    void loadInventory();
  }

  async function logConsumption(item: FeedInventory) {
    const delta = Number(amount[item.id] ?? 0);
    if (!delta || delta > item.quantity) return toast.error("مقدار مصرف نامعتبر است");

    const { error: consumptionError } = await supabase.from("feed_consumption_log").insert({
      farm_id: farmId,
      feed_type: item.feed_type,
      amount_used: delta,
      log_date: new Date().toISOString().slice(0, 10),
    });
    if (consumptionError) return toast.error("خطا در ثبت مصرف");

    await supabase.from("feed_inventory").update({ quantity: item.quantity - delta }).eq("id", item.id);
    setAmount((a) => ({ ...a, [item.id]: "" }));
    toast.success("مصرف ثبت شد");
    void loadInventory();
  }

  async function addNewFeedType() {
    if (!farmId || !newQty) return;
    const { error } = await supabase.from("feed_inventory").insert({
      farm_id: farmId,
      feed_type: newType,
      quantity: Number(newQty),
      unit: newUnit,
    });
    if (error) return toast.error("این نوع خوراک قبلاً ثبت شده یا خطایی رخ داد");
    setNewQty("");
    toast.success("خوراک جدید اضافه شد");
    void loadInventory();
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
                <span>{FEED_TYPE_LABELS[item.feed_type]}</span>
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
        {inventory.map((item) => (
          <li key={item.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold">{FEED_TYPE_LABELS[item.feed_type]}</span>
              <span className="text-lg">
                {toPersianDigits(item.quantity)} {FEED_UNIT_LABELS[item.unit]}
              </span>
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
        ))}
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
          <Button size="lg" className="h-12 text-lg" onClick={addNewFeedType} disabled={!newQty}>
            افزودن
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
