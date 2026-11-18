import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  FileText,
  Search,
  Download,
  Calendar,
  CreditCard,
  Crown,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  TrendingUp,
  Receipt,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const VendorSubscriptionHistory = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);
  const [error, setError] = useState(null);

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Selected invoice for detail view modal
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  useEffect(() => {
    fetchSubscriptionInvoices();
  }, [page]);

  const fetchSubscriptionInvoices = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        page,
        limit: 15,
        search: search.trim() || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      };

      const res = await api.get('/vendor-subscriptions/invoices/my-invoices', { params });
      if (res.data?.success) {
        setInvoices(res.data.data.invoices || []);
        setTotalPages(res.data.data.totalPages || 1);
        setTotalCount(res.data.data.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch vendor subscription invoices:', err);
      // Fallback: fetch from /vendor-subscriptions/history
      try {
        const fallbackRes = await api.get('/vendor-subscriptions/history');
        const historyList = fallbackRes.data?.data?.history || [];
        setInvoices(
          historyList.map((h) => ({
            _id: h.invoice?._id || h._id,
            invoiceNumber: h.invoice?.invoiceNumber || `VSI-PENDING-${String(h._id).slice(-6)}`,
            issueDate: h.createdAt,
            planSnapshot: {
              name: h.planNameSnapshot || h.planId?.name || 'Vendor Subscription',
              planType: h.durationSnapshot?.planType || 'Standard',
            },
            subscriptionDates: {
              startDate: h.startDate,
              endDate: h.endDate || h.expiryDate,
              expiryDate: h.expiryDate || h.endDate,
              durationValue: h.durationSnapshot?.durationValue || 1,
              durationUnit: h.durationSnapshot?.durationUnit || 'months',
              subscriptionStatus: h.subscriptionStatus || h.status || 'Active',
            },
            pricing: {
              finalAmount: h.planPriceSnapshot || h.amount || 0,
            },
            paymentMethod: h.paymentId?.paymentMethod || 'RAZORPAY',
            transactionId: h.transactionId || h.paymentId?.transactionId || 'N/A',
            status: h.paymentStatus === 'Paid' || h.status === 'ACTIVE' ? 'PAID' : 'PENDING',
          }))
        );
        setTotalCount(historyList.length);
      } catch (fbErr) {
        setError(err.response?.data?.message || 'Failed to load subscription invoices. Please refresh.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchSubscriptionInvoices();
  };

  const handleResetFilters = () => {
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
    setTimeout(() => {
      fetchSubscriptionInvoices();
    }, 50);
  };

  const handleDownloadPdf = async (invoiceId, invoiceNumber) => {
    try {
      setDownloadingId(invoiceId);
      const res = await api.get(`/vendor-subscriptions/invoices/${invoiceId}/pdf`, {
        responseType: 'blob',
      });

      const blob = new Blob([res.data], { type: 'application/pdf' });
      const fileUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = fileUrl;
      const safeNum = (invoiceNumber || invoiceId).replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `Vendor_Subscription_Invoice_${safeNum}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(fileUrl);
      a.remove();
    } catch (err) {
      console.warn('Authenticated blob download fallback:', err);
      const token =
        localStorage.getItem('fk_access_token') ||
        localStorage.getItem('token') ||
        localStorage.getItem('accessToken');
      window.open(
        `http://localhost:5000/api/vendor-subscriptions/invoices/${invoiceId}/pdf${
          token ? `?token=${token}` : ''
        }`,
        '_blank'
      );
    } finally {
      setDownloadingId(null);
    }
  };

  // KPI Calculations
  const totalSpent = invoices.reduce((sum, inv) => sum + (Number(inv.pricing?.finalAmount) || 0), 0);
  const activeInvoice = invoices.find(
    (inv) =>
      new Date(inv.subscriptionDates?.expiryDate) > new Date() &&
      inv.subscriptionDates?.subscriptionStatus?.toLowerCase() === 'active'
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-7xl mx-auto"
    >
      {/* ─── 1. Page Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#30358F] text-white flex items-center justify-center shadow-md shadow-indigo-900/20">
              <Receipt className="w-5 h-5" />
            </div>
            <span>Vendor Subscription Invoices</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Official B2B tax invoices, plan validity periods, and verified payment records for your merchant storefront
          </p>
        </div>
        <button
          onClick={fetchSubscriptionInvoices}
          disabled={loading}
          className="self-start sm:self-auto px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:border-slate-300 font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Records
        </button>
      </div>

      {/* ─── 2. Top Summary KPI Cards ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Total Invoices</span>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{totalCount}</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Subscription billing cycles</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-[#30358F] flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase text-emerald-600 tracking-wider">Current Active Plan</span>
            <h3 className="text-lg font-black text-slate-900 mt-1 truncate max-w-[150px]">
              {activeInvoice?.planSnapshot?.name || 'Active Subscription'}
            </h3>
            <p className="text-[10px] text-emerald-600 font-bold mt-0.5">Verified & In Good Standing</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Crown className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase text-blue-600 tracking-wider">Total Subscription Spend</span>
            <h3 className="text-2xl font-black text-slate-900 mt-1">
              ₹{totalSpent.toLocaleString('en-IN')}
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Tax-inclusive platform fee</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase text-amber-600 tracking-wider">Next Plan Renewal</span>
            <h3 className="text-sm font-black text-slate-900 mt-1">
              {activeInvoice?.subscriptionDates?.expiryDate
                ? new Date(activeInvoice.subscriptionDates.expiryDate).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })
                : 'Auto-Renew / Annual'}
            </h3>
            <p className="text-[10px] text-amber-600 font-bold mt-0.5">Calendar-day expiration</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ─── 3. Search and Date Filters Bar ────────────────────────────── */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by invoice number (e.g. VSI/2026-27/000001), transaction ID, plan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#30358F]"
            />
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>From:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-transparent focus:outline-none text-slate-900 text-xs font-medium"
            />
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>To:</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-transparent focus:outline-none text-slate-900 text-xs font-medium"
            />
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-[#30358F] text-white font-bold rounded-xl text-xs hover:bg-[#252a73] transition shadow-xs"
          >
            Apply Filter
          </button>

          {(search || dateFrom || dateTo) && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs font-bold text-rose-600 hover:text-rose-800 underline ml-1"
            >
              Reset
            </button>
          )}
        </form>
      </div>

      {/* ─── 4. Invoices Table ─────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-[#30358F] animate-spin" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Loading Verified Subscription Invoices...
            </p>
          </div>
        ) : error ? (
          <div className="p-12 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
            <p className="text-sm font-bold text-slate-700">{error}</p>
            <button
              onClick={fetchSubscriptionInvoices}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition"
            >
              Try Again
            </button>
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-16 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Receipt className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">No Subscription Invoices Found</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Invoices are generated automatically as soon as you purchase or renew a vendor subscription plan.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-100 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  <th className="py-4 px-6">Invoice Number</th>
                  <th className="py-4 px-4">Plan & Tier</th>
                  <th className="py-4 px-4">Duration</th>
                  <th className="py-4 px-4">Validity Window</th>
                  <th className="py-4 px-4 text-right">Amount Paid</th>
                  <th className="py-4 px-4 text-center">Payment Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {invoices.map((inv) => {
                  const issueDateFormatted = new Date(inv.issueDate || inv.createdAt).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  });

                  const startDateFormatted = inv.subscriptionDates?.startDate
                    ? new Date(inv.subscriptionDates.startDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'N/A';

                  const expiryDateFormatted = inv.subscriptionDates?.expiryDate
                    ? new Date(inv.subscriptionDates.expiryDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'N/A';

                  const planName = inv.planSnapshot?.name || 'Merchant Plan';
                  const amount = Number(inv.pricing?.finalAmount || 0);

                  return (
                    <tr key={inv._id} className="hover:bg-slate-50/60 transition group">
                      {/* Invoice Number & Date */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-[#30358F] flex items-center justify-center shrink-0 font-bold">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-black text-slate-900 group-hover:text-[#30358F] transition font-mono">
                              {inv.invoiceNumber}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Issued: {issueDateFormatted}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Plan & Tier */}
                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          <Crown className="w-3.5 h-3.5 text-amber-500" />
                          <span>{planName}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                          Txn: {inv.transactionId ? String(inv.transactionId).slice(-10) : 'Verified'}
                        </div>
                      </td>

                      {/* Duration */}
                      <td className="py-4 px-4 font-semibold text-slate-700">
                        {inv.subscriptionDates?.durationValue || 1}{' '}
                        {inv.subscriptionDates?.durationUnit || 'months'}
                      </td>

                      {/* Validity Period */}
                      <td className="py-4 px-4">
                        <div className="text-slate-800 font-medium">
                          {startDateFormatted} &rarr;
                        </div>
                        <div className="text-[11px] font-bold text-indigo-700 mt-0.5">
                          {expiryDateFormatted}
                        </div>
                      </td>

                      {/* Amount Paid */}
                      <td className="py-4 px-4 text-right">
                        <span className="font-black text-slate-900 text-sm">
                          ₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {inv.paymentMethod || 'RAZORPAY'}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          {inv.status || 'PAID'}
                        </span>
                      </td>

                      {/* Actions: Download PDF & Details */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedInvoice(inv)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
                            title="View invoice summary"
                          >
                            Details
                          </button>
                          <button
                            onClick={() => handleDownloadPdf(inv._id, inv.invoiceNumber)}
                            disabled={downloadingId === inv._id}
                            className="px-3 py-1.5 bg-[#30358F] hover:bg-[#252a73] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition"
                          >
                            {downloadingId === inv._id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                            <span>PDF</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 bg-slate-50/75 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>
              Page {page} of {totalPages} ({totalCount} total invoices)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 font-bold transition"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 font-bold transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── 5. Invoice Quick View Modal ──────────────────────────────── */}
      <AnimatePresence>
        {selectedInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-[#30358F] flex items-center justify-center font-bold">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-sm">Subscription Invoice Details</h3>
                    <p className="text-[11px] font-mono text-slate-500">{selectedInvoice.invoiceNumber}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 text-xs space-y-3 border border-slate-100">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold">Plan Name</span>
                    <div className="font-extrabold text-slate-800 text-sm">{selectedInvoice.planSnapshot?.name}</div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold">Status</span>
                    <div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800">
                        {selectedInvoice.status || 'PAID'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/60">
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold">Start Date</span>
                    <div className="font-semibold text-slate-700">
                      {new Date(selectedInvoice.subscriptionDates?.startDate).toLocaleDateString('en-IN')}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold">Expiry Date</span>
                    <div className="font-semibold text-slate-700">
                      {new Date(selectedInvoice.subscriptionDates?.expiryDate).toLocaleDateString('en-IN')}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/60 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Plan Base Price:</span>
                    <span className="font-semibold text-slate-700">
                      ₹{Number(selectedInvoice.pricing?.planPrice || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  {Number(selectedInvoice.pricing?.discount || 0) > 0 && (
                    <div className="flex justify-between text-emerald-600 font-semibold">
                      <span>Discount:</span>
                      <span>-₹{Number(selectedInvoice.pricing?.discount).toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Taxable Value:</span>
                    <span className="font-semibold text-slate-700">
                      ₹{Number(selectedInvoice.pricing?.taxableAmount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Applicable GST:</span>
                    <span className="font-semibold text-slate-700">
                      ₹{Number(selectedInvoice.pricing?.totalTax || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
                    <span>Total Amount Paid:</span>
                    <span className="text-[#30358F]">
                      ₹{Number(selectedInvoice.pricing?.finalAmount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
                >
                  Close
                </button>
                <button
                  onClick={() => handleDownloadPdf(selectedInvoice._id, selectedInvoice.invoiceNumber)}
                  className="px-4 py-2 bg-[#30358F] hover:bg-[#252a73] text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default VendorSubscriptionHistory;
