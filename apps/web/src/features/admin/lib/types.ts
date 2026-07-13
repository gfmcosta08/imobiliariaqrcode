export type SubscriberRow = {
  account_id: string;
  full_name: string;
  email: string;
  whatsapp_number: string;
  plan_code: string;
  subscription_status: string;
  total_properties: number;
  total_qr_reads: number;
  total_leads: number;
};

export type SubscriberPropertySummary = {
  property_id: string;
  public_id: string;
  title: string;
  listing_status: string;
  city: string | null;
  state: string | null;
  qr_token: string | null;
  qr_reads: number;
  unique_visitors: number;
  total_leads: number;
  visit_interest_count: number;
  updated_at: string;
};

export type SubscriberDashboard = {
  account: {
    account_id: string;
    full_name: string;
    email: string;
    whatsapp_number: string;
    plan_code: string;
    subscription_status: string;
    created_at: string;
    total_properties: number;
    total_qr_reads: number;
    total_leads: number;
    unique_qr_visitors: number;
  };
  properties: SubscriberPropertySummary[];
};

export type PropertyQrMetrics = {
  property: {
    property_id: string;
    account_id: string;
    public_id: string;
    title: string;
    listing_status: string;
    city: string | null;
    state: string | null;
    neighborhood: string | null;
    full_address: string | null;
    latitude: number | null;
    longitude: number | null;
    qr_token: string | null;
  };
  summary: {
    total_scans: number;
    unique_visitors: number;
    total_leads: number;
    visit_interest_count: number;
    qr_entry_count: number;
    similar_interest_count: number;
    public_qr_interest_count: number;
    conversion_scan_to_lead: number;
    conversion_scan_to_visit: number;
    first_scan_at: string | null;
    last_scan_at: string | null;
  };
  scans_by_day: { day: string; count: number }[];
  scans_by_hour: { hour: number; count: number }[];
  device_breakdown: { device: string; count: number }[];
  recent_scans: {
    id: string;
    created_at: string;
    source: string;
    device: string;
    user_agent: string;
    has_ip_hash: boolean;
  }[];
  leads: {
    id: string;
    nome_completo: string;
    telefone: string;
    intent: string;
    status: string;
    origem: string;
    created_at: string;
    updated_at: string;
  }[];
  interactions: {
    id: string;
    lead_id: string;
    interaction_type: string;
    created_at: string;
    payload: Record<string, unknown>;
  }[];
  location_note: string;
};
