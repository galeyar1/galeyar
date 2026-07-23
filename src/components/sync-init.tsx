"use client";

import { useEffect } from "react";
import { initSyncListeners } from "@/lib/sync/init";

export function SyncInit() {
  useEffect(() => {
    initSyncListeners();
  }, []);

  return null;
}
