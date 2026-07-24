import { supabase } from "@/lib/supabase/client";
import { db, type SyncQueueItem } from "@/lib/db/schema";
import type { SyncableTable } from "@/lib/supabase/types";

const MAX_RETRIES = 5;
const SYNC_TABLES: SyncableTable[] = [
  "animals",
  "milk_records",
  "weight_records",
  "disease_records",
  "birth_records",
  "treatments",
  "vaccinations",
  "deworming_records",
];

let syncing = false;
let queuedRerun = false;

export type SyncPhase = "idle" | "syncing" | "complete";
type Listener = (phase: SyncPhase) => void;
const listeners = new Set<Listener>();

/** Tiny pub-sub so the UI can show Online/Offline/Syncing/Sync Complete without polling. */
export function onSyncPhaseChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emitPhase(phase: SyncPhase) {
  for (const listener of listeners) listener(phase);
}

async function currentFarmId(): Promise<string | null> {
  const profile = await db.profile.get("current");
  return profile?.farm_id ?? null;
}

/**
 * Runs a push-then-pull cycle. Safe to call as often as you like (online
 * event, tab focus, a periodic timer, right after a local write) — calls
 * that arrive while one is already in flight are coalesced into a single
 * extra run instead of overlapping.
 */
export async function triggerSync(): Promise<void> {
  if (typeof window === "undefined" || !navigator.onLine) return;

  if (syncing) {
    queuedRerun = true;
    return;
  }

  syncing = true;
  emitPhase("syncing");
  try {
    await pushQueue();
    await pullAll();
    emitPhase("complete");
    window.setTimeout(() => emitPhase("idle"), 2000);
  } catch (error) {
    console.error("galeyar sync: cycle failed", error);
    emitPhase("idle");
  } finally {
    syncing = false;
    if (queuedRerun) {
      queuedRerun = false;
      void triggerSync();
    }
  }
}

async function pushQueue() {
  const items = await db.sync_queue.orderBy("createdAt").toArray();

  for (const item of items) {
    try {
      await pushOne(item);
      await db.sync_queue.delete(item.id!);
      await db.table(item.table).update(item.recordId, { sync_status: "synced" });
    } catch (error) {
      const retryCount = item.retryCount + 1;
      await db.sync_queue.update(item.id!, {
        retryCount,
        lastError: error instanceof Error ? error.message : String(error),
      });
      if (retryCount >= MAX_RETRIES) {
        await db.table(item.table).update(item.recordId, { sync_status: "error" });
      }
      // Stop on first failure for this cycle — likely offline or a
      // systemic error (e.g. auth expired); retrying the rest immediately
      // would just fail the same way. The next triggerSync() picks up
      // where this left off.
      throw error;
    }
  }
}

async function pushOne(item: SyncQueueItem) {
  if (item.operation === "delete") {
    const { error } = await supabase.from(item.table).delete().eq("id", item.recordId);
    if (error) throw error;
    return;
  }

  const payload = { ...item.payload } as Record<string, unknown>;
  delete payload.sync_status;
  const { error } = await supabase.from(item.table).upsert(payload);
  if (error) throw error;
}

async function pullAll() {
  const farmId = await currentFarmId();
  if (!farmId) return;
  for (const table of SYNC_TABLES) {
    await pullTable(table, farmId);
  }
}

async function pullTable(table: SyncableTable, farmId: string) {
  // Keyed per-farm: an owner can switch farms, and each farm has its own
  // independent pull position. Using one global `since` per table would
  // mean switching to a farm last modified before another farm's last pull
  // silently skips that farm's older rows forever.
  const key = `${table}:${farmId}`;
  const meta = await db.sync_meta.get(key);
  const since = meta?.lastPulledAt ?? "1970-01-01T00:00:00.000Z";

  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("farm_id", farmId)
    .gt("updated_at", since)
    .order("updated_at", { ascending: true })
    .limit(500);

  if (error) throw error;
  if (!data || data.length === 0) return;

  await db.table(table).bulkPut(data.map((row) => ({ ...row, sync_status: "synced" as const })));

  const latest = data[data.length - 1] as { updated_at: string };
  await db.sync_meta.put({ key, lastPulledAt: latest.updated_at });
}
