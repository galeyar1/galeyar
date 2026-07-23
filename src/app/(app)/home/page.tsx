"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus } from "lucide-react";

import { db } from "@/lib/db/schema";
import { useAuth } from "@/lib/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toPersianDigits } from "@/lib/jalali";

const RECORD_TABLES = ["milk_records", "weight_records", "disease_records", "birth_records", "treatments"] as const;

export default function OperatorHomePage() {
  const { profile, session } = useAuth();
  const farmId = profile?.farm_id;
  const userId = session?.user.id;

  const todayCount = useLiveQuery(async () => {
    if (!farmId || !userId) return 0;
    const today = new Date().toISOString().slice(0, 10);
    let count = 0;
    for (const table of RECORD_TABLES) {
      const rows = await db.table(table).where("farm_id").equals(farmId).toArray();
      count += rows.filter(
        (r) => !r.deleted_at && r.created_by === userId && r.created_at.slice(0, 10) === today
      ).length;
    }
    return count;
  }, [farmId, userId]);

  return (
    <div className="flex flex-col gap-6 p-4">
      <div>
        <h1 className="text-2xl font-bold">
          سلام{profile?.full_name ? ` ${profile.full_name}` : ""} 👋
        </h1>
        <p className="text-muted-foreground">امروز چه گزارشی ثبت می‌کنید؟</p>
      </div>

      <Card>
        <CardContent className="flex items-center justify-between p-5">
          <span className="text-base">گزارش‌های امروز شما</span>
          <span className="text-3xl font-bold text-primary">{toPersianDigits(todayCount ?? 0)}</span>
        </CardContent>
      </Card>

      <Button asChild size="lg" className="h-16 text-xl">
        <Link href="/register">
          <Plus className="size-6" />
          ثبت گزارش جدید
        </Link>
      </Button>
    </div>
  );
}
