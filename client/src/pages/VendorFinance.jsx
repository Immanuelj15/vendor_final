import React, { useState, useEffect } from 'react';
import {
  IndianRupee,
  TrendingUp,
  Percent,
  CheckCircle2,
  Clock,
  ArrowDownRight,
  Download,
  ShieldCheck,
  Building,
  Check,
  X,
  AlertCircle,
  HelpCircle,
  Lock,
} from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../services/api';

export const VendorFinance = () => {
  const [statement, setStatement] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('PAYOUTS'); // 'PAYOUTS' | 'LEDGER'

  useEffect(() => {
    fetchFinanceData();
  }, []);

  const fetchFinanceData = async () => {
    setIsLoading(true);
    try {
      const stmtRes = await api.get('/vendor/finance/statement');
      setStatement(stmtRes.data?.data);
    } catch (err) {
      console.error('Failed to fetch finance data', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-16 text-center text-slate-500 font-medium animate-pulse">
        Loading merchant financial data...
      </div>
    );
  }

  // Derive metrics: prioritize marketplace metrics, fallback to statement summary
  const metrics = statement?.marketplaceMetrics || {
    totalSales: statement?.sales || 0,
    totalCommissionDeducted: statement?.commission || 0,
    totalEarnings: statement?.sales ? Math.round(statement.sales * 0.95 * 100) / 100 : 0,
    amountOnHold: 0,
    amountEligible: 0,
    amountPaid: statement?.payouts || 0,
  };

  const payouts = statement?.marketplacePayouts || [];
  const settlements = statement?.settlements || [];
  const transactions = statement?.transactions || [];

  const getStatusBadge = (status, remainingDays) => {
    switch (status) {
      case 'HOLD':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            HOLD ({remainingDays > 0 ? `${remainingDays}d left` : 'Eligible Today'})
          </span>
        );
      case 'ELIGIBLE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse">
            <CheckCircle2 className="w-3.5 h-3.5" />
            ELIGIBLE FOR PAYOUT
          </span>
        );
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Check className="w-3.5 h-3.5" />
            PAID
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
            <X className="w-3.5 h-3.5" />
            CANCELLED
          </span>
        );
      case 'REFUNDED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="w-3.5 h-3.5" />
            REFUNDED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6"
    >
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-blue-100 text-blue-800">
              Vendor Finance Portal
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-medium text-slate-500">7-Day Clearance Schedule</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
            Financial Dashboard & Payouts
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Track your 95% net sales earnings, automated 5% platform commission deductions, and 7-day bank payout status.
          </p>
        </div>

        {/* Read-Only Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 border border-slate-200 rounded-2xl text-xs font-bold text-slate-600 self-start sm:self-auto">
          <Lock className="w-3.5 h-3.5 text-slate-500" />
          <span>Read-Only Financial Records</span>
        </div>
      </div>

      {/* 6 Required Vendor Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. Total Sales */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Sales</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-slate-900 font-mono">
            ₹{metrics.totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </h3>
          <span className="text-[11px] text-slate-400 mt-1 block">Gross marketplace product sales</span>
        </div>

        {/* 2. Total Commission Deducted (5%) */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Commission Deducted (5%)</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-purple-700 font-mono">
            -₹{metrics.totalCommissionDeducted.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </h3>
          <span className="text-[11px] text-slate-400 mt-1 block">Platform fee deducted per product</span>
        </div>

        {/* 3. Total Earnings (95%) */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Earnings (95%)</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-emerald-700 font-mono">
            ₹{metrics.totalEarnings.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </h3>
          <span className="text-[11px] text-slate-400 mt-1 block">Net revenue after 5% platform fee</span>
        </div>

        {/* 4. Amount Currently on Hold (7-Day Period) */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Amount on Hold (7-Day Rule)</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-amber-700 font-mono">
            ₹{metrics.amountOnHold.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </h3>
          <span className="text-[11px] text-slate-400 mt-1 block">Held for 7 days post-payment</span>
        </div>

        {/* 5. Amount Eligible for Payout */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Eligible for Payout</span>
            <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-teal-700 font-mono">
            ₹{metrics.amountEligible.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </h3>
          <span className="text-[11px] text-slate-400 mt-1 block">7-day cleared • Awaiting release</span>
        </div>

        {/* 6. Amount Already Paid */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Amount Already Paid</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-blue-700 font-mono">
            ₹{metrics.amountPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </h3>
          <span className="text-[11px] text-slate-400 mt-1 block">Transferred to your verified bank</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('PAYOUTS')}
          className={`px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'PAYOUTS'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building className="w-4 h-4" />
          Payout History & 7-Day Clearance
        </button>
        <button
          onClick={() => setActiveTab('LEDGER')}
          className={`px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'LEDGER'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <IndianRupee className="w-4 h-4" />
          Account Ledger Transactions
        </button>
      </div>

      {/* Tab 1: Payout History Table */}
      {activeTab === 'PAYOUTS' && (
        <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-xs">
          <div className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Building className="w-4 h-4 text-blue-600" />
                  <span>7-Day Vendor Payout Schedule & History</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Platform retains 5% commission. The remaining 95% is held for 7 days from payment confirmation before clearance.
                </p>
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 self-start sm:self-auto">
                Automatic 7-Day Clearance
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-[11px] text-slate-500 uppercase bg-slate-50 border-b border-slate-100 font-bold">
                  <tr>
                    <th className="px-4 py-3">Order ID / Payout #</th>
                    <th className="px-4 py-3">Products</th>
                    <th className="px-4 py-3 text-right">Selling Price</th>
                    <th className="px-4 py-3 text-right text-purple-600">Commission (5%)</th>
                    <th className="px-4 py-3 text-right text-emerald-700 font-extrabold">Net Payable (95%)</th>
                    <th className="px-4 py-3">Payment Date</th>
                    <th className="px-4 py-3">Expected Payout Date</th>
                    <th className="px-4 py-3">Actual Payout Date</th>
                    <th className="px-4 py-3 text-center">Payout Status</th>
                    <th className="px-4 py-3">UTR Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payouts.length === 0 && settlements.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="px-4 py-10 text-center text-slate-400">
                        No vendor payout records found.
                      </td>
                    </tr>
                  ) : payouts.length > 0 ? (
                    payouts.map((p) => {
                      const order = p.orderId || {};
                      const suborder = p.suborderId || {};
                      const items = suborder.items || [];
                      const productNames = items.map((i) => i.name || i.productNameSnapshot || 'Product').join(', ') || 'Order Item(s)';

                      return (
                        <tr key={p._id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-4 py-3.5">
                            <div className="font-mono font-bold text-slate-900">
                              {order.orderNumber || p.orderId?._id?.slice(-8) || '-'}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {p.payoutNumber}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-slate-800 max-w-[200px] truncate" title={productNames}>
                            {productNames}
                          </td>
                          <td className="px-4 py-3.5 text-right font-medium text-slate-900 font-mono">
                            ₹{p.grossAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3.5 text-right font-bold text-purple-600 font-mono">
                            -₹{p.commissionAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3.5 text-right font-black text-emerald-700 font-mono text-sm">
                            ₹{p.netPayableAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3.5 text-slate-600 text-[11px]">
                            {p.paymentReceivedAt ? new Date(p.paymentReceivedAt).toLocaleDateString('en-IN') : '-'}
                          </td>
                          <td className="px-4 py-3.5 text-slate-600 text-[11px]">
                            {p.payoutEligibleAt ? (
                              <div>
                                <div>{new Date(p.payoutEligibleAt).toLocaleDateString('en-IN')}</div>
                                {p.payoutStatus === 'HOLD' && (
                                  <span className="text-[10px] text-amber-600 font-bold">
                                    ({p.remainingHoldDays > 0 ? `${p.remainingHoldDays}d remaining` : 'Due Today'})
                                  </span>
                                )}
                              </div>
                            ) : '-'}
                          </td>
                          <td className="px-4 py-3.5 text-slate-600 text-[11px]">
                            {p.paidAt ? (
                              <span className="text-emerald-700 font-medium">
                                {new Date(p.paidAt).toLocaleDateString('en-IN')}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Pending Release</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {getStatusBadge(p.payoutStatus, p.remainingHoldDays)}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-[11px] text-slate-600">
                            {p.payoutReference || '-'}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    settlements.map((st) => (
                      <tr key={st._id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3.5 font-mono font-bold text-slate-900">
                          {st.suborderId?.subOrderNumber || 'Order Item'}
                        </td>
                        <td className="px-4 py-3.5 text-slate-800">
                          Order Products
                        </td>
                        <td className="px-4 py-3.5 text-right font-medium text-slate-900 font-mono">
                          ₹{Number(st.grossAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold text-purple-600 font-mono">
                          -₹{Number(st.platformCommission || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3.5 text-right font-black text-emerald-700 font-mono text-sm">
                          ₹{Number(st.netPayable || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 text-[11px]">
                          {new Date(st.createdAt).toLocaleDateString('en-IN')}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 text-[11px]">
                          {st.eligibleAt ? new Date(st.eligibleAt).toLocaleDateString('en-IN') : '-'}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 text-[11px]">
                          {st.paidAt ? new Date(st.paidAt).toLocaleDateString('en-IN') : '-'}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {getStatusBadge(st.status || 'PAID', 0)}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-[11px] text-slate-600">
                          {st.payoutReference || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Account Ledger Transactions */}
      {activeTab === 'LEDGER' && (
        <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-xs">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Account Ledger Transactions</h2>
                <p className="text-xs text-slate-500 mt-0.5">Immutable double-entry financial audit record</p>
              </div>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100 font-bold">
                  <tr>
                    <th className="px-4 py-3.5">Date</th>
                    <th className="px-4 py-3.5">Type</th>
                    <th className="px-4 py-3.5">Description</th>
                    <th className="px-4 py-3.5 text-right">Amount</th>
                    <th className="px-4 py-3.5 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-4 py-10 text-center text-slate-400">
                        No transactions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3.5 text-slate-600 text-xs">
                          {new Date(tx.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {tx.transactionType}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-800 font-medium text-xs">{tx.description}</td>
                        <td
                          className={`px-4 py-3.5 text-right font-black font-mono text-xs ${
                            tx.credit > 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {tx.credit > 0 ? '+' : '-'}₹{tx.credit > 0 ? tx.credit : tx.debit}
                        </td>
                        <td className="px-4 py-3.5 text-right font-black font-mono text-slate-900 text-xs">
                          ₹{tx.balanceSnapshot}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default VendorFinance;
