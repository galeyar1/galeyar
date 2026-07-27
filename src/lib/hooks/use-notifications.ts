"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/lib/auth/auth-provider";
import { supabase } from "@/lib/supabase/client";
import type { NotificationRow } from "@/lib/supabase/types";

const LIST_LIMIT = 50;

export interface NotificationsInfo {
  notifications: NotificationRow[];
  unreadCount: number;
  loading: boolean;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => void;
}

/**
 * Online-only, same pattern as useFarmPlan() — notifications are inherently
 * transient/server-driven, so there's no offline cache to fall back to.
 * Subscribes to postgres_changes on this farm's rows (migration 0032 added
 * `notifications` to the supabase_realtime publication) so admin/AI-created
 * notifications appear without a manual refresh.
 */
export function useNotifications(): NotificationsInfo {
  const { profile } = useAuth();
  const farmId = profile?.farm_id;
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  const load = useCallback(async () => {
    if (!farmId) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("farm_id", farmId)
      .order("created_at", { ascending: false })
      .limit(LIST_LIMIT);
    setNotifications((data ?? []) as NotificationRow[]);
    setLoading(false);
  }, [farmId]);

  useEffect(() => {
    void load();
  }, [load, nonce]);

  useEffect(() => {
    if (!farmId) return;
    const channel = supabase
      .channel(`notifications:${farmId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `farm_id=eq.${farmId}` },
        () => void load()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [farmId, load]);

  async function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  }

  async function markAllRead() {
    if (!farmId) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await supabase.from("notifications").update({ is_read: true }).eq("farm_id", farmId).eq("is_read", false);
  }

  return {
    notifications,
    unreadCount: notifications.filter((n) => !n.is_read).length,
    loading,
    markRead,
    markAllRead,
    refresh: () => setNonce((n) => n + 1),
  };
}
