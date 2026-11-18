import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Coins,
  RefreshCw,
  Search,
  Filter,
  Users,
  Receipt,
  ShoppingBag,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  AlertCircle,
  Clock,
  Lock,
} from 'lucide-react';
import { superAdminService } from '../../services/superAdminService';

export const SuperAdminFairCoins = () => {
  const [activeTab, setActiveTab] = useState('customers'); // 'customers' | 'transactions' | 'orders'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Overview KPIs
  const [overview, setOverview] = useState({
    totalCredited: 0,
    totalCreditedRupees: 0,
    totalRedeemed: 0,
    totalRedeemedRupees: 0,
    totalReversed: 0,
    totalReversedRupees: 0,
    totalOutstanding: 0,
    totalOutstandingRupees: 0,
    customerCount: 0,
    customersWithBalance: 0,
    conversionRate: 10,
    conversionText: '10 Fair Coins = ₹1',
  });

  // Tab 1: Customers Data
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerPage, setCustomerPage] = useState(1);
  const [customerTotalPages, setCustomerTotalPages] = useState(1);
  const [customerTotalCount, setCustomerTotalCount] = useState(0);

  // Tab 2: Transactions Data
  const [transactions, setTransactions] = useState([]);
  const [txSearch, setTxSearch] = useState('');
  const [txType, setTxType] = useState('ALL');
  const [txPage, setTxPage] = useState(1);
  const [txTotalPages, setTxTotalPages] = useState(1);
  const [txTotalCount, setTxTotalCount] = useState(0);

  // Tab 3: Order Coin Details
  const [orders, setOrders] = useState([]);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderPage, setOrderPage] = useState(1);
  const [orderTotalPages, setOrderTotalPages] = useState(1);
  const [orderTotalCount, setOrderTotalCount] = useState(0);

  // Fetch Overview Data
  const fetchOverview = useCallback(async () => {
    try {
      const data = await superAdminService.getFairCoinsOverview();
      if (data) setOverview(data);
    } catch (err) {
      console.error('Failed to load Fair Coins overview:', err);
    }
  }, []);

  // Fetch Customers
  const fetchCustomers = useCallback(async () => {
    try {
      const data = await superAdminService.getFairCoinsCustomers({
        page: customerPage,
        limit: 20,
        search: customerSearch,
      });
      if (data) {
        setCustomers(data.customers || []);
        setCustomerTotalPages(data.pages || 1);
        setCustomerTotalCount(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to load customers:', err);
    }
  }, [customerPage, customerSearch]);

  // Fetch Transactions
  const fetchTransactions = useCallback(async () => {
    try {
      const data = await superAdminService.getFairCoinsTransactions({
        page: txPage,
        limit: 25,
        type: txType,
        search: txSearch,
      });
      if (data) {
        setTransactions(data.transactions || []);
        setTxTotalPages(data.pages || 1);
        setTxTotalCount(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to load transactions:', err);
    }
  }, [txPage, txType, txSearch]);

  // Fetch Orders
  const fetchOrders = useCallback(async () => {
    try {
      const data = await superAdminService.getFairCoinsOrders({
        page: orderPage,
        limit: 20,
        search: orderSearch,
      });
      if (data) {
        setOrders(data.orders || []);
        setOrderTotalPages(data.pages || 1);
        setOrderTotalCount(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to load orders:', err);
    }
  }, [orderPage, orderSearch]);

  // Load all data
  const loadAll = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      await Promise.all([
        fetchOverview(),
        fetchCustomers(),
        fetchTransactions(),
        fetchOrders(),
      ]);
    } catch (e) {
      setError('Failed to aggregate Fair Coins data from database.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (activeTab === 'customers') fetchCustomers();
    else if (activeTab === 'transactions') fetchTransactions();
    else if (activeTab === 'orders') fetchOrders();
  }, [activeTab, customerPage, txPage, txType, orderPage]);

  const getBadgeForType = (type, status) => {
    if (status === 'REVERSED' || type === 'REVERSED') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
          REVERSED
        </span>
      );
    }
    if (type === 'REDEEMED' || type === 'DEBIT') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200">
          REDEEMED
        </span>
      );
    }
    if (type === 'REFUNDED') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200">
          REFUNDED
        </span>
      );
    }
    if (type === 'WELCOME') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
          WELCOME
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
        {type || 'CREDITED'}
      </span>
    );
  };

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-xs font-black uppercase tracking-wider mb-2">
            <Coins className="w-3.5 h-3.5 text-amber-600" />
            <span>Customer Loyalty & Rewards Ledger</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Fair Coins Reward & Redemption Audit
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Authoritative real-time database ledger of all credited, redeemed, and reversed Fair Coins.
          </p>
        </div>

        <button
          onClick={() => loadAll(true)}
          disabled={loading || refreshing}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition shadow-xs disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Syncing...' : 'Sync Database'}</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs font-bold shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 4 Primary KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Outstanding */}
        <div className="bg-gradient-to-tr from-blue-700 via-indigo-700 to-indigo-800 text-white p-6 rounded-3xl shadow-lg shadow-blue-500/15 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-100 flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-amber-300" />
              <span>Outstanding Coins</span>
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white">
              Customer Liability
            </span>
          </div>
          <div className="my-3">
            <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight">
              {loading ? '...' : Number(overview.totalOutstanding).toLocaleString()}
            </div>
            <div className="text-xs font-bold text-amber-300 font-mono mt-1">
              ₹{loading ? '...' : Number(overview.totalOutstandingRupees).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="pt-2 border-t border-white/15 text-[11px] text-blue-100 flex items-center justify-between">
            <span>Customers with Balance:</span>
            <span className="font-bold text-white">{overview.customersWithBalance || 0} / {overview.customerCount || 0}</span>
          </div>
        </div>

        {/* Total Credited */}
        <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
            <span>Total Credited</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 font-mono">
              +{loading ? '...' : Number(overview.totalCredited).toLocaleString()}
            </div>
            <div className="text-xs font-bold text-slate-500 font-mono mt-1">
              ₹{loading ? '...' : Number(overview.totalCreditedRupees).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
            500 welcome bonus + 100/item purchased.
          </div>
        </div>

        {/* Total Redeemed */}
        <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
            <span>Total Redeemed</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-black text-amber-800 font-mono">
              -{loading ? '...' : Number(overview.totalRedeemed).toLocaleString()}
            </div>
            <div className="text-xs font-bold text-slate-500 font-mono mt-1">
              ₹{loading ? '...' : Number(overview.totalRedeemedRupees).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
            Checkout discounts claimed by customers.
          </div>
        </div>

        {/* Total Reversed */}
        <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
            <span>Total Reversed</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <RefreshCw className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-black text-rose-600 font-mono">
              -{loading ? '...' : Number(overview.totalReversed).toLocaleString()}
            </div>
            <div className="text-xs font-bold text-slate-500 font-mono mt-1">
              ₹{loading ? '...' : Number(overview.totalReversedRupees).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
            Reversals on cancelled/refunded orders.
          </div>
        </div>
      </div>

      {/* Conversion Rate Policy Enforcement Notice (Non-Modifiable) */}
      <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-800 shrink-0 border border-amber-300">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <div className="font-black text-sm flex items-center gap-2">
              <span>Authoritative Conversion Rate: 10 Fair Coins = ₹1</span>
              <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded-full uppercase">
                Fixed & Locked
              </span>
            </div>
            <p className="text-amber-800 text-xs mt-0.5">
              1 Fair Coin = ₹0.10. Neither Super Admin nor vendors can alter this rate. Exact integer calculations are enforced across frontend & backend.
            </p>
          </div>
        </div>
        <div className="bg-white/80 border border-amber-200 px-3.5 py-1.5 rounded-xl font-mono text-xs font-bold text-amber-900 self-start sm:self-auto shrink-0">
          500 Welcome • 100/Product
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200 flex gap-6 text-sm font-bold">
        <button
          onClick={() => setActiveTab('customers')}
          className={`pb-3 flex items-center gap-2 transition-all relative ${
            activeTab === 'customers'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Customer Balances ({customerTotalCount})</span>
        </button>

        <button
          onClick={() => setActiveTab('transactions')}
          className={`pb-3 flex items-center gap-2 transition-all relative ${
            activeTab === 'transactions'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Transaction Ledger ({txTotalCount})</span>
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`pb-3 flex items-center gap-2 transition-all relative ${
            activeTab === 'orders'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Order Coin Details ({orderTotalCount})</span>
        </button>
      </div>

      {/* TAB 1: Customer Balances */}
      {activeTab === 'customers' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-base font-black text-slate-900">
              Customer Fair Coins Balance Sheet
            </h3>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by customer name, email, phone..."
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setCustomerPage(1);
                }}
                className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl pl-9 pr-3 py-2 text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider bg-slate-50/50">
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-3">Contact</th>
                  <th className="py-3 px-3 text-right">Available Balance</th>
                  <th className="py-3 px-3 text-right">Rupee Value</th>
                  <th className="py-3 px-3 text-right">Total Earned</th>
                  <th className="py-3 px-3 text-right">Total Redeemed</th>
                  <th className="py-3 px-4 text-center">Welcome Reward</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-10 text-slate-400">
                      No customer records match your query.
                    </td>
                  </tr>
                ) : (
                  customers.map((c) => (
                    <tr key={c._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div>{c.name || 'Anonymous Customer'}</div>
                        <div className="text-[10px] text-slate-400 font-mono">Ref: {c.referralCode || '—'}</div>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="text-slate-800 font-medium">{c.email || '—'}</div>
                        <div className="text-[10px] text-slate-400">{c.phone || '—'}</div>
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-black text-sm text-slate-900">
                        {Number(c.available).toLocaleString()}
                        {c.reserved > 0 && (
                          <span className="block text-[10px] text-amber-600 font-medium">
                            ({c.reserved} reserved)
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-amber-800">
                        ₹{Number(c.rupeeValue).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-emerald-600">
                        +{Number(c.totalEarned).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-amber-800">
                        -{Number(c.totalRedeemed).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {c.welcomeCoinsAwarded ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Awarded (500)
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-600 border border-slate-200">
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {customerTotalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs text-slate-600">
              <span>Page {customerPage} of {customerTotalPages} ({customerTotalCount} customers)</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCustomerPage((p) => Math.max(1, p - 1))}
                  disabled={customerPage <= 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 font-bold"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCustomerPage((p) => Math.min(customerTotalPages, p + 1))}
                  disabled={customerPage >= customerTotalPages}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 font-bold"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Transaction Ledger */}
      {activeTab === 'transactions' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-base font-black text-slate-900">
              Immutable Platform Rewards Ledger
            </h3>

            {/* Filter by Type & Search */}
            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={txType}
                onChange={(e) => {
                  setTxType(e.target.value);
                  setTxPage(1);
                }}
                className="bg-slate-50 border border-slate-200 text-xs rounded-xl px-3 py-2 text-slate-800 font-bold focus:outline-none"
              >
                <option value="ALL">All Types</option>
                <option value="WELCOME">WELCOME (+500)</option>
                <option value="EARNED">EARNED (Purchase)</option>
                <option value="REDEEMED">REDEEMED (Checkout)</option>
                <option value="REVERSED">REVERSED (Cancellation)</option>
                <option value="REFUNDED">REFUNDED (Restore)</option>
              </select>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search order ref, description..."
                  value={txSearch}
                  onChange={(e) => {
                    setTxSearch(e.target.value);
                    setTxPage(1);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl pl-9 pr-3 py-2 text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider bg-slate-50/50">
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Transaction Details</th>
                  <th className="py-3 px-3 text-center">Type</th>
                  <th className="py-3 px-3 text-right">Fair Coins</th>
                  <th className="py-3 px-3 text-right">Rupee Value</th>
                  <th className="py-3 px-4 text-right">Balance After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-10 text-slate-400">
                      No transaction records match the criteria.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => {
                    const isDebit = tx.type === 'REDEEMED' || tx.type === 'DEBIT';
                    const isReversal = tx.type === 'REVERSED' || tx.status === 'REVERSED';
                    const absCoins = Math.abs(Number(tx.amount) || 0);
                    const txDate = tx.createdAt ? new Date(tx.createdAt) : null;

                    return (
                      <tr key={tx._id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-bold text-slate-900">
                            {txDate ? txDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {txDate ? txDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{tx.userId?.name || 'Customer'}</div>
                          <div className="text-[10px] text-slate-400">{tx.userId?.email || '—'}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-800">{tx.description || tx.source}</div>
                          {tx.referenceId && (
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              Ref: #{tx.referenceId}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-center">{getBadgeForType(tx.type, tx.status)}</td>
                        <td
                          className={`py-3.5 px-3 text-right font-mono font-black text-sm ${
                            isReversal
                              ? 'text-rose-600'
                              : isDebit
                              ? 'text-amber-800'
                              : 'text-emerald-600'
                          }`}
                        >
                          {isDebit || isReversal ? `-${absCoins}` : `+${absCoins}`}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-700">
                          ₹{(absCoins / 10).toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                          {tx.balanceAfter !== undefined && tx.balanceAfter !== null
                            ? Number(tx.balanceAfter).toLocaleString()
                            : '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {txTotalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs text-slate-600">
              <span>Page {txPage} of {txTotalPages} ({txTotalCount} ledger entries)</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                  disabled={txPage <= 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 font-bold"
                >
                  Previous
                </button>
                <button
                  onClick={() => setTxPage((p) => Math.min(txTotalPages, p + 1))}
                  disabled={txPage >= txTotalPages}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 font-bold"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Order Coin Details */}
      {activeTab === 'orders' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-base font-black text-slate-900">
              Order-wise Fair Coins Earning & Redemption Audit
            </h3>

            {/* Search */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search order number..."
                value={orderSearch}
                onChange={(e) => {
                  setOrderSearch(e.target.value);
                  setOrderPage(1);
                }}
                className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl pl-9 pr-3 py-2 text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider bg-slate-50/50">
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-3 text-right">Order Amount</th>
                  <th className="py-3 px-3 text-right">Coins Redeemed</th>
                  <th className="py-3 px-3 text-right">Rupee Discount</th>
                  <th className="py-3 px-3 text-right">Coins Earned</th>
                  <th className="py-3 px-3 text-center">Payment Status</th>
                  <th className="py-3 px-4 text-center">Order Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-10 text-slate-400">
                      No order coin records found.
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        #{o.orderNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{o.userId?.name || 'Customer'}</div>
                        <div className="text-[10px] text-slate-400">{o.userId?.email || '—'}</div>
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-black text-slate-900">
                        ₹{Number(o.grandTotal || o.total || 0).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-amber-800">
                        {Number(o.fairCoinsUsed || 0) > 0 ? `-${Number(o.fairCoinsUsed).toLocaleString()}` : '0'}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-emerald-700">
                        {Number(o.coinDiscount || 0) > 0 ? `-₹${Number(o.coinDiscount).toFixed(2)}` : '₹0.00'}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-emerald-600">
                        {Number(o.earnedCoins || 0) > 0 ? `+${Number(o.earnedCoins).toLocaleString()}` : '—'}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            o.paymentStatus === 'PAID'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {o.paymentStatus}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            o.orderStatus === 'DELIVERED'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : o.orderStatus === 'CANCELLED'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {o.orderStatus}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {orderTotalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs text-slate-600">
              <span>Page {orderPage} of {orderTotalPages} ({orderTotalCount} orders)</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setOrderPage((p) => Math.max(1, p - 1))}
                  disabled={orderPage <= 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 font-bold"
                >
                  Previous
                </button>
                <button
                  onClick={() => setOrderPage((p) => Math.min(orderTotalPages, p + 1))}
                  disabled={orderPage >= orderTotalPages}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 font-bold"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SuperAdminFairCoins;
