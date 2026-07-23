import Dexie, { type Table } from "dexie";
import type {
  Animal,
  BirthRecord,
  DiseaseRecord,
  MilkRecord,
  SyncableTable,
  Treatment,
  UserProfile,
  Vaccination,
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
  /** `${table}:${farmId}` — pull position must be per-farm now that an owner can switch farms, otherwise switching to a farm last touched before another farm's last pull would silently skip its older rows. */
  key: string;
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
  vaccinations!: Table<Local<Vaccination>, string>;
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

    this.version(2)
      .stores({
        vaccinations: "id, farm_id, animal_id, next_due_date, sync_status, deleted_at",
        sync_meta: "key",
      })
      .upgrade(async (tx) => {
        // sync_meta's primary key changed shape (table -> `${table}:${farmId}`);
        // it's disposable pull-position cache, so just clear it — the next
        // sync does one full re-pull instead of carrying a mismatched key.
        await tx.table("sync_meta").clear();
      });
  }
}

export const db = new GaleyarDatabase();
