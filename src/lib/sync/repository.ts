import { db, type Local } from "@/lib/db/schema";
import type { SyncableTable } from "@/lib/supabase/types";
import { triggerSync } from "@/lib/sync/engine";

/**
 * Every write in the app goes through here, never directly through
 * supabase-js. It writes to IndexedDB first (instant, works offline) and
 * enqueues the mutation for the sync engine to push when a connection is
 * available.
 */

function localTable(table: SyncableTable) {
  return db.table(table);
}

const LOCAL_WRITE_TIMEOUT_MS = 10_000;

/**
 * IndexedDB has no real "cancel" — but a hung transaction (a blocked schema
 * upgrade from another open tab, or WebKit's well-known bug where IndexedDB
 * simply never resolves in Safari private browsing) must not leave the
 * caller's loading state stuck forever. This bounds the wait and rejects
 * with a message safe to show directly to the user, so every form using
 * createRecord/updateRecord gets timeout protection for free.
 */
function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(
        () => reject(new Error(`ذخیره‌سازی محلی (${label}) بیش از حد طول کشید. لطفاً دوباره تلاش کنید.`)),
        LOCAL_WRITE_TIMEOUT_MS
      );
    }),
  ]);
}

type NewRecordInput = Record<string, unknown>;

export async function createRecord(
  table: SyncableTable,
  farmId: string,
  createdBy: string,
  data: NewRecordInput
): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const record: Local<NewRecordInput> = {
    ...data,
    id,
    farm_id: farmId,
    created_by: createdBy,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    sync_status: "pending",
  };

  await withTimeout(localTable(table).put(record), table);
  await withTimeout(
    db.sync_queue.add({
      table,
      operation: "insert",
      recordId: id,
      payload: record,
      createdAt: Date.now(),
      retryCount: 0,
    }),
    "sync_queue"
  );

  void triggerSync();
  return id;
}

export async function updateRecord(
  table: SyncableTable,
  id: string,
  patch: NewRecordInput
): Promise<void> {
  const changes = { ...patch, updated_at: new Date().toISOString(), sync_status: "pending" as const };
  await withTimeout(localTable(table).update(id, changes), table);
  const updated = await withTimeout(localTable(table).get(id), table);
  if (!updated) return;

  await withTimeout(
    db.sync_queue.add({
      table,
      operation: "update",
      recordId: id,
      payload: updated,
      createdAt: Date.now(),
      retryCount: 0,
    }),
    "sync_queue"
  );

  void triggerSync();
}

/** Soft delete only — the operator role is blocked from this at the RLS layer too. */
export async function softDeleteRecord(table: SyncableTable, id: string): Promise<void> {
  await updateRecord(table, id, { deleted_at: new Date().toISOString() });
}
