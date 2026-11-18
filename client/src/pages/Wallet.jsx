import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import {
  Coins,
  Clock,
  RefreshCw,
  TrendingUp,
  ArrowDownRight,
  ArrowUpRight,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

export const Wallet = () => {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchWallet = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const [walletRes, txRes] = await Promise.all([
        api.get('/fair-coins/wallet'),
        api.get('/fair-coins/transactions'),
      ]);

      const walletData = walletRes.data?.data?.wallet || walletRes.data?.wallet || null;
      const txData = txRes.data?.data?.transactions || txRes.data?.transactions || [];

      setWallet(walletData);
      setTransactions(txData);
    } catch (e) {
      console.error('Failed to load wallet data:', e);
      setError('Unable to load Fair Coins wallet. Please try refreshing.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  const balance = Number(wallet?.available ?? wallet?.balance ?? 0);
  const totalBalance = Number(wallet?.balance ?? 0);
  const reservedCoins = Number(wallet?.reserved ?? 0);
  // Authoritative fixed rule: 10 Fair Coins = ₹1 (Rupee equivalent = Fair Coin balance ÷ 10)
  const rupeeEquivalent = (balance / 10).toFixed(2);
  const totalEarned = Number(wallet?.totalEarned ?? 0);
  const totalRedeemed = Number(wallet?.totalRedeemed ?? wallet?.totalSpent ?? 0);
  const totalReversed = Number(wallet?.totalReversed ?? 0);

  const getTransactionBadge = (tx) => {
    const status = tx.status || 'COMPLETED';
    if (status === 'REVERSED' || tx.type === 'REVERSED') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
          Reversed
        </span>
      );
    }
    if (status === 'FAILED') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-700 border border-slate-200">
          Failed
        </span>
      );
    }
    if (tx.type === 'REDEEMED' || tx.type === 'DEBIT') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200">
          Redeemed
        </span>
      );
    }
    if (tx.type === 'REFUNDED') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200">
          Refunded
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
        Credited
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Top Header & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Coins className="w-7 h-7 text-amber-500" />
            <span>Customer Fair Coins Wallet</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track your available Fair Coins, rupee value, earnings, redemptions, and full transaction ledger.
          </p>
        </div>

        <button
          onClick={() => fetchWallet(true)}
          disabled={loading || refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition disabled:opacity-50 self-start sm:self-auto"
          title="Refresh wallet balance and ledger"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh Wallet'}</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-rose-800 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchWallet()}
            className="underline text-rose-700 hover:text-rose-900 font-bold"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Wallet Summary Cards: 4 KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Available Balance & Rupee Equivalent */}
        <div className="bg-gradient-to-tr from-blue-700 via-indigo-700 to-indigo-800 text-white p-6 rounded-3xl shadow-lg shadow-blue-500/15 space-y-3 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between relative z-10">
            <div className="text-xs font-bold uppercase tracking-wider text-blue-100 flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-amber-300" />
              <span>Available Fair Coins</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white backdrop-blur-xs">
              Active
            </span>
          </div>

          <div className="relative z-10 py-1">
            <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight">
              {loading ? '...' : balance.toLocaleString()}
              <span className="text-sm font-bold text-blue-200 ml-2">Coins</span>
            </div>
            {reservedCoins > 0 && (
              <p className="text-[11px] text-amber-200 mt-1 font-semibold">
                ({reservedCoins.toLocaleString()} reserved for pending checkout)
              </p>
            )}
          </div>

          <div className="pt-2 border-t border-white/15 space-y-1 relative z-10">
            <div className="flex items-center justify-between text-xs">
              <span className="text-blue-100">Rupee Value:</span>
              <span className="font-black text-amber-300 font-mono text-base">
                ₹{loading ? '...' : rupeeEquivalent}
              </span>
            </div>
            <div className="text-[10px] text-blue-200 font-medium">
              10 Fair Coins = ₹1 (Fixed)
            </div>
          </div>
        </div>

        {/* Card 2: Total Coins Earned */}
        <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs space-y-3 flex flex-col justify-between">
          <div>
            <div className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center justify-between">
              <span>Total Earned</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 mt-2 font-mono">
              +{loading ? '...' : totalEarned.toLocaleString()}
              <span className="text-xs font-bold text-slate-400 ml-1">Coins</span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
            Welcome bonus & 100 coins/eligible item.
          </div>
        </div>

        {/* Card 3: Total Coins Redeemed */}
        <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs space-y-3 flex flex-col justify-between">
          <div>
            <div className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center justify-between">
              <span>Total Redeemed</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                <ArrowDownRight className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-800 mt-2 font-mono">
              -{loading ? '...' : totalRedeemed.toLocaleString()}
              <span className="text-xs font-bold text-slate-400 ml-1">Coins</span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
            Applied at checkout for rupee discounts.
          </div>
        </div>

        {/* Card 4: Total Coins Reversed */}
        <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs space-y-3 flex flex-col justify-between">
          <div>
            <div className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center justify-between">
              <span>Total Reversed</span>
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                <RefreshCw className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-rose-600 mt-2 font-mono">
              -{loading ? '...' : totalReversed.toLocaleString()}
              <span className="text-xs font-bold text-slate-400 ml-1">Coins</span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
            Reversed from cancelled or refunded orders.
          </div>
        </div>
      </div>

      {/* Information Banner on Fixed Rate Rule */}
      <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0" />
          <div>
            <span className="font-bold text-amber-950">Authoritative Platform Conversion Rate: </span>
            <span>10 Fair Coins = ₹1 (1 Fair Coin = ₹0.10)</span>
          </div>
        </div>
        <div className="text-[11px] text-amber-800 font-semibold bg-white/70 px-3 py-1 rounded-lg border border-amber-200 self-start sm:self-auto">
          Rupee equivalent = Fair Coins ÷ 10
        </div>
      </div>

      {/* Immutable Ledger History Table */}
      <div className="bg-white border border-slate-200/80 p-6 rounded-3xl shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <span>Fair Coin Transaction History</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Audited transaction ledger with timestamp and post-transaction balance.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {transactions.length} {transactions.length === 1 ? 'record' : 'records'}
          </span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
            <span>Loading transaction history...</span>
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12 text-xs text-slate-400">
            <Coins className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="font-bold text-slate-600">No transactions recorded yet</p>
            <p className="text-slate-400 mt-0.5">
              Earn coins by making purchases, referring friends, or playing the daily Spin & Win.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider bg-slate-50/50">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Transaction</th>
                  <th className="py-3 px-3 text-right">Fair Coins</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Balance After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {transactions.map((tx) => {
                  const isDebit =
                    tx.type === 'REDEEMED' ||
                    tx.type === 'DEBIT' ||
                    tx.type === 'EXPIRATION' ||
                    (typeof tx.amount === 'number' && tx.amount < 0);
                  const isReversal = tx.type === 'REVERSED' || tx.status === 'REVERSED';
                  const absAmount = Math.abs(Number(tx.amount) || 0);

                  const txDate = tx.createdAt ? new Date(tx.createdAt) : null;
                  const formattedDate = txDate
                    ? txDate.toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—';
                  const formattedTime = txDate
                    ? txDate.toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      })
                    : '';

                  return (
                    <tr key={tx._id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Date & Time */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="text-slate-900 font-bold">{formattedDate}</div>
                        {formattedTime && (
                          <div className="text-[10px] text-slate-400">{formattedTime}</div>
                        )}
                      </td>

                      {/* Transaction Description & Reference */}
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <div>{tx.description || tx.source || 'Fair Coin Transaction'}</div>
                        {tx.referenceId && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Order/Ref: #{tx.referenceId}
                          </div>
                        )}
                      </td>

                      {/* Fair Coins Amount */}
                      <td
                        className={`py-3.5 px-3 text-right font-mono font-black text-sm ${
                          isReversal
                            ? 'text-rose-600'
                            : isDebit
                            ? 'text-amber-800'
                            : 'text-emerald-600'
                        }`}
                      >
                        {isDebit || isReversal ? `-${absAmount}` : `+${absAmount}`}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">{getTransactionBadge(tx)}</td>

                      {/* Balance After */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                        {tx.balanceAfter !== undefined && tx.balanceAfter !== null
                          ? Number(tx.balanceAfter).toLocaleString()
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Wallet;
