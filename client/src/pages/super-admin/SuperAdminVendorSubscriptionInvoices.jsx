import React, { useState, useEffect } from 'react';
import api from '../../services/api';
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
  Store,
  DollarSign,
  User,
  Filter,
  Eye,
  X,
  Share2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const SuperAdminVendorSubscriptionInvoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);
  const [error, setError] = useState(null);

  // KPIs
  const [stats, setStats] = useState({
    totalInvoices: 0,
    totalRevenue: 0,
    totalTaxCollected: 0,
    totalReferralCommissions: 0,
    activeSubscriptions: 0,
    expiredSubscriptions: 0,
  });

  // Filters State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [planFilter, setPlanFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Selected invoice for detail view modal
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  useEffect(() => {
    fetchInvoices();
    fetchStats();
  }, [page, statusFilter]);

  const fetchStats = async () => {
    try {
      const res = await api.get('/vendor-subscriptions/invoices/admin/stats');
      if (res.data?.success) {
        setStats(res.data.data.stats || {});
      }
    } catch (err) {
      console.warn('Failed to fetch admin subscription invoice stats:', err);
    }
  };

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        page,
        limit: 15,
        search: search.trim() || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        plan: planFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      };

      const res = await api.get('/vendor-subscriptions/invoices/admin/all', { params });
      if (res.data?.success) {
        setInvoices(res.data.data.invoices || []);
        setTotalPages(res.data.data.totalPages || 1);
        setTotalCount(res.data.data.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch admin subscription invoices:', err);
      setError(err.response?.data?.message || 'Failed to fetch subscription invoices.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchInvoices();
  };

  const handleResetFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setPlanFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
    setTimeout(() => {
      fetchInvoices();
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
      console.warn('Authenticated download fallback:', err);
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-7xl mx-auto"
    >
      {/* ─── 1. Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#30358F] text-white flex items-center justify-center shadow-md shadow-indigo-900/20">
              <Receipt className="w-5 h-5" />
            </div>
            <span>Platform Vendor Subscription Invoices</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Official B2B sequential tax invoices (VSI series), financial ledger records, GST audit data, and vendor referral records
          </p>
        </div>
        <button
          onClick={() => {
            fetchInvoices();
            fetchStats();
          }}
          disabled={loading}
          className="self-start sm:self-auto px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:border-slate-300 font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Ledger
        </button>
      </div>

      {/* ─── 2. Top Summary KPI Cards (Super Admin) ─────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Subscription Invoices */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Total Invoices</span>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{stats.totalInvoices || totalCount}</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Sequential VSI series</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-[#30358F] flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Total Subscription Revenue */}
        <div className="bg-white p-5 rounded-3xl border border-emerald-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase text-emerald-600 tracking-wider">Total Sub. Revenue</span>
            <h3 className="text-2xl font-black text-emerald-900 mt-1">
              ₹{(stats.totalRevenue || 0).toLocaleString('en-IN')}
            </h3>
            <p className="text-[10px] text-emerald-600 font-bold mt-0.5">Verified & Collected</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Active Subscriptions */}
        <div className="bg-white p-5 rounded-3xl border border-blue-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase text-blue-600 tracking-wider">Active Merchants</span>
            <h3 className="text-2xl font-black text-blue-900 mt-1">
              {stats.activeSubscriptions || 0}
            </h3>
            <p className="text-[10px] text-blue-600 font-bold mt-0.5">Valid seller storefronts</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Store className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Total Referral Commissions */}
        <div className="bg-white p-5 rounded-3xl border border-amber-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase text-amber-600 tracking-wider">Referral Commissions</span>
            <h3 className="text-2xl font-black text-amber-900 mt-1">
              ₹{(stats.totalReferralCommissions || 0).toLocaleString('en-IN')}
            </h3>
            <p className="text-[10px] text-amber-600 font-bold mt-0.5">10% direct MLM bonus</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Share2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ─── 3. Search and Date Filters Bar ────────────────────────────── */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by invoice number, store name, vendor email, transaction ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#30358F]"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-transparent focus:outline-none font-bold text-slate-900 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="PAID">PAID</option>
              <option value="PENDING">PENDING</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
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
            Apply Filters
          </button>

          {(search || statusFilter !== 'ALL' || dateFrom || dateTo) && (
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

      {/* ─── 4. Platform Invoices Table ────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-[#30358F] animate-spin" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Loading Platform Vendor Subscription Invoices...
            </p>
          </div>
        ) : error ? (
          <div className="p-12 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
            <p className="text-sm font-bold text-slate-700">{error}</p>
            <button
              onClick={fetchInvoices}
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
              <h3 className="text-base font-bold text-slate-800">No Vendor Subscription Invoices Found</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                No subscription purchases matching your current filter criteria were found in the database.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-100 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  <th className="py-4 px-6">Invoice Number</th>
                  <th className="py-4 px-4">Vendor & Store</th>
                  <th className="py-4 px-4">Plan & Cycle</th>
                  <th className="py-4 px-4">Validity Period</th>
                  <th className="py-4 px-4 text-right">Amount (INR)</th>
                  <th className="py-4 px-4 text-center">Status</th>
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

                  const storeName = inv.vendorSnapshot?.storeName || 'Merchant';
                  const ownerName = inv.vendorSnapshot?.ownerName || '';
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
                              {issueDateFormatted}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Vendor & Store */}
                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <Store className="w-3.5 h-3.5 text-blue-600" />
                          <span>{storeName}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {ownerName ? `${ownerName} • ` : ''}{inv.vendorSnapshot?.email || 'N/A'}
                        </div>
                      </td>

                      {/* Plan & Cycle */}
                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-800 flex items-center gap-1">
                          <Crown className="w-3 h-3 text-amber-500" />
                          <span>{inv.planSnapshot?.name || 'Subscription'}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {inv.subscriptionDates?.durationValue || 1} {inv.subscriptionDates?.durationUnit || 'months'}
                        </div>
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

                      {/* Amount */}
                      <td className="py-4 px-4 text-right">
                        <span className="font-black text-slate-900 text-sm">
                          ₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                          {inv.transactionId ? String(inv.transactionId).slice(-10) : 'RAZORPAY'}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          {inv.status || 'PAID'}
                        </span>
                      </td>

                      {/* Actions: View Details & PDF Download */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedInvoice(inv)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
                            title="View complete record & internal referral commissions"
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
              Showing Page {page} of {totalPages} ({totalCount} total invoices)
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

      {/* ─── 5. Super Admin Invoice Detail Modal ──────────────────────── */}
      <AnimatePresence>
        {selectedInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-xl rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-[#30358F] flex items-center justify-center font-bold">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-sm">Super Admin Subscription Invoice Audit</h3>
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

              {/* Vendor & Store Information */}
              <div className="bg-slate-50 rounded-2xl p-4 text-xs space-y-2 border border-slate-100">
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  Vendor Merchant Details
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-slate-400">Store Name:</span>
                    <div className="font-extrabold text-slate-900 text-sm">{selectedInvoice.vendorSnapshot?.storeName}</div>
                  </div>
                  <div>
                    <span className="text-slate-400">Proprietor / Contact:</span>
                    <div className="font-bold text-slate-800">{selectedInvoice.vendorSnapshot?.ownerName || 'N/A'}</div>
                  </div>
                  <div>
                    <span className="text-slate-400">Email:</span>
                    <div className="font-medium text-slate-700">{selectedInvoice.vendorSnapshot?.email || 'N/A'}</div>
                  </div>
                  <div>
                    <span className="text-slate-400">Phone:</span>
                    <div className="font-medium text-slate-700">{selectedInvoice.vendorSnapshot?.phone || 'N/A'}</div>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400">Business Address:</span>
                    <div className="font-medium text-slate-700">{selectedInvoice.vendorSnapshot?.businessAddress || 'Address on file'}</div>
                  </div>
                  <div>
                    <span className="text-slate-400">Vendor GSTIN:</span>
                    <div className="font-mono font-bold text-slate-800">{selectedInvoice.vendorSnapshot?.gstin || 'Unregistered / Composition'}</div>
                  </div>
                </div>
              </div>

              {/* Subscription & Pricing Breakdown */}
              <div className="bg-slate-50 rounded-2xl p-4 text-xs space-y-2 border border-slate-100">
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  Subscription & Financial Settlement
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-slate-400">Plan Name:</span>
                    <div className="font-black text-slate-900">{selectedInvoice.planSnapshot?.name}</div>
                  </div>
                  <div>
                    <span className="text-slate-400">Validity:</span>
                    <div className="font-bold text-indigo-700">
                      {new Date(selectedInvoice.subscriptionDates?.startDate).toLocaleDateString('en-IN')} &rarr;{' '}
                      {new Date(selectedInvoice.subscriptionDates?.expiryDate).toLocaleDateString('en-IN')}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400">Transaction ID:</span>
                    <div className="font-mono text-slate-800">{selectedInvoice.transactionId}</div>
                  </div>
                  <div>
                    <span className="text-slate-400">Payment Status:</span>
                    <div className="font-black text-emerald-700">{selectedInvoice.status || 'PAID'}</div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/60 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Plan Base Price:</span>
                    <span className="font-semibold text-slate-700">₹{Number(selectedInvoice.pricing?.planPrice || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Discount:</span>
                    <span className="font-semibold text-emerald-600">-₹{Number(selectedInvoice.pricing?.discount || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Net Taxable Value:</span>
                    <span className="font-semibold text-slate-700">₹{Number(selectedInvoice.pricing?.taxableAmount || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Platform GST ({selectedInvoice.pricing?.taxRate || 0}%):</span>
                    <span className="font-semibold text-slate-700">₹{Number(selectedInvoice.pricing?.totalTax || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
                    <span>Total Amount Paid:</span>
                    <span className="text-[#30358F]">₹{Number(selectedInvoice.pricing?.finalAmount || 0).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Super Admin Internal Referral Commission Snapshot */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 text-xs space-y-2">
                <div className="flex items-center gap-1.5 text-amber-900 font-black uppercase text-[10px] tracking-wider">
                  <Share2 className="w-3.5 h-3.5 text-amber-600" />
                  <span>Internal Referral Commission Record (Confidential Admin Ledger)</span>
                </div>
                {selectedInvoice.referralCommissionSnapshot?.isReferred ? (
                  <div className="grid grid-cols-2 gap-2 text-slate-700 pt-1">
                    <div>
                      <span className="text-slate-400">Referring Sponsor:</span>
                      <div className="font-bold text-slate-900">{selectedInvoice.referralCommissionSnapshot.referredByStoreName || 'Sponsor Vendor'}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Commission Rate:</span>
                      <div className="font-bold text-emerald-700">{selectedInvoice.referralCommissionSnapshot.commissionRatePercent || 10}% Direct</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Commission Payable:</span>
                      <div className="font-black text-emerald-700 text-sm">
                        ₹{Number(selectedInvoice.referralCommissionSnapshot.commissionAmount || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">Commission Ledger Status:</span>
                      <div className="font-bold text-emerald-700">PROCESSED TO MLM WALLET</div>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-500 italic text-[11px] pt-1">
                    Direct platform signup — no vendor sponsor referral commission allocated.
                  </p>
                )}
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
                  <span>Download PDF Invoice</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default SuperAdminVendorSubscriptionInvoices;

