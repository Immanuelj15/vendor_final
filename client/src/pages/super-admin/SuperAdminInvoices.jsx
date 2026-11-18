import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  FileText, Search, Download, RefreshCw, Calendar, AlertCircle,
  CheckCircle2, Clock, Loader2, DollarSign, XCircle, ShieldAlert,
  Percent, ArrowRight, Ban, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const SuperAdminInvoices = () => {
  const [stats, setStats] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Cancellation Modal state
  const [cancellingInvoice, setCancellingInvoice] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    fetchStats();
    fetchInvoices();
  }, [page, statusFilter, typeFilter]);

  const fetchStats = async () => {
    try {
      const res = await api.get('/invoices/admin/stats');
      if (res.data?.success) {
        setStats(res.data.data.stats);
      }
    } catch (e) {
      console.warn('Failed to load invoice stats', e);
    }
  };

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { page, limit: 15 };
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.invoiceType = typeFilter;
      if (searchQuery) params.invoiceNumber = searchQuery;

      const res = await api.get('/invoices/admin/all', { params });
      if (res.data?.success) {
        setInvoices(res.data.data.invoices || []);
        setTotalPages(res.data.data.totalPages || 1);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch platform invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchInvoices();
  };

  const handleDownloadPdf = async (invoiceId, invoiceNumber) => {
    try {
      const res = await api.get(`/invoices/${invoiceId}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const fileUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = fileUrl;
      const safeNum = (invoiceNumber || invoiceId).replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `Invoice_${safeNum}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(fileUrl);
      a.remove();
    } catch (err) {
      console.warn('Authenticated download fallback:', err);
      const token = localStorage.getItem('fk_access_token') || localStorage.getItem('token') || localStorage.getItem('accessToken');
      window.open(`http://localhost:5000/api/invoices/${invoiceId}/pdf${token ? `?token=${token}` : ''}`, '_blank');
    }
  };

  const handleCancelSubmit = async (e) => {
    e.preventDefault();
    if (!cancellingInvoice) return;
    try {
      setCancelling(true);
      setActionError(null);
      await api.post(`/invoices/${cancellingInvoice._id}/cancel`, { reason: cancelReason });
      setActionSuccess(`Invoice #${cancellingInvoice.invoiceNumber} cancelled and Credit Note generated.`);
      setCancellingInvoice(null);
      setCancelReason('');
      fetchStats();
      fetchInvoices();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to cancel invoice');
    } finally {
      setCancelling(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PAID':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">PAID</span>;
      case 'CANCELLED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">CANCELLED</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">{status}</span>;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <span>Platform Invoice & Tax Management</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Centralized registry of customer tax invoices, multi-vendor seller bills, and credit notes
          </p>
        </div>
        <button
          onClick={() => { fetchStats(); fetchInvoices(); }}
          className="p-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 shadow-xs text-xs font-bold transition flex items-center gap-2 self-start"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Invoices</span>
          <p className="text-2xl font-black text-slate-900 mt-2">{stats?.totalInvoices || 0}</p>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Issued across platform</span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Paid Volume</span>
          <p className="text-2xl font-black text-emerald-600 mt-2">
            ₹{Number(stats?.totalPaidValue || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-slate-400 mt-0.5 block">{stats?.paidInvoices || 0} settled transactions</span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total GST Collected</span>
          <p className="text-2xl font-black text-indigo-600 mt-2">
            ₹{Number(stats?.totalCollectedTax || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-slate-400 mt-0.5 block">CGST + SGST + IGST</span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cancelled / Adjustments</span>
          <p className="text-2xl font-black text-rose-600 mt-2">{stats?.cancelledInvoices || 0}</p>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Credit notes generated</span>
        </div>
      </div>

      {/* Alert Notices */}
      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-emerald-800 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-500 hover:text-emerald-700">✕</button>
        </div>
      )}
      {actionError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-rose-800 text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-500 hover:text-rose-700">✕</button>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            {['', 'PAID', 'ISSUED', 'CANCELLED'].map((st) => (
              <button
                key={st}
                onClick={() => { setStatusFilter(st); setPage(1); }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                  statusFilter === st
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {st === '' ? 'All Statuses' : st}
              </button>
            ))}
          </div>

          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-80">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Invoice or Order #..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
            <button
              type="submit"
              className="px-3.5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      {/* Invoice Table */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 bg-white border border-slate-200/80 rounded-3xl">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-xs font-bold text-slate-500">Loading platform invoices...</p>
        </div>
      ) : invoices.length === 0 ? (
        <div className="py-20 text-center bg-white border border-slate-200/80 rounded-3xl space-y-3">
          <FileText className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-black text-slate-800">No invoices found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Invoices are created automatically when orders are confirmed across the BAAPOO MART marketplace.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Invoice No</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Seller / Vendor</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4 text-right">Taxable</th>
                  <th className="py-3 px-4 text-right">GST</th>
                  <th className="py-3 px-4 text-right">Grand Total</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {invoices.map((inv) => (
                  <tr key={inv._id} className="hover:bg-slate-50/50 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-indigo-600">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        inv.isCreditNote ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {inv.isCreditNote ? 'CREDIT NOTE' : inv.invoiceType?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {new Date(inv.issueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-900">{inv.sellerSnapshot?.storeName || 'BAAPOO Direct'}</p>
                      {inv.sellerSnapshot?.gstin && (
                        <p className="text-[10px] text-slate-400 font-mono">GST: {inv.sellerSnapshot.gstin}</p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      <p className="font-bold">{inv.buyerSnapshot?.name || 'Customer'}</p>
                      <p className="text-[10px] text-slate-400">Order #{inv.orderNumber}</p>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-600">
                      ₹{Number(inv.pricing?.taxableAmount || 0).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-600">
                      ₹{Number(inv.pricing?.taxTotal || 0).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                      ₹{Number(inv.pricing?.grandTotal || 0).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4">
                      {getStatusBadge(inv.status)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleDownloadPdf(inv._id, inv.invoiceNumber)}
                          className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold inline-flex items-center gap-1 transition text-[11px]"
                          title="Download PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                        {inv.status !== 'CANCELLED' && !inv.isCreditNote && (
                          <button
                            onClick={() => setCancellingInvoice(inv)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                            title="Cancel Invoice & Issue Credit Note"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cancellation & Credit Note Modal */}
      <AnimatePresence>
        {cancellingInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <Ban className="w-4 h-4 text-rose-600" />
                  <span>Cancel Invoice & Issue Credit Note</span>
                </h3>
                <button onClick={() => setCancellingInvoice(null)} className="p-1 text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-slate-600">
                You are cancelling Invoice <strong className="text-slate-900 font-mono">#{cancellingInvoice.invoiceNumber}</strong>.
                Per Indian GST regulations, this will mark the original invoice cancelled and issue an official sequential Credit Note document.
              </p>

              <form onSubmit={handleCancelSubmit} className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Reason for Cancellation / Credit Note *
                  </label>
                  <input
                    required
                    type="text"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="e.g., Customer return, billing adjustment, order cancelled"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setCancellingInvoice(null)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={cancelling}
                    className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5"
                  >
                    {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                    <span>Issue Credit Note</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default SuperAdminInvoices;

