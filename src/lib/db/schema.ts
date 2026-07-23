import Dexie, { type Table } from "dexie";
import type {
  Animal,
  BirthRecord,
  DiseaseRecord,
  MilkRecord,
  SyncableTable,
  Treatment,
  UserProfile,
  WeightRecord,
} from "@/lib/supabase/types";

export type SyncStatus = "synced" | "pending" | "error";

/** A locally-stored record always carries its sync bookkeeping alongside the real columns. */
export type Local<T> = T & { sync_status: SyncStatus };

export type SyncOperation = "insert" | "update" | "delete";

export interface SyncQueueItem {
  id?: number;
  table: SyncableTable;
  operation: SyncOperation;
  recordId: string;
  payload: Record<string, unknown>;
  createdAt: number;
  retryCount: number;
  lastError?: string;
}

export interface SyncMeta {
  table: SyncableTable;
  lastPulledAt: string | null;
}

/** Single-row cache so a reopened-offline app still knows who's logged in and their role/farm. */
export interface CachedProfile extends UserProfile {
  cacheKey: "current";
}

class GaleyarDatabase extends Dexie {
  animals!: Table<Local<Animal>, string>;
  milk_records!: Table<Local<MilkRecord>, string>;
  weight_records!: Table<Local<WeightRecord>, string>;
  disease_records!: Table<Local<DiseaseRecord>, string>;
  birth_records!: Table<Local<BirthRecord>, string>;
  treatments!: Table<Local<Treatment>, string>;
  sync_queue!: Table<SyncQueueItem, number>;
  sync_meta!: Table<SyncMeta, string>;
  profile!: Table<CachedProfile, string>;

  constructor() {
    super("galeyar");

    this.version(1).stores({
      animals: "id, farm_id, ear_tag, species, sync_status, deleted_at",
      milk_records: "id, farm_id, animal_id, record_date, sync_status, deleted_at",
      weight_records: "id, farm_id, animal_id, record_date, sync_status, deleted_at",
      disease_records: "id, farm_id, animal_id, record_date, sync_status, deleted_at",
      birth_records: "id, farm_id, mother_id, birth_date, sync_status, deleted_at",
      treatments: "id, farm_id, animal_id, treatment_date, sync_status, deleted_at",
      sync_queue: "++id, table, recordId, createdAt",
      sync_meta: "table",
      profile: "cacheKey",
    });
  }
}

export const db = new GaleyarDatabase();
