import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  X, Truck, MapPin, CheckCircle2, Clock, AlertCircle, Loader2,
  ExternalLink, Calendar, Package, ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const ShipmentTrackingModal = ({ shipmentId, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (shipmentId) {
      fetchTracking();
    }
  }, [shipmentId]);

  const fetchTracking = async () => {
    try {
      setLoading(true);
      setError(null);
      const isVendorRoute = window.location.pathname.includes('/vendor');
      const primaryUrl = isVendorRoute
        ? `/shipping/vendor/shipments/${shipmentId}/tracking`
        : `/shipping/customer/shipments/${shipmentId}/tracking`;

      const res = await api.get(primaryUrl).catch(async () => {
        const fallbackUrl = isVendorRoute
          ? `/shipping/customer/shipments/${shipmentId}/tracking`
          : `/shipping/vendor/shipments/${shipmentId}/tracking`;
        return await api.get(fallbackUrl);
      });
      if (res.data?.success) {
        setData(res.data.data);
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to fetch tracking details');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'DELIVERED':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'OUT_FOR_DELIVERY':
      case 'IN_TRANSIT':
      case 'PICKED_UP':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'CANCELLED':
      case 'RTO_DELIVERED':
      case 'RTO_INITIATED':
        return 'text-rose-700 bg-rose-50 border-rose-200';
      default:
        return 'text-amber-700 bg-amber-50 border-amber-200';
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Live Shipment Tracking</h3>
                <p className="text-xs text-slate-500 mt-0.5">Real-time status via Delhivery Logistics</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            {loading ? (
              <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <p className="text-sm font-semibold">Contacting Delhivery tracking servers...</p>
              </div>
            ) : error ? (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <div>
                  <p className="font-bold">Tracking unavailable</p>
                  <p className="text-xs mt-0.5 text-rose-600">{error}</p>
                </div>
              </div>
            ) : data ? (
              <>
                {/* Status Card */}
                <div className="p-5 rounded-2xl border border-slate-200/80 bg-linear-to-br from-slate-50 to-white space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-black border uppercase tracking-wider ${getStatusColor(data.shipment?.status)}`}>
                      {data.shipment?.status?.replace(/_/g, ' ') || 'PROCESSING'}
                    </span>
                    {data.shipment?.estimatedDeliveryDate && (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                        <Calendar className="w-3.5 h-3.5 text-blue-600" />
                        <span>Est. Delivery: {new Date(data.shipment.estimatedDeliveryDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-slate-400 font-semibold uppercase tracking-wider block">Courier</span>
                      <span className="font-bold text-slate-900 mt-0.5 block">{data.shipment?.courierName || data.shipment?.courierPartnerName || (data.shipment?.courierCompanyId ? `Courier #${data.shipment.courierCompanyId}` : 'Delhivery Surface')}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold uppercase tracking-wider block">AWB Number</span>
                      <span className="font-mono font-bold text-blue-600 mt-0.5 block">{data.shipment?.awbNumber || 'Not assigned yet'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold uppercase tracking-wider block">Tracking Mode</span>
                      <span className="font-bold text-emerald-600 mt-0.5 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        In-App Timeline
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Live milestones tracked below</span>
                    </div>
                  </div>
                </div>

                {/* Tracking Timeline */}
                <div>
                  <h4 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span>Shipment Timeline</span>
                  </h4>

                  {data.trackingEvents && data.trackingEvents.length > 0 ? (
                    <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                      {data.trackingEvents.map((evt, idx) => (
                        <div key={idx} className="relative">
                          <div className={`absolute -left-6 top-1 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center ${
                            idx === 0 ? 'border-blue-600 ring-4 ring-blue-100' : 'border-slate-300'
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${idx === 0 ? 'bg-blue-600' : 'bg-slate-300'}`} />
                          </div>
                          <div>
                            <div className="flex items-baseline justify-between gap-2">
                              <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                                {evt.status?.replace(/_/g, ' ') || evt.activity}
                              </h5>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {new Date(evt.eventTime || evt.createdAt).toLocaleString(undefined, {
                                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                })}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mt-0.5">{evt.activity || evt.details}</p>
                            {evt.location && (
                              <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3 text-slate-400" /> {evt.location}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100">
                      <Package className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-700">Shipment is being prepared</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Detailed tracking milestones will appear here as soon as the package is scanned by the courier.
                      </p>
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ShipmentTrackingModal;

