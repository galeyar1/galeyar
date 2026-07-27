"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, Inbox, CheckCheck } from "lucide-react";

import { useNotifications } from "@/lib/hooks/use-notifications";
import { NOTIFICATION_TYPE_LABELS } from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatJalali, toPersianDigits } from "@/lib/jalali";
import type { NotificationRow } from "@/lib/supabase/types";

const SOURCE_LABELS: Record<NotificationRow["source"], string> = { admin: "مدیریت گله‌یار", ai: "هوش مصنوعی گله‌یار", system: "سیستم" };
const PRIORITY_DOT: Record<NotificationRow["priority"], string> = {
  low: "bg-muted-foreground/40",
  normal: "bg-primary",
  high: "bg-warning",
  urgent: "bg-destructive",
};

export function NotificationBell() {
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);

  async function handleOpenNotification(n: NotificationRow) {
    if (!n.is_read) void markRead(n.id);
  }

  return (
    <>
      <Button variant="ghost" size="icon" className="relative" onClick={() => setOpen(true)} aria-label="اعلان‌ها">
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <Badge className="absolute -top-1 -left-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-destructive-foreground">
            {toPersianDigits(unreadCount > 99 ? "۹۹+" : unreadCount)}
          </Badge>
        )}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex flex-col p-0">
          <SheetHeader className="flex-row items-center justify-between border-b border-border">
            <SheetTitle>اعلان‌ها</SheetTitle>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={() => void markAllRead()} className="text-xs">
                <CheckCheck className="size-3.5" /> همه را خوانده‌شده علامت بزن
              </Button>
            )}
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
            {loading && <p className="py-8 text-center text-sm text-muted-foreground">در حال بارگذاری…</p>}

            {!loading && notifications.length === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
                <Inbox className="size-10" />
                <p className="text-sm">اعلانی وجود ندارد.</p>
              </div>
            )}

            {!loading &&
              notifications.map((n) => {
                const body = (
                  <div
                    className={`flex flex-col gap-1 rounded-xl border p-3 text-start transition-colors ${
                      n.is_read ? "border-border bg-transparent" : "border-primary/30 bg-primary/5"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`size-2 shrink-0 rounded-full ${PRIORITY_DOT[n.priority]}`} />
                        <span className="text-sm font-semibold">{n.title ?? NOTIFICATION_TYPE_LABELS[n.type]}</span>
                      </div>
                      {!n.is_read && <span className="size-2 shrink-0 rounded-full bg-primary" />}
                    </div>
                    <p className="text-sm text-muted-foreground">{n.message}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{SOURCE_LABELS[n.source]} · {NOTIFICATION_TYPE_LABELS[n.type]}</span>
                      <span>{formatJalali(n.created_at.slice(0, 10))}</span>
                    </div>
                  </div>
                );

                return n.target_url ? (
                  <Link key={n.id} href={n.target_url} onClick={() => { void handleOpenNotification(n); setOpen(false); }}>
                    {body}
                  </Link>
                ) : (
                  <button key={n.id} type="button" className="text-start" onClick={() => void handleOpenNotification(n)}>
                    {body}
                  </button>
                );
              })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
