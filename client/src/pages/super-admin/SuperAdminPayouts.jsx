import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IndianRupee,
  TrendingUp,
  Percent,
  CheckCircle2,
  Clock,
  Building,
  CreditCard,
  RefreshCw,
  AlertCircle,
  Search,
  Check,
  X,
  DollarSign,
  ShieldCheck,
  Sliders,
  Play,
  ArrowRight,
  Eye,
  Filter
} from 'lucide-react';
import { superAdminService } from '../../services/superAdminService';

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

export const SuperAdminPayouts = () => {
  const [activeTab, setActiveTab] = useState('PAYOUTS'); // 'PAYOUTS' | 'COMMISSIONS'
  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(true);

  // Financial Metrics
  const [metrics, setMetrics] = useState({
    totalCustomerPayments: 0,
    totalPlatformCommissionEarned: 0,
    totalVendorPayableAmount: 0,
    totalPayoutsOnHold: 0,
    totalEligiblePayouts: 0,
    totalCompletedPayouts: 0,
    pendingPayoutsCount: 0,
    currentCommissionRate: 5,
  });

  // Commission Rate Configuration
  const [commissionRateInput, setCommissionRateInput] = useState('5');
  const [isUpdatingRate, setIsUpdatingRate] = useState(false);

  // Vendor Payouts State
  const [payouts, setPayouts] = useState([]);
  const [payoutStatusFilter, setPayoutStatusFilter] = useState('ALL');
  const [payoutSearch, setPayoutSearch] = useState('');
  const [payoutPage, setPayoutPage] = useState(1);
  const [payoutTotalPages, setPayoutTotalPages] = useState(1);

  // Commission Transactions State
  const [commissions, setCommissions] = useState([]);
  const [commissionSearch, setCommissionSearch] = useState('');
  const [commissionStatusFilter, setCommissionStatusFilter] = useState('ALL');
  const [commissionPage, setCommissionPage] = useState(1);
  const [commissionTotalPages, setCommissionTotalPages] = useState(1);

  // Modal / Action states
  const [releaseModal, setReleaseModal] = useState(null); // payout object
  const [bankViewModal, setBankViewModal] = useState(null); // payout object
  const [payoutReference, setPayoutReference] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [isReleasing, setIsReleasing] = useState(false);
  const [isTriggeringJob, setIsTriggeringJob] = useState(false);

  // Notification banners
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadMetrics = async () => {
    try {
      setMetricsLoading(true);
      const res = await superAdminService.getMarketplaceMetrics();
      if (res) {
        setMetrics(res);
        setCommissionRateInput(String(res.currentCommissionRate || 5));
      }
    } catch (err) {
      console.error('Failed to load marketplace metrics:', err);
    } finally {
      setMetricsLoading(false);
    }
  };

  const loadPayouts = async (status = payoutStatusFilter, page = payoutPage, search = payoutSearch) => {
    try {
      setLoading(true);
      setErrorMsg('');
      const params = { page, limit: 15 };
      if (status !== 'ALL') params.payoutStatus = status;
      if (search.trim()) params.search = search.trim();

      const res = await superAdminService.getMarketplacePayouts(params);
      if (res) {
        setPayouts(res.items || []);
        setPayoutTotalPages(res.totalPages || 1);
      }
    } catch (err) {
      console.error('Failed to load marketplace payouts:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to retrieve vendor payouts');
    } finally {
      setLoading(false);
    }
  };

  const loadCommissions = async (status = commissionStatusFilter, page = commissionPage, search = commissionSearch) => {
    try {
      setLoading(true);
      setErrorMsg('');
      const params = { page, limit: 15 };
      if (status !== 'ALL') params.status = status;
      if (search.trim()) params.search = search.trim();

      const res = await superAdminService.getMarketplaceCommissions(params);
      if (res) {
        setCommissions(res.items || []);
        setCommissionTotalPages(res.totalPages || 1);
      }
    } catch (err) {
      console.error('Failed to load commissions:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to retrieve commission records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  useEffect(() => {
    if (activeTab === 'PAYOUTS') {
      loadPayouts(payoutStatusFilter, payoutPage, payoutSearch);
    } else {
      loadCommissions(commissionStatusFilter, commissionPage, commissionSearch);
    }
  }, [activeTab, payoutStatusFilter, payoutPage, commissionStatusFilter, commissionPage]);

  const handleUpdateCommissionRate = async (e) => {
    e.preventDefault();
    const rate = parseFloat(commissionRateInput);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      setErrorMsg('Commission rate must be a valid percentage between 0 and 100');
      return;
    }
    try {
      setIsUpdatingRate(true);
      setErrorMsg('');
      await superAdminService.updateMarketplaceCommissionRate(rate);
      setSuccessMsg(`Platform commission rate updated to ${rate}% successfully!`);
      loadMetrics();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to update commission rate');
    } finally {
      setIsUpdatingRate(false);
    }
  };

  const handleTriggerEligibilityJob = async () => {
    try {
      setIsTriggeringJob(true);
      setErrorMsg('');
      const res = await superAdminService.triggerMarketplaceEligibilityJob();
      setSuccessMsg(`7-Day Eligibility Job executed! ${res.processedCount || 0} payout(s) transitioned to ELIGIBLE.`);
      loadMetrics();
      loadPayouts(payoutStatusFilter, payoutPage, payoutSearch);
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to trigger eligibility background job');
    } finally {
      setIsTriggeringJob(false);
    }
  };

  const handleReleasePayout = async () => {
    if (!releaseModal) return;
    try {
      setIsReleasing(true);
      setErrorMsg('');
      const idempotencyKey = `PAYOUT-REL-${releaseModal._id}-${Date.now()}`;
      await superAdminService.releaseMarketplacePayout(releaseModal._id, {
        payoutReference: payoutReference.trim() || undefined,
        adminNotes: adminNotes.trim() || undefined,
        idempotencyKey,
      });

      setSuccessMsg(`Payout of ₹${releaseModal.netPayableAmount.toLocaleString('en-IN')} successfully released to vendor bank account!`);
      setReleaseModal(null);
      setPayoutReference('');
      setAdminNotes('');
      loadMetrics();
      loadPayouts(payoutStatusFilter, payoutPage, payoutSearch);
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      console.error('Release payout error:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to release vendor payout');
    } finally {
      setIsReleasing(false);
    }
  };

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
            ELIGIBLE
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
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6"
    >
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-blue-100 text-blue-800">
              Treasury & Settlements
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-medium text-slate-500">7-Day Holding Rule Active</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
            Marketplace Commission & Vendor Payouts
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Manage the automated 5% platform commission deduction, 7-day payment holding schedule, and vendor disbursements.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* 7-Day Eligibility Job Trigger */}
          <button
            onClick={handleTriggerEligibilityJob}
            disabled={isTriggeringJob}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition disabled:opacity-50"
            title="Scan all HOLD payouts and transition eligible 7-day accounts to ELIGIBLE"
          >
            <Play className={`w-3.5 h-3.5 ${isTriggeringJob ? 'animate-spin' : ''}`} />
            {isTriggeringJob ? 'Processing...' : 'Run 7-Day Job'}
          </button>

          {/* Refresh Data */}
          <button
            onClick={() => {
              loadMetrics();
              if (activeTab === 'PAYOUTS') loadPayouts();
              else loadCommissions();
            }}
            className="p-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl shadow-xs transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Alerts */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-medium flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg('')} className="text-emerald-500 hover:text-emerald-800">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-medium flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg('')} className="text-rose-500 hover:text-rose-800">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 7 KPI Financial Summary Cards + Commission Configurator */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Customer Payments */}
        <motion.div variants={itemVariants} className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Customer Payments</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-slate-900 font-mono">
            ₹{metrics.totalCustomerPayments.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">Gross marketplace volume</p>
        </motion.div>

        {/* 2. Platform Commission Earned */}
        <motion.div variants={itemVariants} className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Platform Commission (5%)</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-purple-700 font-mono">
            ₹{metrics.totalPlatformCommissionEarned.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">Retained marketplace revenue</p>
        </motion.div>

        {/* 3. Total Vendor Payable Amount */}
        <motion.div variants={itemVariants} className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Vendor Payable (95%)</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-indigo-700 font-mono">
            ₹{metrics.totalVendorPayableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">Total vendor net earnings</p>
        </motion.div>

        {/* 4. Commission Rate Configurator */}
        <motion.div variants={itemVariants} className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Default Commission Rate</span>
            <Sliders className="w-4 h-4 text-blue-400" />
          </div>
          <form onSubmit={handleUpdateCommissionRate} className="mt-2 flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={commissionRateInput}
                onChange={(e) => setCommissionRateInput(e.target.value)}
                className="w-full bg-slate-700/80 border border-slate-600 rounded-xl px-3 py-1.5 text-sm font-bold text-white focus:outline-none focus:border-blue-400"
              />
              <span className="absolute right-3 top-2 text-xs text-slate-400 font-bold">%</span>
            </div>
            <button
              type="submit"
              disabled={isUpdatingRate}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
            >
              {isUpdatingRate ? '...' : 'Save'}
            </button>
          </form>
          <p className="text-[10px] text-slate-400 mt-2">Applies automatically to new orders</p>
        </motion.div>

        {/* 5. Total Payouts on Hold (7-Day Rule) */}
        <motion.div variants={itemVariants} className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Payouts on Hold</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-amber-700 font-mono">
            ₹{metrics.totalPayoutsOnHold.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">Under 7-day clearing holding period</p>
        </motion.div>

        {/* 6. Total Eligible Payouts */}
        <motion.div variants={itemVariants} className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Eligible for Payout</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-emerald-700 font-mono">
            ₹{metrics.totalEligiblePayouts.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">Ready for Super Admin disbursement</p>
        </motion.div>

        {/* 7. Total Completed Vendor Payouts */}
        <motion.div variants={itemVariants} className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Completed Payouts</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-blue-700 font-mono">
            ₹{metrics.totalCompletedPayouts.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">Successfully disbursed to vendor banks</p>
        </motion.div>

        {/* 8. Pending Count */}
        <motion.div variants={itemVariants} className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Payouts Count</span>
            <div className="p-2 rounded-xl bg-slate-100 text-slate-600">
              <Filter className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-slate-800 font-mono">
            {metrics.pendingPayoutsCount}
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">Hold + Eligible settlement requests</p>
        </motion.div>
      </div>

      {/* Tab Switcher & Navigation */}
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
          7-Day Vendor Payout Management
        </button>
        <button
          onClick={() => setActiveTab('COMMISSIONS')}
          className={`px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'COMMISSIONS'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Percent className="w-4 h-4" />
          Product Commission Breakdown
        </button>
      </div>

      {/* TAB 1: 7-Day Vendor Payout Management */}
      {activeTab === 'PAYOUTS' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search payout # or UTR reference..."
                value={payoutSearch}
                onChange={(e) => setPayoutSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadPayouts(payoutStatusFilter, 1, payoutSearch)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-slate-500">Status:</span>
              {['ALL', 'HOLD', 'ELIGIBLE', 'PAID', 'CANCELLED', 'REFUNDED'].map((st) => (
                <button
                  key={st}
                  onClick={() => {
                    setPayoutStatusFilter(st);
                    setPayoutPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    payoutStatusFilter === st
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Payouts Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4">Payout #</th>
                    <th className="py-3.5 px-4">Vendor</th>
                    <th className="py-3.5 px-4">Order ID</th>
                    <th className="py-3.5 px-4 text-right">Gross (₹)</th>
                    <th className="py-3.5 px-4 text-right">Commission (5%)</th>
                    <th className="py-3.5 px-4 text-right">Net Payout (95%)</th>
                    <th className="py-3.5 px-4">Payment Date</th>
                    <th className="py-3.5 px-4">Eligible Date</th>
                    <th className="py-3.5 px-4">Hold Period</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan="11" className="py-12 text-center text-slate-400 font-medium animate-pulse">
                        Loading vendor payouts...
                      </td>
                    </tr>
                  ) : payouts.length === 0 ? (
                    <tr>
                      <td colSpan="11" className="py-12 text-center text-slate-400 font-medium">
                        No vendor payout records found.
                      </td>
                    </tr>
                  ) : (
                    payouts.map((p) => {
                      const vendor = p.vendorId || {};
                      const order = p.orderId || {};
                      const isEligible = p.payoutStatus === 'ELIGIBLE';
                      const isHold = p.payoutStatus === 'HOLD';
                      const isPaid = p.payoutStatus === 'PAID';

                      return (
                        <tr key={p._id} className="hover:bg-slate-50/60 transition">
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                            {p.payoutNumber || p._id.slice(-8)}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{vendor.storeName || vendor.businessName || 'Vendor'}</div>
                            <div className="text-[10px] text-slate-400">{vendor.email || vendor.phone || ''}</div>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-600">
                            {order.orderNumber || p.orderId?._id?.slice(-8) || '-'}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-slate-900 font-bold">
                            ₹{p.grossAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-purple-600 font-bold">
                            -₹{p.commissionAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-emerald-700 font-black">
                            ₹{p.netPayableAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 text-[11px]">
                            {p.paymentReceivedAt ? new Date(p.paymentReceivedAt).toLocaleDateString('en-IN') : '-'}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 text-[11px]">
                            {p.payoutEligibleAt ? new Date(p.payoutEligibleAt).toLocaleDateString('en-IN') : '-'}
                          </td>
                          <td className="py-3.5 px-4">
                            {isHold ? (
                              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                {p.remainingHoldDays > 0 ? `${p.remainingHoldDays} day(s) left` : 'Due Today'}
                              </span>
                            ) : isEligible ? (
                              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                7-day cleared
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {getStatusBadge(p.payoutStatus, p.remainingHoldDays)}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* View Bank Details Button */}
                              {p.vendorBankSnapshot && (
                                <button
                                  onClick={() => setBankViewModal(p)}
                                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                                  title="View Bank Account Details"
                                >
                                  <CreditCard className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Release Payout Action */}
                              {isEligible ? (
                                <button
                                  onClick={() => {
                                    setReleaseModal(p);
                                    setPayoutReference(`UTR-${Date.now()}`);
                                  }}
                                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
                                >
                                  Release Payout
                                </button>
                              ) : isHold ? (
                                <button
                                  disabled
                                  className="px-2.5 py-1 bg-slate-100 text-slate-400 rounded-lg text-[11px] font-bold cursor-not-allowed"
                                  title={`Payout is locked until 7-day clearance on ${new Date(p.payoutEligibleAt).toLocaleDateString('en-IN')}`}
                                >
                                  Locked ({p.remainingHoldDays}d)
                                </button>
                              ) : isPaid ? (
                                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-mono">
                                  {p.payoutReference || 'DISBURSED'}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-bold">{p.payoutStatus}</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {payoutTotalPages > 1 && (
              <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Page {payoutPage} of {payoutTotalPages}</span>
                <div className="flex gap-2">
                  <button
                    disabled={payoutPage <= 1}
                    onClick={() => setPayoutPage((prev) => Math.max(1, prev - 1))}
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    disabled={payoutPage >= payoutTotalPages}
                    onClick={() => setPayoutPage((prev) => Math.min(payoutTotalPages, prev + 1))}
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Product Commission Breakdown */}
      {activeTab === 'COMMISSIONS' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search product name or SKU..."
                value={commissionSearch}
                onChange={(e) => setCommissionSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadCommissions(commissionStatusFilter, 1, commissionSearch)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-slate-500">Status:</span>
              {['ALL', 'HOLD', 'ELIGIBLE', 'PAID', 'CANCELLED'].map((st) => (
                <button
                  key={st}
                  onClick={() => {
                    setCommissionStatusFilter(st);
                    setCommissionPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    commissionStatusFilter === st
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Commission Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4">Order ID</th>
                    <th className="py-3.5 px-4">Product Name & SKU</th>
                    <th className="py-3.5 px-4">Vendor</th>
                    <th className="py-3.5 px-4 text-right">Selling Price (₹)</th>
                    <th className="py-3.5 px-4 text-center">Comm. %</th>
                    <th className="py-3.5 px-4 text-right">Commission (₹)</th>
                    <th className="py-3.5 px-4 text-right">Vendor Payable (₹)</th>
                    <th className="py-3.5 px-4">Payment Date</th>
                    <th className="py-3.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan="9" className="py-12 text-center text-slate-400 font-medium animate-pulse">
                        Loading commission transactions...
                      </td>
                    </tr>
                  ) : commissions.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="py-12 text-center text-slate-400 font-medium">
                        No product commission records found.
                      </td>
                    </tr>
                  ) : (
                    commissions.map((c) => {
                      const vendor = c.vendorId || {};
                      const order = c.orderId || {};

                      return (
                        <tr key={c._id} className="hover:bg-slate-50/60 transition">
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                            {order.orderNumber || c.orderId?._id?.slice(-8) || '-'}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{c.productName}</div>
                            {c.productSku && <div className="text-[10px] text-slate-400 font-mono">SKU: {c.productSku}</div>}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{vendor.storeName || vendor.businessName || 'Vendor'}</div>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-slate-900 font-bold">
                            ₹{c.sellingPrice?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono text-slate-600 font-bold">
                            {c.commissionPercentage}%
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-purple-700 font-bold">
                            ₹{c.commissionAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-emerald-700 font-black">
                            ₹{c.vendorPayableAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 text-[11px]">
                            {c.paymentReceivedAt ? new Date(c.paymentReceivedAt).toLocaleDateString('en-IN') : '-'}
                          </td>
                          <td className="py-3.5 px-4">
                            {getStatusBadge(c.status, 0)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {commissionTotalPages > 1 && (
              <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Page {commissionPage} of {commissionTotalPages}</span>
                <div className="flex gap-2">
                  <button
                    disabled={commissionPage <= 1}
                    onClick={() => setCommissionPage((prev) => Math.max(1, prev - 1))}
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    disabled={commissionPage >= commissionTotalPages}
                    onClick={() => setCommissionPage((prev) => Math.min(commissionTotalPages, prev + 1))}
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Release Payout Modal */}
      <AnimatePresence>
        {releaseModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 w-full max-w-lg rounded-3xl p-6 shadow-2xl relative"
            >
              <button
                onClick={() => setReleaseModal(null)}
                className="absolute top-5 right-5 p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-lg font-black text-slate-900 mb-1">
                Release Vendor Payout
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Payout #{releaseModal.payoutNumber} • 7-Day Holding Rule Cleared
              </p>

              {/* Payout Summary Card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 mb-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Vendor:</span>
                  <span className="font-bold text-slate-900">{releaseModal.vendorId?.storeName || 'Vendor'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Gross Sales:</span>
                  <span className="font-mono text-slate-800">₹{releaseModal.grossAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Platform Commission (5%):</span>
                  <span className="font-mono text-purple-700 font-bold">-₹{releaseModal.commissionAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-black">
                  <span className="text-slate-900">Net Amount to Disburse:</span>
                  <span className="font-mono text-emerald-700">₹{releaseModal.netPayableAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Vendor Bank Snapshot Preview */}
              {releaseModal.vendorBankSnapshot && (
                <div className="bg-blue-50/60 border border-blue-200/60 rounded-2xl p-3.5 mb-4 text-xs space-y-1">
                  <div className="font-bold text-blue-900 flex items-center gap-1.5 mb-1">
                    <Building className="w-3.5 h-3.5" />
                    Destination Bank Details:
                  </div>
                  <div className="text-slate-700">Account Holder: <span className="font-bold">{releaseModal.vendorBankSnapshot.accountHolderName}</span></div>
                  <div className="text-slate-700">Bank Name: <span className="font-bold">{releaseModal.vendorBankSnapshot.bankName}</span></div>
                  <div className="text-slate-700">Account: <span className="font-mono font-bold">{releaseModal.vendorBankSnapshot.accountNumberMasked}</span> (IFSC: {releaseModal.vendorBankSnapshot.ifscCode})</div>
                </div>
              )}

              {/* Payment Reference Inputs */}
              <div className="space-y-3 mb-5">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Transfer Reference / UTR Number
                  </label>
                  <input
                    type="text"
                    value={payoutReference}
                    onChange={(e) => setPayoutReference(e.target.value)}
                    placeholder="e.g. UTR-20261117-987654"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Super Admin Notes (Optional)
                  </label>
                  <textarea
                    rows="2"
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Notes regarding disbursement confirmation..."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReleaseModal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isReleasing}
                  onClick={handleReleasePayout}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-500/20 transition disabled:opacity-50"
                >
                  {isReleasing ? 'Releasing...' : 'Confirm & Disburse'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bank Account Viewer Modal */}
      <AnimatePresence>
        {bankViewModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 w-full max-w-md rounded-3xl p-6 shadow-2xl relative"
            >
              <button
                onClick={() => setBankViewModal(null)}
                className="absolute top-5 right-5 p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-base font-black text-slate-900 mb-1 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-600" />
                Vendor Bank Account Snapshot
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Snapshot captured at time of order payment
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 text-xs">
                <div>
                  <span className="text-slate-500 block">Account Holder:</span>
                  <span className="font-bold text-slate-900 text-sm">{bankViewModal.vendorBankSnapshot?.accountHolderName || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Bank Name:</span>
                  <span className="font-bold text-slate-900">{bankViewModal.vendorBankSnapshot?.bankName || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Account Number:</span>
                  <span className="font-mono font-bold text-slate-900">{bankViewModal.vendorBankSnapshot?.accountNumberMasked || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">IFSC Code:</span>
                  <span className="font-mono font-bold text-blue-600">{bankViewModal.vendorBankSnapshot?.ifscCode || '-'}</span>
                </div>
                {bankViewModal.vendorBankSnapshot?.upiId && (
                  <div>
                    <span className="text-slate-500 block">UPI ID:</span>
                    <span className="font-mono font-bold text-purple-600">{bankViewModal.vendorBankSnapshot.upiId}</span>
                  </div>
                )}
                <div>
                  <span className="text-slate-500 block">Verification Status:</span>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    {bankViewModal.vendorBankSnapshot?.verificationStatus || 'VERIFIED'}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setBankViewModal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default SuperAdminPayouts;
