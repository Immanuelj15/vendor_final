import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, MapPin, Truck, CheckCircle, Clock, FileText, AlertCircle, Loader2, Download, ExternalLink, RefreshCw } from 'lucide-react';
import ShipmentTrackingModal from '../components/shipping/ShipmentTrackingModal';
import { motion } from 'framer-motion';
import api from '../services/api';

export const VendorOrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [shipment, setShipment] = useState(null);
  const [showTracking, setShowTracking] = useState(false);
  const [shippingActionLoading, setShippingActionLoading] = useState(false);

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const fetchOrder = async () => {
    try {
      const [orderRes, shipRes] = await Promise.all([
        api.get(`/vendor/orders/${id}`),
        api.get(`/shipping/vendor/shipments?suborderId=${id}`).catch(() => ({ data: { data: { shipments: [] } } }))
      ]);
      setOrder(orderRes.data?.data?.order);
      const foundShipments = shipRes.data?.data?.shipments || [];
      if (foundShipments.length > 0) {
        setShipment(foundShipments[0]);
      }
    } catch (err) {
      console.error('Failed to fetch order detail', err);
    } finally {
      setIsLoading(false);
    }
  };

  const updateStatus = async (action) => {
    setIsProcessing(true);
    try {
      await api.post(`/vendor/orders/${id}/${action}`);
      fetchOrder();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAssignAWB = async () => {
    if (!shipment?._id) return;
    try {
      setShippingActionLoading(true);
      await api.post(`/shipping/vendor/shipments/${shipment._id}/awb`, {});
      await fetchOrder();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to assign AWB');
    } finally {
      setShippingActionLoading(false);
    }
  };

  const handleSchedulePickup = async () => {
    if (!shipment?._id) return;
    try {
      setShippingActionLoading(true);
      await api.post(`/shipping/vendor/shipments/${shipment._id}/pickup`, {});
      alert('Pickup scheduled successfully with Delhivery!');
      await fetchOrder();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to schedule pickup');
    } finally {
      setShippingActionLoading(false);
    }
  };

  const handleCreateShipment = async () => {
    try {
      setShippingActionLoading(true);
      await api.post('/shipping/vendor/shipments', { suborderId: id });
      await fetchOrder();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create shipment');
    } finally {
      setShippingActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-16 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
        <p className="text-slate-500 text-sm font-medium">Loading order fulfillment details...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-16 text-center text-slate-600 font-medium">
        Order not found or you don't have permission to view it.
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Back & Title Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/vendor/orders')}
          className="p-3 bg-white hover:bg-slate-50 text-slate-700 rounded-2xl border border-slate-200/80 shadow-xs transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Order #{order.subOrderNumber}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Placed on {new Date(order.createdAt).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Order details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-7 shadow-xs">
            <h2 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              <span>Items to Fulfill</span>
            </h2>
            <div className="space-y-3.5">
              {order.items?.map((item, index) => (
                <div
                  key={index}
                  className="flex gap-4 p-4 bg-slate-50/70 border border-slate-100 rounded-2xl items-center"
                >
                  <div className="w-16 h-16 bg-white border border-slate-200 rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
                    {item.productImage ? (
                      <img src={item.productImage} alt={item.productName} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-8 h-8 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 truncate">{item.productName}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Quantity: {item.quantity}</p>
                    <p className="text-sm font-bold text-blue-600 mt-0.5">₹{item.price}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Subtotal</p>
                    <p className="text-base font-black text-slate-900">₹{item.price * item.quantity}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-7 shadow-xs">
            <h2 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <span>Order Lifecycle Status</span>
            </h2>
            <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Current Phase: {order.status}</h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  Update status as you prepare items and package the delivery parcel.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Actions & Info */}
        <div className="space-y-6">
          {/* Fulfillment Action Box */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-4">
            <h2 className="text-lg font-black text-slate-900">Fulfillment Action</h2>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status:</span>
              <span className="px-3 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                {order.status}
              </span>
            </div>

            <div className="space-y-3 pt-1">
              {order.status === 'PENDING' && (
                <button
                  onClick={() => updateStatus('accept')}
                  disabled={isProcessing}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-sm shadow-md shadow-blue-500/20 transition-all flex justify-center items-center gap-2"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  <span>Accept Order</span>
                </button>
              )}
              {order.status === 'CONFIRMED' && (
                <button
                  onClick={() => updateStatus('process')}
                  disabled={isProcessing}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-sm shadow-md shadow-blue-500/20 transition-all flex justify-center items-center gap-2"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                  <span>Start Processing</span>
                </button>
              )}
              {order.status === 'PROCESSING' && (
                <button
                  onClick={() => updateStatus('pack')}
                  disabled={isProcessing}
                  className="w-full py-3.5 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-bold text-sm shadow-md shadow-purple-500/20 transition-all flex justify-center items-center gap-2"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                  <span>Mark as Packed</span>
                </button>
              )}
              {order.status === 'PACKED' && (
                <button
                  onClick={() => updateStatus('ready-to-ship')}
                  disabled={isProcessing}
                  className="w-full py-3.5 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl font-bold text-sm shadow-md shadow-orange-500/20 transition-all flex justify-center items-center gap-2"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                  <span>Request Courier Pickup</span>
                </button>
              )}
              {['READY_TO_SHIP', 'PICKUP_SCHEDULED'].includes(order.status) && (
                <div className="space-y-3">
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
                    <CheckCircle className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                    <p className="text-xs font-bold text-emerald-800">Ready for Carrier Handover</p>
                    <p className="text-[11px] text-emerald-600 mt-0.5">Pickup scheduled. Hand over parcel upon courier arrival.</p>
                  </div>
                  <button
                    onClick={() => updateStatus('ship')}
                    disabled={isProcessing}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs shadow-md shadow-blue-500/20 transition-all flex justify-center items-center gap-2"
                  >
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                    <span>Handover to Courier (Mark In Transit)</span>
                  </button>
                </div>
              )}
              {['SHIPPED', 'IN_TRANSIT'].includes(order.status) && (
                <div className="space-y-3">
                  <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl text-center">
                    <Truck className="w-5 h-5 text-blue-600 mx-auto mb-1 animate-pulse" />
                    <p className="text-xs font-bold text-blue-800">Parcel In Transit</p>
                    <p className="text-[11px] text-blue-600 mt-0.5">Courier partner is delivering the package to customer.</p>
                  </div>
                  <button
                    onClick={() => updateStatus('deliver')}
                    disabled={isProcessing}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs shadow-md shadow-emerald-500/20 transition-all flex justify-center items-center gap-2"
                  >
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    <span>Mark as Delivered</span>
                  </button>
                </div>
              )}
              {order.status === 'DELIVERED' && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
                  <CheckCircle className="w-6 h-6 text-emerald-600 mx-auto mb-1.5" />
                  <p className="text-sm font-bold text-emerald-800">Delivered to Customer</p>
                  <p className="text-xs text-emerald-600 mt-0.5">Order fulfillment completed successfully.</p>
                </div>
              )}
            </div>
          </div>

          {/* Delhivery Logistics Card */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Truck className="w-4 h-4 text-indigo-600" />
                <span>Delhivery Logistics</span>
              </h2>
              {shipment && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {shipment.status?.replace(/_/g, ' ') || 'PREPARING'}
                </span>
              )}
            </div>

            {shipment ? (
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider block">Courier & AWB</span>
                  <p className="font-bold text-slate-900 mt-0.5">{shipment.courierName || shipment.courierPartnerName || (shipment.courierCompanyId ? `Courier #${shipment.courierCompanyId}` : 'Delhivery Surface')}</p>
                  <p className="font-mono text-indigo-600 font-semibold">{shipment.awbNumber || 'No AWB assigned yet'}</p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                  {!shipment.awbNumber && (
                    <button
                      onClick={handleAssignAWB}
                      disabled={shippingActionLoading}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition"
                    >
                      {shippingActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Truck className="w-3.5 h-3.5" />}
                      <span>Assign Courier & AWB</span>
                    </button>
                  )}

                  {shipment.awbNumber && ['CREATED', 'AWB_ASSIGNED'].includes(shipment.status) && (
                    <button
                      onClick={handleSchedulePickup}
                      disabled={shippingActionLoading}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition"
                    >
                      {shippingActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
                      <span>Schedule Carrier Pickup</span>
                    </button>
                  )}

                  {shipment.status === 'PICKUP_SCHEDULED' && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                      <p className="text-xs font-bold text-emerald-800 flex items-center justify-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        Pickup Scheduled with Courier
                      </p>
                      <p className="text-[11px] text-emerald-600 mt-0.5">Awaiting courier arrival & parcel handover.</p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowTracking(true)}
                      className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold flex items-center justify-center gap-1.5 transition"
                    >
                      <Truck className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Live Track</span>
                    </button>

                    {shipment.labelUrl && (
                      <a
                        href={shipment.labelUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold flex items-center justify-center gap-1.5 transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Print Label</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">
                  No Delhivery shipment generated for this suborder yet. It will automatically be created when marked Ready to Ship, or you can initiate it now.
                </p>
                <button
                  onClick={handleCreateShipment}
                  disabled={shippingActionLoading}
                  className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition"
                >
                  {shippingActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
                  <span>Create Delhivery Shipment</span>
                </button>
              </div>
            )}
          </div>

          {/* Delivery Address */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-3">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span>Customer Delivery</span>
            </h2>
            {(() => {
              const addr = order.shippingAddress || order.deliveryAddressSnapshot || shipment?.destinationAddressSnapshot;
              if (!addr) {
                return <p className="text-xs text-slate-500">Delivery address on file</p>;
              }
              return (
                <div className="space-y-1 text-sm text-slate-700">
                  <p className="font-bold text-slate-900">{addr.name || addr.fullName || 'Customer'}</p>
                  {addr.phone && <p className="text-slate-500">{addr.phone}</p>}
                  <p className="pt-2 leading-relaxed">{addr.streetAddress || addr.street || addr.addressLine1}</p>
                  {addr.landmark && <p className="text-slate-500 text-xs">Landmark: {addr.landmark}</p>}
                  <p>
                    {addr.city}, {addr.state}
                  </p>
                  <p className="font-medium text-slate-900">
                    PIN: {addr.postalCode || addr.zipCode || addr.zip || addr.pincode}
                  </p>
                </div>
              );
            })()}
          </div>

          {/* Financials */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-3">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Order Financials</span>
            </h2>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Items Subtotal</span>
                <span className="font-bold text-slate-900">₹{order.itemsSubtotal}</span>
              </div>
              <div className="flex justify-between text-rose-600 font-medium">
                <span>Platform Commission</span>
                <span>- ₹{order.platformCommission}</span>
              </div>
              <div className="pt-3 border-t border-slate-100 flex justify-between items-baseline">
                <span className="font-black text-slate-900">Net Merchant Earning</span>
                <span className="font-black text-xl text-emerald-600">₹{order.vendorEarning}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Live Tracking Modal */}
      {showTracking && shipment && (
        <ShipmentTrackingModal
          shipmentId={shipment._id}
          onClose={() => setShowTracking(false)}
        />
      )}
    </motion.div>
  );
};

export default VendorOrderDetail;
