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

  await localTable(table).put(record);
  await db.sync_queue.add({
    table,
    operation: "insert",
    recordId: id,
    payload: record,
    createdAt: Date.now(),
    retryCount: 0,
  });

  void triggerSync();
  return id;
}

export async function updateRecord(
  table: SyncableTable,
  id: string,
  patch: NewRecordInput
): Promise<void> {
  const changes = { ...patch, updated_at: new Date().toISOString(), sync_status: "pending" as const };
  await localTable(table).update(id, changes);
  const updated = await localTable(table).get(id);
  if (!updated) return;

  await db.sync_queue.add({
    table,
    operation: "update",
    recordId: id,
    payload: updated,
    createdAt: Date.now(),
    retryCount: 0,
  });

  void triggerSync();
}

/** Soft delete only — the operator role is blocked from this at the RLS layer too. */
export async function softDeleteRecord(table: SyncableTable, id: string): Promise<void> {
  await updateRecord(table, id, { deleted_at: new Date().toISOString() });
}
