"use client";

import { useLiveQuery } from "dexie-react-hooks";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

import { db } from "@/lib/db/schema";
import { useAuth } from "@/lib/auth/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toPersianDigits } from "@/lib/jalali";

const DISEASE_LABELS: Record<string, string> = {
  respiratory: "تنفسی",
  digestive: "گوارشی",
  fever: "تب",
  infectious: "عفونی",
  lameness: "لنگش",
  other: "سایر",
};

function lastNDays(n: number): string[] {
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export default function ReportsPage() {
  const { profile } = useAuth();
  const farmId = profile?.farm_id;

  const milkTrend = useLiveQuery(async () => {
    if (!farmId) return [];
    const days = lastNDays(14);
    const rows = await db.milk_records.where("farm_id").equals(farmId).toArray();
    const byDay = new Map<string, number>();
    for (const r of rows) {
      if (r.deleted_at) continue;
      const total = Number(r.morning_milk ?? 0) + Number(r.evening_milk ?? 0);
      byDay.set(r.record_date, (byDay.get(r.record_date) ?? 0) + total);
    }
    return days.map((d) => ({ day: d.slice(5), value: byDay.get(d) ?? 0 }));
  }, [farmId]);

  const weightTrend = useLiveQuery(async () => {
    if (!farmId) return [];
    const rows = await db.weight_records.where("farm_id").equals(farmId).toArray();
    const byMonth = new Map<string, { sum: number; count: number }>();
    for (const r of rows) {
      if (r.deleted_at) continue;
      const month = r.record_date.slice(0, 7);
      const entry = byMonth.get(month) ?? { sum: 0, count: 0 };
      entry.sum += Number(r.weight);
      entry.count += 1;
      byMonth.set(month, entry);
    }
    return [...byMonth.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([month, { sum, count }]) => ({ month: month.slice(5), value: Math.round(sum / count) }));
  }, [farmId]);

  const diseaseFrequency = useLiveQuery(async () => {
    if (!farmId) return [];
    const since = new Date();
    since.setDate(since.getDate() - 90);
    const sinceIso = since.toISOString().slice(0, 10);
    const rows = await db.disease_records.where("farm_id").equals(farmId).toArray();
    const counts = new Map<string, number>();
    for (const r of rows) {
      if (r.deleted_at || r.record_date < sinceIso) continue;
      counts.set(r.disease_type, (counts.get(r.disease_type) ?? 0) + 1);
    }
    return [...counts.entries()].map(([type, count]) => ({
      type: DISEASE_LABELS[type] ?? type,
      count,
    }));
  }, [farmId]);

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-bold">گزارش‌ها و تحلیل</h1>

      <Card>
        <CardHeader>
          <CardTitle>روند تولید شیر (۱۴ روز اخیر)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={milkTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip formatter={(v) => `${toPersianDigits(Number(v))} لیتر`} />
              <Line type="monotone" dataKey="value" stroke="#1B5E20" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>میانگین وزن ماهانه</CardTitle>
        </CardHeader>
        <CardContent>
          {weightTrend && weightTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={weightTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v) => `${toPersianDigits(Number(v))} کیلوگرم`} />
                <Line type="monotone" dataKey="value" stroke="#2E7D32" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted-foreground">داده کافی برای نمودار وجود ندارد.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>فراوانی بیماری (۹۰ روز اخیر)</CardTitle>
        </CardHeader>
        <CardContent>
          {diseaseFrequency && diseaseFrequency.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={diseaseFrequency}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#EF6C00" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted-foreground">موردی ثبت نشده است.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
