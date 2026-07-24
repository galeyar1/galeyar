export type UserRole = "owner" | "operator" | "vet" | "consultant";
export type Species = "sheep" | "goat" | "cattle" | "camel" | "horse";
export type AnimalStatus = "active" | "sold" | "dead";
export type DiseaseType =
  | "respiratory"
  | "digestive"
  | "fever"
  | "infectious"
  | "lameness"
  | "other";
export type FeedType =
  | "hay"
  | "straw"
  | "flour"
  | "soybean"
  | "concentrate"
  | "barley"
  | "corn"
  | "wheat_bran"
  | "salt"
  | "mineral_supplements"
  | "custom";
export type FeedUnit = "kg" | "ton" | "bag";
export type NotificationType = "feed_low" | "disease_alert" | "ai_suggestion" | "system";
export type DewormingType = "internal" | "external";
export type FinancialTransactionType = "income" | "expense";
export type IncomeCategory = "animal_sale" | "milk_sale" | "wool_sale" | "breeding_service" | "other";
export type ExpenseCategory =
  | "feed"
  | "veterinary"
  | "vaccines"
  | "transportation"
  | "salaries"
  | "utilities"
  | "equipment"
  | "other";
export type SupportTicketCategory = "chat" | "technical" | "veterinary" | "nutrition" | "callback";
export type SupportTicketPriority = "low" | "normal" | "high" | "urgent";
export type SupportTicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type ExitReason =
  | "sale"
  | "slaughterhouse"
  | "disease_death"
  | "accident"
  | "genetic_removal"
  | "old_age"
  | "infertility"
  | "abortion"
  | "missing"
  | "donation"
  | "other";

export interface Farm {
  id: string;
  farm_name: string;
  province: string | null;
  city: string | null;
  /** Herd-growth assumption overrides (src/lib/herd-growth.ts) — null uses the species/breed default. */
  twin_rate: number | null;
  mortality_rate: number | null;
  created_at: string;
}

export interface UserProfile {
  id: string;
  full_name: string | null;
  phone_number: string | null;
  email: string | null;
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
  /** Set only for animals auto-created from a birth record, e.g. "SH-125-05-M1". */
  generated_id: string | null;
  species_code: string | null;
  birth_year: string | null;
  offspring_number: number | null;
  gender_code: string | null;
  /** Pregnancy Assistant (src/lib/pregnancy.ts). */
  is_pregnant: boolean;
  pregnancy_month: number | null;
  expected_birth_date: string | null;
  /** Set when status leaves "active" — src/lib/exit-reasons.ts. */
  exit_reason: string | null;
  /** Genetic Intelligence (src/lib/genetics-prediction.ts). */
  predicted_genetics: string | null;
  confirmed_genetics: string | null;
  genetics_source: string | null;
  genetic_score: number | null;
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
  /** °C, optional — src/lib/disease-alerts.ts fever thresholds. */
  body_temperature: number | null;
  quarantine_until: string | null;
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
  male_offspring_count: number;
  female_offspring_count: number;
  birth_date: string;
  notes: string | null;
  /** The auto-generated IDs assigned to this birth event's offspring, e.g. ["SH-125-05-M1", "SH-125-05-F1"]. */
  offspring_generated_ids: string[] | null;
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
  custom_label: string | null;
  quantity: number;
  unit: FeedUnit;
  unit_cost: number | null;
  /** Set once by the farmer instead of logging consumption daily — src/lib/feed-forecast.ts. */
  daily_rate: number | null;
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

export interface FarmMember {
  id: string;
  farm_id: string;
  user_id: string;
  created_at: string;
}

export interface AnimalImage {
  id: string;
  farm_id: string;
  animal_id: string;
  image_url: string;
  created_by: string | null;
  created_at: string;
}

export interface Vaccination {
  id: string;
  farm_id: string;
  animal_id: string;
  vaccine_name: string;
  date_given: string;
  next_due_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Deworming {
  id: string;
  farm_id: string;
  animal_id: string;
  deworming_type: DewormingType;
  product_name: string;
  date_given: string;
  next_due_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface FinancialTransaction {
  id: string;
  farm_id: string;
  type: FinancialTransactionType;
  category: string;
  amount: number;
  transaction_date: string;
  description: string | null;
  /** Counterparty name — who owes the farm (unsettled income) or is owed by it (unsettled expense). */
  party_name: string | null;
  due_date: string | null;
  is_settled: boolean;
  animal_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface SupportTicket {
  id: string;
  farm_id: string;
  title: string;
  description: string;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  attachment_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface SupportTicketMessage {
  id: string;
  ticket_id: string;
  farm_id: string;
  sender_id: string | null;
  message: string;
  created_at: string;
}

export interface GeneticTest {
  id: string;
  farm_id: string;
  animal_id: string;
  laboratory_name: string;
  test_date: string;
  result: string;
  attachment_url: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface GeneticsHistoryEntry {
  id: string;
  farm_id: string;
  animal_id: string;
  previous_confirmed: string | null;
  new_confirmed: string;
  source: string;
  changed_by: string | null;
  changed_at: string;
}

export type PedigreeRelationType = "father" | "mother";

export interface PedigreeRelation {
  id: string;
  farm_id: string;
  animal_id: string;
  relation_type: PedigreeRelationType;
  external_name: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

/** Tables that participate in offline sync (mirrored into IndexedDB). */
export type SyncableTable =
  | "animals"
  | "milk_records"
  | "weight_records"
  | "disease_records"
  | "birth_records"
  | "treatments"
  | "vaccinations"
  | "deworming_records"
  | "financial_transactions"
  | "support_tickets"
  | "genetic_tests";
