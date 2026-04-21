export interface Company {
  id: number;
  name: string;
  code: string;
  logo_color: string;
  contact_email: string;
  webhook_endpoint: string | null;
  webhook_username: string | null;
  integration_active: boolean;
  created_at: string;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  category: string;
  unit: string;
  price_per_unit: number;
  stock_quantity: number;
  reorder_level: number;
  sap_material_code: string;
  created_at: string;
}

export interface POItem {
  id: number;
  product_id: number;
  product: Product;
  requested_qty: number;
  fulfilled_qty: number;
  unit_price: number;
  subtotal: number;
}

export type POStatus =
  | "PENDING"
  | "STOCK_AVAILABLE"
  | "STOCK_PARTIAL"
  | "OUT_OF_STOCK"
  | "CONFIRMED"
  | "DISPATCHED";

export interface PurchaseOrder {
  id: number;
  po_number: string;
  company_id: number;
  company: Company;
  status: POStatus;
  total_amount: number;
  notes: string;
  sap_order_id: string;
  source: string;           // "MANUAL" | "WEBHOOK"
  created_at: string;
  updated_at: string;
  items: POItem[];
}

export type WebhookStatus = "SUCCESS" | "FAILED" | "PENDING";

export interface WebhookLog {
  id: number;
  company_id: number | null;
  event_type: string;
  source_ip: string | null;
  payload: any;
  response_status: number | null;
  status: WebhookStatus;
  po_number: string | null;
  error_message: string | null;
  created_at: string;
  company: Company | null;
}

export type ASNStatus = "CREATED" | "SYNCED" | "FAILED";

export interface ASNRecord {
  id: number;
  asn_number: string;
  po_id: number;
  company_id: number;
  status: ASNStatus;
  shipment_date: string | null;
  expected_delivery: string | null;
  carrier: string | null;
  tracking_number: string | null;
  sync_attempts: number;
  sync_response: string | null;
  created_at: string;
  updated_at: string;
  company: Company | null;
}

export interface DashboardStats {
  total_pos: number;
  pending_pos: number;
  confirmed_pos: number;
  dispatched_pos: number;
  out_of_stock_pos: number;
  total_revenue: number;
  low_stock_products: number;
  total_webhooks: number;
  failed_webhooks: number;
  total_asn: number;
  total_sap_orders: number;
  unmapped_skus: number;
}
