import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import {
  ArrowLeft,
  Package,
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  MapPin,
  FileText,
  RotateCcw,
  Loader2,
  CreditCard,
  Tag,
  ExternalLink,
  X,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ShipmentTrackingModal from '../components/shipping/ShipmentTrackingModal';

const CANCELLATION_REASONS = [
  'Ordered by mistake',
  'Found a better price elsewhere',
  'Estimated delivery time is too long',
  'Incorrect delivery address entered',
  'Changed my mind / Need no longer exists',
  'Other',
];

const RETURN_REASONS = [
  'Damaged product received',
  'Defective / Item not functioning',
  'Incorrect item or size delivered',
  'Missing items or accessories in package',
  'Quality not as expected',
  'Different from website description',
  'Other',
];

export const OrderDetail = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [trackingData, setTrackingData] = useState(null);
  const [shipments, setShipments] = useState([]);
  const [selectedTrackingShipmentId, setSelectedTrackingShipmentId] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cancellation Modal State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState(CANCELLATION_REASONS[0]);
  const [cancelDetailedNotes, setCancelDetailedNotes] = useState('');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  // Return / Replacement Modal State
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [requestType, setRequestType] = useState('RETURN'); // 'RETURN' or 'REPLACEMENT'
  const [eligibilityData, setEligibilityData] = useState(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [returnReason, setReturnReason] = useState(RETURN_REASONS[0]);
  const [returnDetailedNotes, setReturnDetailedNotes] = useState('');
  const [evidenceImages, setEvidenceImages] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [bankDetails, setBankDetails] = useState({
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
    bankName: '',
  });
  const [returnSubmitting, setReturnSubmitting] = useState(false);

  useEffect(() => {
    fetchOrderAndTracking();
  }, [id]);

  const fetchOrderAndTracking = async () => {
    try {
      setLoading(true);
      setError(null);
      const [orderRes, trackingRes, shipmentsRes, invoicesRes] = await Promise.all([
        api.get(`/orders/${id}`),
        api.get(`/fulfillment/orders/${id}/tracking`).catch(() => ({ data: { data: null } })),
        api.get(`/shipping/customer/orders/${id}/shipments`).catch(() => ({ data: { data: { shipments: [] } } })),
        api.get(`/invoices/order/${id}`).catch(() => ({ data: { data: [] } })),
      ]);
      if (orderRes.data?.success) {
        setOrder(orderRes.data.data?.order || orderRes.data.data);
      }
      if (trackingRes.data?.success) {
        setTrackingData(trackingRes.data.data);
      }
      if (shipmentsRes?.data?.success) {
        setShipments(shipmentsRes.data.data?.shipments || []);
      }
      if (invoicesRes?.data?.success) {
        setInvoices(invoicesRes.data.data?.invoices || invoicesRes.data.data || []);
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  // Open Return / Replacement Form & Load dynamic eligibility
  const openReturnModal = async (initialType = 'RETURN') => {
    setRequestType(initialType);
    setShowReturnForm(true);
    setEligibilityLoading(true);
    try {
      const res = await api.get(`/returns/eligibility/${id}`);
      if (res.data?.success) {
        const data = res.data.data;
        setEligibilityData(data);
        // Pre-select first eligible item
        const eligible = data.items?.filter((it) => (initialType === 'RETURN' ? it.canReturn : it.canReplace));
        if (eligible && eligible.length > 0) {
          setSelectedItems([{ productId: eligible[0].productId, quantity: 1, name: eligible[0].name }]);
        } else if (data.items?.length > 0) {
          setSelectedItems([{ productId: data.items[0].productId, quantity: 1, name: data.items[0].name }]);
        }
      }
    } catch (err) {
      console.warn('Failed to load eligibility, falling back to basic items:', err);
      if (order?.items) {
        setSelectedItems(order.items.map((i) => ({ productId: i.productId, quantity: 1, name: i.name })));
      }
    } finally {
      setEligibilityLoading(false);
    }
  };

  // Submit Order Cancellation
  const handleConfirmCancel = async (e) => {
    e.preventDefault();
    setCancelSubmitting(true);
    try {
      await api.post('/returns/request', {
        orderId: id,
        requestType: 'CANCELLATION',
        reason: cancelReason,
        detailedDescription: cancelDetailedNotes,
      });
      alert('Order cancelled successfully! Your refund (if paid) and Fair Coins have been restored.');
      setShowCancelModal(false);
      fetchOrderAndTracking();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel order');
    } finally {
      setCancelSubmitting(false);
    }
  };

  // Submit Return or Replacement Request
  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    if (selectedItems.length === 0) {
      alert('Please select at least one product item to return or replace.');
      return;
    }

    setReturnSubmitting(true);
    try {
      const imagesArray = evidenceImages
        .split('\n')
        .map((url) => url.trim())
        .filter((url) => url.length > 0);

      const payload = {
        orderId: id,
        requestType,
        reason: returnReason,
        detailedDescription: returnDetailedNotes,
        items: selectedItems,
        evidenceImages: imagesArray,
        serialNumber: serialNumber.trim(),
      };

      if (order?.paymentMethod === 'COD' && requestType === 'RETURN') {
        payload.bankDetails = bankDetails;
      }

      await api.post('/returns/request', payload);
      alert(`${requestType === 'REPLACEMENT' ? 'Replacement' : 'Return'} request submitted successfully! You can track progress in "My Returns & Cancellations".`);
      setShowReturnForm(false);
      fetchOrderAndTracking();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit request');
    } finally {
      setReturnSubmitting(false);
    }
  };

  const handleDownloadInvoice = async (targetInvoiceId, invoiceNumber) => {
    try {
      const validTargetId =
        typeof targetInvoiceId === 'string' &&
        targetInvoiceId.trim() &&
        targetInvoiceId !== '[object Object]' &&
        /^[0-9a-fA-F]{24}$/.test(targetInvoiceId.trim())
          ? targetInvoiceId.trim()
          : null;

      let invId = validTargetId;
      if (!invId && Array.isArray(invoices) && invoices.length > 0 && invoices[0]?._id) {
        invId = String(invoices[0]._id);
      }

      // If still no invoice ID in state, fetch directly
      if (!invId && id) {
        try {
          const invRes = await api.get(`/invoices/order/${id}`);
          const list = invRes.data?.data?.invoices || [];
          if (list.length > 0 && list[0]?._id) {
            invId = String(list[0]._id);
            invoiceNumber = invoiceNumber || list[0].invoiceNumber;
          }
        } catch (fetchErr) {
          console.warn('Could not fetch invoice for order:', fetchErr);
        }
      }

      const endpoint = invId ? `/invoices/${invId}/pdf` : `/orders/${id}/invoice`;
      const response = await api.get(endpoint, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const fileUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = fileUrl;
      const safeName = (invoiceNumber || (order ? order.orderNumber : id) || 'Invoice').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `Invoice_${safeName}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(fileUrl);
      a.remove();
      return;
    } catch (err) {
      console.warn('Authenticated blob download fallback:', err);
    }

    const authToken = localStorage.getItem('fk_access_token') || localStorage.getItem('token') || localStorage.getItem('accessToken');
    const validTargetId =
      typeof targetInvoiceId === 'string' &&
      targetInvoiceId.trim() &&
      targetInvoiceId !== '[object Object]' &&
      /^[0-9a-fA-F]{24}$/.test(targetInvoiceId.trim())
        ? targetInvoiceId.trim()
        : null;
    const invId = validTargetId || (invoices && invoices.length > 0 && invoices[0]?._id ? String(invoices[0]._id) : null);
    if (invId) {
      window.open(`http://localhost:5000/api/invoices/${invId}/pdf${authToken ? `?token=${authToken}` : ''}`, '_blank');
      return;
    }
    window.open(`http://localhost:5000/api/orders/${id}/invoice${authToken ? `?token=${authToken}` : ''}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <span className="text-xs font-semibold text-slate-500">Loading order information...</span>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900">Error Loading Order</h2>
        <p className="text-xs text-slate-500">{error || 'Order record not found or inaccessible.'}</p>
        <Link to="/customer/orders" className="inline-flex items-center gap-1.5 text-xs text-blue-600 font-bold hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to My Orders
        </Link>
      </div>
    );
  }

  const isPaid = order.paymentStatus === 'PAID';
  const isCancellable = ['PENDING', 'CONFIRMED', 'PROCESSING'].includes(order.orderStatus);
  const isDelivered = order.orderStatus === 'DELIVERED';
  const isCancelled = order.orderStatus === 'CANCELLED';
  const timeline = trackingData?.timeline || [];

  const lifecycleStages = [
    { label: 'Confirmed', key: 'CONFIRMED' },
    { label: 'Processing', key: 'PROCESSING' },
    { label: 'Packed', key: 'PACKED' },
    { label: 'Shipped', key: 'SHIPPED' },
    { label: 'In Transit', key: 'IN_TRANSIT' },
    { label: 'Out for Delivery', key: 'OUT_FOR_DELIVERY' },
    { label: 'Delivered', key: 'DELIVERED' },
  ];

  const currentStatusIndex = lifecycleStages.findIndex((s) => s.key === order.orderStatus);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Bar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5 gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/customer/orders"
            className="p-2.5 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 shadow-xs transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Order #{order.orderNumber}</h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                  isPaid
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : isCancelled
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                Payment: {order.paymentStatus}
              </span>
              {isCancelled && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300">
                  CANCELLED
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Placed on {new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => handleDownloadInvoice()}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 inline-flex items-center gap-1.5 transition"
          >
            <FileText className="w-4 h-4" />
            <span>Download Invoice</span>
          </button>

          {isCancellable && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition"
            >
              Cancel Order
            </button>
          )}

          {isDelivered && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => openReturnModal('RETURN')}
                className="px-4 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4 text-amber-700" />
                <span>Return Item</span>
              </button>
              <button
                onClick={() => openReturnModal('REPLACEMENT')}
                className="px-4 py-2.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 text-xs font-bold transition inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-4 h-4 text-cyan-700" />
                <span>Replace Item</span>
              </button>
            </div>
          )}

          <Link
            to="/customer/returns"
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs inline-flex items-center gap-1.5 transition"
          >
            <span>My Returns</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Delivery Lifecycle Progress Tracker */}
      {!isCancelled && (
        <div className="bg-white border border-slate-200/80 p-6 rounded-3xl shadow-xs space-y-4">
          <h3 className="font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <Truck className="w-4 h-4 text-blue-600" />
            <span>Delivery Progress & Status</span>
          </h3>

          <div className="overflow-x-auto pb-2">
            <div className="min-w-[650px] flex items-center justify-between relative py-2">
              <div className="absolute top-5 left-6 right-6 h-1 bg-slate-100 z-0 rounded-full" />
              <div
                className="absolute top-5 left-6 h-1 bg-blue-600 z-0 transition-all duration-500 rounded-full"
                style={{
                  width: `${Math.max(0, (currentStatusIndex / (lifecycleStages.length - 1)) * 92)}%`,
                }}
              />

              {lifecycleStages.map((stage, idx) => {
                const isPastOrCurrent = currentStatusIndex >= idx;
                const isCurrent = currentStatusIndex === idx;

                return (
                  <div key={stage.key} className="flex flex-col items-center relative z-10 space-y-2">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs ${
                        isCurrent
                          ? 'bg-blue-600 text-white ring-4 ring-blue-500/20'
                          : isPastOrCurrent
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white text-slate-400 border border-slate-300'
                      }`}
                    >
                      {isPastOrCurrent ? '✓' : idx + 1}
                    </div>
                    <span
                      className={`text-[11px] font-bold text-center ${
                        isCurrent ? 'text-blue-700' : isPastOrCurrent ? 'text-slate-800' : 'text-slate-400'
                      }`}
                    >
                      {stage.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Live Carrier Shipments & Parcel Tracking */}
      {shipments && shipments.length > 0 && (
        <div className="bg-white border border-slate-200/80 p-6 rounded-3xl shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <Truck className="w-4 h-4 text-indigo-600" />
              <span>Shipment & Package Tracking ({shipments.length})</span>
            </h3>
            <span className="text-xs text-slate-500 font-medium">Powered by Delhivery Logistics</span>
          </div>

          <div className="grid gap-3">
            {shipments.map((s, idx) => (
              <div
                key={s._id || idx}
                className="p-4 rounded-2xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100/70 text-indigo-700 flex items-center justify-center shrink-0">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-slate-900">
                        {s.courierName || 'Delhivery Express'}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700">
                        {s.status?.replace(/_/g, ' ') || 'PROCESSING'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                      {s.awbNumber ? (
                        <span>
                          AWB: <strong className="font-mono text-slate-800">{s.awbNumber}</strong>
                        </span>
                      ) : (
                        <span className="text-slate-400">AWB pending courier assignment</span>
                      )}
                      {s.estimatedDeliveryDate && (
                        <span>
                          Est. Delivery:{' '}
                          <strong className="text-slate-700">
                            {new Date(s.estimatedDeliveryDate).toLocaleDateString('en-IN', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => setSelectedTrackingShipmentId(s._id)}
                    className="flex-1 sm:flex-none px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs shadow-indigo-500/20 inline-flex items-center justify-center gap-1.5 transition"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>Track Live</span>
                  </button>
                  {s.awbNumber && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(s.awbNumber);
                        alert(`Copied AWB: ${s.awbNumber}`);
                      }}
                      className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-xs transition"
                      title="Copy AWB Number"
                    >
                      Copy AWB
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Order Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Items */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-4">
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-3">
              <Package className="w-4 h-4 text-blue-600" />
              <span>Purchased Products ({order.items?.length || 0})</span>
            </h3>

            <div className="divide-y divide-slate-100">
              {order.items?.map((item, idx) => (
                <div key={idx} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-12 h-12 object-cover rounded-xl border border-slate-100" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                        <Package className="w-6 h-6" />
                      </div>
                    )}
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">{item.name}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Qty: {item.quantity} • Unit: ₹{(item.price || item.unitPrice || 0).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-sm text-slate-900">
                      ₹{((item.price || item.unitPrice || 0) * item.quantity).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Pricing & Addresses */}
        <div className="space-y-6">
          {/* Order Summary */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-3xl shadow-xs space-y-3">
            <h3 className="font-extrabold text-sm text-slate-900 border-b border-slate-100 pb-3">Payment Summary</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Items Subtotal:</span>
                <span className="font-bold text-slate-800">₹{(order.subtotal || order.total || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Shipping Charges:</span>
                <span className="font-bold text-emerald-600">
                  {(() => {
                    const fee = Number(order.shippingFee ?? order.shippingTotal ?? order.shippingCost ?? 0);
                    return (!fee || fee === 0) ? 'FREE' : `₹${fee.toLocaleString('en-IN')}`;
                  })()}
                </span>
              </div>
              {order.fairCoinsUsed > 0 && (
                <div className="flex justify-between text-amber-600 font-bold">
                  <span>Fair Coins Redeemed:</span>
                  <span>-{order.fairCoinsUsed} Coins (₹{(order.fairCoinsUsed / 10).toFixed(2)})</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black text-slate-900 border-t border-slate-100 pt-3">
                <span>Grand Total:</span>
                <span>₹{(order.total || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Shipping Address */}
          {order.shippingAddress && (
            <div className="bg-white border border-slate-200/80 p-6 rounded-3xl shadow-xs space-y-2">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-3">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span>Delivery Address</span>
              </h3>
              <p className="font-bold text-xs text-slate-800">{order.shippingAddress.name || order.shippingAddress.fullName}</p>
              <p className="text-xs text-slate-600">
                {order.shippingAddress.street || order.shippingAddress.addressLine1},{' '}
                {order.shippingAddress.city}, {order.shippingAddress.state}
                {(order.shippingAddress.postalCode || order.shippingAddress.zip || order.shippingAddress.pincode)
                  ? ` - ${order.shippingAddress.postalCode || order.shippingAddress.zip || order.shippingAddress.pincode}`
                  : ''}
              </p>
              <p className="text-xs text-slate-500 font-medium">Phone: {order.shippingAddress.phone}</p>
            </div>
          )}
        </div>
      </div>

      {/* CANCELLATION MODAL */}
      <AnimatePresence>
        {showCancelModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-slate-200 p-6 rounded-3xl w-full max-w-md space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-black text-lg text-slate-900">Cancel Order #{order.orderNumber}</h3>
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleConfirmCancel} className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Reason for Cancellation</label>
                  <select
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="w-full bg-slate-50 text-xs text-slate-800 rounded-xl px-3.5 py-2.5 border border-slate-200 font-semibold focus:outline-hidden"
                  >
                    {CANCELLATION_REASONS.map((r, i) => (
                      <option key={i} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Detailed Explanation (Optional)</label>
                  <textarea
                    placeholder="Provide additional details regarding your cancellation..."
                    value={cancelDetailedNotes}
                    onChange={(e) => setCancelDetailedNotes(e.target.value)}
                    className="w-full bg-slate-50 text-xs text-slate-800 rounded-xl px-3.5 py-2.5 border border-slate-200 focus:outline-hidden h-20"
                  />
                </div>

                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200/80 text-[11px] text-amber-800">
                  <p className="font-bold">Important Notice:</p>
                  <p>
                    {isPaid
                      ? 'Cancelling will immediately restore any Fair Coins used and initiate a full automated refund of ₹' +
                        order.total.toLocaleString('en-IN') +
                        ' to your original payment method.'
                      : 'Cancelling will release your order and restore any Fair Coins reserved.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCancelModal(false)}
                    className="py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                  >
                    Keep Order
                  </button>
                  <button
                    type="submit"
                    disabled={cancelSubmitting}
                    className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-500/20 transition-all"
                  >
                    {cancelSubmitting ? 'Cancelling...' : 'Confirm Cancellation'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* RETURN & REPLACEMENT MODAL */}
      <AnimatePresence>
        {showReturnForm && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-slate-200 p-6 rounded-3xl w-full max-w-lg space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-black text-base text-slate-900">
                    {requestType === 'REPLACEMENT' ? 'Request Product Replacement' : 'Submit Return & Refund Request'}
                  </h3>
                  <p className="text-[11px] text-slate-400">Order #{order.orderNumber}</p>
                </div>
                <button
                  onClick={() => setShowReturnForm(false)}
                  className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Action Switcher: Return vs Replacement */}
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setRequestType('RETURN')}
                  className={`py-2 rounded-xl transition ${
                    requestType === 'RETURN' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Return for Refund
                </button>
                <button
                  type="button"
                  onClick={() => setRequestType('REPLACEMENT')}
                  className={`py-2 rounded-xl transition ${
                    requestType === 'REPLACEMENT' ? 'bg-white text-cyan-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Product Replacement
                </button>
              </div>

              {eligibilityLoading ? (
                <div className="py-8 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                  <p className="text-xs font-semibold">Checking return policy eligibility...</p>
                </div>
              ) : (
                <form onSubmit={handleReturnSubmit} className="space-y-4 text-xs">
                  {/* Item Selection */}
                  <div className="space-y-2">
                    <span className="font-bold text-slate-700 block">Select Items to {requestType === 'REPLACEMENT' ? 'Replace' : 'Return'}:</span>
                    {eligibilityData?.items?.map((it, idx) => {
                      const isEligible = requestType === 'RETURN' ? it.canReturn : it.canReplace;
                      const isSelected = selectedItems.some((si) => si.productId === it.productId);

                      return (
                        <div
                          key={idx}
                          className={`p-3 rounded-2xl border transition ${
                            isSelected ? 'bg-blue-50/40 border-blue-300' : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <label className="flex items-start gap-2.5 cursor-pointer">
                              <input
                                type="checkbox"
                                disabled={!isEligible}
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedItems([...selectedItems, { productId: it.productId, quantity: 1, name: it.name }]);
                                  } else {
                                    setSelectedItems(selectedItems.filter((si) => si.productId !== it.productId));
                                  }
                                }}
                                className="mt-0.5 rounded text-blue-600"
                              />
                              <div>
                                <p className="font-bold text-slate-900">{it.name}</p>
                                <p className="text-[11px] text-slate-500">Unit: ₹{it.unitPrice?.toLocaleString('en-IN')}</p>
                                {isEligible ? (
                                  <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">
                                    ✓ Eligible ({requestType === 'RETURN' ? it.returnDaysLeft : it.replacementDaysLeft} days remaining)
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-rose-600 font-bold block mt-0.5">
                                    ✗ {it.ineligibilityReason || 'Policy window expired or item non-returnable'}
                                  </span>
                                )}
                              </div>
                            </label>

                            {isSelected && (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[11px] text-slate-500">Qty:</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={it.quantity}
                                  value={selectedItems.find((si) => si.productId === it.productId)?.quantity || 1}
                                  onChange={(e) => {
                                    const val = Math.min(it.quantity, Math.max(1, parseInt(e.target.value) || 1));
                                    setSelectedItems(
                                      selectedItems.map((si) => (si.productId === it.productId ? { ...si, quantity: val } : si))
                                    );
                                  }}
                                  className="w-12 bg-white border border-slate-300 text-center rounded-lg text-xs py-1 font-bold"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Reason Dropdown */}
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Reason for {requestType}</label>
                    <select
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      className="w-full bg-slate-50 text-xs text-slate-800 rounded-xl px-3.5 py-2.5 border border-slate-200 font-semibold focus:outline-hidden"
                    >
                      {RETURN_REASONS.map((r, i) => (
                        <option key={i} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Detailed Description */}
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Detailed Description of Issue</label>
                    <textarea
                      required
                      placeholder="Explain the specific issue with the product (condition, defects, packaging)..."
                      value={returnDetailedNotes}
                      onChange={(e) => setReturnDetailedNotes(e.target.value)}
                      className="w-full bg-slate-50 text-xs text-slate-800 rounded-xl px-3.5 py-2.5 border border-slate-200 focus:outline-hidden h-20"
                    />
                  </div>

                  {/* Serial Number (if applicable) */}
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Serial Number / IMEI (If applicable)</label>
                    <input
                      type="text"
                      placeholder="Enter device serial number / IMEI from box"
                      value={serialNumber}
                      onChange={(e) => setSerialNumber(e.target.value)}
                      className="w-full bg-slate-50 text-xs text-slate-800 rounded-xl px-3.5 py-2 border border-slate-200"
                    />
                  </div>

                  {/* Evidence Images */}
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Evidence Photos (Image URLs, one per line)</label>
                    <textarea
                      placeholder="https://example.com/photo1.jpg"
                      value={evidenceImages}
                      onChange={(e) => setEvidenceImages(e.target.value)}
                      className="w-full bg-slate-50 text-xs text-slate-800 rounded-xl px-3.5 py-2 border border-slate-200 h-16 font-mono text-[11px]"
                    />
                  </div>

                  {/* COD Bank Details (if COD Order and Return) */}
                  {order.paymentMethod === 'COD' && requestType === 'RETURN' && (
                    <div className="p-3.5 bg-blue-50/50 rounded-2xl border border-blue-200 space-y-2">
                      <p className="font-bold text-blue-900">Bank Details for Direct Refund (COD Order)</p>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <input
                          type="text"
                          placeholder="Account Holder Name"
                          value={bankDetails.accountHolderName}
                          onChange={(e) => setBankDetails({ ...bankDetails, accountHolderName: e.target.value })}
                          className="bg-white border border-slate-200 rounded-lg p-2"
                          required
                        />
                        <input
                          type="text"
                          placeholder="Account Number"
                          value={bankDetails.accountNumber}
                          onChange={(e) => setBankDetails({ ...bankDetails, accountNumber: e.target.value })}
                          className="bg-white border border-slate-200 rounded-lg p-2"
                          required
                        />
                        <input
                          type="text"
                          placeholder="IFSC Code"
                          value={bankDetails.ifscCode}
                          onChange={(e) => setBankDetails({ ...bankDetails, ifscCode: e.target.value })}
                          className="bg-white border border-slate-200 rounded-lg p-2 uppercase"
                          required
                        />
                        <input
                          type="text"
                          placeholder="Bank Name"
                          value={bankDetails.bankName}
                          onChange={(e) => setBankDetails({ ...bankDetails, bankName: e.target.value })}
                          className="bg-white border border-slate-200 rounded-lg p-2"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2.5 pt-2 border-t">
                    <button
                      type="button"
                      onClick={() => setShowReturnForm(false)}
                      className="py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={returnSubmitting || selectedItems.length === 0}
                      className="py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all"
                    >
                      {returnSubmitting ? 'Submitting...' : `Submit ${requestType}`}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delhivery Live Tracking Modal */}
      {selectedTrackingShipmentId && (
        <ShipmentTrackingModal
          shipmentId={selectedTrackingShipmentId}
          onClose={() => setSelectedTrackingShipmentId(null)}
        />
      )}
    </div>
  );
};

export default OrderDetail;
