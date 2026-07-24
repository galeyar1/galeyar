"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Bell, Baby, Stethoscope, Syringe, Wheat, Wallet, LifeBuoy } from "lucide-react";

import { db } from "@/lib/db/schema";
import { useAuth } from "@/lib/auth/auth-provider";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { formatJalali, todayIso } from "@/lib/jalali";
import { daysUntilBirth, pregnancyStage } from "@/lib/pregnancy";
import { feverAlertLevel } from "@/lib/disease-alerts";
import { vaccinationDueStatus } from "@/lib/vaccination-alerts";
import { daysRemaining } from "@/lib/feed-forecast";
import { creditorTransactions, debtorTransactions } from "@/lib/finance";
import type { FeedInventory } from "@/lib/supabase/types";

interface NotificationItem {
  id: string;
  icon: typeof Bell;
  color: string;
  title: string;
  detail: string;
  href?: string;
  date: string;
}

export default function NotificationCenterPage() {
  const { profile } = useAuth();
  const farmId = profile?.farm_id;
  const today = todayIso();
  const [feedItems, setFeedItems] = useState<Pick<FeedInventory, "id" | "quantity" | "daily_rate" | "feed_type" | "custom_label">[]>([]);

  useEffect(() => {
    if (!farmId) return;
    supabase
      .from("feed_inventory")
      .select("id, quantity, daily_rate, feed_type, custom_label")
      .eq("farm_id", farmId)
      .then(({ data }) => setFeedItems(data ?? []));
  }, [farmId]);

  const items = useLiveQuery(async () => {
    if (!farmId) return [];
    const [animals, disease, vaccinations, txns, tickets] = await Promise.all([
      db.animals.where("farm_id").equals(farmId).toArray(),
      db.disease_records.where("farm_id").equals(farmId).toArray(),
      db.vaccinations.where("farm_id").equals(farmId).toArray(),
      db.financial_transactions.where("farm_id").equals(farmId).toArray(),
      db.support_tickets.where("farm_id").equals(farmId).toArray(),
    ]);
    const earTagOf = new Map(animals.map((a) => [a.id, a.ear_tag]));
    const result: NotificationItem[] = [];

    for (const a of animals) {
      if (a.deleted_at || !a.is_pregnant || !a.expected_birth_date) continue;
      const days = daysUntilBirth(a.expected_birth_date, today);
      if (pregnancyStage(days) === "near_birth" || pregnancyStage(days) === "overdue") {
        result.push({
          id: `pregnancy-${a.id}`,
          icon: Baby,
          color: "text-primary",
          title: `آبستنی — ${a.ear_tag}`,
          detail: pregnancyStage(days) === "overdue" ? "سررسید گذشته" : "نزدیک زایمان",
          href: `/animals/view?id=${a.id}`,
          date: a.expected_birth_date,
        });
      }
    }

    for (const d of disease) {
      if (d.deleted_at) continue;
      const fever = feverAlertLevel(d.body_temperature ?? null);
      if (fever) {
        result.push({
          id: `disease-${d.id}`,
          icon: Stethoscope,
          color: "text-destructive",
          title: `بیماری — ${earTagOf.get(d.animal_id) ?? "؟"}`,
          detail: fever === "emergency" ? "تب اورژانسی" : "تب بالا",
          href: `/animals/view?id=${d.animal_id}`,
          date: d.record_date,
        });
      }
    }

    for (const v of vaccinations) {
      if (v.deleted_at) continue;
      const status = vaccinationDueStatus(v.next_due_date, today);
      if (status === "overdue" || status === "upcoming") {
        result.push({
          id: `vaccination-${v.id}`,
          icon: Syringe,
          color: status === "overdue" ? "text-destructive" : "text-warning",
          title: `واکسیناسیون — ${earTagOf.get(v.animal_id) ?? "؟"}`,
          detail: `${v.vaccine_name} — ${status === "overdue" ? "سررسید گذشته" : "نزدیک سررسید"}`,
          href: `/animals/view?id=${v.animal_id}`,
          date: v.next_due_date ?? today,
        });
      }
    }

    for (const item of feedItems) {
      const remaining = daysRemaining(item.quantity, item.daily_rate);
      if (remaining !== null && remaining <= 14) {
        result.push({
          id: `feed-${item.id}`,
          icon: Wheat,
          color: "text-warning",
          title: `خوراک — ${item.custom_label || item.feed_type}`,
          detail: `${remaining} روز تا اتمام`,
          href: "/business/finance",
          date: today,
        });
      }
    }

    const liveTxns = txns.filter((t) => !t.deleted_at);
    const debtors = debtorTransactions(liveTxns);
    const creditors = creditorTransactions(liveTxns);
    if (debtors.length > 0) {
      result.push({
        id: "finance-debtors",
        icon: Wallet,
        color: "text-warning",
        title: "مالی — بدهکاران",
        detail: `${debtors.length} تراکنش تسویه‌نشده`,
        href: "/business/finance",
        date: today,
      });
    }
    if (creditors.length > 0) {
      result.push({
        id: "finance-creditors",
        icon: Wallet,
        color: "text-destructive",
        title: "مالی — بستانکاران",
        detail: `${creditors.length} تراکنش تسویه‌نشده`,
        href: "/business/finance",
        date: today,
      });
    }

    const openTickets = tickets.filter((t) => !t.deleted_at && (t.status === "open" || t.status === "in_progress"));
    if (openTickets.length > 0) {
      result.push({
        id: "support-open",
        icon: LifeBuoy,
        color: "text-primary",
        title: "پشتیبانی",
        detail: `${openTickets.length} تیکت باز`,
        href: "/business/support",
        date: today,
      });
    }

    return result.sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [farmId, today, feedItems]);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Bell className="size-6 text-primary" />
        <h1 className="text-xl font-bold">مرکز اعلان‌ها</h1>
      </div>

      <div className="flex flex-col gap-2">
        {(items ?? []).length === 0 && (
          <p className="mt-10 text-center text-muted-foreground">اعلان فعالی وجود ندارد.</p>
        )}
        {(items ?? []).map((n) => {
          const content = (
            <Card key={n.id}>
              <CardContent className="flex items-center gap-3 p-3">
                <n.icon className={`size-5 shrink-0 ${n.color}`} />
                <div className="flex flex-1 flex-col">
                  <span className="font-semibold">{n.title}</span>
                  <span className="text-xs text-muted-foreground">{n.detail}</span>
                </div>
                <span className="text-xs text-muted-foreground">{formatJalali(n.date)}</span>
              </CardContent>
            </Card>
          );
          return n.href ? (
            <Link key={n.id} href={n.href}>
              {content}
            </Link>
          ) : (
            content
          );
        })}
      </div>
    </div>
  );
}
