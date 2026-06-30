export type LeaseClause = {
  key: string;
  title: string;
  body_markdown: string;
  editable: boolean;
};

/** The placeholder values a lease exposes to clause text. */
export type LeasePlaceholders = {
  landlord_name: string;
  tenant_name: string;
  tenant_national_id: string;
  property_label: string;
  rent_kes: string;
  deposit_kes: string;
  frequency: string;
  payment_day: string;
  start_date: string;
  end_date: string;
};
