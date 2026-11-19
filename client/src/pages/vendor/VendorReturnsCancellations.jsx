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
  X,
} from 'lucide-react';

export const VendorReturnsCancellations = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [requestTypeFilter, setRequestTypeFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [activeModal, setActiveModal] = useState(null); // 'APPROVE', 'REJECT', 'INSPECT', 'DETAIL'
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Form states
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [schedulePickup, setSchedulePickup] = useState(true);
  const [rejectionReason, setRejectionReason] = useState('');
  const [inspectionStatus, setInspectionStatus] = useState('PASSED');
  const [inspectionNotes, setInspectionNotes] = useState('');
  const [restockItem, setRestockItem] = useState(true);

  useEffect(() => {
    fetchVendorRequests();
  }, [statusFilter, requestTypeFilter]);

  const fetchVendorRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (requestTypeFilter) params.requestType = requestTypeFilter;
      if (searchTerm) params.search = searchTerm;

      const res = await api.get('/returns/vendor', { params });
      if (res.data?.success) {
        setRequests(res.data.data?.requests || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch vendor return requests');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchVendorRequests();
  };

  // Vendor Action: Approve
  const handleApprove = async () => {
    try {
      setModalLoading(true);
      await api.post(`/returns/vendor/${selectedRequest._id}/approve`, {
        remarks: approvalRemarks,
        schedulePickup,
      });
      alert('Return request approved successfully! Reverse pickup has been initiated.');
      setActiveModal(null);
      fetchVendorRequests();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve return request');
    } finally {
      setModalLoading(false);
    }
  };

  // Vendor Action: Reject (Mandatory reason)
  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      alert('Please provide a mandatory reason for rejecting this return request.');
      return;
    }
    try {
      setModalLoading(true);
      await api.post(`/returns/vendor/${selectedRequest._id}/reject`, {
        rejectionReason: rejectionReason.trim(),
      });
      alert('Return request has been rejected. The customer has been notified with your explanation.');
      setActiveModal(null);
      fetchVendorRequests();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject return request');
    } finally {
      setModalLoading(false);
    }
  };

  // Vendor Action: Update Inspection
  const handleInspect = async () => {
    try {
      setModalLoading(true);
      await api.post(`/returns/vendor/${selectedRequest._id}/inspection`, {
        inspectionStatus,
        inspectionNotes,
        restockItem,
      });
      alert(`Inspection marked as ${inspectionStatus}. Status updated.`);
      setActiveModal(null);
      fetchVendorRequests();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update inspection');
    } finally {
      setModalLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'REQUEST_SUBMITTED':
      case 'UNDER_REVIEW':
      case 'REQUESTED':
        return { label: 'Pending Review', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'APPROVED':
        return { label: 'Approved', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'REJECTED':
        return { label: 'Rejected', bg: 'bg-rose-50 text-rose-700 border-rose-200' };
      case 'PICKUP_SCHEDULED':
        return { label: 'Pickup Scheduled', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'RECEIVED':
        return { label: 'Item Received', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
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
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <RotateCcw className="w-7 h-7 text-blue-600" />
            <span>Returns & Cancellations Management</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Review and manage customer return and cancellation requests for your store's products.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Requests</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{requests.length}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-xs">
          <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Pending My Action</p>
          <p className="text-2xl font-black text-amber-700 mt-1">
            {requests.filter((r) => ['REQUEST_SUBMITTED', 'UNDER_REVIEW', 'REQUESTED'].includes(r.status)).length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-blue-200 bg-blue-50/20 shadow-xs">
          <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Pickup / In Transit</p>
          <p className="text-2xl font-black text-blue-700 mt-1">
            {requests.filter((r) => ['PICKUP_SCHEDULED', 'PICKUP_COMPLETED', 'RECEIVED'].includes(r.status)).length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
          <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Completed / Closed</p>
          <p className="text-2xl font-black text-emerald-700 mt-1">
            {requests.filter((r) => ['REFUND_COMPLETED', 'COMPLETED', 'REJECTED'].includes(r.status)).length}
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={requestTypeFilter}
            onChange={(e) => setRequestTypeFilter(e.target.value)}
            className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-hidden"
          >
            <option value="">All Types (Return / Replace / Cancel)</option>
            <option value="RETURN">Return (Refund)</option>
            <option value="REPLACEMENT">Replacement</option>
            <option value="CANCELLATION">Cancellation</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-hidden"
          >
            <option value="">All Statuses</option>
            <option value="REQUEST_SUBMITTED">Pending Review</option>
            <option value="APPROVED">Approved</option>
            <option value="PICKUP_SCHEDULED">Pickup Scheduled</option>
            <option value="RECEIVED">Received</option>
            <option value="QUALITY_INSPECTION">Quality Check</option>
            <option value="REFUND_COMPLETED">Refund Completed</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>

        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Order # or Reason..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl w-60 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
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

      {/* Requests Table */}
      {loading ? (
        <div className="py-16 text-center text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
          <p className="text-xs font-bold">Loading store return requests...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          <p className="text-xs font-bold">{error}</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
          <Package className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-black text-slate-900">No Return or Cancellation Requests</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            You currently have no pending return or cancellation requests matching this filter.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-4">Order / Request</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Product(s)</th>
                  <th className="py-3.5 px-4">Reason</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((req) => {
                  const badge = getStatusBadge(req.status);
                  const isActionable = ['REQUEST_SUBMITTED', 'UNDER_REVIEW', 'REQUESTED'].includes(req.status);
                  const isInspectable = ['PICKUP_COMPLETED', 'RECEIVED', 'QUALITY_INSPECTION'].includes(req.status);

                  return (
                    <tr key={req._id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">Order #{req.orderNumber}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {req.requestType} • {new Date(req.requestedAt || req.createdAt).toLocaleDateString('en-IN')}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">{req.customerId?.name || 'Customer'}</div>
                        <div className="text-[10px] text-slate-500">{req.customerId?.phone || req.customerId?.email}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {req.items?.map((item, i) => (
                            <div key={i} className="text-slate-800 font-medium truncate max-w-[200px]">
                              {item.name} <span className="text-slate-400 font-normal">x{item.quantity}</span>
                            </div>
                          ))}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-800">{req.reason}</span>
                        {req.detailedDescription && (
                          <p className="text-[10px] text-slate-500 truncate max-w-[180px]">{req.detailedDescription}</p>
                        )}
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
                            title="View Full Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {isActionable && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedRequest(req);
                                  setApprovalRemarks('');
                                  setActiveModal('APPROVE');
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-xs transition"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedRequest(req);
                                  setRejectionReason('');
                                  setActiveModal('REJECT');
                                }}
                                className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] transition"
                              >
                                Reject
                              </button>
                            </>
                          )}

                          {isInspectable && (
                            <button
                              onClick={() => {
                                setSelectedRequest(req);
                                setInspectionStatus('PASSED');
                                setInspectionNotes('');
                                setRestockItem(true);
                                setActiveModal('INSPECT');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] shadow-xs transition"
                            >
                              Inspect Item
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

      {/* APPROVE MODAL */}
      {activeModal === 'APPROVE' && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-slate-900 text-sm">Approve Return Request</h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Approve {selectedRequest.requestType} for Order #{selectedRequest.orderNumber}. Reverse pickup logistics will be automatically booked with Delhivery.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Approval Notes / Remarks (Optional)</label>
                <textarea
                  value={approvalRemarks}
                  onChange={(e) => setApprovalRemarks(e.target.value)}
                  placeholder="e.g. Approved. Please pack securely with original box."
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-blue-500/20"
                  rows={2}
                />
              </div>

              <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={schedulePickup}
                  onChange={(e) => setSchedulePickup(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0"
                />
                <span>Schedule automated reverse pickup courier</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={modalLoading}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
              >
                {modalLoading ? 'Approving...' : 'Confirm Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL (MANDATORY REASON) */}
      {activeModal === 'REJECT' && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-rose-900 text-sm">Reject Return Request</h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Provide a clear, detailed reason for rejecting this return request. This explanation is mandatory and will be communicated to the customer.
            </p>

            <div className="space-y-1 text-xs">
              <label className="font-bold text-slate-700 block">
                Mandatory Rejection Explanation <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why the return cannot be accepted (e.g., seal broken on non-returnable consumable, missing serial tag, customer physical damage)..."
                className="w-full border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-rose-500/20"
                rows={3}
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={modalLoading || !rejectionReason.trim()}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs"
              >
                {modalLoading ? 'Rejecting...' : 'Reject Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INSPECT MODAL */}
      {activeModal === 'INSPECT' && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-purple-900 text-sm">Quality Inspection & Restocking</h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Record quality verification for the received returned package. If passed, the return moves to refund processing.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Inspection Outcome</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setInspectionStatus('PASSED')}
                    className={`py-2 rounded-xl font-bold border text-xs transition ${
                      inspectionStatus === 'PASSED'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    Passed (Original State)
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectionStatus('FAILED')}
                    className={`py-2 rounded-xl font-bold border text-xs transition ${
                      inspectionStatus === 'FAILED'
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    Failed (Damaged / Missing)
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Inspection Notes</label>
                <textarea
                  value={inspectionNotes}
                  onChange={(e) => setInspectionNotes(e.target.value)}
                  placeholder="Notes on packaging, accessories, condition..."
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs"
                  rows={2}
                />
              </div>

              {inspectionStatus === 'PASSED' && (
                <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={restockItem}
                    onChange={(e) => setRestockItem(e.target.checked)}
                    className="rounded text-purple-600 focus:ring-0"
                  />
                  <span>Automatically restock item quantity back to store inventory</span>
                </label>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleInspect}
                disabled={modalLoading}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs"
              >
                {modalLoading ? 'Saving...' : 'Submit Inspection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {activeModal === 'DETAIL' && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-black text-slate-900 text-sm">Request Details #{selectedRequest._id.substring(selectedRequest._id.length - 8)}</h3>
                <p className="text-[11px] text-slate-400">Order #{selectedRequest.orderNumber}</p>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/60 space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer</p>
                <p className="font-bold text-slate-800">{selectedRequest.customerId?.name || 'Customer'}</p>
                <p className="text-slate-500 text-[11px]">{selectedRequest.customerId?.phone} • {selectedRequest.customerId?.email}</p>
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Items</p>
                <div className="space-y-2">
                  {selectedRequest.items?.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div>
                        <p className="font-bold text-slate-800">{item.name}</p>
                        <p className="text-[10px] text-slate-400">Qty: {item.quantity} • Unit: ₹{(item.unitPrice || 0).toLocaleString('en-IN')}</p>
                        {item.serialNumber && <p className="text-[10px] text-blue-600 font-mono">Serial: {item.serialNumber}</p>}
                      </div>
                      <p className="font-black text-slate-900">₹{(item.lineTotal || 0).toLocaleString('en-IN')}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-amber-50/60 rounded-2xl border border-amber-200/80 space-y-1">
                <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Reason for Request</p>
                <p className="font-bold text-amber-900">{selectedRequest.reason}</p>
                {selectedRequest.detailedDescription && (
                  <p className="text-slate-700 text-[11px]">{selectedRequest.detailedDescription}</p>
                )}
              </div>

              {selectedRequest.evidenceImages?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Customer Evidence Images</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedRequest.evidenceImages.map((img, i) => (
                      <a key={i} href={img} target="_blank" rel="noreferrer">
                        <img src={img} alt="Evidence" className="w-16 h-16 object-cover rounded-xl border border-slate-200" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorReturnsCancellations;

