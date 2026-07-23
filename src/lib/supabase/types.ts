export type UserRole = "owner" | "operator" | "vet" | "consultant";
export type Species = "sheep" | "goat" | "cattle" | "camel";
export type AnimalStatus = "active" | "sold" | "dead";
export type DiseaseType =
  | "respiratory"
  | "digestive"
  | "fever"
  | "infectious"
  | "lameness"
  | "other";
export type FeedType = "hay" | "straw" | "flour" | "soybean" | "concentrate";
export type FeedUnit = "kg" | "ton" | "bag";
export type NotificationType = "feed_low" | "disease_alert" | "ai_suggestion" | "system";

export interface Farm {
  id: string;
  farm_name: string;
  province: string | null;
  city: string | null;
  created_at: string;
}

export interface UserProfile {
  id: string;
  full_name: string | null;
  phone_number: string;
  role: UserRole;
  farm_id: string | null;
  created_at: string;
}

export interface FarmInvite {
  id: string;
  farm_id: string;
  phone_number: string;
  role: UserRole;
  invited_by: string | null;
  created_at: string;
  accepted_at: string | null;
}

export interface Animal {
  id: string;
  farm_id: string;
  ear_tag: string;
  name: string | null;
  species: Species;
  animal_type: string | null;
  breed: string | null;
  gender: string | null;
  birth_date: string | null;
  father_id: string | null;
  mother_id: string | null;
  status: AnimalStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface MilkRecord {
  id: string;
  farm_id: string;
  animal_id: string;
  morning_milk: number | null;
  evening_milk: number | null;
  record_date: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface WeightRecord {
  id: string;
  farm_id: string;
  animal_id: string;
  weight: number;
  record_date: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DiseaseRecord {
  id: string;
  farm_id: string;
  animal_id: string;
  disease_type: DiseaseType;
  description: string | null;
  image_url: string | null;
  record_date: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface BirthRecord {
  id: string;
  farm_id: string;
  mother_id: string;
  father_id: string | null;
  offspring_count: number;
  gender: string | null;
  birth_date: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Treatment {
  id: string;
  farm_id: string;
  animal_id: string;
  medication: string;
  treatment_date: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface FeedInventory {
  id: string;
  farm_id: string;
  feed_type: FeedType;
  quantity: number;
  unit: FeedUnit;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeedConsumptionLog {
  id: string;
  farm_id: string;
  feed_type: FeedType;
  amount_used: number;
  log_date: string;
  created_by: string | null;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  farm_id: string;
  type: NotificationType;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface AiInsight {
  id: string;
  farm_id: string;
  insight_type: string;
  payload: unknown;
  generated_at: string;
  valid_until: string | null;
}

/** Tables that participate in offline sync (mirrored into IndexedDB). */
export type SyncableTable =
  | "animals"
  | "milk_records"
  | "weight_records"
  | "disease_records"
  | "birth_records"
  | "treatments";
