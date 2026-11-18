import fs from 'fs';

let code = fs.readFileSync('src/pages/VendorOrderDetail.jsx', 'utf8');

// 1. Update Fulfillment Action
const targetAction = `{['READY_TO_SHIP', 'SHIPPED', 'DELIVERED'].includes(order.status) && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
                  <CheckCircle className="w-6 h-6 text-emerald-600 mx-auto mb-1.5" />
                  <p className="text-sm font-bold text-emerald-800">Handled by Courier</p>
                  <p className="text-xs text-emerald-600 mt-0.5">Logistics partner has taken over this fulfillment.</p>
                </div>
              )}`;

const replacementAction = `{['READY_TO_SHIP', 'PICKUP_SCHEDULED'].includes(order.status) && (
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
              {order.status === 'SHIPPED' && (
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
              )}`;

if (code.includes('Handled by Courier')) {
  // Normalize CRLF to LF for search
  const normalized = code.replace(/\r\n/g, '\n');
  const normalizedTarget = targetAction.replace(/\r\n/g, '\n');
  if (normalized.includes(normalizedTarget)) {
    code = normalized.replace(normalizedTarget, replacementAction);
  }
}

// 2. Update Courier & AWB
const oldCourier = `<p className="font-bold text-slate-900 mt-0.5">{shipment.courierPartnerName || shipment.courierCompanyId || 'Auto Assigned'}</p>`;
const newCourier = `<p className="font-bold text-slate-900 mt-0.5">{shipment.courierName || shipment.courierPartnerName || (shipment.courierCompanyId ? \`Courier #\${shipment.courierCompanyId}\` : 'Delhivery Surface')}</p>`;
code = code.replace(oldCourier, newCourier);

// 3. Update Delivery Address card
const oldDeliveryCard = `<div className="space-y-1 text-sm text-slate-700">
              <p className="font-bold text-slate-900">{order.shippingAddress?.fullName}</p>
              <p className="text-slate-500">{order.shippingAddress?.phone}</p>
              <p className="pt-2 leading-relaxed">{order.shippingAddress?.streetAddress}</p>
              {order.shippingAddress?.landmark && <p className="text-slate-500">Landmark: {order.shippingAddress?.landmark}</p>}
              <p>
                {order.shippingAddress?.city}, {order.shippingAddress?.state}
              </p>
              <p className="font-medium text-slate-900">PIN: {order.shippingAddress?.zipCode}</p>
            </div>`;

const newDeliveryCard = `{(() => {
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
            })()}`;

const normCode = code.replace(/\r\n/g, '\n');
const normOldDelivery = oldDeliveryCard.replace(/\r\n/g, '\n');
if (normCode.includes(normOldDelivery)) {
  code = normCode.replace(normOldDelivery, newDeliveryCard);
}

fs.writeFileSync('src/pages/VendorOrderDetail.jsx', code, 'utf8');
console.log('VendorOrderDetail.jsx successfully updated!');

