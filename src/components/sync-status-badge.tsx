"use client";

import { WifiOff, RefreshCw, CheckCircle2, CloudUpload } from "lucide-react";
import { useSyncStatus } from "@/lib/sync/use-sync-status";
import { toPersianDigits } from "@/lib/jalali";
import { cn } from "@/lib/utils";

/** Online / Offline / Syncing / Sync Complete indicator for the top app bar. */
export function SyncStatusBadge({ className }: { className?: string }) {
  const { isOnline, phase, pendingCount } = useSyncStatus();

  if (!isOnline) {
    return (
      <span className={cn("flex items-center gap-1 text-xs text-muted-foreground", className)}>
        <WifiOff className="size-3.5" />
        آفلاین
        {pendingCount > 0 && ` (${toPersianDigits(pendingCount)} در صف)`}
      </span>
    );
  }

  if (phase === "syncing") {
    return (
      <span className={cn("flex items-center gap-1 text-xs text-primary", className)}>
        <RefreshCw className="size-3.5 animate-spin" />
        در حال همگام‌سازی…
      </span>
    );
  }

  if (phase === "complete") {
    return (
      <span className={cn("flex items-center gap-1 text-xs text-success", className)}>
        <CheckCircle2 className="size-3.5" />
        همگام‌سازی کامل شد
      </span>
    );
  }

  if (pendingCount > 0) {
    return (
      <span className={cn("flex items-center gap-1 text-xs text-warning", className)}>
        <CloudUpload className="size-3.5" />
        {toPersianDigits(pendingCount)} در انتظار ارسال
      </span>
    );
  }

  return null;
}
