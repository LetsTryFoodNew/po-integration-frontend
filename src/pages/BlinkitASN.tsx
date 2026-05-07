import { useState } from "react";
import {
  PackageCheck, Search, XCircle, AlertCircle, Loader2,
  CheckCircle, Info,
} from "lucide-react";
import { getBlinkitASNs, cancelBlinkitASN } from "../api";
import type { BlinkitASN, BlinkitASNListData } from "../types";
import blinkitLogo from "../assets/blinkit-logo.svg";

const ASN_STATUS_STYLE: Record<string, string> = {
  CREATED:   "bg-blue-100 text-blue-700 border-blue-300",
  SUBMITTED: "bg-indigo-100 text-indigo-700 border-indigo-300",
  ACCEPTED:  "bg-green-100 text-green-700 border-green-300",
  REJECTED:  "bg-red-100 text-red-700 border-red-300",
  CANCELLED: "bg-gray-100 text-gray-600 border-gray-300",
  DELIVERED: "bg-emerald-100 text-emerald-700 border-emerald-300",
};

const CANCELLABLE = new Set(["CREATED", "SUBMITTED"]);

export default function BlinkitASN() {
  const [poNumber, setPONumber]     = useState("");
  const [asns, setASNs]             = useState<BlinkitASN[]>([]);
  const [loading, setLoading]       = useState(false);
  const [searched, setSearched]     = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [hasNext, setHasNext]       = useState(false);
  const [page, setPage]             = useState(1);
  const [searchedCode, setSearched2] = useState("");
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null);

  const fetchASNs = async (code: string, p = 1) => {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    setCancelSuccess(null);
    try {
      const res  = await getBlinkitASNs(code.trim(), { page: p, page_size: 10 });
      const body = res.data?.data ?? res.data;
      const list = (body?.asns ?? body?.data?.asns ?? []) as BlinkitASN[];
      setASNs(list);
      setHasNext(body?.hasNext ?? false);
      setSearched(true);
      setSearched2(code.trim());
    } catch (e: any) {
      setError(
        e.response?.data?.detail ??
        "Failed to fetch ASNs — check the PO number and try again",
      );
      setASNs([]);
      setSearched(true);
    }
    setLoading(false);
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPage(1);
    fetchASNs(poNumber, 1);
  };

  const handleCancel = async (asnId: string) => {
    if (!confirm(`Cancel ASN ${asnId}?\n\nThis cannot be undone.`)) return;
    setCancelling(asnId);
    try {
      await cancelBlinkitASN(asnId, "VENDOR_REQUEST");
      setCancelSuccess(`ASN ${asnId} cancelled successfully.`);
      await fetchASNs(searchedCode, page);
    } catch (e: any) {
      alert(e.response?.data?.detail ?? "Failed to cancel ASN");
    }
    setCancelling(null);
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <img src={blinkitLogo} alt="Blinkit" className="w-10 h-10 rounded-xl" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Blinkit ASN Manager</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Search and manage Advance Shipment Notifications submitted to Blinkit
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-1.5">
        <div className="flex items-start gap-2">
          <Info size={15} className="mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p>
              <strong>ASN endpoint (testing):</strong>{" "}
              <code className="bg-white border border-amber-200 rounded px-1 text-xs">
                POST https://dev.partnersbiz.com/webhook/public/v1/asn
              </code>
            </p>
            <p>
              To <strong>create</strong> an ASN → go to{" "}
              <a href="/blinkit/pos" className="underline font-medium">Blinkit PO Events</a>{" "}
              and click <strong>ASN</strong> on an OPEN PO.
            </p>
            <p>
              <strong>Note:</strong> Blinkit does not provide a List ASNs API — track your{" "}
              <code className="bg-white border border-amber-200 rounded px-1 text-xs">asn_id</code>{" "}
              from each create response. The search below shows locally-tracked ASNs only.
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex gap-3">
        <input
          type="text"
          placeholder="Enter Blinkit PO ID (e.g. PO-123456)"
          value={poNumber}
          onChange={e => setPONumber(e.target.value)}
          className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <button
          type="submit"
          disabled={loading || !poNumber.trim()}
          className="flex items-center gap-2 px-5 py-2 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 disabled:opacity-50 transition"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Search
        </button>
      </form>

      {/* Cancel success banner */}
      {cancelSuccess && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">
          <CheckCircle size={16} className="flex-shrink-0" />
          {cancelSuccess}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Results */}
      {searched && !error && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {asns.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <PackageCheck size={40} className="mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No ASNs found for PO {searchedCode}</p>
              <p className="text-sm mt-1">
                Create one from the{" "}
                <a href="/blinkit/pos" className="text-amber-600 hover:underline">Blinkit PO Events</a> page
              </p>
            </div>
          ) : (
            <>
              <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  {asns.length} ASN{asns.length !== 1 ? "s" : ""} for PO{" "}
                  <span className="font-mono text-amber-700">{searchedCode}</span>
                </span>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  Page {page}
                  <button
                    disabled={page <= 1}
                    onClick={() => { const p = page - 1; setPage(p); fetchASNs(searchedCode, p); }}
                    className="px-2 py-1 border rounded disabled:opacity-40 hover:bg-gray-100"
                  >←</button>
                  <button
                    disabled={!hasNext}
                    onClick={() => { const p = page + 1; setPage(p); fetchASNs(searchedCode, p); }}
                    className="px-2 py-1 border rounded disabled:opacity-40 hover:bg-gray-100"
                  >→</button>
                </div>
              </div>

              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-5 py-3 text-left">ASN ID</th>
                    <th className="px-5 py-3 text-left">Invoice Number</th>
                    <th className="px-5 py-3 text-left">Invoice Date</th>
                    <th className="px-5 py-3 text-right">Total Qty</th>
                    <th className="px-5 py-3 text-right">Total Amount</th>
                    <th className="px-5 py-3 text-center">Status</th>
                    <th className="px-5 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {asns.map(asn => {
                    const isFinal      = asn.status === "CANCELLED" || asn.status === "DELIVERED";
                    const isCancellable = CANCELLABLE.has(asn.status);
                    return (
                      <tr key={asn.asnId} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-mono text-xs font-semibold text-amber-700">
                          {asn.asnId}
                        </td>
                        <td className="px-5 py-3 font-mono text-xs text-gray-600">
                          {asn.invoiceNumber ?? "—"}
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-500">
                          {asn.invoiceDate
                            ? new Date(asn.invoiceDate).toLocaleDateString("en-IN", {
                                day: "2-digit", month: "short", year: "numeric",
                              })
                            : "—"}
                        </td>
                        <td className="px-5 py-3 text-right text-gray-600 text-xs font-semibold">
                          {asn.totalQty ?? "—"}
                        </td>
                        <td className="px-5 py-3 text-right text-gray-700 font-medium text-xs">
                          {asn.totalAmount != null
                            ? `₹${asn.totalAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
                            : "—"}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                            ASN_STATUS_STYLE[asn.status] ?? "bg-gray-100 text-gray-600 border-gray-200"
                          }`}>
                            {asn.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center">
                          {isFinal ? (
                            <span className="text-xs text-gray-400">
                              {asn.status === "DELIVERED" ? "✓ Delivered" : "Cancelled"}
                            </span>
                          ) : isCancellable ? (
                            <button
                              onClick={() => handleCancel(asn.asnId)}
                              disabled={cancelling === asn.asnId}
                              className="inline-flex items-center gap-1 px-3 py-1.5 border border-red-200 text-red-600 text-xs rounded-lg hover:bg-red-50 disabled:opacity-50 transition"
                            >
                              <XCircle size={11} />
                              {cancelling === asn.asnId ? "Cancelling…" : "Cancel"}
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Item details section */}
              {asns.some(a => a.items?.length) && (
                <div className="border-t border-gray-100 p-5 space-y-4">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    ASN Item Breakdown
                  </h4>
                  {asns.filter(a => a.items?.length).map(asn => (
                    <div key={asn.asnId} className="border border-gray-100 rounded-lg overflow-hidden">
                      <div className="bg-amber-50 px-4 py-2 flex items-center gap-3 text-xs">
                        <span className="font-mono font-semibold text-amber-700">{asn.asnId}</span>
                        <span className="text-gray-500">Invoice: {asn.invoiceNumber ?? "—"}</span>
                        <span className={`px-1.5 py-0.5 rounded-full border font-medium ${
                          ASN_STATUS_STYLE[asn.status] ?? "bg-gray-100 text-gray-600 border-gray-200"
                        }`}>{asn.status}</span>
                      </div>
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 text-gray-500">
                          <tr>
                            <th className="px-4 py-2 text-left">Product ID</th>
                            <th className="px-4 py-2 text-left">Product</th>
                            <th className="px-4 py-2 text-right">Invoiced Qty</th>
                            <th className="px-4 py-2 text-right">Rate</th>
                            <th className="px-4 py-2 text-right">MRP</th>
                            <th className="px-4 py-2 text-left">Batch</th>
                            <th className="px-4 py-2 text-left">Expiry</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {asn.items!.map((item, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-4 py-1.5 font-mono text-amber-700">{item.productId ?? "—"}</td>
                              <td className="px-4 py-1.5 text-gray-700 max-w-[180px] truncate">{item.productName ?? "—"}</td>
                              <td className="px-4 py-1.5 text-right font-semibold text-gray-700">{item.invoicedQty ?? 0}</td>
                              <td className="px-4 py-1.5 text-right text-gray-600">{item.rate != null ? `₹${item.rate}` : "—"}</td>
                              <td className="px-4 py-1.5 text-right text-gray-600">{item.mrp  != null ? `₹${item.mrp}`  : "—"}</td>
                              <td className="px-4 py-1.5 font-mono text-gray-400">{item.batchNumber ?? "—"}</td>
                              <td className="px-4 py-1.5 text-gray-400">{item.expiryDate ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
