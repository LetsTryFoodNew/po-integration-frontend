import axios from "axios";

const api = axios.create({ baseURL: "http://localhost:8000/api" });
export default api;

// Dashboard
export const getDashboard = () => api.get("/dashboard");

// Companies
export const getCompanies = () => api.get("/companies");
export const createCompany = (data: any) => api.post("/companies", data);
export const updateCompanyIntegration = (id: number, data: any) =>
  api.patch(`/companies/${id}/integration`, data);

// Products
export const getProducts = () => api.get("/products");
export const createProduct = (data: any) => api.post("/products", data);
export const updateProduct = (id: number, data: any) => api.patch(`/products/${id}`, data);

// Purchase Orders
export const getPurchaseOrders = (params?: any) => api.get("/purchase-orders", { params });
export const getPurchaseOrder = (id: number) => api.get(`/purchase-orders/${id}`);
export const createPO = (data: any) => api.post("/purchase-orders", data);
export const updatePOStatus = (id: number, status: string) =>
  api.patch(`/purchase-orders/${id}/status`, { status });

// Webhooks
export const getWebhookLogs = (params?: any) => api.get("/webhook/logs", { params });
export const simulateWebhook = (partnerCode: string) =>
  api.post(`/webhook/simulate/${partnerCode}`);

// ASN
export const getASNRecords = (params?: any) => api.get("/asn", { params });
export const createASN = (data: any) => api.post("/asn", data);
export const syncASN = (id: number) => api.post(`/asn/${id}/sync`);

// Product Mappings
export const getProductMappings = (params?: any) => api.get("/product-mappings", { params });
export const createProductMapping = (data: any) => api.post("/product-mappings", data);
export const deleteProductMapping = (id: number) => api.delete(`/product-mappings/${id}`);
export const resolveProductSKU = (params: { partner_code: string; partner_sku: string; partner_name?: string }) =>
  api.get("/product-mappings/resolve", { params });

// SAP Sales Orders
export const getSAPOrders = (params?: any) => api.get("/sap-orders", { params });
export const getSAPOrder = (sapOrderId: string) => api.get(`/sap-orders/${sapOrderId}`);
export const createSAPOrderFromPO = (poId: number) =>
  api.post(`/sap-orders/create-from-po/${poId}`);

// Unmapped SKU Alerts
export const getUnmappedSKUs = (params?: any) => api.get("/unmapped-skus", { params });
export const resolveUnmappedSKU = (alertId: number, data: { product_id: number; resolution_notes?: string }) =>
  api.post(`/unmapped-skus/${alertId}/resolve`, data);
