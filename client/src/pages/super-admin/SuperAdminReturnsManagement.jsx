import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  RotateCcw,
  RefreshCw,
  XCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  Package,
  Search,
  Filter,
  Eye,
  ShieldCheck,
  CreditCard,
  Settings,
  Plus,
  Trash2,
  Edit2,
  X,
  Sliders,
} from 'lucide-react';

export const SuperAdminReturnsManagement = () => {
  const [activeTab, setActiveTab] = useState('REQUESTS'); // 'REQUESTS' or 'POLICIES'
  const [requests, setRequests] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter states
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [activeModal, setActiveModal] = useState(null); // 'OVERRIDE', 'REFUND', 'POLICY_FORM', 'DETAIL'
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Admin Override Form
  const [overrideAction, setOverrideAction] = useState('APPROVE');
  const [adminNotes, setAdminNotes] = useState('');

  // Refund Form
  const [refundAmount, setRefundAmount] = useState('');
  const [refundRemarks, setRefundRemarks] = useState('');

  // Policy Form
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [policyForm, setPolicyForm] = useState({
    name: 'BAAPOO MART Standard 7-Day Policy',
    policyType: 'GLOBAL_DEFAULT',
    returnAllowed: true,
    returnWindowDays: 7,
    replacementAllowed: true,
    replacementWindowDays: 7,
    refundAllowed: true,
    cancellationAllowed: true,
    requiresEvidenceImages: false,
    requiresSerialVerification: false,
    applicableConditions: [
      'Original brand packaging must be intact',
      'All accessories, user manuals, and warranty cards included',
      'Item must be unused and in original condition',
    ],
    isActive: true,
  });

  useEffect(() => {
    if (activeTab === 'REQUESTS') {
      fetchRequests();
    } else {
      fetchPolicies();
    }
  }, [activeTab, statusFilter, typeFilter]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.requestType = typeFilter;
      if (searchTerm) params.search = searchTerm;

      const res = await api.get('/returns/admin', { params });
      if (res.data?.success) {
        setRequests(res.data.data?.requests || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch admin requests');
    } finally {
      setLoading(false);
    }
  };

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/returns/policies');
      if (res.data?.success) {
        setPolicies(res.data.data || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch return policies');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchRequests();
  };

  // Admin Override Submit
  const handleOverrideSubmit = async () => {
    if (!adminNotes.trim()) {
      alert('Please provide a mandatory explanation for this admin override decision.');
      return;
    }
    try {
      setModalLoading(true);
      const newStatus = overrideAction === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      await api.post(`/returns/admin/${selectedRequest._id}/override`, {
        overrideAction,
        adminNotes: adminNotes.trim(),
        newStatus,
      });
      alert(`Admin override executed: Request status changed to ${newStatus}.`);
      setActiveModal(null);
      fetchRequests();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to execute admin override');
    } finally {
      setModalLoading(false);
    }
  };

  // Gateway Refund Submit
  const handleRefundSubmit = async () => {
    try {
      setModalLoading(true);
      await api.post(`/returns/admin/${selectedRequest._id}/refund`, {
        refundAmount: parseFloat(refundAmount),
        remarks: refundRemarks,
      });
      alert('Refund processed successfully through payment gateway and recorded in ledgers.');
      setActiveModal(null);
      fetchRequests();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to process refund');
    } finally {
      setModalLoading(false);
    }
  };

  // Policy Form Save
  const handlePolicySave = async (e) => {
    e.preventDefault();
    try {
      setModalLoading(true);
      if (editingPolicy) {
        await api.put(`/returns/policies/${editingPolicy._id}`, policyForm);
        alert('Return policy updated successfully.');
      } else {
        await api.post('/returns/policies', policyForm);
        alert('Return policy created successfully.');
      }
      setActiveModal(null);
      setEditingPolicy(null);
      fetchPolicies();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save return policy');
    } finally {
      setModalLoading(false);
    }
  };

  // Policy Delete
  const handleDeletePolicy = async (id) => {
    if (!window.confirm('Are you sure you want to delete this return policy?')) return;
    try {
      await api.delete(`/returns/policies/${id}`);
      alert('Return policy deleted.');
      fetchPolicies();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete return policy');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'REQUEST_SUBMITTED':
      case 'UNDER_REVIEW':
      case 'REQUESTED':
        return { label: 'Under Review', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'APPROVED':
        return { label: 'Approved', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'REJECTED':
        return { label: 'Rejected', bg: 'bg-rose-50 text-rose-700 border-rose-200' };
      case 'PICKUP_SCHEDULED':
        return { label: 'Pickup Scheduled', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'RECEIVED':
        return { label: 'Received', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 'QUALITY_INSPECTION':
        return { label: 'Quality Check', bg: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'REFUND_PROCESSING':
        return { label: 'Refund Processing', bg: 'bg-sky-50 text-sky-700 border-sky-200' };
      case 'REFUND_COMPLETED':
      case 'COMPLETED':
        return { label: 'Completed', bg: 'bg-teal-50 text-teal-700 border-teal-200' };
      default:
        return { label: status, bg: 'bg-slate-50 text-slate-700 border-slate-200' };
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Title & Navigation tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="w-7 h-7 text-blue-600" />
            <span>Returns, Refunds & Policies Hub</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Platform-wide governance: dispute resolution, vendor overrides, automated refunds & policy rules.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl">
          <button
            onClick={() => setActiveTab('REQUESTS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'REQUESTS' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Requests & Disputes</span>
          </button>
          <button
            onClick={() => setActiveTab('POLICIES')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'POLICIES' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Return Policies Config</span>
          </button>
        </div>
      </div>

      {/* TAB 1: REQUESTS & DISPUTES */}
      {activeTab === 'REQUESTS' && (
        <div className="space-y-6">
          {/* Filters & Search */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-hidden"
              >
                <option value="">All Types (Return / Replace / Cancel)</option>
                <option value="RETURN">Return</option>
                <option value="REPLACEMENT">Replacement</option>
                <option value="CANCELLATION">Cancellation</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-hidden"
              >
                <option value="">All Statuses</option>
                <option value="REQUEST_SUBMITTED">Under Review</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Vendor Rejected (Disputed)</option>
                <option value="REFUND_PROCESSING">Ready for Refund</option>
                <option value="REFUND_COMPLETED">Refund Completed</option>
              </select>
            </div>

            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search Order # or Reason..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl w-60 focus:outline-hidden"
                />
              </div>
              <button
                type="submit"
                className="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition"
              >
                Filter
              </button>
            </form>
          </div>

          {/* Table */}
          {loading ? (
            <div className="py-16 text-center text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
              <p className="text-xs font-bold">Loading platform requests...</p>
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-center">
              <AlertCircle className="w-8 h-8 mx-auto mb-2" />
              <p className="text-xs font-bold">{error}</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
              <Package className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-base font-black text-slate-900">No Return or Dispute Requests Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">No requests matching your active filter criteria.</p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3.5 px-4">Order / Request</th>
                      <th className="py-3.5 px-4">Customer</th>
                      <th className="py-3.5 px-4">Seller</th>
                      <th className="py-3.5 px-4">Products & Refund</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Admin Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {requests.map((req) => {
                      const badge = getStatusBadge(req.status);
                      const isRefundable = ['REFUND_PROCESSING', 'QUALITY_INSPECTION', 'APPROVED'].includes(req.status) &&
                                           req.refundDetails?.refundStatus !== 'COMPLETED';

                      return (
                        <tr key={req._id} className="hover:bg-slate-50/50 transition">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">Order #{req.orderNumber}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {req.requestType} • {new Date(req.requestedAt || req.createdAt).toLocaleDateString('en-IN')}
                            </div>
                            {req.adminOverride?.isOverridden && (
                              <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[9px] font-black uppercase tracking-wider">
                                Overridden by Admin
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-800">{req.customerId?.name || 'Customer'}</div>
                            <div className="text-[10px] text-slate-500">{req.customerId?.email}</div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-800">{req.vendorId?.businessName || req.vendorId?.storeName || 'Vendor'}</div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-800">
                              {req.items?.length} item(s)
                            </div>
                            <div className="text-[11px] font-black text-emerald-700">
                              Refund: ₹{(req.refundDetails?.refundableAmount || req.refundDetails?.refundAmount || 0).toLocaleString('en-IN')}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider inline-block ${badge.bg}`}>
                              {badge.label}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setSelectedRequest(req);
                                  setActiveModal('DETAIL');
                                }}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
                                title="View Details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => {
                                  setSelectedRequest(req);
                                  setOverrideAction(req.status === 'REJECTED' ? 'APPROVE' : 'REJECT');
                                  setAdminNotes('');
                                  setActiveModal('OVERRIDE');
                                }}
                                className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-bold text-[11px] transition"
                              >
                                Override
                              </button>

                              {isRefundable && (
                                <button
                                  onClick={() => {
                                    setSelectedRequest(req);
                                    setRefundAmount(req.refundDetails?.refundableAmount || 0);
                                    setRefundRemarks(`Authorized Refund for Order #${req.orderNumber}`);
                                    setActiveModal('REFUND');
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-xs transition"
                                >
                                  Process Refund
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: POLICIES */}
      {activeTab === 'POLICIES' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div>
              <h3 className="font-black text-slate-900 text-sm">Configured Return & Replacement Policies</h3>
              <p className="text-xs text-slate-500">
                Define the return windows, replacement eligibility, and verification requirements for products.
              </p>
            </div>

            <button
              onClick={() => {
                setEditingPolicy(null);
                setPolicyForm({
                  name: 'Custom Category Return Policy',
                  policyType: 'CATEGORY',
                  returnAllowed: true,
                  returnWindowDays: 7,
                  replacementAllowed: true,
                  replacementWindowDays: 7,
                  refundAllowed: true,
                  cancellationAllowed: true,
                  requiresEvidenceImages: false,
                  requiresSerialVerification: false,
                  applicableConditions: [
                    'Original brand packaging must be intact',
                    'All tags and manuals attached',
                  ],
                  isActive: true,
                });
                setActiveModal('POLICY_FORM');
              }}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Policy</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {policies.map((pol) => (
              <div key={pol._id} className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-slate-900 text-sm">{pol.name}</h4>
                      {pol.isDefault && (
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-black uppercase border border-blue-200">
                          Global Default
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">Type: {pol.policyType}</p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingPolicy(pol);
                        setPolicyForm({
                          name: pol.name,
                          policyType: pol.policyType,
                          returnAllowed: pol.returnAllowed,
                          returnWindowDays: pol.returnWindowDays,
                          replacementAllowed: pol.replacementAllowed,
                          replacementWindowDays: pol.replacementWindowDays,
                          refundAllowed: pol.refundAllowed,
                          cancellationAllowed: pol.cancellationAllowed,
                          requiresEvidenceImages: pol.requiresEvidenceImages,
                          requiresSerialVerification: pol.requiresSerialVerification,
                          applicableConditions: pol.applicableConditions || [],
                          isActive: pol.isActive,
                        });
                        setActiveModal('POLICY_FORM');
                      }}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {!pol.isDefault && (
                      <button
                        onClick={() => handleDeletePolicy(pol._id)}
                        className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-200/60">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Return Window:</span>
                    <span className="font-black text-slate-800">{pol.returnAllowed ? `${pol.returnWindowDays} Days` : 'Disabled'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Replacement Window:</span>
                    <span className="font-black text-slate-800">{pol.replacementAllowed ? `${pol.replacementWindowDays} Days` : 'Disabled'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Evidence Photos:</span>
                    <span className="font-bold text-slate-700">{pol.requiresEvidenceImages ? 'Mandatory' : 'Optional'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">IMEI / Serial Verification:</span>
                    <span className="font-bold text-slate-700">{pol.requiresSerialVerification ? 'Required' : 'None'}</span>
                  </div>
                </div>

                {pol.applicableConditions?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Return Conditions:</p>
                    <ul className="list-disc list-inside text-[11px] text-slate-600 space-y-0.5">
                      {pol.applicableConditions.map((cond, i) => (
                        <li key={i}>{cond}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: ADMIN OVERRIDE */}
      {activeModal === 'OVERRIDE' && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-slate-900 text-sm">Dispute Resolution: Admin Override</h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Super Admin override for Order #{selectedRequest.orderNumber}. This decision supersedes the seller's action.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Target Decision</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOverrideAction('APPROVE')}
                    className={`py-2 rounded-xl font-bold border text-xs transition ${
                      overrideAction === 'APPROVE'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    Force Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverrideAction('REJECT')}
                    className={`py-2 rounded-xl font-bold border text-xs transition ${
                      overrideAction === 'REJECT'
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    Force Reject
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Mandatory Super Admin Rationale <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="State the regulatory / policy reason for overriding the seller decision..."
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs"
                  rows={3}
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button onClick={() => setActiveModal(null)} className="px-4 py-2 rounded-xl border text-slate-600 font-bold text-xs">
                Cancel
              </button>
              <button
                onClick={handleOverrideSubmit}
                disabled={modalLoading || !adminNotes.trim()}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs disabled:opacity-50"
              >
                {modalLoading ? 'Applying...' : 'Apply Admin Decision'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DIRECT REFUND EXECUTION */}
      {activeModal === 'REFUND' && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-emerald-900 text-sm">Execute Gateway Refund</h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Triggers verified refund to customer via Razorpay (or records bank transfer) and automatically balances vendor ledger and platform commission debits.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Refund Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-black text-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Remarks / Note</label>
                <input
                  type="text"
                  value={refundRemarks}
                  onChange={(e) => setRefundRemarks(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button onClick={() => setActiveModal(null)} className="px-4 py-2 rounded-xl border text-slate-600 font-bold text-xs">
                Cancel
              </button>
              <button
                onClick={handleRefundSubmit}
                disabled={modalLoading || !refundAmount || parseFloat(refundAmount) <= 0}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
              >
                {modalLoading ? 'Processing...' : 'Execute Refund Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: POLICY FORM */}
      {activeModal === 'POLICY_FORM' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-slate-900 text-sm">
                {editingPolicy ? 'Edit Return Policy' : 'Create New Return Policy'}
              </h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePolicySave} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Policy Name</label>
                <input
                  type="text"
                  value={policyForm.name}
                  onChange={(e) => setPolicyForm({ ...policyForm, name: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Policy Scope</label>
                  <select
                    value={policyForm.policyType}
                    onChange={(e) => setPolicyForm({ ...policyForm, policyType: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-semibold"
                  >
                    <option value="GLOBAL_DEFAULT">Global Default</option>
                    <option value="CATEGORY">Category Override</option>
                    <option value="PRODUCT">Product Override</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Return Window (Days)</label>
                  <input
                    type="number"
                    min="0"
                    max="90"
                    value={policyForm.returnWindowDays}
                    onChange={(e) => setPolicyForm({ ...policyForm, returnWindowDays: parseInt(e.target.value) || 0 })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={policyForm.returnAllowed}
                    onChange={(e) => setPolicyForm({ ...policyForm, returnAllowed: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  <span>Allow Return (Refund)</span>
                </label>

                <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={policyForm.replacementAllowed}
                    onChange={(e) => setPolicyForm({ ...policyForm, replacementAllowed: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  <span>Allow Replacement (Exchange)</span>
                </label>

                <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={policyForm.requiresEvidenceImages}
                    onChange={(e) => setPolicyForm({ ...policyForm, requiresEvidenceImages: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  <span>Require Evidence Photos</span>
                </label>

                <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={policyForm.requiresSerialVerification}
                    onChange={(e) => setPolicyForm({ ...policyForm, requiresSerialVerification: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  <span>Require IMEI / Serial Verification</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 rounded-xl border text-slate-600 font-bold text-xs">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs"
                >
                  {modalLoading ? 'Saving...' : 'Save Policy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DETAIL */}
      {activeModal === 'DETAIL' && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-black text-slate-900 text-sm">Full Request Audit #{selectedRequest._id.substring(selectedRequest._id.length - 8)}</h3>
                <p className="text-[11px] text-slate-400">Order #{selectedRequest.orderNumber}</p>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/60">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Parties</p>
                <p className="font-bold text-slate-800">Customer: {selectedRequest.customerId?.name} ({selectedRequest.customerId?.email})</p>
                <p className="text-slate-600">Vendor: {selectedRequest.vendorId?.businessName || selectedRequest.vendorId?.storeName}</p>
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Reason & Notes</p>
                <p className="font-semibold text-slate-800">{selectedRequest.reason}</p>
                {selectedRequest.detailedDescription && (
                  <p className="text-slate-600 text-[11px] mt-0.5">{selectedRequest.detailedDescription}</p>
                )}
              </div>

              {selectedRequest.vendorAction?.explanation && (
                <div className="p-3 bg-amber-50/60 rounded-2xl border border-amber-200/80">
                  <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Seller Response</p>
                  <p className="font-bold text-amber-900">Action: {selectedRequest.vendorAction.action}</p>
                  <p className="text-slate-700 text-[11px] mt-0.5">{selectedRequest.vendorAction.explanation}</p>
                </div>
              )}

              {selectedRequest.actionHistory?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">History Log</p>
                  <div className="space-y-1.5 border-l-2 border-slate-200 pl-3">
                    {selectedRequest.actionHistory.map((act, i) => (
                      <div key={i} className="text-[11px]">
                        <span className="font-bold text-slate-800">{act.action}</span> by{' '}
                        <span className="text-blue-600 font-semibold">{act.byRole}</span>
                        {act.note && <span className="text-slate-500"> — {act.note}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t">
              <button onClick={() => setActiveModal(null)} className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminReturnsManagement;

