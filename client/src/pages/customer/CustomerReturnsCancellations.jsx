import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import {
  RotateCcw,
  RefreshCw,
  XCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Package,
  CreditCard,
  ShieldAlert,
  Search,
  Filter,
  ArrowRight,
} from 'lucide-react';

export const CustomerReturnsCancellations = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL'); // ALL, RETURN, REPLACEMENT, CANCELLATION
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRequests();
  }, [activeTab, statusFilter]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (activeTab !== 'ALL') params.requestType = activeTab;
      if (statusFilter) params.status = statusFilter;

      const res = await api.get('/returns/my', { params });
      if (res.data?.success) {
        setRequests(res.data.data?.requests || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load your return & cancellation requests');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'REQUEST_SUBMITTED':
      case 'UNDER_REVIEW':
      case 'REQUESTED':
        return { label: 'Under Review', bg: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock };
      case 'APPROVED':
        return { label: 'Approved', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 };
      case 'REJECTED':
        return { label: 'Rejected', bg: 'bg-rose-50 text-rose-700 border-rose-200', icon: XCircle };
      case 'PICKUP_SCHEDULED':
        return { label: 'Pickup Scheduled', bg: 'bg-blue-50 text-blue-700 border-blue-200', icon: Truck };
      case 'PICKUP_COMPLETED':
      case 'RECEIVED':
        return { label: 'Item Received', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: Package };
      case 'QUALITY_INSPECTION':
        return { label: 'Quality Check', bg: 'bg-purple-50 text-purple-700 border-purple-200', icon: RefreshCw };
      case 'REFUND_PROCESSING':
        return { label: 'Refund Processing', bg: 'bg-sky-50 text-sky-700 border-sky-200', icon: CreditCard };
      case 'REFUND_COMPLETED':
      case 'COMPLETED':
        return { label: 'Completed / Refunded', bg: 'bg-teal-50 text-teal-700 border-teal-200', icon: CheckCircle2 };
      case 'REPLACEMENT_APPROVED':
        return { label: 'Replacement Approved', bg: 'bg-cyan-50 text-cyan-700 border-cyan-200', icon: RefreshCw };
      case 'REPLACEMENT_SHIPPED':
        return { label: 'Replacement Shipped', bg: 'bg-blue-50 text-blue-700 border-blue-200', icon: Truck };
      default:
        return { label: status, bg: 'bg-slate-50 text-slate-700 border-slate-200', icon: Clock };
    }
  };

  const stats = {
    total: requests.length,
    active: requests.filter((r) => ['REQUEST_SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PICKUP_SCHEDULED', 'QUALITY_INSPECTION', 'REFUND_PROCESSING'].includes(r.status)).length,
    completed: requests.filter((r) => ['REFUND_COMPLETED', 'COMPLETED'].includes(r.status)).length,
    rejected: requests.filter((r) => r.status === 'REJECTED').length,
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <RotateCcw className="w-7 h-7 text-blue-600" />
            <span>My Returns & Cancellations</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track and manage your order cancellations, product returns, replacements, and refunds.
          </p>
        </div>
        <Link
          to="/account/orders"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition self-start"
        >
          <Package className="w-4 h-4" />
          <span>View Past Orders</span>
        </Link>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Requests</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-blue-200 bg-blue-50/20 shadow-xs">
          <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">In Progress</p>
          <p className="text-2xl font-black text-blue-700 mt-1">{stats.active}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
          <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Completed / Refunded</p>
          <p className="text-2xl font-black text-emerald-700 mt-1">{stats.completed}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-rose-200 bg-rose-50/20 shadow-xs">
          <p className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Rejected / Closed</p>
          <p className="text-2xl font-black text-rose-700 mt-1">{stats.rejected}</p>
        </div>
      </div>

      {/* Filter Tabs & Select */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'ALL', label: 'All Requests' },
            { id: 'RETURN', label: 'Returns' },
            { id: 'REPLACEMENT', label: 'Replacements' },
            { id: 'CANCELLATION', label: 'Cancellations' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 px-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">All Statuses</option>
            <option value="REQUEST_SUBMITTED">Under Review</option>
            <option value="APPROVED">Approved</option>
            <option value="PICKUP_SCHEDULED">Pickup Scheduled</option>
            <option value="QUALITY_INSPECTION">Quality Check</option>
            <option value="REFUND_PROCESSING">Refund Processing</option>
            <option value="REFUND_COMPLETED">Refund Completed</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="py-16 text-center text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
          <p className="text-xs font-bold">Loading your requests...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          <p className="text-xs font-bold">{error}</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <Package className="w-7 h-7" />
          </div>
          <h3 className="text-base font-black text-slate-900">No Return or Cancellation Requests</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            You don't have any active returns or cancellations under this filter. If you need to return a delivered item or cancel an upcoming order, go to your orders page.
          </p>
          <Link
            to="/account/orders"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition"
          >
            <span>Go to My Orders</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => {
            const badge = getStatusBadge(req.status);
            const BadgeIcon = badge.icon;
            const isExpanded = expandedId === req._id;

            return (
              <div
                key={req._id}
                className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden transition hover:border-slate-300"
              >
                {/* Header row */}
                <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className={`p-2.5 rounded-2xl ${
                      req.requestType === 'CANCELLATION' ? 'bg-rose-50 text-rose-600' :
                      req.requestType === 'REPLACEMENT' ? 'bg-cyan-50 text-cyan-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                      {req.requestType === 'CANCELLATION' ? <XCircle className="w-5 h-5" /> :
                       req.requestType === 'REPLACEMENT' ? <RefreshCw className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                          {req.requestType} REQUEST
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs font-bold text-slate-700">Order #{req.orderNumber}</span>
                        <span className="text-[11px] text-slate-400">
                          (Ref: {req._id.substring(req._id.length - 8)})
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Requested on {new Date(req.requestedAt || req.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                        {req.vendorId?.businessName && ` • Seller: ${req.vendorId.businessName}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-black border flex items-center gap-1.5 ${badge.bg}`}>
                      <BadgeIcon className="w-3.5 h-3.5" />
                      <span>{badge.label}</span>
                    </span>

                    <button
                      onClick={() => setExpandedId(isExpanded ? null : req._id)}
                      className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
                      title={isExpanded ? 'Collapse' : 'Expand Details'}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Items Summary preview */}
                <div className="p-5 space-y-3">
                  <div className="space-y-2">
                    {req.items?.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3 min-w-0">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-10 h-10 object-cover rounded-xl border border-slate-100 shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 text-slate-400">
                              <Package className="w-5 h-5" />
                            </div>
                          )}
                          <div className="truncate">
                            <p className="font-bold text-slate-900 truncate">{item.name}</p>
                            <p className="text-[11px] text-slate-500">Qty: {item.quantity} • Unit: ₹{(item.unitPrice || 0).toLocaleString('en-IN')}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-black text-slate-900">₹{((item.lineTotal || (item.unitPrice * item.quantity)) || 0).toLocaleString('en-IN')}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Reason Callout */}
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/60 text-xs">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Reason Provided:</p>
                    <p className="font-semibold text-slate-800 mt-0.5">{req.reason}</p>
                    {req.detailedDescription && (
                      <p className="text-slate-600 text-[11px] mt-1">{req.detailedDescription}</p>
                    )}
                  </div>
                </div>

                {/* Expanded Details Section */}
                {isExpanded && (
                  <div className="p-5 bg-slate-50/50 border-t border-slate-100 space-y-5 text-xs">
                    {/* Reverse Pickup Details */}
                    {req.pickupDetails && (req.pickupDetails.status !== 'PENDING' || req.pickupDetails.awbNumber) && (
                      <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200/80 space-y-2">
                        <h4 className="font-black text-blue-900 flex items-center gap-2">
                          <Truck className="w-4 h-4 text-blue-600" />
                          <span>Reverse Pickup & Courier Details</span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                          <div>
                            <span className="text-slate-500">Courier Partner:</span>{' '}
                            <span className="font-bold text-slate-800">{req.pickupDetails.courierPartner || 'Logistics Partner'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">AWB Tracking:</span>{' '}
                            <span className="font-bold text-slate-800">{req.pickupDetails.awbNumber || 'Generating...'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Scheduled Date:</span>{' '}
                            <span className="font-bold text-slate-800">
                              {req.pickupDetails.scheduledDate ? new Date(req.pickupDetails.scheduledDate).toLocaleDateString('en-IN') : 'Within 24-48 hrs'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Refund Information */}
                    {req.refundDetails && (
                      <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 space-y-2">
                        <h4 className="font-black text-emerald-900 flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-emerald-600" />
                          <span>Refund Breakdown</span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                          <div>
                            <span className="text-slate-500">Refund Amount:</span>{' '}
                            <span className="font-black text-emerald-800">
                              ₹{(req.refundDetails.refundAmount || req.refundDetails.refundableAmount || 0).toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500">Refund Method:</span>{' '}
                            <span className="font-bold text-slate-800">{req.refundDetails.refundMethod || 'Original Payment'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Status:</span>{' '}
                            <span className="font-bold text-slate-800">{req.refundDetails.refundStatus}</span>
                          </div>
                          {req.refundDetails.gatewayRefundId && (
                            <div className="sm:col-span-3">
                              <span className="text-slate-500">Transaction Reference ID:</span>{' '}
                              <span className="font-mono font-bold text-slate-700">{req.refundDetails.gatewayRefundId}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Vendor Rejection Note */}
                    {req.status === 'REJECTED' && req.vendorAction?.explanation && (
                      <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-1">
                        <p className="font-black text-rose-800 flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4 text-rose-600" />
                          <span>Seller Rejection Reason:</span>
                        </p>
                        <p className="text-rose-700 text-[11px]">{req.vendorAction.explanation}</p>
                      </div>
                    )}

                    {/* Evidence photos */}
                    {req.evidenceImages?.length > 0 && (
                      <div>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Uploaded Evidence:</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          {req.evidenceImages.map((img, i) => (
                            <a key={i} href={img} target="_blank" rel="noreferrer" className="block">
                              <img src={img} alt="Evidence" className="w-16 h-16 object-cover rounded-xl border border-slate-200 hover:opacity-80 transition" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action History Log */}
                    {req.actionHistory?.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-slate-200/60">
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tracking Timeline:</p>
                        <div className="space-y-2">
                          {req.actionHistory.map((act, i) => (
                            <div key={i} className="flex items-start gap-2 text-[11px]">
                              <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                              <div className="flex-1">
                                <span className="font-bold text-slate-800">{act.action}</span>
                                {act.note && <span className="text-slate-600"> — {act.note}</span>}
                                <span className="text-slate-400 block text-[10px]">
                                  {new Date(act.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Footer Links */}
                    <div className="flex justify-end pt-2">
                      <Link
                        to={`/account/orders`}
                        className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-bold text-xs"
                      >
                        <span>View Order Details</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CustomerReturnsCancellations;

