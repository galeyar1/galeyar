"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { db } from "@/lib/db/schema";

export interface SyncStatusInfo {
  pendingCount: number;
  errorCount: number;
  isOnline: boolean;
}

/** Reactive "N در انتظار همگام‌سازی" style indicator, backed by Dexie live queries. */
export function useSyncStatus(): SyncStatusInfo {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const pendingCount = useLiveQuery(() => db.sync_queue.count(), [], 0);
  const errorCount = useLiveQuery(
    () =>
      db.sync_queue.filter((item) => item.retryCount >= 5).count(),
    [],
    0
  );

  return { pendingCount: pendingCount ?? 0, errorCount: errorCount ?? 0, isOnline };
}
