import { Fragment, useEffect, useState } from "react";
import {
  ClipboardList, RefreshCcw, Wifi, WifiOff, Clock,
  ChevronDown, ChevronRight, Plus, PackageCheck,
  CheckCircle, XCircle, AlertCircle, Loader2, Webhook,
} from "lucide-react";
import {
  getBlinkitPOs, getBlinkitPO, getBlinkitHealth, createBlinkitASN,
} from "../api";
import type {
  BlinkitPO, BlinkitPOItem, BlinkitPOListData,
} from "../types";
import blinkitLogo from "../assets/blinkit-logo.svg";

const PO_STATUS_STYLE: Record<string, string> = {
  OPEN:      "bg-green-100 text-green-700 border-green-300",
  DRAFT:     "bg-yellow-100 text-yellow-700 border-yellow-300",
  CLOSED:    "bg-blue-100 text-blue-700 border-blue-300",
  CANCELLED: "bg-red-100 text-red-700 border-red-300",
  EXPIRED:   "bg-gray-100 text-gray-600 border-gray-300",
};

const STATUS_FILTERS = ["", "OPEN", "CLOSED", "CANCELLED", "DRAFT", "EXPIRED"];

interface ASNLineForm {
  productId: string;
  skuCode: string;
  productName: string;
  requestedQty: number;
  invoicedQty: number;
  rate: number;
  mrp: number;
  batchNumber: string;
  expiryDate: string;
}

interface CreateASNForm {
  invoiceNumber: string;
  invoiceDate: string;
  deliveryDate: string;
  lines: ASNLineForm[];
}

function lineFromItem(item: BlinkitPOItem): ASNLineForm {
  return {
    productId:    item.productId,
    skuCode:      item.skuCode ?? "",
    productName:  item.productName,
    requestedQty: item.requestedQty,
    invoicedQty:  item.requestedQty,
    rate:         item.rate,
    mrp:          item.mrp,
    batchNumber:  "",
    expiryDate:   "",
  };
}

export default function BlinkitPOs() {
  const [pos, setPOs]               = useState<BlinkitPO[]>([]);
  const [loading, setLoading]       = useState(false);
  const [connected, setConnected]   = useState<boolean | null>(null);
  const [days, setDays]             = useState(30);
  const [statusFilter, setStatus]   = useState("");
  const [page, setPage]             = useState(1);
  const [hasNext, setHasNext]       = useState(false);
  const [expandedRows, setExpanded] = useState<Set<string>>(new Set());
  const [loadingItems, setLoadingItems] = useState<Set<string>>(new Set());

  // ASN modal
  const [asnModal, setAsnModal]           = useState<BlinkitPO | null>(null);
  const [asnForm, setAsnForm]             = useState<CreateASNForm>({
    invoiceNumber: "", invoiceDate: "", deliveryDate: "", lines: [],
  });
  const [asnSubmitting, setAsnSubmitting] = useState(false);
  const [asnResult, setAsnResult]         = useState<string | null>(null);
  const [asnError, setAsnError]           = useState<string | null>(null);

  const checkHealth = async () => {
    try {
      const r = await getBlinkitHealth();
      setConnected(r.data?.connectivity?.reachable !== false);
    } catch {
      setConnected(false);
    }
  };

  const fetchPOs = async (p = page) => {
    setLoading(true);
    try {
      const res  = await getBlinkitPOs({
        days,
        status:    statusFilter || undefined,
        page:      p,
        page_size: 20,
      });
      // Support both direct array and wrapped { purchaseOrders, hasNext } shapes
      const body  = res.data?.data ?? res.data;
      const list  = (body?.purchaseOrders ?? body?.data?.purchaseOrders ?? body) as BlinkitPO[];
      setPOs(Array.isArray(list) ? list : []);
      setHasNext(body?.hasNext ?? false);
    } catch (e: any) {
      console.error("Blinkit PO fetch error:", e);
      setPOs([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    checkHealth();
    fetchPOs(1);
    setPage(1);
  }, [days, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleRow = async (po: BlinkitPO) => {
    const id = po.purchaseOrderId;
    const next = new Set(expandedRows);
    if (next.has(id)) {
      next.delete(id);
      setExpanded(next);
      return;
    }
    next.add(id);
    setExpanded(next);
    // Lazy-load line items if not yet fetched
    if (!po.items?.length) {
      setLoadingItems(prev => new Set(prev).add(id));
      try {
        const res   = await getBlinkitPO(id);
        const detail = res.data?.data ?? res.data;
        setPOs(prev =>
          prev.map(p =>
            p.purchaseOrderId === id
              ? { ...p, items: detail?.items ?? detail?.data?.items ?? [] }
              : p,
          ),
        );
      } catch { /* non-critical */ }
      setLoadingItems(prev => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
    }
  };

  const openASNModal = (po: BlinkitPO) => {
    setAsnResult(null);
    setAsnError(null);
    setAsnForm({
      invoiceNumber: "",
      invoiceDate:   new Date().toISOString().split("T")[0],
      deliveryDate:  po.deliveryDate ? po.deliveryDate.split("T")[0] : "",
      lines:         (po.items ?? []).map(lineFromItem),
    });
    setAsnModal(po);
  };

  const handleASNSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!asnModal) return;
    setAsnSubmitting(true);
    setAsnError(null);
    const payload = {
      purchaseOrderId: asnModal.purchaseOrderId,
      vendorId:        asnModal.vendorId ?? 18309,
      invoiceNumber:   asnForm.invoiceNumber,
      invoiceDate:     asnForm.invoiceDate,
      ...(asnForm.deliveryDate ? { deliveryDate: asnForm.deliveryDate } : {}),
      items: asnForm.lines
        .filter(l => l.invoicedQty > 0)
        .map(l => ({
          productId:    l.productId,
          invoicedQty:  l.invoicedQty,
          rate:         l.rate,
          mrp:          l.mrp,
          ...(l.batchNumber ? { batchNumber: l.batchNumber } : {}),
          ...(l.expiryDate  ? { expiryDate:  l.expiryDate  } : {}),
        })),
    };
    try {
      const res  = await createBlinkitASN(payload);
      const id   = res.data?.asn_id ?? res.data?.data?.asnId ?? res.data?.asnId;
      setAsnResult(id ?? "ASN Submitted");
    } catch (err: any) {
      setAsnError(
        err.response?.data?.detail ??
        JSON.stringify(err.response?.data) ??
        "Failed to submit ASN",
      );
    }
    setAsnSubmitting(false);
  };

  const stats = {
    total:    pos.length,
    open:     pos.filter(p => p.status === "OPEN").length,
    closed:   pos.filter(p => p.status === "CLOSED" || p.status === "CANCELLED").length,
    totalQty: pos.reduce((s, p) => s + (p.totalQty ?? 0), 0),
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={blinkitLogo} alt="Blinkit" className="w-10 h-10 rounded-xl" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Blinkit Purchase Orders</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Vendor ID: 18309 · Testing (dev.partnersbiz.com)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
            connected === true  ? "bg-green-50 text-green-700"  :
            connected === false ? "bg-red-50 text-red-700"      :
                                  "bg-gray-50 text-gray-500"
          }`}>
            {connected === true  ? <Wifi size={13} />    :
             connected === false ? <WifiOff size={13} /> : <Clock size={13} />}
            {connected === true  ? "Blinkit Connected" :
             connected === false ? "Connection Error"  : "Checking…"}
          </div>
          <button
            onClick={() => { checkHealth(); fetchPOs(page); }}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition"
          >
            <RefreshCcw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Inbound webhook info */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 flex items-start gap-3">
        <Webhook size={16} className="mt-0.5 flex-shrink-0 text-amber-600" />
        <div className="space-y-1">
          <p>
            <strong>How Blinkit POs work:</strong> Blinkit <em>pushes</em> PO events to our
            webhook — there is no pull API. POs appear here once Blinkit's team configures
            our webhook URL.
          </p>
          <p className="text-xs text-amber-700 font-mono break-all">
            Webhook URL to share with Blinkit:{" "}
            <span className="font-semibold">
              https://po-integration-backend.onrender.com/api/webhook/inbound/blinkit/po
            </span>
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 font-medium">Past</label>
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            {[7, 14, 30, 60, 90].map(d => <option key={d} value={d}>{d} days</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 font-medium">Status</label>
          <select
            value={statusFilter}
            onChange={e => setStatus(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            {STATUS_FILTERS.map(s => <option key={s} value={s}>{s || "All"}</option>)}
          </select>
        </div>
        <div className="ml-auto flex items-center gap-2 text-sm text-gray-500">
          Page {page}
          <button
            disabled={page <= 1}
            onClick={() => { const p = page - 1; setPage(p); fetchPOs(p); }}
            className="px-2 py-1 border rounded disabled:opacity-40 hover:bg-gray-50"
          >←</button>
          <button
            disabled={!hasNext}
            onClick={() => { const p = page + 1; setPage(p); fetchPOs(p); }}
            className="px-2 py-1 border rounded disabled:opacity-40 hover:bg-gray-50"
          >→</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total POs",        value: stats.total,                     icon: ClipboardList, color: "bg-amber-500"  },
          { label: "Open / Active",    value: stats.open,                      icon: CheckCircle,   color: "bg-green-500"  },
          { label: "Closed / Cancelled", value: stats.closed,                  icon: XCircle,       color: "bg-red-500"    },
          { label: "Total Qty",        value: stats.totalQty.toLocaleString(), icon: PackageCheck,  color: "bg-blue-500"   },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
            <div className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center flex-shrink-0`}>
              <Icon size={18} className="text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-xl font-bold text-gray-800">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* PO Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-gray-400">
            <Loader2 size={28} className="mx-auto mb-3 animate-spin text-amber-400" />
            Loading Blinkit POs from webhook store…
          </div>
        ) : pos.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Webhook size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="font-medium">Waiting for Blinkit to push POs</p>
            <p className="text-sm mt-1 max-w-sm mx-auto">
              POs will appear here once Blinkit configures our inbound webhook URL.
              Share: <span className="font-mono text-xs text-amber-700">
                /api/webhook/inbound/blinkit/po
              </span>
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left w-8"></th>
                <th className="px-4 py-3 text-left">PO Number</th>
                <th className="px-4 py-3 text-left">Warehouse</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Delivery Date</th>
                <th className="px-4 py-3 text-right">Total Qty</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pos.map(po => {
                const expanded    = expandedRows.has(po.purchaseOrderId);
                const itemLoading = loadingItems.has(po.purchaseOrderId);
                return (
                  <Fragment key={po.purchaseOrderId}>
                    <tr className={`hover:bg-gray-50 ${expanded ? "bg-amber-50/30" : ""}`}>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleRow(po)}
                          className="text-gray-400 hover:text-amber-600 transition"
                        >
                          {itemLoading
                            ? <Loader2 size={16} className="animate-spin" />
                            : expanded
                              ? <ChevronDown size={16} />
                              : <ChevronRight size={16} />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs font-semibold text-amber-700">
                          {po.purchaseOrderId}
                        </div>
                        {po.poCode && (
                          <div className="text-gray-400 text-xs">{po.poCode}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-800 text-xs font-medium">
                          {po.warehouseName ?? po.warehouseCode ?? "—"}
                        </div>
                        {po.cityName && (
                          <div className="text-gray-400 text-xs">{po.cityName}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                          PO_STATUS_STYLE[po.status] ?? "bg-gray-100 text-gray-600 border-gray-200"
                        }`}>
                          {po.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {po.deliveryDate
                          ? new Date(po.deliveryDate).toLocaleDateString("en-IN", {
                              day: "2-digit", month: "short", year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-700">
                        {(po.totalQty ?? 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 text-xs">
                        {po.totalAmount != null
                          ? `₹${po.totalAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {po.status === "OPEN" && (
                          <button
                            onClick={() => openASNModal(po)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-500 text-white text-xs rounded-lg hover:bg-amber-600 transition"
                          >
                            <Plus size={11} /> ASN
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* Expanded line items */}
                    {expanded && (
                      <tr>
                        <td colSpan={8} className="bg-amber-50/40 px-8 py-3 border-b border-amber-100">
                          {itemLoading ? (
                            <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                              <Loader2 size={12} className="animate-spin" /> Loading line items…
                            </div>
                          ) : !po.items?.length ? (
                            <p className="text-xs text-gray-400 italic py-1">No line items available</p>
                          ) : (
                            <table className="w-full text-xs border-collapse">
                              <thead>
                                <tr className="text-gray-500 border-b border-amber-100">
                                  <th className="text-left pb-1.5 pr-4 font-medium">Product ID</th>
                                  <th className="text-left pb-1.5 pr-4 font-medium">Product</th>
                                  <th className="text-left pb-1.5 pr-4 font-medium">Brand</th>
                                  <th className="text-right pb-1.5 pr-4 font-medium">Qty</th>
                                  <th className="text-right pb-1.5 pr-4 font-medium">Rate</th>
                                  <th className="text-right pb-1.5 pr-4 font-medium">MRP</th>
                                  <th className="text-left pb-1.5 font-medium">HSN</th>
                                  <th className="text-right pb-1.5 font-medium">GST %</th>
                                </tr>
                              </thead>
                              <tbody>
                                {po.items.map((item, idx) => (
                                  <tr key={idx} className="border-b border-amber-50 last:border-0">
                                    <td className="py-1.5 pr-4 font-mono text-amber-700">{item.productId}</td>
                                    <td className="py-1.5 pr-4 text-gray-700 max-w-[200px] truncate">{item.productName}</td>
                                    <td className="py-1.5 pr-4 text-gray-500">{item.brandName ?? "—"}</td>
                                    <td className="py-1.5 pr-4 text-right font-semibold">{item.requestedQty}</td>
                                    <td className="py-1.5 pr-4 text-right text-gray-600">₹{item.rate}</td>
                                    <td className="py-1.5 pr-4 text-right text-gray-600">₹{item.mrp}</td>
                                    <td className="py-1.5 font-mono text-gray-400">{item.hsnCode ?? "—"}</td>
                                    <td className="py-1.5 text-right text-gray-500">
                                      {item.gstRate != null ? `${item.gstRate}%` : "—"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create ASN Modal */}
      {asnModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto"
          onClick={() => !asnSubmitting && setAsnModal(null)}
        >
          <div
            className="bg-white rounded-xl w-full max-w-2xl shadow-2xl my-8"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h3 className="font-bold text-gray-800">
                  Create ASN —{" "}
                  <span className="font-mono text-amber-700">{asnModal.purchaseOrderId}</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {asnModal.warehouseName ?? asnModal.warehouseCode ?? ""} · Vendor 18309
                </p>
              </div>
              {!asnSubmitting && (
                <button onClick={() => setAsnModal(null)} className="text-gray-400 hover:text-gray-700 text-lg">✕</button>
              )}
            </div>

            {asnResult ? (
              <div className="p-10 text-center">
                <CheckCircle size={48} className="mx-auto mb-4 text-green-500" />
                <h4 className="font-bold text-gray-800 text-lg mb-1">ASN Submitted Successfully</h4>
                <p className="text-gray-500 text-sm mb-3">Blinkit ASN ID</p>
                <div className="inline-block bg-green-50 border border-green-200 rounded-lg px-5 py-3 font-mono text-green-800 font-bold text-xl mb-5">
                  {asnResult}
                </div>
                <p className="text-xs text-gray-400 mb-6">
                  Save this ASN ID — needed to cancel or reference this shipment.
                </p>
                <button
                  onClick={() => setAsnModal(null)}
                  className="px-6 py-2 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 transition"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleASNSubmit} className="p-5 space-y-5">
                {asnError && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                    <span className="break-all">{asnError}</span>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Invoice Number *</label>
                    <input
                      required type="text" placeholder="e.g. INV-2025-001"
                      value={asnForm.invoiceNumber}
                      onChange={e => setAsnForm({ ...asnForm, invoiceNumber: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Invoice Date *</label>
                    <input
                      required type="date"
                      value={asnForm.invoiceDate}
                      onChange={e => setAsnForm({ ...asnForm, invoiceDate: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Delivery Date</label>
                    <input
                      type="date"
                      value={asnForm.deliveryDate}
                      onChange={e => setAsnForm({ ...asnForm, deliveryDate: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>

                {/* Line Items */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Line Items
                    </label>
                    <span className="text-xs text-gray-400">
                      {asnForm.lines.length} items · quantities in units (PC)
                    </span>
                  </div>

                  {asnForm.lines.length === 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                      No line items. Expand the PO row to load items first, then reopen this modal.
                    </div>
                  ) : (
                    <div className="border border-gray-100 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 text-gray-500 sticky top-0 z-10">
                          <tr>
                            <th className="px-3 py-2 text-left">Product</th>
                            <th className="px-3 py-2 text-right">Ordered</th>
                            <th className="px-3 py-2 text-center w-24">Invoice Qty *</th>
                            <th className="px-3 py-2 text-left w-28">Batch No.</th>
                            <th className="px-3 py-2 text-left w-28">Expiry Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {asnForm.lines.map((line, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-3 py-2">
                                <div className="font-mono text-amber-700">{line.productId}</div>
                                <div className="text-gray-500 truncate max-w-[160px]">{line.productName}</div>
                              </td>
                              <td className="px-3 py-2 text-right text-gray-500">{line.requestedQty}</td>
                              <td className="px-3 py-2">
                                <input
                                  required type="number" min="0" max={line.requestedQty}
                                  value={line.invoicedQty}
                                  onChange={e => {
                                    const l = [...asnForm.lines];
                                    l[idx] = { ...l[idx], invoicedQty: Number(e.target.value) };
                                    setAsnForm({ ...asnForm, lines: l });
                                  }}
                                  className="w-full border border-gray-200 rounded px-2 py-1 text-center focus:outline-none focus:ring-1 focus:ring-amber-400"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="text" placeholder="Optional"
                                  value={line.batchNumber}
                                  onChange={e => {
                                    const l = [...asnForm.lines];
                                    l[idx] = { ...l[idx], batchNumber: e.target.value };
                                    setAsnForm({ ...asnForm, lines: l });
                                  }}
                                  className="w-full border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="date"
                                  value={line.expiryDate}
                                  onChange={e => {
                                    const l = [...asnForm.lines];
                                    l[idx] = { ...l[idx], expiryDate: e.target.value };
                                    setAsnForm({ ...asnForm, lines: l });
                                  }}
                                  className="w-full border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setAsnModal(null)}
                    disabled={asnSubmitting}
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={asnSubmitting || asnForm.lines.every(l => l.invoicedQty === 0)}
                    className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 disabled:opacity-50 transition"
                  >
                    {asnSubmitting
                      ? <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Submitting…</span>
                      : "Submit ASN to Blinkit"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
