"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Briefcase,
  Wallet,
  Globe,
  BarChart3,
  Gauge,
  Dna,
  Sparkles,
  FileText,
  Bell,
  LifeBuoy,
  GraduationCap,
} from "lucide-react";

import { db } from "@/lib/db/schema";
import { useAuth } from "@/lib/auth/auth-provider";
import { Card, CardContent } from "@/components/ui/card";
import { toPersianDigits, todayIso } from "@/lib/jalali";
import { computeProfitLoss } from "@/lib/finance";

interface MenuItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export default function BusinessCenterPage() {
  const { profile } = useAuth();
  const farmId = profile?.farm_id;
  const isOwner = profile?.role === "owner";
  const today = todayIso();

  const monthProfit = useLiveQuery(async () => {
    if (!farmId) return null;
    const rows = await db.financial_transactions.where("farm_id").equals(farmId).toArray();
    const monthKey = today.slice(0, 7);
    const inMonth = rows.filter((r) => !r.deleted_at && r.transaction_date.slice(0, 7) === monthKey);
    return computeProfitLoss(inMonth);
  }, [farmId, today]);

  const openTicketCount = useLiveQuery(async () => {
    if (!farmId) return 0;
    const rows = await db.support_tickets.where("farm_id").equals(farmId).toArray();
    return rows.filter((r) => !r.deleted_at && (r.status === "open" || r.status === "in_progress")).length;
  }, [farmId]);

  const menu: MenuItem[] = [
    { href: "/business/finance", label: "هوش مالی", icon: Wallet },
    { href: "/business/global-dashboard", label: "داشبورد کل دامداری‌ها", icon: Globe },
    { href: "/business/analytics", label: "تحلیل کسب‌وکار", icon: BarChart3 },
    { href: "/business/performance", label: "عملکرد دامداری", icon: Gauge },
    { href: "/business/genetics", label: "ژنتیک پیشرفته", icon: Dna },
    { href: "/business/genetics-intelligence", label: "هوش ژنتیکی", icon: Sparkles },
    { href: "/business/reports", label: "گزارشات پیشرفته", icon: FileText },
    { href: "/business/notifications", label: "مرکز اعلان‌ها", icon: Bell },
    { href: "/business/support", label: "مرکز پشتیبانی", icon: LifeBuoy, badge: openTicketCount ? String(openTicketCount) : undefined },
    { href: "/business/education", label: "مرکز آموزش", icon: GraduationCap },
  ];

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Briefcase className="size-6 text-primary" />
        <h1 className="text-xl font-bold">هوش تجاری گله‌یار</h1>
      </div>

      {isOwner && monthProfit && (
        <Card>
          <CardContent className="grid grid-cols-3 gap-2 p-4 text-center">
            <div>
              <div className="text-lg font-bold text-success">{toPersianDigits(monthProfit.revenue.toLocaleString())}</div>
              <div className="text-xs text-muted-foreground">درآمد این ماه</div>
            </div>
            <div>
              <div className="text-lg font-bold text-destructive">{toPersianDigits(monthProfit.expenses.toLocaleString())}</div>
              <div className="text-xs text-muted-foreground">هزینه این ماه</div>
            </div>
            <div>
              <div className={`text-lg font-bold ${monthProfit.netProfit >= 0 ? "text-primary" : "text-destructive"}`}>
                {toPersianDigits(monthProfit.netProfit.toLocaleString())}
              </div>
              <div className="text-xs text-muted-foreground">سود خالص</div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        {menu.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="h-full transition-colors hover:border-primary">
              <CardContent className="flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between">
                  <item.icon className="size-6 text-primary" />
                  {item.badge && (
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-bold text-destructive">
                      {toPersianDigits(item.badge)}
                    </span>
                  )}
                </div>
                <span className="text-base font-semibold">{item.label}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
