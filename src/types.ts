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

// ── Zepto Silk Route Types ────────────────────────────────────────────────────

export type ZeptoPOEventType = "CreatePO" | "UpdatePO" | "CancelPO";

export type ZeptoPOStatus = "RELEASED" | "EXPIRED" | "CANCELLED" | "CLOSED" | "OPEN";

export interface ZeptoPOLineItem {
  skuCode: string;
  materialCode?: string;
  matetrialCode?: string;  // Zepto API has this typo in some responses
  productName: string;
  subCategory?: string;
  brandName?: string;
  quantity: number;
  ean?: string;
  mrp: number;
  costPrice: number;
  hsnCode?: string;
  hsnText?: string;
  margin?: number;
  dispatchMargin?: number;
  outboundMargin?: number;
  holdingMargin?: number;
  bfdMargin?: number;
  igstPercentage?: number;
  cgstPercentage?: number;
  sgstPercentage?: number;
  cessPercentage?: number;
  absoluteCess?: number;
  packSize?: number;
  totalAmount?: number;
  taxExclusiveCost?: number;
  cgstValue?: number;
  sgstValue?: number;
  igstValue?: number;
  cessValue?: number;
  absoluteCessValue?: number;
  taxLogic?: string;
}

export interface ZeptoPO {
  eventId: string;
  eventType: ZeptoPOEventType;
  timestamp: string;
  code: string;           // PO number e.g. "P364929"
  type?: string;
  status: ZeptoPOStatus;
  vendorCode: string;
  vendorName?: string;
  vendorType?: string;
  entityCode?: string;
  entityName?: string;
  orderDate?: string;
  deliveryDate?: string;
  expiryDate?: string;
  terms?: string;
  pdfFileName?: string;
  expiringPoPdfLink?: string;
  expiringUrlForPoPDF?: string;
  totalQty?: number;
  toStoreCode?: string;
  toStoreName?: string;
  fromStoreCode?: string;
  fromStoreName?: string;
  isInterstate?: boolean;
  poLineItems?: ZeptoPOLineItem[];
  address?: {
    storeAddress?: string;
    vendorAddress?: string;
    storeShippingAddress?: string;
    storeBillingAddress?: string;
    vendorPinCode?: string;
  };
  financialDetails?: {
    vendorGSTIN?: string;
    entityGSTIN?: string;
    vendorPAN?: string;
    entityPAN?: string;
  };
}

export interface ZeptoPOListData {
  purchaseOrders: ZeptoPO[];
  hasNext: boolean;
  pageNumber: number;
  pageSize: number;
}

export interface ZeptoASNItem {
  skuCode?: string;
  materialCode?: string;
  productName?: string;
  invoicedQuantity?: number;
  freeQuantity?: number;
  mrp?: number;
  basePrice?: number;
  batchDetails?: { batchNumber?: string; expiryDate?: string };
}

export interface ZeptoASN {
  asnNumber: string;
  invoiceNumber?: string;
  status: string;
  asnTotalAmount?: number;
  poNumber?: string;
  vendor?: string;
  vendorName?: string;
  locationCode?: string;
  locationName?: string;
  poQuantity?: number;
  asnQuantity?: number;
  totalAmount?: number;
  createdAt?: string;
  itemDetails?: ZeptoASNItem[];
}

export interface ZeptoASNListData {
  ASNs: ZeptoASN[];
  hasNext: boolean;
  pageNumber: number;
  pageSize: number;
}
