import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  FileText, Search, Download, RefreshCw, Calendar, AlertCircle,
  CheckCircle2, Clock, Loader2, ArrowRight, ExternalLink, Receipt
} from 'lucide-react';
import { motion } from 'framer-motion';
import { VendorSubscriptionHistory } from './VendorSubscriptionHistory';

export const VendorInvoices = () => {
  const [activeInvoiceTab, setActiveInvoiceTab] = useState('ORDERS'); // 'ORDERS' | 'SUBSCRIPTION'
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchInvoice, setSearchInvoice] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchInvoices();
  }, [page, statusFilter]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { page, limit: 15 };
      if (statusFilter) params.status = statusFilter;
      if (searchInvoice) params.invoiceNumber = searchInvoice;

      const res = await api.get('/invoices/vendor/my-invoices', { params });
      if (res.data?.success) {
        setInvoices(res.data.data.invoices || []);
        setTotalPages(res.data.data.totalPages || 1);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch merchant invoices');
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
      return;
    } catch (err) {
      console.warn('Authenticated download fallback:', err);
      const token = localStorage.getItem('fk_access_token') || localStorage.getItem('token') || localStorage.getItem('accessToken');
      window.open(`http://localhost:5000/api/invoices/${invoiceId}/pdf${token ? `?token=${token}` : ''}`, '_blank');
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
            <span>Merchant Tax Invoices</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Official GST-compliant tax invoices and retail vouchers generated for your store sales
          </p>
        </div>
        <button
          onClick={fetchInvoices}
          className="p-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 shadow-xs text-xs font-bold transition flex items-center gap-2 self-start"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Top Invoice Category Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-sm font-bold">
        <button
          onClick={() => setActiveInvoiceTab('ORDERS')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeInvoiceTab === 'ORDERS'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Customer Order Sales Invoices</span>
        </button>
        <button
          onClick={() => setActiveInvoiceTab('SUBSCRIPTION')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeInvoiceTab === 'SUBSCRIPTION'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Vendor Subscription Invoices</span>
        </button>
      </div>

      {activeInvoiceTab === 'SUBSCRIPTION' ? (
        <VendorSubscriptionHistory />
      ) : (
        <>
      {/* Filter and Search Bar */}
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
                {st === '' ? 'All Invoices' : st}
              </button>
            ))}
          </div>

          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-72">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchInvoice}
                onChange={(e) => setSearchInvoice(e.target.value)}
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

      {/* Invoice Table / List */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 bg-white border border-slate-200/80 rounded-3xl">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-xs font-bold text-slate-500">Loading merchant invoices...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : invoices.length === 0 ? (
        <div className="py-16 text-center bg-white border border-slate-200/80 rounded-3xl space-y-4">
          <FileText className="w-12 h-12 text-slate-300 mx-auto" />
          <div>
            <h3 className="text-base font-black text-slate-800">No customer sales invoices found</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Sales invoices are automatically generated when customer orders containing your products are confirmed.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => setActiveInvoiceTab('SUBSCRIPTION')}
              className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs transition border border-indigo-200 flex items-center gap-2 mx-auto shadow-xs"
            >
              <Receipt className="w-4 h-4" />
              <span>Looking for your Vendor Plan Subscription Invoice? View here &rarr;</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Invoice No</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Order Reference</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4 text-right">Taxable</th>
                  <th className="py-3 px-4 text-right">Total (INR)</th>
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
                    <td className="py-3.5 px-4 text-slate-600">
                      {new Date(inv.issueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-900">#{inv.orderNumber}</p>
                      {inv.subOrderNumber && (
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">Sub: #{inv.subOrderNumber}</p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      <p className="font-bold">{inv.buyerSnapshot?.name || 'Customer'}</p>
                      <p className="text-[11px] text-slate-400">{inv.buyerSnapshot?.city || ''}</p>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-600">
                      ₹{Number(inv.pricing?.taxableAmount || 0).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                      ₹{Number(inv.pricing?.grandTotal || 0).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4">
                      {getStatusBadge(inv.status)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleDownloadPdf(inv._id, inv.invoiceNumber)}
                        className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold inline-flex items-center gap-1.5 transition text-[11px]"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download PDF</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
        </>
      )}
    </motion.div>
  );
};

export default VendorInvoices;

