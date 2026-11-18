import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  Truck, Package, Search, Filter, RefreshCw, Calendar, MapPin,
  ExternalLink, Download, Clock, AlertCircle, CheckCircle2, ChevronRight,
  Loader2, XCircle, FileText, Layers, ShieldAlert, BarChart3,
  RotateCcw, DollarSign, ArrowUpRight, Check, X, ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ShipmentTrackingModal from '../../components/shipping/ShipmentTrackingModal';

const TABS = [
  { id: 'all', label: 'All Shipments', icon: Layers },
  { id: 'pending', label: 'Pending Shipments', icon: Clock },
  { id: 'in_transit', label: 'In Transit', icon: Truck },
  { id: 'delivered', label: 'Delivered', icon: CheckCircle2 },
  { id: 'cancelled', label: 'Cancelled', icon: XCircle },
  { id: 'returns', label: 'Return Requests', icon: RotateCcw },
  { id: 'refunds', label: 'Refund Management', icon: DollarSign },
  { id: 'exceptions', label: 'Shiprocket API Logs', icon: ShieldAlert },
];

export const SuperAdminShipping = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [stats, setStats] = useState(null);
  const [shipments, setShipments] = useState([]);
  const [returns, setReturns] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedShipmentIds, setSelectedShipmentIds] = useState([]);

  // Modal & action states
  const [selectedTrackingId, setSelectedTrackingId] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Shiprocket API Connection Health State
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [checkingConnection, setCheckingConnection] = useState(false);

  const handleCheckConnection = async () => {
    try {
      setCheckingConnection(true);
      const res = await api.get('/shipping/admin/connection-status');
      setConnectionStatus(res.data?.data?.status || null);
    } catch (e) {
      setConnectionStatus({ connected: false, error: e.response?.data?.message || e.message });
    } finally {
      setCheckingConnection(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (['all', 'pending', 'in_transit', 'delivered', 'cancelled'].includes(activeTab)) {
      fetchShipments();
    } else if (['returns', 'refunds'].includes(activeTab)) {
      fetchReturns();
    } else if (activeTab === 'exceptions') {
      fetchExceptions();
    }
  }, [activeTab, statusFilter, dateFilter]);

  const fetchStats = async () => {
    try {
      const res = await api.get('/shipping/admin/stats');
      if (res.data?.success) {
        setStats(res.data.data.stats);
      }
    } catch (e) {
      console.warn('Failed to fetch shipping stats', e);
    }
  };

  const fetchShipments = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};

      if (activeTab === 'pending') {
        params.status = 'DRAFT,READY,CREATED,AWB_ASSIGNED,PICKUP_REQUESTED';
      } else if (activeTab === 'in_transit') {
        params.status = 'PICKED_UP,IN_TRANSIT,OUT_FOR_DELIVERY,SHIPPED';
      } else if (activeTab === 'delivered') {
        params.status = 'DELIVERED';
      } else if (activeTab === 'cancelled') {
        params.status = 'CANCELLED';
      } else if (statusFilter) {
        params.status = statusFilter;
      }

      if (searchQuery) params.search = searchQuery;
      if (dateFilter) params.dateFrom = dateFilter;

      const res = await api.get('/shipping/admin/shipments', { params });
      if (res.data?.success) {
        setShipments(res.data.data.shipments || []);
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to fetch platform shipments');
    } finally {
      setLoading(false);
    }
  };

  const fetchReturns = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (searchQuery) params.search = searchQuery;

      const res = await api.get('/returns/admin', { params });
      if (res.data?.success) {
        const list = res.data.data?.requests || res.data.data || [];
        setReturns(list);
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to fetch returns data');
    } finally {
      setLoading(false);
    }
  };

  const fetchExceptions = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/shipping/admin/exceptions');
      if (res.data?.success) {
        setExceptions(res.data.data.exceptions || []);
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to fetch shipping exception logs');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateManifest = async () => {
    if (selectedShipmentIds.length === 0) {
      alert('Select at least one shipment to generate manifest');
      return;
    }
    try {
      setActionLoadingId('manifest');
      const res = await api.post('/shipping/admin/shipments/manifest', {
        shipmentIds: selectedShipmentIds,
      });
      const manifestUrl = res.data?.data?.manifestUrl;
      if (manifestUrl) {
        window.open(manifestUrl, '_blank');
      }
      setActionSuccess('Manifest generated successfully for selected shipments');
      setSelectedShipmentIds([]);
      fetchShipments();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to generate manifest');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRetryShipment = async (shipmentId) => {
    try {
      setActionLoadingId(shipmentId);
      await api.post(`/shipping/admin/shipments/${shipmentId}/retry`);
      setActionSuccess('Shipment recreation queued successfully');
      fetchShipments();
      fetchStats();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to retry shipment');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAdminOverride = async (returnId, decision) => {
    const reason = prompt(`Enter reason for ${decision} override:`);
    if (!reason) return;
    try {
      setActionLoadingId(returnId);
      await api.post(`/returns/admin/${returnId}/override`, {
        decision,
        reason,
      });
      setActionSuccess(`Return request successfully overridden to ${decision}`);
      fetchReturns();
      fetchStats();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Override failed');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleProcessRefund = async (returnId) => {
    if (!window.confirm('Process refund for this return request immediately?')) return;
    try {
      setActionLoadingId(returnId);
      await api.post(`/returns/admin/${returnId}/refund`);
      setActionSuccess('Refund processed successfully');
      fetchReturns();
      fetchStats();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Refund processing failed');
    } finally {
      setActionLoadingId(null);
    }
  };

  const getStatusBadge = (status) => {
    const s = status || 'PENDING';
    if (s === 'DELIVERED') {
      return <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">DELIVERED</span>;
    }
    if (['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'PICKED_UP', 'SHIPPED'].includes(s)) {
      return <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-blue-50 text-blue-700 border border-blue-200">{s.replace(/_/g, ' ')}</span>;
    }
    if (s === 'AWB_ASSIGNED' || s === 'MANIFEST_GENERATED' || s === 'PICKUP_SCHEDULED') {
      return <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">{s.replace(/_/g, ' ')}</span>;
    }
    if (['CANCELLED', 'RTO_INITIATED', 'RTO_DELIVERED', 'FAILED', 'DELIVERY_FAILED'].includes(s)) {
      return <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-rose-50 text-rose-700 border border-rose-200">{s.replace(/_/g, ' ')}</span>;
    }
    return <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-50 text-amber-700 border border-amber-200">{s.replace(/_/g, ' ')}</span>;
  };

  const kpis = [
    { label: 'Total Orders', value: stats?.totalOrders ?? 0, desc: 'Marketplace orders', color: 'text-slate-900', bg: 'bg-slate-50' },
    { label: 'Total Shipments', value: stats?.totalShipments ?? 0, desc: 'All forward/reverse', color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Pending Shipments', value: stats?.pendingShipments ?? 0, desc: 'Draft / Created', color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Ready for Pickup', value: stats?.readyForPickup ?? 0, desc: 'AWB & pickup scheduled', color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Picked Up', value: stats?.pickedUp ?? 0, desc: 'With courier partner', color: 'text-cyan-600', bg: 'bg-cyan-50' },
    { label: 'In Transit', value: stats?.inTransit ?? 0, desc: 'En route to customer', color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Delivered', value: stats?.delivered ?? 0, desc: 'Successfully fulfilled', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Delayed Shipments', value: stats?.delayedShipments ?? 0, desc: 'Past estimated date', color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Cancelled Shipments', value: stats?.cancelledShipments ?? 0, desc: 'Cancelled orders', color: 'text-rose-600', bg: 'bg-rose-50' },
    { label: 'Return Requests', value: stats?.returnRequests ?? 0, desc: 'Total submitted', color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Approved Returns', value: stats?.approvedReturns ?? 0, desc: 'Pickup authorized', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Rejected Returns', value: stats?.rejectedReturns ?? 0, desc: 'Denied with reason', color: 'text-slate-600', bg: 'bg-slate-50' },
    { label: 'Pending Refunds', value: stats?.pendingRefunds ?? 0, desc: 'Awaiting completion', color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Completed Refunds', value: stats?.completedRefunds ?? 0, desc: 'Settled to account', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Failed Refunds', value: stats?.failedRefunds ?? 0, desc: 'Retry required', color: 'text-rose-600', bg: 'bg-rose-50' },
    { label: 'RTO Shipments', value: stats?.rtoShipments ?? 0, desc: 'Returned to origin', color: 'text-rose-600', bg: 'bg-rose-50' },
  ];

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
              <Truck className="w-5 h-5" />
            </div>
            <span>Logistics & Shiprocket Hub</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Platform-wide multi-vendor shipping orchestration, AWB assignment, carrier tracking & manifests
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedShipmentIds.length > 0 && (
            <button
              onClick={handleGenerateManifest}
              disabled={actionLoadingId === 'manifest'}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-colors"
            >
              {actionLoadingId === 'manifest' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
              <span>Generate Manifest ({selectedShipmentIds.length})</span>
            </button>
          )}
          <button
            onClick={handleCheckConnection}
            disabled={checkingConnection}
            className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 shadow-xs text-xs font-bold transition-colors flex items-center gap-1.5"
            title="Check Shiprocket API Health"
          >
            {checkingConnection ? <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" /> : <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />}
            <span>Test API</span>
          </button>
          <button
            onClick={() => {
              fetchStats();
              if (['all', 'pending', 'in_transit', 'delivered', 'cancelled'].includes(activeTab)) {
                fetchShipments();
              } else if (['returns', 'refunds'].includes(activeTab)) {
                fetchReturns();
              } else {
                fetchExceptions();
              }
            }}
            className="p-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 shadow-xs text-xs font-bold transition-colors"
            title="Refresh Logistics Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Connection Status Banner */}
      {connectionStatus && (
        <div className={`p-4 rounded-2xl border text-xs flex items-center justify-between ${
          connectionStatus.connected
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          <div className="flex items-center gap-2">
            {connectionStatus.connected ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
            <div>
              <span className="font-bold">
                Shiprocket API Status: {connectionStatus.connected ? 'Connected & Verified' : 'Connection Failed'}
              </span>
              <p className="mt-0.5 text-[11px] opacity-90">
                {connectionStatus.connected
                  ? `Authenticated successfully with Shiprocket API v2. Registered pickup locations: ${connectionStatus.registeredPickupLocationsCount}`
                  : `Error: ${connectionStatus.error || 'Could not verify API credentials. Please check SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD in server/.env'}`}
              </p>
            </div>
          </div>
          <button onClick={() => setConnectionStatus(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
        </div>
      )}

      {/* 16 KPI Metric Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-500" />
            <span>Platform Logistics & Financial Health (16 Metrics)</span>
          </h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {kpis.map((kpi, idx) => (
            <div key={idx} className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate" title={kpi.label}>
                {kpi.label}
              </span>
              <p className={`text-xl font-black mt-1 ${kpi.color}`}>
                {kpi.value}
              </p>
              <span className="text-[10px] text-slate-400 mt-0.5 block truncate" title={kpi.desc}>
                {kpi.desc}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-emerald-800 text-sm">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-500 hover:text-emerald-700">✕</button>
        </div>
      )}
      {actionError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-rose-800 text-sm">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-500 hover:text-rose-700">✕</button>
        </div>
      )}

      {/* 8 Dedicated Management Tabs */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-1.5 overflow-x-auto w-full pb-2 md:pb-0 scrollbar-none">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 shrink-0 ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Global Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-50/70 p-3 rounded-2xl border border-slate-100">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by AWB, Order Number, Vendor, Customer..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {activeTab === 'all' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 w-full sm:w-auto"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="CREATED">Created</option>
              <option value="AWB_ASSIGNED">AWB Assigned</option>
              <option value="PICKUP_SCHEDULED">Pickup Scheduled</option>
              <option value="PICKED_UP">Picked Up</option>
              <option value="IN_TRANSIT">In Transit</option>
              <option value="OUT_FOR_DELIVERY">Out For Delivery</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          )}

          <button
            onClick={() => {
              if (['all', 'pending', 'in_transit', 'delivered', 'cancelled'].includes(activeTab)) {
                fetchShipments();
              } else if (['returns', 'refunds'].includes(activeTab)) {
                fetchReturns();
              } else {
                fetchExceptions();
              }
            }}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition w-full sm:w-auto shrink-0"
          >
            Apply Filters
          </button>
        </div>

        {/* Tab Content: Shipments (all, pending, in_transit, delivered, cancelled) */}
        {['all', 'pending', 'in_transit', 'delivered', 'cancelled'].includes(activeTab) && (
          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                <p className="text-xs font-bold">Loading platform logistics...</p>
              </div>
            ) : shipments.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-xs font-bold">
                No shipments found matching criteria in this category
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-2">
                      <input
                        type="checkbox"
                        checked={selectedShipmentIds.length === shipments.length && shipments.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedShipmentIds(shipments.map((s) => s._id));
                          } else {
                            setSelectedShipmentIds([]);
                          }
                        }}
                        className="rounded text-indigo-600"
                      />
                    </th>
                    <th className="py-3 px-3">Shipment / Order</th>
                    <th className="py-3 px-3">Vendor</th>
                    <th className="py-3 px-3">Destination</th>
                    <th className="py-3 px-3">Carrier & AWB</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shipments.map((s) => (
                    <tr key={s._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-2">
                        <input
                          type="checkbox"
                          checked={selectedShipmentIds.includes(s._id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedShipmentIds([...selectedShipmentIds, s._id]);
                            } else {
                              setSelectedShipmentIds(selectedShipmentIds.filter((id) => id !== s._id));
                            }
                          }}
                          className="rounded text-indigo-600"
                        />
                      </td>
                      <td className="py-3.5 px-3">
                        <p className="font-mono font-bold text-slate-900">
                          #{s.shipmentIdNumber || s._id.slice(-8).toUpperCase()}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Order #{s.parentOrderId?.orderNumber || s.suborderId?.subOrderNumber || '—'}
                        </p>
                      </td>
                      <td className="py-3.5 px-3">
                        <p className="font-bold text-slate-800">{s.vendorId?.storeName || s.originAddressSnapshot?.businessName || 'Vendor'}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{s.originAddressSnapshot?.phone || s.vendorId?.email}</p>
                      </td>
                      <td className="py-3.5 px-3">
                        <p className="font-medium text-slate-800">{s.destinationAddressSnapshot?.name || s.destinationAddressSnapshot?.contactName || 'Customer'}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {s.destinationAddressSnapshot?.city || s.destinationAddressSnapshot?.district}, PIN {s.destinationAddressSnapshot?.postalCode || s.destinationAddressSnapshot?.pincode}
                        </p>
                      </td>
                      <td className="py-3.5 px-3">
                        <p className="font-bold text-slate-800">{s.courierName || s.courierProvider || 'Auto Assigned'}</p>
                        <p className="font-mono font-semibold text-indigo-600 text-[11px] mt-0.5">
                          {s.awbNumber || 'No AWB yet'}
                        </p>
                      </td>
                      <td className="py-3.5 px-3">{getStatusBadge(s.status)}</td>
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedTrackingId(s._id)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-indigo-600 transition"
                            title="Live Track"
                          >
                            <Truck className="w-4 h-4" />
                          </button>
                          {['DRAFT', 'FAILED'].includes(s.status) && (
                            <button
                              onClick={() => handleRetryShipment(s._id)}
                              className="px-2 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-[11px] font-bold transition"
                            >
                              Retry
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab Content: Return Requests */}
        {activeTab === 'returns' && (
          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                <p className="text-xs font-bold">Loading return requests...</p>
              </div>
            ) : returns.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-xs font-bold">
                No return or cancellation requests found
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-3">Order / Req ID</th>
                    <th className="py-3 px-3">Type & Reason</th>
                    <th className="py-3 px-3">Amount</th>
                    <th className="py-3 px-3">Pickup & Courier</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Admin Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {returns.map((r) => (
                    <tr key={r._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-3">
                        <p className="font-mono font-bold text-slate-900">#{r.orderNumber}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">ID: {r._id.slice(-8).toUpperCase()}</p>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="font-bold text-slate-800">{r.requestType}</span>
                        <p className="text-[11px] text-slate-500 mt-0.5">{r.reason}</p>
                      </td>
                      <td className="py-3.5 px-3">
                        <p className="font-bold text-slate-900">₹{(r.refundDetails?.refundableAmount || r.refundAmount || 0).toLocaleString('en-IN')}</p>
                        <span className="text-[10px] text-slate-400 block">{r.refundDetails?.refundMethod || 'GATEWAY'}</span>
                      </td>
                      <td className="py-3.5 px-3">
                        <p className="font-medium text-slate-700">{r.pickupDetails?.courierPartner || 'Not Assigned'}</p>
                        <p className="font-mono text-indigo-600 text-[11px]">{r.pickupDetails?.awbNumber || 'No Reverse AWB'}</p>
                      </td>
                      <td className="py-3.5 px-3">{getStatusBadge(r.status)}</td>
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {['REQUESTED', 'REQUEST_SUBMITTED', 'UNDER_REVIEW', 'VENDOR_REJECTED'].includes(r.status) && (
                            <>
                              <button
                                onClick={() => handleAdminOverride(r._id, 'APPROVE')}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[11px] font-bold transition"
                                title="Approve Return Request"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleAdminOverride(r._id, 'REJECT')}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[11px] font-bold transition"
                                title="Reject Return Request"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {['APPROVED', 'ITEM_RECEIVED'].includes(r.status) && (
                            <button
                              onClick={() => handleProcessRefund(r._id)}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[11px] font-bold transition"
                              title="Process Refund"
                            >
                              Process Refund
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab Content: Refund Management */}
        {activeTab === 'refunds' && (
          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                <p className="text-xs font-bold">Loading refund ledgers...</p>
              </div>
            ) : returns.filter(r => r.refundDetails?.refundStatus || r.refundDetails?.refundableAmount).length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-xs font-bold">
                No active refund records found
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-3">Order Number</th>
                    <th className="py-3 px-3">Refund Amount</th>
                    <th className="py-3 px-3">Gateway Ref ID</th>
                    <th className="py-3 px-3">Payment Method</th>
                    <th className="py-3 px-3">Refund Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {returns
                    .filter(r => r.refundDetails?.refundStatus || r.refundDetails?.refundableAmount)
                    .map((r) => (
                      <tr key={r._id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-3">
                          <p className="font-mono font-bold text-slate-900">#{r.orderNumber}</p>
                          <p className="text-[11px] text-slate-400">{r.requestType}</p>
                        </td>
                        <td className="py-3.5 px-3">
                          <p className="font-black text-slate-900 text-sm">₹{(r.refundDetails?.refundAmount || r.refundDetails?.refundableAmount || 0).toLocaleString('en-IN')}</p>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="font-mono text-slate-600 text-[11px]">{r.refundDetails?.gatewayRefundId || '—'}</span>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="font-bold text-slate-700">{r.refundDetails?.paymentMethod || 'RAZORPAY'}</span>
                        </td>
                        <td className="py-3.5 px-3">{getStatusBadge(r.refundDetails?.refundStatus || 'PENDING')}</td>
                        <td className="py-3.5 px-3 text-right">
                          {r.refundDetails?.refundStatus !== 'COMPLETED' && (
                            <button
                              onClick={() => handleProcessRefund(r._id)}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[11px] font-bold transition"
                            >
                              Retry Refund
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab Content: Shiprocket API Logs */}
        {activeTab === 'exceptions' && (
          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin text-rose-600" />
                <p className="text-xs font-bold">Loading exception logs...</p>
              </div>
            ) : exceptions.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-xs font-bold">
                No active shipping exceptions recorded
              </div>
            ) : (
              <div className="space-y-3">
                {exceptions.map((exc) => (
                  <div
                    key={exc._id}
                    className="p-4 bg-rose-50/50 border border-rose-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-rose-900 uppercase">
                          {exc.errorCode || exc.exceptionType || 'SHIPROCKET_API_ERROR'}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(exc.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-slate-700 mt-1 font-medium">{exc.errorMessage || exc.message}</p>
                      {exc.requestReference && (
                        <p className="text-slate-400 text-[11px] font-mono mt-0.5">
                          Ref: {exc.requestReference}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Live Tracking Modal */}
      {selectedTrackingId && (
        <ShipmentTrackingModal
          shipmentId={selectedTrackingId}
          onClose={() => setSelectedTrackingId(null)}
        />
      )}
    </motion.div>
  );
};

export default SuperAdminShipping;
