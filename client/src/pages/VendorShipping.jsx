import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Truck, Package, Search, Filter, RefreshCw, Calendar, MapPin,
  ExternalLink, Download, Clock, AlertCircle, CheckCircle2, ChevronRight,
  Loader2, XCircle, FileText, Plus, ShieldCheck, DollarSign, Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ShipmentTrackingModal from '../components/shipping/ShipmentTrackingModal';

export const VendorShipping = () => {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchAwb, setSearchAwb] = useState('');
  const [selectedTrackingId, setSelectedTrackingId] = useState(null);

  // Courier selection modal state
  const [courierModalShipment, setCourierModalShipment] = useState(null);
  const [availableCouriers, setAvailableCouriers] = useState([]);
  const [loadingCouriers, setLoadingCouriers] = useState(false);
  const [courierFetchError, setCourierFetchError] = useState(null);

  // Pickup Address Modal state
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [pickupAddresses, setPickupAddresses] = useState([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [addressSubmitting, setAddressSubmitting] = useState(false);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [newAddress, setNewAddress] = useState({
    contactName: '',
    businessName: '',
    phone: '',
    email: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    stateName: '',
    pincode: '',
    isDefault: true,
  });

  // Action states
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    fetchShipments();
  }, [statusFilter]);

  const fetchShipments = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (searchAwb) params.awbNumber = searchAwb;

      const res = await api.get('/shipping/vendor/shipments', { params });
      if (res.data?.success) {
        setShipments(res.data.data.shipments || []);
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to fetch vendor shipments');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchShipments();
  };

  // Open courier selection modal for a shipment
  const openCourierModal = async (shipment) => {
    setCourierModalShipment(shipment);
    setLoadingCouriers(true);
    setCourierFetchError(null);
    setAvailableCouriers([]);

    try {
      const res = await api.get(`/shipping/vendor/shipments/${shipment._id}/couriers`);
      if (res.data?.success) {
        setAvailableCouriers(res.data.data?.availableCouriers || []);
      }
    } catch (err) {
      setCourierFetchError(err.response?.data?.message || 'Failed to retrieve live couriers for this route');
    } finally {
      setLoadingCouriers(false);
    }
  };

  // Assign AWB with optional specific courier ID
  const handleAssignAWB = async (shipmentId, courierCompanyId = null) => {
    try {
      setActionLoadingId(shipmentId);
      setActionError(null);
      setCourierModalShipment(null);

      const payload = {};
      if (courierCompanyId) payload.courierCompanyId = courierCompanyId;

      const res = await api.post(`/shipping/vendor/shipments/${shipmentId}/awb`, payload);
      const awb = res.data?.data?.shipment?.awbNumber || 'Assigned';
      const courierName = res.data?.data?.shipment?.courierName || 'Shiprocket Partner';
      setActionSuccess(`AWB generated successfully! Courier: ${courierName}, AWB: ${awb}`);
      await fetchShipments();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to assign AWB');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSchedulePickup = async (shipmentId) => {
    try {
      setActionLoadingId(shipmentId);
      setActionError(null);
      await api.post(`/shipping/vendor/shipments/${shipmentId}/pickup`, {});
      setActionSuccess('Courier pickup requested successfully from your registered address!');
      await fetchShipments();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to schedule pickup');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDownloadLabel = async (shipmentId) => {
    try {
      setActionLoadingId(shipmentId);
      const res = await api.get(`/shipping/vendor/shipments/${shipmentId}/label`);
      const labelUrl = res.data?.data?.labelUrl;
      if (labelUrl) {
        window.open(labelUrl, '_blank');
      } else {
        alert('Shipping label is being compiled by Shiprocket. Please try again in a few moments.');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to generate shipping label');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelShipment = async (shipmentId) => {
    if (!window.confirm('Are you sure you want to cancel this courier shipment?')) return;
    try {
      setActionLoadingId(shipmentId);
      await api.post(`/shipping/vendor/shipments/${shipmentId}/cancel`, {
        reason: 'Vendor cancelled shipment'
      });
      setActionSuccess('Shipment cancelled successfully');
      await fetchShipments();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to cancel shipment');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Fetch Pickup Addresses
  const fetchPickupAddresses = async () => {
    try {
      setLoadingAddresses(true);
      const res = await api.get('/shipping/vendor/addresses');
      if (res.data?.success) {
        setPickupAddresses(res.data.data.addresses || []);
      }
    } catch (err) {
      console.warn('Error fetching pickup addresses:', err);
    } finally {
      setLoadingAddresses(false);
    }
  };

  const openAddressModal = () => {
    setShowAddressModal(true);
    fetchPickupAddresses();
  };

  const handleRegisterAddressWithShiprocket = async (addressId) => {
    try {
      setAddressSubmitting(true);
      await api.post(`/shipping/vendor/addresses/${addressId}/register`);
      setActionSuccess('Pickup location successfully registered and verified with Shiprocket!');
      await fetchPickupAddresses();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to register with Shiprocket');
    } finally {
      setAddressSubmitting(false);
    }
  };

  const handleCreateAddress = async (e) => {
    e.preventDefault();
    if (!newAddress.contactName || !newAddress.businessName || !newAddress.phone || !newAddress.addressLine1 || !newAddress.pincode) {
      alert('Please fill in all required address fields.');
      return;
    }
    try {
      setAddressSubmitting(true);
      await api.post('/shipping/vendor/addresses', newAddress);
      setShowNewAddressForm(false);
      setNewAddress({
        contactName: '',
        businessName: '',
        phone: '',
        email: '',
        addressLine1: '',
        addressLine2: '',
        city: '',
        stateName: '',
        pincode: '',
        isDefault: true,
      });
      await fetchPickupAddresses();
      setActionSuccess('Pickup address created and submitted to Shiprocket!');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create pickup address');
    } finally {
      setAddressSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    const s = status || 'PENDING';
    if (s === 'DELIVERED') {
      return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200">DELIVERED</span>;
    }
    if (['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'PICKED_UP'].includes(s)) {
      return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-blue-50 text-blue-700 border border-blue-200">{s.replace(/_/g, ' ')}</span>;
    }
    if (s === 'AWB_ASSIGNED' || s === 'MANIFEST_GENERATED') {
      return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200">{s.replace(/_/g, ' ')}</span>;
    }
    if (['CANCELLED', 'RTO_INITIATED', 'RTO_DELIVERED'].includes(s)) {
      return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-700 border border-rose-200">{s.replace(/_/g, ' ')}</span>;
    }
    return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-700 border border-amber-200">{s.replace(/_/g, ' ')}</span>;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Truck className="w-5 h-5" />
            </div>
            <span>Shipping & Logistics</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Official Shiprocket carrier integration for automated dispatch, label printing, and real-time tracking
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={openAddressModal}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-2xl border border-slate-200 shadow-xs transition-colors flex items-center gap-2 text-xs font-bold"
          >
            <MapPin className="w-4 h-4 text-indigo-600" />
            <span>Pickup Address</span>
          </button>
          <button
            onClick={() => fetchShipments()}
            className="p-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-2xl border border-slate-200 shadow-xs transition-colors flex items-center gap-2 text-xs font-bold"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
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

      {/* Search & Tabs */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap gap-1.5 w-full md:w-auto">
            {[
              { label: 'All Shipments', value: '' },
              { label: 'Pending / Ready', value: 'READY_TO_SHIP' },
              { label: 'In Transit', value: 'IN_TRANSIT' },
              { label: 'Delivered', value: 'DELIVERED' },
              { label: 'Returns & RTO', value: 'RTO_INITIATED' },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === tab.value
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-72">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchAwb}
                onChange={(e) => setSearchAwb(e.target.value)}
                placeholder="Search AWB / Order #..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
            <button
              type="submit"
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      {/* Shipment List */}
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center gap-3 bg-white border border-slate-200/80 rounded-3xl shadow-xs">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-slate-500 text-xs font-bold">Connecting with Shiprocket servers...</p>
        </div>
      ) : shipments.length === 0 ? (
        <div className="p-16 text-center bg-white border border-slate-200/80 rounded-3xl shadow-xs space-y-3">
          <Package className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-black text-slate-800">No shipments found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Once orders are confirmed and marked ready to ship, shipments will appear here for courier assignment.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {shipments.map((shipment) => (
            <div
              key={shipment._id}
              className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs hover:border-indigo-100 transition-all space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900">
                        Shipment #{shipment.shiprocketShipmentId || shipment.courierOrderId || shipment._id.slice(-8).toUpperCase()}
                      </span>
                      {getStatusBadge(shipment.status)}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Order #{shipment.parentOrderId?.orderNumber || shipment.suborderId?.subOrderNumber || '—'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedTrackingId(shipment._id)}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Truck className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Track Live</span>
                  </button>
                  {shipment.labelUrl && (
                    <button
                      onClick={() => handleDownloadLabel(shipment._id)}
                      className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Print Label</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Detail Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider block">Courier & AWB</span>
                  <div className="mt-1">
                    <p className="font-bold text-slate-900">{shipment.courierName || (shipment.courierCompanyId ? `Courier #${shipment.courierCompanyId}` : 'Delhivery / Blue Dart')}</p>
                    <p className="font-mono font-semibold text-indigo-600 mt-0.5">{shipment.awbNumber || 'No AWB yet'}</p>
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider block">Delivery Destination</span>
                  <div className="mt-1">
                    <p className="font-bold text-slate-900">{shipment.destinationAddressSnapshot?.name || 'Customer'}</p>
                    <p className="text-slate-500 mt-0.5">
                      {[
                        shipment.destinationAddressSnapshot?.city,
                        shipment.destinationAddressSnapshot?.postalCode ? `PIN ${shipment.destinationAddressSnapshot?.postalCode}` : null,
                      ].filter(Boolean).join(', ') || 'Address on file'}
                    </p>
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider block">Package Info</span>
                  <div className="mt-1">
                    <p className="font-bold text-slate-900">{shipment.packageWeight || 0.5} kg</p>
                    <p className="text-slate-500 mt-0.5">
                      {shipment.length || 10}x{shipment.width || 10}x{shipment.height || 10} cm
                    </p>
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider block">Pickup Origin</span>
                  <div className="mt-1">
                    <p className="font-bold text-slate-900">{shipment.pickupLocationName || 'Vendor Warehouse'}</p>
                    <p className="text-slate-500 mt-0.5">PIN: {shipment.originAddressSnapshot?.pincode || 'Registered'}</p>
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {!shipment.awbNumber && ['CREATED', 'DRAFT', 'READY'].includes(shipment.status) && (
                    <button
                      onClick={() => openCourierModal(shipment)}
                      disabled={actionLoadingId === shipment._id}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                      {actionLoadingId === shipment._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Truck className="w-3.5 h-3.5" />}
                      <span>Choose Courier & Assign AWB</span>
                    </button>
                  )}

                  {shipment.awbNumber && ['CREATED', 'AWB_ASSIGNED'].includes(shipment.status) && (
                    <button
                      onClick={() => handleSchedulePickup(shipment._id)}
                      disabled={actionLoadingId === shipment._id}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                      {actionLoadingId === shipment._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
                      <span>Schedule Courier Pickup</span>
                    </button>
                  )}

                  {shipment.status === 'PICKUP_SCHEDULED' && (
                    <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold inline-flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Pickup Scheduled — Ready for Handover
                    </span>
                  )}
                </div>

                {!['DELIVERED', 'CANCELLED', 'PICKED_UP', 'IN_TRANSIT'].includes(shipment.status) && (
                  <button
                    onClick={() => handleCancelShipment(shipment._id)}
                    disabled={actionLoadingId === shipment._id}
                    className="text-xs text-rose-600 hover:text-rose-800 font-bold transition-colors"
                  >
                    Cancel Shipment
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Courier Selection Modal */}
      {courierModalShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Select Shiprocket Courier Partner</h3>
                  <p className="text-xs text-slate-500">Compare rates, delivery speeds, and tracking ratings</p>
                </div>
              </div>
              <button
                onClick={() => setCourierModalShipment(null)}
                className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {loadingCouriers ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
                  <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
                  <p className="text-xs font-bold">Querying Shiprocket for available couriers on this route...</p>
                </div>
              ) : courierFetchError ? (
                <div className="space-y-4">
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs">
                    <p className="font-bold">Live rate query notice:</p>
                    <p className="mt-1">{courierFetchError}</p>
                  </div>
                  <button
                    onClick={() => handleAssignAWB(courierModalShipment._id, null)}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                  >
                    Auto-assign Primary Shiprocket Courier
                  </button>
                </div>
              ) : availableCouriers.length === 0 ? (
                <div className="text-center py-8 space-y-3">
                  <p className="text-xs text-slate-500">No specific couriers returned. You can auto-assign the best available courier.</p>
                  <button
                    onClick={() => handleAssignAWB(courierModalShipment._id, null)}
                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold"
                  >
                    Auto-assign Courier
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
                    <span>{availableCouriers.length} couriers serviceable</span>
                    <button
                      onClick={() => handleAssignAWB(courierModalShipment._id, null)}
                      className="text-indigo-600 hover:underline font-bold"
                    >
                      Auto-assign Best Courier
                    </button>
                  </div>

                  {availableCouriers.map((c) => (
                    <div
                      key={c.id}
                      className="p-4 rounded-2xl border border-slate-200 hover:border-indigo-400 hover:shadow-xs transition-all flex items-center justify-between gap-4"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-slate-900">{c.name}</h4>
                          {c.isAir && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-50 text-sky-700 border border-sky-200">
                              Air Express
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-500">
                          <span className="flex items-center gap-1 font-semibold text-slate-700">
                            <Clock className="w-3.5 h-3.5 text-indigo-600" />
                            {c.estimatedDelivery || '2-4 Days'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                            {c.rating ? `${c.rating}/5` : '4.2/5'}
                          </span>
                          {c.cod && (
                            <span className="text-[11px] text-emerald-600 font-bold">COD Available</span>
                          )}
                        </div>
                      </div>

                      <div className="text-right flex flex-col items-end gap-2">
                        <span className="text-sm font-black text-slate-900">₹{c.rate}</span>
                        <button
                          onClick={() => handleAssignAWB(courierModalShipment._id, c.id)}
                          disabled={actionLoadingId === courierModalShipment._id}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors"
                        >
                          Select
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pickup Address Management Modal */}
      {showAddressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Shiprocket Pickup Locations</h3>
                  <p className="text-xs text-slate-500">Manage warehouse addresses where couriers pick up orders</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddressModal(false)}
                className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {!showNewAddressForm ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Configured Addresses ({pickupAddresses.length})</span>
                    <button
                      onClick={() => setShowNewAddressForm(true)}
                      className="px-3.5 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add New Address</span>
                    </button>
                  </div>

                  {loadingAddresses ? (
                    <div className="py-8 flex justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                    </div>
                  ) : pickupAddresses.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-500">
                      No pickup address configured yet. Please add your warehouse or shop address.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pickupAddresses.map((addr) => (
                        <div
                          key={addr._id}
                          className="p-4 rounded-2xl border border-slate-200 space-y-2 bg-slate-50/50"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-sm text-slate-900">{addr.businessName || addr.contactName}</h4>
                              {addr.isDefault && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-700">
                                  Default
                                </span>
                              )}
                            </div>
                            {addr.shiprocketRegistrationStatus === 'REGISTERED' ? (
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Verified Shiprocket
                              </span>
                            ) : (
                              <button
                                onClick={() => handleRegisterAddressWithShiprocket(addr._id)}
                                disabled={addressSubmitting}
                                className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold"
                              >
                                {addressSubmitting ? 'Registering...' : 'Register in Shiprocket'}
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-slate-600">{addr.addressLine1} {addr.addressLine2}</p>
                          <p className="text-xs font-medium text-slate-700">
                            {addr.cityName || addr.city || ''}, {addr.stateName || ''} - PIN {addr.pincode}
                          </p>
                          <p className="text-[11px] text-slate-500">Contact: {addr.contactName} ({addr.phone})</p>
                          {addr.shiprocketPickupName && (
                            <p className="text-[11px] font-mono text-indigo-600">Shiprocket Location Code: {addr.shiprocketPickupName}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <form onSubmit={handleCreateAddress} className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h4 className="font-bold text-sm text-slate-900">Add New Pickup Location</h4>
                    <button
                      type="button"
                      onClick={() => setShowNewAddressForm(false)}
                      className="text-xs text-slate-500 hover:underline"
                    >
                      Back to list
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Contact Person Name *"
                      required
                      value={newAddress.contactName}
                      onChange={(e) => setNewAddress({ ...newAddress, contactName: e.target.value })}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                    />
                    <input
                      type="text"
                      placeholder="Business / Facility Name *"
                      required
                      value={newAddress.businessName}
                      onChange={(e) => setNewAddress({ ...newAddress, businessName: e.target.value })}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="tel"
                      placeholder="Phone (10 digits) *"
                      required
                      value={newAddress.phone}
                      onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      value={newAddress.email}
                      onChange={(e) => setNewAddress({ ...newAddress, email: e.target.value })}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                    />
                  </div>

                  <input
                    type="text"
                    placeholder="Address Line 1 (Building, Street) *"
                    required
                    value={newAddress.addressLine1}
                    onChange={(e) => setNewAddress({ ...newAddress, addressLine1: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                  />

                  <div className="grid grid-cols-3 gap-3">
                    <input
                      type="text"
                      placeholder="City *"
                      required
                      value={newAddress.city}
                      onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                    />
                    <input
                      type="text"
                      placeholder="State *"
                      required
                      value={newAddress.stateName}
                      onChange={(e) => setNewAddress({ ...newAddress, stateName: e.target.value })}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                    />
                    <input
                      type="text"
                      placeholder="6-digit PIN Code *"
                      required
                      value={newAddress.pincode}
                      onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value })}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowNewAddressForm(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={addressSubmitting}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold"
                    >
                      {addressSubmitting ? 'Saving...' : 'Save & Register'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

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

export default VendorShipping;
