import { useEffect, useState } from "react";
import {
  Mail, RefreshCcw, CheckCircle, XCircle, Clock,
  Loader2, ChevronDown, ChevronRight, Send, AlertCircle,
  Wifi, WifiOff, Download,
} from "lucide-react";
import {
  getEmailPOs, testEmailPO, reprocessEmailPO,
  pollGmail, getGmailStatus,
} from "../api";

type ParseStatus = "PENDING" | "PARSED" | "FAILED";

interface EmailPOItem {
  product_name: string;
  sku: string | null;
  quantity: number;
  unit_price: number;
}

interface ParsedData {
  po_number?: string;
  partner_code?: string;
  partner_name?: string;
  order_date?: string;
  delivery_date?: string;
  items?: EmailPOItem[];
  notes?: string;
  confidence?: string;
  error?: string;
}

interface EmailPOLog {
  id: number;
  sender_email: string | null;
  subject: string | null;
  parse_status: ParseStatus;
  po_number: string | null;
  partner_code: string | null;
  parsed_data: ParsedData | null;
  po_id: number | null;
  error_message: string | null;
  created_at: string;
}

interface GmailStatus {
  connected: boolean;
  address?: string;
  labels?: string[];
  error?: string;
}

interface LabelResult {
  label: string;
  partner: string;
  imported: number;
  skipped: number;
  errors: number;
}

interface PollResult {
  imported: number;
  skipped: number;
  errors: number;
  labels_checked: LabelResult[];
  error?: string;
}

const STATUS_STYLE: Record<ParseStatus, string> = {
  PARSED:  "bg-green-100 text-green-700 border-green-300",
  PENDING: "bg-yellow-100 text-yellow-700 border-yellow-300",
  FAILED:  "bg-red-100 text-red-700 border-red-300",
};

const STATUS_ICON: Record<ParseStatus, typeof CheckCircle> = {
  PARSED:  CheckCircle,
  PENDING: Clock,
  FAILED:  XCircle,
};

const CONFIDENCE_COLOR: Record<string, string> = {
  HIGH:   "text-green-600",
  MEDIUM: "text-yellow-600",
  LOW:    "text-red-500",
};

const FILTER_OPTIONS = [
  { value: "", label: "All" },
  { value: "PARSED", label: "Parsed" },
  { value: "PENDING", label: "Pending" },
  { value: "FAILED", label: "Failed" },
];

interface TestForm {
  sender_email: string;
  subject: string;
  body_text: string;
}

const DEFAULT_TEST: TestForm = {
  sender_email: "purchaseorder@blinkit.com",
  subject: "BLINKIT_PO PO_BCPL - Ahmedabad A2 Feeder Warehouse-2738110040552 : 2026-05-12",
  body_text: `Dear Supply Partner,

Purchase Order Details:
PO Number: 2738110040552
Warehouse: Ahmedabad A2 Feeder Warehouse
Delivery Date: 2026-05-18

Items:
1. Let's Try Namkeen 200g  — SKU: LT-NK-200  — Qty: 500 units @ ₹45
2. Let's Try Chips Masala  — SKU: LT-CH-M100 — Qty: 300 units @ ₹30

Please confirm and dispatch accordingly.

Regards,
Blinkit Procurement`,
};

export default function EmailPOs() {
  const [logs, setLogs]             = useState<EmailPOLog[]>([]);
  const [loading, setLoading]       = useState(false);
  const [filter, setFilter]         = useState("");
  const [expanded, setExpanded]     = useState<Set<number>>(new Set());

  // Gmail status
  const [gmailStatus, setGmailStatus]   = useState<GmailStatus | null>(null);
  const [gmailLoading, setGmailLoading] = useState(false);

  // Poll Gmail
  const [polling, setPolling]       = useState(false);
  const [pollResult, setPollResult] = useState<PollResult | null>(null);
  const [daysBack, setDaysBack]     = useState(30);
  const [maxPerLabel, setMaxPerLabel] = useState(50);

  // Test modal
  const [showTest, setShowTest]       = useState(false);
  const [testForm, setTestForm]       = useState<TestForm>(DEFAULT_TEST);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult]   = useState<EmailPOLog | null>(null);
  const [testError, setTestError]     = useState<string | null>(null);

  // Reprocess
  const [reprocessing, setReprocessing] = useState<Set<number>>(new Set());

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await getEmailPOs({ parse_status: filter || undefined, limit: 200 });
      setLogs(res.data ?? []);
    } catch {
      setLogs([]);
    }
    setLoading(false);
  };

  const checkGmailStatus = async () => {
    setGmailLoading(true);
    try {
      const res = await getGmailStatus();
      setGmailStatus(res.data);
    } catch {
      setGmailStatus({ connected: false, error: "Could not reach backend" });
    }
    setGmailLoading(false);
  };

  useEffect(() => {
    fetchLogs();
    checkGmailStatus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchLogs(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePollGmail = async () => {
    setPolling(true);
    setPollResult(null);
    try {
      const res = await pollGmail({ days_back: daysBack, max_per_label: maxPerLabel });
      setPollResult(res.data);
      fetchLogs();
    } catch (err: any) {
      setPollResult({
        imported: 0, skipped: 0, errors: 1, labels_checked: [],
        error: err.response?.data?.detail ?? "Poll failed",
      });
    }
    setPolling(false);
  };

  const toggleRow = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleTest = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    setTestLoading(true);
    setTestError(null);
    setTestResult(null);
    try {
      const res = await testEmailPO(testForm);
      setTestResult(res.data);
      fetchLogs();
    } catch (err: any) {
      setTestError(
        err.response?.data?.detail ?? JSON.stringify(err.response?.data) ?? "Test failed"
      );
    }
    setTestLoading(false);
  };

  const handleReprocess = async (id: number) => {
    setReprocessing(prev => new Set(prev).add(id));
    try {
      await reprocessEmailPO(id);
      fetchLogs();
    } catch { /* ignore */ }
    setReprocessing(prev => { const s = new Set(prev); s.delete(id); return s; });
  };

  const stats = {
    total:   logs.length,
    parsed:  logs.filter(l => l.parse_status === "PARSED").length,
    failed:  logs.filter(l => l.parse_status === "FAILED").length,
    pending: logs.filter(l => l.parse_status === "PENDING").length,
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center">
            <Mail size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Email Purchase Orders</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              POs from Gmail — Blinkit · Swiggy · Flipkart · Amazon · BigBasket · DMart · Reliance
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setShowTest(true); setTestResult(null); setTestError(null); }}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition"
          >
            <Send size={14} /> Test Parse
          </button>
          <button
            onClick={fetchLogs}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition"
          >
            <RefreshCcw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Gmail Connection + Poll Panel */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
              gmailStatus === null      ? "bg-gray-100 text-gray-500"   :
              gmailStatus.connected    ? "bg-green-50 text-green-700"   :
                                         "bg-red-50 text-red-700"
            }`}>
              {gmailLoading
                ? <Loader2 size={12} className="animate-spin" />
                : gmailStatus?.connected
                  ? <Wifi size={12} />
                  : <WifiOff size={12} />}
              {gmailLoading
                ? "Checking…"
                : gmailStatus?.connected
                  ? `Gmail Connected — ${gmailStatus.address}`
                  : gmailStatus?.error ?? "Not connected"}
            </div>
            <button
              onClick={checkGmailStatus}
              disabled={gmailLoading}
              className="text-xs text-gray-400 hover:text-gray-600 underline disabled:opacity-50"
            >
              re-check
            </button>
          </div>

          {/* Poll controls */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <span>Past</span>
              <select
                value={daysBack}
                onChange={e => setDaysBack(Number(e.target.value))}
                className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
              >
                {[7, 14, 30, 60, 90].map(d => <option key={d} value={d}>{d} days</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <span>Max</span>
              <select
                value={maxPerLabel}
                onChange={e => setMaxPerLabel(Number(e.target.value))}
                className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
              >
                {[20, 50, 100, 200].map(n => <option key={n} value={n}>{n}/label</option>)}
              </select>
            </div>
            <button
              onClick={handlePollGmail}
              disabled={polling || !gmailStatus?.connected}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 transition font-medium"
            >
              {polling
                ? <><Loader2 size={14} className="animate-spin" /> Polling Gmail…</>
                : <><Download size={14} /> Poll Gmail Now</>}
            </button>
          </div>
        </div>

        {/* Gmail labels configured */}
        {gmailStatus?.connected && (
          <div className="text-xs text-gray-500">
            <span className="font-medium text-gray-600">Configured labels: </span>
            {["SWIGGY_PO","FLIPKART","Big_Basket_PO","DAALCHINI_PO","DMART_PO","FIRST_CLUB PO","Reliance_POs","Amazon_POs","REVISED_PO"].map(l => (
              <span key={l} className="inline-block bg-indigo-50 text-indigo-700 border border-indigo-200 rounded px-1.5 py-0.5 mr-1 mb-1 font-mono">{l}</span>
            ))}
          </div>
        )}

        {/* Poll results */}
        {pollResult && (
          <div className={`rounded-xl border p-4 text-sm ${
            pollResult.error ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"
          }`}>
            {pollResult.error ? (
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle size={16} /> {pollResult.error}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-4 font-medium text-green-800">
                  <CheckCircle size={16} className="text-green-600" />
                  <span>{pollResult.imported} new POs imported</span>
                  <span className="text-green-600 font-normal">· {pollResult.skipped} already existed · {pollResult.errors} errors</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {pollResult.labels_checked.map(l => (
                    <span key={l.label} className={`text-xs px-2 py-1 rounded-lg border ${
                      l.imported > 0 ? "bg-green-100 text-green-700 border-green-300" : "bg-gray-100 text-gray-500 border-gray-200"
                    }`}>
                      {l.label}: {l.imported} new
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Emails",  value: stats.total,   color: "bg-indigo-500", icon: Mail        },
          { label: "Parsed → PO",  value: stats.parsed,  color: "bg-green-500",  icon: CheckCircle },
          { label: "Failed",        value: stats.failed,  color: "bg-red-500",    icon: XCircle     },
          { label: "Pending",       value: stats.pending, color: "bg-yellow-500", icon: Clock       },
        ].map(({ label, value, color, icon: Icon }) => (
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

      {/* Filter */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
        <span className="text-sm text-gray-600 font-medium">Filter</span>
        <div className="flex gap-2">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                filter === opt.value
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-gray-400">{logs.length} emails</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-gray-400">
            <Loader2 size={28} className="mx-auto mb-3 animate-spin text-indigo-400" />
            Loading email POs…
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Mail size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No email POs yet</p>
            <p className="text-sm mt-1">
              Click <strong>Poll Gmail Now</strong> to import from your inbox, or use <strong>Test Parse</strong> to try a sample.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left w-8"></th>
                <th className="px-4 py-3 text-left">Sender</th>
                <th className="px-4 py-3 text-left">Subject</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">PO Number</th>
                <th className="px-4 py-3 text-left">Partner</th>
                <th className="px-4 py-3 text-left">Confidence</th>
                <th className="px-4 py-3 text-left">Received</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map(log => {
                const isExpanded  = expanded.has(log.id);
                const Icon        = STATUS_ICON[log.parse_status];
                const confidence  = log.parsed_data?.confidence;
                const gmailLabel  = (log.parsed_data as any)?.gmail_label
                                 ?? (log as any)?.raw_payload?.gmail_label;
                return (
                  <>
                    <tr key={log.id} className={`hover:bg-gray-50 ${isExpanded ? "bg-indigo-50/30" : ""}`}>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleRow(log.id)} className="text-gray-400 hover:text-indigo-600 transition">
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-gray-700 truncate max-w-[140px]">{log.sender_email || "—"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-gray-700 truncate max-w-[220px]">{log.subject || "—"}</div>
                        {gmailLabel && (
                          <span className="text-[10px] font-mono bg-indigo-50 text-indigo-600 px-1 rounded">{gmailLabel}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_STYLE[log.parse_status]}`}>
                          <Icon size={11} /> {log.parse_status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-indigo-700">{log.po_number || "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {log.partner_code || log.parsed_data?.partner_code || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {confidence
                          ? <span className={`text-xs font-semibold ${CONFIDENCE_COLOR[confidence] ?? "text-gray-500"}`}>{confidence}</span>
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString("en-IN", {
                          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {(log.parse_status === "FAILED" || log.parse_status === "PENDING") && (
                          <button
                            onClick={() => handleReprocess(log.id)}
                            disabled={reprocessing.has(log.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
                          >
                            {reprocessing.has(log.id) ? <Loader2 size={11} className="animate-spin" /> : <RefreshCcw size={11} />}
                            Retry
                          </button>
                        )}
                        {log.parse_status === "PARSED" && log.po_id && (
                          <span className="text-xs text-green-600 font-medium">PO #{log.po_id} ✓</span>
                        )}
                      </td>
                    </tr>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <tr key={`${log.id}-detail`}>
                        <td colSpan={9} className="bg-indigo-50/40 px-8 py-4 border-b border-indigo-100">
                          {log.parse_status === "FAILED" ? (
                            <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                              <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
                              <span>{log.error_message || log.parsed_data?.error || "Parse failed — click Retry"}</span>
                            </div>
                          ) : log.parsed_data?.items?.length ? (
                            <div className="space-y-3">
                              <div className="flex flex-wrap gap-4 text-xs text-gray-600">
                                {log.parsed_data.partner_name && <span><strong>Partner:</strong> {log.parsed_data.partner_name}</span>}
                                {log.parsed_data.order_date   && <span><strong>Order Date:</strong> {log.parsed_data.order_date}</span>}
                                {log.parsed_data.delivery_date && <span><strong>Delivery:</strong> {log.parsed_data.delivery_date}</span>}
                                {log.parsed_data.notes        && <span><strong>Notes:</strong> {log.parsed_data.notes}</span>}
                              </div>
                              <table className="w-full text-xs border-collapse">
                                <thead>
                                  <tr className="text-gray-500 border-b border-indigo-100">
                                    <th className="text-left pb-1.5 pr-4 font-medium">Product</th>
                                    <th className="text-left pb-1.5 pr-4 font-medium">SKU</th>
                                    <th className="text-right pb-1.5 pr-4 font-medium">Qty</th>
                                    <th className="text-right pb-1.5 font-medium">Unit Price</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {log.parsed_data.items.map((item, idx) => (
                                    <tr key={idx} className="border-b border-indigo-50 last:border-0">
                                      <td className="py-1.5 pr-4 text-gray-700">{item.product_name}</td>
                                      <td className="py-1.5 pr-4 font-mono text-indigo-600">{item.sku || "—"}</td>
                                      <td className="py-1.5 pr-4 text-right font-semibold">{item.quantity}</td>
                                      <td className="py-1.5 text-right text-gray-500">
                                        {item.unit_price > 0 ? `₹${item.unit_price}` : "—"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 italic">Parsing in progress or no items found</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Test Parse Modal */}
      {showTest && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={() => !testLoading && setShowTest(false)}>
          <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl my-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h3 className="font-bold text-gray-800">Test Email PO Parser</h3>
                <p className="text-xs text-gray-500 mt-0.5">Simulate an email — Claude AI will parse it and try to create a PO</p>
              </div>
              {!testLoading && <button onClick={() => setShowTest(false)} className="text-gray-400 hover:text-gray-700 text-lg">✕</button>}
            </div>

            {testResult ? (
              <div className="p-8 space-y-4">
                <div className={`flex items-center gap-3 p-4 rounded-xl border ${
                  testResult.parse_status === "PARSED" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                }`}>
                  {testResult.parse_status === "PARSED"
                    ? <CheckCircle size={24} className="text-green-500 flex-shrink-0" />
                    : <XCircle size={24} className="text-red-500 flex-shrink-0" />}
                  <div>
                    <p className="font-semibold text-sm text-gray-800">
                      {testResult.parse_status === "PARSED"
                        ? `PO Created — #${testResult.po_id}`
                        : "Parse Failed"}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {testResult.parse_status === "PARSED"
                        ? `PO Number: ${testResult.po_number} · Partner: ${testResult.partner_code}`
                        : testResult.error_message}
                    </p>
                  </div>
                </div>
                {testResult.parsed_data?.items?.length ? (
                  <div className="border border-gray-100 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-gray-500">
                        <tr>
                          <th className="px-3 py-2 text-left">Product</th>
                          <th className="px-3 py-2 text-left">SKU</th>
                          <th className="px-3 py-2 text-right">Qty</th>
                          <th className="px-3 py-2 text-right">Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {testResult.parsed_data.items.map((item: EmailPOItem, i: number) => (
                          <tr key={i}>
                            <td className="px-3 py-2 text-gray-700">{item.product_name}</td>
                            <td className="px-3 py-2 font-mono text-indigo-600">{item.sku || "—"}</td>
                            <td className="px-3 py-2 text-right font-semibold">{item.quantity}</td>
                            <td className="px-3 py-2 text-right text-gray-500">{item.unit_price > 0 ? `₹${item.unit_price}` : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowTest(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition">Close</button>
                  <button onClick={() => { setTestResult(null); setTestError(null); }} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition">Test Again</button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleTest} className="p-5 space-y-4">
                {testError && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                    <AlertCircle size={15} className="mt-0.5 flex-shrink-0" /><span className="break-all">{testError}</span>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">From (sender email)</label>
                  <input required type="email" value={testForm.sender_email} onChange={e => setTestForm({ ...testForm, sender_email: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
                  <input required type="text" value={testForm.subject} onChange={e => setTestForm({ ...testForm, subject: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email Body</label>
                  <textarea required rows={9} value={testForm.body_text} onChange={e => setTestForm({ ...testForm, body_text: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
                </div>
                <div className="flex gap-3 pt-1 border-t border-gray-100">
                  <button type="button" onClick={() => setShowTest(false)} disabled={testLoading} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 transition">Cancel</button>
                  <button type="submit" disabled={testLoading} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 transition">
                    {testLoading ? <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Parsing…</span> : "Parse with Claude AI"}
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
