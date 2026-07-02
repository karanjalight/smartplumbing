/**
 * Hand-written Database types for `supabase/migrations/0001_init.sql`.
 *
 * Regenerate when the schema changes:
 *
 *   npx supabase gen types typescript --project-id <id> --schema public > lib/supabase/types.ts
 *
 * The shape below mirrors the SQL tables and enums one-to-one. Views are
 * included as read-only rows.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ---------- Enums --------------------------------------------------------

export type UserRole = "admin" | "landlord" | "tenant" | "staff";
export type AccountStatus =
  | "active"
  | "pending_verification"
  | "suspended"
  | "inactive";
export type TenantBillingModel = "prepaid_sts" | "postpaid";
export type TenantStatus = "active" | "low_credit" | "inactive" | "overdue";
export type PayoutSchedule = "monthly" | "biweekly";
export type PayoutRail = "m_pesa_b2b" | "bank_transfer";
export type RentModel = "per_unit" | "whole_building";
export type RecurringBillFrequency = "monthly" | "quarterly" | "yearly";
export type MeterLifecycle = "active" | "inactive" | "fault" | "maintenance";
export type MeterConnectivity =
  | "online"
  | "offline"
  | "intermittent"
  | "unknown";
export type MeterModelType =
  | "water_prepay_m3"
  | "water_prepay_currency"
  | "postpay";
export type PaymentMethod = "M-Pesa" | "Bank" | "Cash" | "STS credit" | "Card";
export type PaymentCategory = "rent" | "tokens" | "service" | "shop";
export type PaymentStatus =
  | "pending"
  | "completed"
  | "failed"
  | "refunded"
  | "cancelled";
export type TokenSource = "app" | "m_pesa" | "manual";
export type ManualTokenChannel = "office" | "call_center" | "field";
export type StaffStatus = "active" | "on_leave" | "inactive";
export type StaffServes = "tenants" | "landlords" | "both";
export type StaffSkill =
  | "plumbing"
  | "electrical"
  | "hvac"
  | "general_maintenance"
  | "meter_support";
export type ServiceUrgency = "low" | "standard" | "urgent";
export type ServiceRequestStatus =
  | "submitted"
  | "acknowledged"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled";
export type AppointmentStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";
export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";
export type NotificationCategory =
  | "meter"
  | "tenant"
  | "payment"
  | "leak"
  | "system"
  | "order"
  | "service"
  | "token"
  | "payout";
export type NotificationSeverity = "critical" | "warning" | "info";

// ---------- Row helpers ---------------------------------------------------

type Timestamps = { created_at: string; updated_at: string };

export type ProfileRow = Timestamps & {
  id: string;
  role: UserRole;
  full_name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  status: AccountStatus;
}

export type LandlordRow = Timestamps & {
  id: string;
  profile_id: string | null;
  code: string | null;
  full_name: string;
  company: string;
  phone: string | null;
  email: string | null;
  region: string | null;
  account_opened: string | null;
  payout_schedule: PayoutSchedule;
  payout_rail: PayoutRail;
  mpesa_till_label: string | null;
  bank_account_label: string | null;
  monthly_collection_kes: number;
  open_alerts_count: number;
  last_payout_at: string | null;
  next_payout_at: string | null;
  status: AccountStatus;
}

export type BuildingRow = Timestamps & {
  id: string;
  code: string | null;
  landlord_id: string;
  name: string;
  address_line: string | null;
  city: string | null;
  region: string | null;
  caretaker_name: string | null;
  caretaker_phone: string | null;
  house_count: number;
  meter_count: number;
  rent_model: RentModel;
  rent_kes: number;
  /** Optional management/platform cut (% of building income). */
  management_fee_pct: number | null;
  notes: string | null;
}

export type BuildingRecurringBillRow = Timestamps & {
  id: string;
  building_id: string;
  label: string;
  amount_kes: number;
  frequency: RecurringBillFrequency;
  is_active: boolean;
  notes: string | null;
};

export type UnitType =
  | "bedsitter"
  | "studio"
  | "one_bedroom"
  | "two_bedroom"
  | "three_bedroom"
  | "four_bedroom"
  | "five_bedroom"
  | "six_bedroom"
  | "seven_bedroom"
  | "eight_bedroom"
  | "commercial"
  | "office"
  | "shop"
  | "warehouse"
  | "parking"
  | "other";

export type UnitRow = Timestamps & {
  id: string;
  code: string | null;
  building_id: string;
  label: string;
  description: string | null;
  rent_kes: number | null;
  is_vacant: boolean;
  unit_type: UnitType | null;
}

export type UnitImageRow = {
  id: string;
  unit_id: string;
  path: string;
  sort_order: number;
  created_at: string;
}

export type WaterPricingRow = Timestamps & {
  id: string;
  building_id: string;
  price_per_unit_kes: number;
  unit_definition: string;
  standing_charge_kes: number;
  min_charge_kes: number;
  vat_rate_pct: number;
  notes: string | null;
  effective_from: string;
  effective_to: string | null;
}

export type MeterRow = Timestamps & {
  id: string;
  meter_no: string;
  serial_number: string | null;
  /** Vendor / manufacturer name (admin onboarding). */
  supplier: string | null;
  model_type: MeterModelType;
  lifecycle_status: MeterLifecycle;
  connectivity_status: MeterConnectivity;
  landlord_id: string | null;
  building_id: string | null;
  unit_id: string | null;
  sts_sgc: number | null;
  sts_ti: number | null;
  installed_on: string | null;
  latest_reading_m3: number | null;
  last_sync_at: string | null;
  open_alerts: number;
  notes: string | null;
}

export type TenantRow = Timestamps & {
  id: string;
  code: string | null;
  profile_id: string | null;
  landlord_id: string;
  building_id: string | null;
  unit_id: string | null;
  meter_id: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  address_line: string | null;
  city: string | null;
  region: string | null;
  billing_model: TenantBillingModel;
  status: TenantStatus;
  balance_kes: number;
  last_token_at: string | null;
  last_token_preview: string | null;
  account_opened: string | null;
  lease_end_date: string | null;
  lease_notes: string | null;
  national_id: string | null;
  kra_pin: string | null;
  deposit_amount_paid: number | null;
  secondary_phones: string | null;
}

export type PaymentRow = Timestamps & {
  id: string;
  tenant_id: string | null;
  landlord_id: string | null;
  meter_id: string | null;
  amount_kes: number;
  method: PaymentMethod;
  category: PaymentCategory;
  status: PaymentStatus;
  reference: string | null;
  provider: string | null;
  provider_reference: string | null;
  raw_payload: Json | null;
  note: string | null;
  processed_at: string | null;
}

export type TokenPurchaseRow = {
  id: string;
  tenant_id: string | null;
  meter_id: string | null;
  meter_no: string;
  amount_kes: number;
  token_formatted: string;
  kct_token_1: string | null;
  kct_token_2: string | null;
  subsidy_token: string | null;
  longi_order_no: string | null;
  longi_sgc: number | null;
  longi_ti: number | null;
  longi_credit: number | null;
  longi_raw_payload: Json | null;
  source: TokenSource;
  manual_channel: ManualTokenChannel | null;
  payment_id: string | null;
  payment_ref: string | null;
  issued_by: string | null;
  note: string | null;
  created_at: string;
}

export type PayoutRow = Timestamps & {
  id: string;
  landlord_id: string;
  period_label: string | null;
  period_start: string | null;
  period_end: string | null;
  gross_kes: number;
  platform_fee_kes: number;
  net_payout_kes: number;
  rail: PayoutRail;
  status: PaymentStatus;
  reference: string | null;
  scheduled_at: string;
  paid_at: string | null;
  raw_payload: Json | null;
}

export type StaffRow = Timestamps & {
  id: string;
  code: string | null;
  profile_id: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  region: string | null;
  status: StaffStatus;
  serves: StaffServes;
  completed_jobs_90d: number;
  notes: string | null;
}

export type StaffSkillRow = {
  staff_id: string;
  skill: StaffSkill;
}

export type ServiceRequestRow = Timestamps & {
  id: string;
  code: string | null;
  tenant_id: string | null;
  landlord_id: string | null;
  building_id: string | null;
  unit_id: string | null;
  service_type: string;
  area: string | null;
  fault_summary: string;
  preferred_date: string | null;
  urgency: ServiceUrgency;
  note: string | null;
  status: ServiceRequestStatus;
  assigned_staff_id: string | null;
}

export type AppointmentRow = Timestamps & {
  id: string;
  service_request_id: string | null;
  staff_id: string | null;
  tenant_id: string | null;
  building_id: string | null;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  status: AppointmentStatus;
  note: string | null;
}

export type ProductCategoryRow = {
  id: string;
  slug: string;
  name: string;
  created_at: string;
}

export type ProductRow = Timestamps & {
  id: string;
  slug: string;
  category_id: string | null;
  name: string;
  short_description: string | null;
  description: string | null;
  price_kes: number;
  stock: number;
  unit: string;
  primary_image_url: string | null;
  rating: number;
  tags: string[];
  is_active: boolean;
}

export type ProductImageRow = {
  id: string;
  product_id: string;
  url: string;
  sort_order: number;
  created_at: string;
}

export type OrderRow = Timestamps & {
  id: string;
  code: string | null;
  tenant_id: string | null;
  customer_profile_id: string | null;
  phone_number: string;
  delivery_address: string | null;
  subtotal_kes: number;
  vat_kes: number;
  delivery_fee_kes: number;
  total_kes: number;
  status: OrderStatus;
  payment_id: string | null;
  note: string | null;
}

export type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price_kes: number;
  line_total_kes: number;
  created_at: string;
}

export type NotificationRow = {
  id: string;
  recipient_profile_id: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  description: string | null;
  href: string | null;
  related_meter_id: string | null;
  related_tenant_id: string | null;
  related_payment_id: string | null;
  related_order_id: string | null;
  related_payout_id: string | null;
  metadata: Json | null;
  read_at: string | null;
  dismissed_at: string | null;
  created_at: string;
}

export type ActivityLogRow = {
  id: string;
  actor_profile_id: string | null;
  actor_role: UserRole | null;
  action: string;
  target_table: string | null;
  target_id: string | null;
  before_state: Json | null;
  after_state: Json | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export type LandlordSettingsRow = {
  landlord_id: string;
  notify_email: boolean;
  notify_sms: boolean;
  notify_push: boolean;
  digest_weekly: boolean;
  alert_meter_fault: boolean;
  alert_meter_offline: boolean;
  alert_payment_failed: boolean;
  alert_tenant_arrears: boolean;
  contact_email: string | null;
  contact_phone: string | null;
  mpesa_till_label: string | null;
  bank_account_label: string | null;
  updated_at: string;
}

export type TenantSettingsRow = {
  tenant_id: string;
  payment_alerts: boolean;
  service_alerts: boolean;
  low_balance_alerts: boolean;
  push_enabled: boolean;
  updated_at: string;
}

export type PlatformSettingsRow = {
  key: string;
  value: Json;
  updated_at: string;
}

// ---------- Leases -------------------------------------------------------

export type LeaseStatus =
  | "draft"
  | "pending_signature"
  | "active"
  | "expired"
  | "terminated"
  | "cancelled";
export type LeaseSignerRole = "tenant" | "landlord";

export type LeaseTemplateRow = Timestamps & {
  id: string;
  landlord_id: string | null;
  name: string;
  description: string | null;
  clauses: Json;
  governing_law: string;
  is_active: boolean;
  version: number;
};

export type LeaseRow = Timestamps & {
  id: string;
  code: string | null;
  landlord_id: string;
  tenant_id: string;
  building_id: string | null;
  unit_id: string | null;
  template_id: string | null;
  landlord_name: string | null;
  tenant_name: string | null;
  tenant_national_id: string | null;
  property_label: string | null;
  rent_kes: number | null;
  deposit_kes: number | null;
  frequency: string;
  payment_day: number | null;
  start_date: string | null;
  end_date: string | null;
  clause_overrides: Json;
  status: LeaseStatus;
  document_url: string | null;
  signed_document_url: string | null;
  signed_at: string | null;
  terminated_at: string | null;
  termination_reason: string | null;
  notes: string | null;
};

export type LeaseSignatureRow = {
  id: string;
  lease_id: string;
  signer_profile_id: string | null;
  signer_role: LeaseSignerRole;
  signer_name: string;
  signature_path: string;
  signed_at: string;
  signer_ip: string | null;
  user_agent: string | null;
};

// ---------- Ledger / billing ---------------------------------------------

export type LedgerDirection = "debit" | "credit";
export type LedgerCategory =
  | "rent"
  | "deposit"
  | "water"
  | "service_charge"
  | "late_fee"
  | "payment"
  | "adjustment"
  | "refund";
export type LedgerSource =
  | "manual"
  | "rent_run"
  | "mpesa"
  | "paystack"
  | "token"
  | "system";

export type LedgerEntryRow = Timestamps & {
  id: string;
  tenant_id: string;
  lease_id: string | null;
  landlord_id: string;
  direction: LedgerDirection;
  category: LedgerCategory;
  amount_kes: number;
  description: string | null;
  period: string | null;
  due_date: string | null;
  source: LedgerSource;
  reference: string | null;
  payment_id: string | null;
  voided: boolean;
  created_by: string | null;
};

export type OwnerExpenseCategory =
  | "maintenance"
  | "repairs"
  | "utilities"
  | "management"
  | "insurance"
  | "other";

export type OwnerExpenseRow = Timestamps & {
  id: string;
  landlord_id: string;
  building_id: string | null;
  category: OwnerExpenseCategory;
  amount_kes: number;
  description: string | null;
  incurred_on: string;
  created_by: string | null;
};

// ---------- Helper insert/update types -----------------------------------

type Insertable<T> = Omit<T, "created_at" | "updated_at"> & {
  created_at?: string;
  updated_at?: string;
};

// `@supabase/postgrest-js` requires every `Tables[...]` entry to carry a
// `Relationships` array (see GenericTable in node_modules/@supabase/postgrest-js).
// We don't model FK joins through this type yet — leaving it empty.
type EmptyRelationships = [];

// ---------- Database ------------------------------------------------------

type TableDef<Row, Insert = Insertable<Row>, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: EmptyRelationships;
};

type LightTableDef<Row> = {
  Row: Row;
  Insert: Omit<Row, "created_at"> & { created_at?: string };
  Update: Partial<Row>;
  Relationships: EmptyRelationships;
};

type ViewDef<Row> = { Row: Row; Relationships: EmptyRelationships };

export type Database = {
  public: {
    Tables: {
      profiles:           TableDef<ProfileRow>;
      landlords:          TableDef<LandlordRow>;
      buildings:          TableDef<BuildingRow>;
      building_recurring_bills: TableDef<BuildingRecurringBillRow>;
      units: {
        Row: UnitRow;
        Insert: Partial<UnitRow> & { building_id: string; label: string };
        Update: Partial<UnitRow>;
        Relationships: EmptyRelationships;
      };
      unit_images: {
        Row: UnitImageRow;
        Insert: Partial<UnitImageRow> & { unit_id: string; path: string };
        Update: Partial<UnitImageRow>;
        Relationships: EmptyRelationships;
      };
      water_pricing:      TableDef<WaterPricingRow>;
      meters:             TableDef<MeterRow>;
      tenants:            TableDef<TenantRow>;
      payments:           TableDef<PaymentRow>;
      token_purchases:    LightTableDef<TokenPurchaseRow>;
      payouts:            TableDef<PayoutRow>;
      payout_payments: {
        Row: { payout_id: string; payment_id: string };
        Insert: { payout_id: string; payment_id: string };
        Update: { payout_id?: string; payment_id?: string };
        Relationships: EmptyRelationships;
      };
      staff:              TableDef<StaffRow>;
      staff_skills: {
        Row: StaffSkillRow;
        Insert: StaffSkillRow;
        Update: Partial<StaffSkillRow>;
        Relationships: EmptyRelationships;
      };
      service_requests:   TableDef<ServiceRequestRow>;
      appointments:       TableDef<AppointmentRow>;
      product_categories: LightTableDef<ProductCategoryRow>;
      products:           TableDef<ProductRow>;
      product_images:     LightTableDef<ProductImageRow>;
      orders:             TableDef<OrderRow>;
      order_items:        LightTableDef<OrderItemRow>;
      notifications:      LightTableDef<NotificationRow>;
      activity_logs:      LightTableDef<ActivityLogRow>;
      landlord_settings: {
        Row: LandlordSettingsRow;
        Insert: Omit<LandlordSettingsRow, "updated_at"> & { updated_at?: string };
        Update: Partial<LandlordSettingsRow>;
        Relationships: EmptyRelationships;
      };
      tenant_settings: {
        Row: TenantSettingsRow;
        Insert: Omit<TenantSettingsRow, "updated_at"> & { updated_at?: string };
        Update: Partial<TenantSettingsRow>;
        Relationships: EmptyRelationships;
      };
      platform_settings: {
        Row: PlatformSettingsRow;
        Insert: Omit<PlatformSettingsRow, "updated_at"> & { updated_at?: string };
        Update: Partial<PlatformSettingsRow>;
        Relationships: EmptyRelationships;
      };
      lease_templates: {
        Row: LeaseTemplateRow;
        Insert: Partial<LeaseTemplateRow> & { name: string };
        Update: Partial<LeaseTemplateRow>;
        Relationships: EmptyRelationships;
      };
      leases: {
        Row: LeaseRow;
        Insert: Partial<LeaseRow> & { landlord_id: string; tenant_id: string };
        Update: Partial<LeaseRow>;
        Relationships: EmptyRelationships;
      };
      lease_signatures: {
        Row: LeaseSignatureRow;
        Insert: Partial<LeaseSignatureRow> & {
          lease_id: string;
          signer_role: LeaseSignerRole;
          signer_name: string;
          signature_path: string;
        };
        Update: Partial<LeaseSignatureRow>;
        Relationships: EmptyRelationships;
      };
      ledger_entries: {
        Row: LedgerEntryRow;
        Insert: Partial<LedgerEntryRow> & {
          tenant_id: string;
          landlord_id: string;
          direction: LedgerDirection;
          category: LedgerCategory;
          amount_kes: number;
        };
        Update: Partial<LedgerEntryRow>;
        Relationships: EmptyRelationships;
      };
      owner_expenses: {
        Row: OwnerExpenseRow;
        Insert: Partial<OwnerExpenseRow> & {
          landlord_id: string;
          amount_kes: number;
        };
        Update: Partial<OwnerExpenseRow>;
        Relationships: EmptyRelationships;
      };
    };
    Views: {
      tenant_directory: ViewDef<
        TenantRow & {
          landlord_code: string | null;
          landlord_name: string | null;
          landlord_company: string | null;
          building_name: string | null;
          unit_label: string | null;
          meter_no: string | null;
        }
      >;
      meter_directory: ViewDef<
        MeterRow & {
          landlord_company: string | null;
          building_name: string | null;
          unit_label: string | null;
          tenant_id: string | null;
          tenant_name: string | null;
        }
      >;
    };
    Functions: {
      current_role_name: { Args: Record<string, never>; Returns: UserRole };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_landlord: { Args: Record<string, never>; Returns: boolean };
      is_tenant: { Args: Record<string, never>; Returns: boolean };
      is_staff: { Args: Record<string, never>; Returns: boolean };
      next_lease_code: { Args: Record<string, never>; Returns: string };
      tenant_balance_kes: { Args: { p_tenant_id: string }; Returns: number };
    };
    Enums: {
      user_role: UserRole;
      account_status: AccountStatus;
      tenant_billing_model: TenantBillingModel;
      tenant_status: TenantStatus;
      payout_schedule: PayoutSchedule;
      payout_rail: PayoutRail;
      rent_model: RentModel;
      unit_type: UnitType;
      meter_lifecycle: MeterLifecycle;
      meter_connectivity: MeterConnectivity;
      meter_model_type: MeterModelType;
      payment_method: PaymentMethod;
      payment_category: PaymentCategory;
      payment_status: PaymentStatus;
      token_source: TokenSource;
      manual_token_channel: ManualTokenChannel;
      staff_status: StaffStatus;
      staff_serves: StaffServes;
      staff_skill: StaffSkill;
      service_urgency: ServiceUrgency;
      service_request_status: ServiceRequestStatus;
      appointment_status: AppointmentStatus;
      order_status: OrderStatus;
      notification_category: NotificationCategory;
      notification_severity: NotificationSeverity;
      lease_status: LeaseStatus;
      lease_signer_role: LeaseSignerRole;
      ledger_direction: LedgerDirection;
      ledger_category: LedgerCategory;
      ledger_source: LedgerSource;
      owner_expense_category: OwnerExpenseCategory;
    };
  };
};
