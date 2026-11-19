/**
 * Shipment model — Delhivery Logistics Integration
 */

import mongoose from 'mongoose';

const shipmentSchema = new mongoose.Schema(
  {
    // ── Core Relations ────────────────────────────────────────────────────────
    suborderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VendorOrder',
      required: true,
      index: true,
      unique: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      index: true,
    },
    parentOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true,
    },

    // ── Courier Info ──────────────────────────────────────────────────────────
    courierProvider: { type: String, default: 'DELHIVERY' },
    courierService: { type: String, default: 'Delhivery Surface Express' },
    courierCompanyId: { type: Number, default: 101 },  // Delhivery Courier Company ID
    courierName: { type: String, default: 'Delhivery Express' }, // Courier Partner Name
    courierOrderId: { type: String, default: '' },      // Order reference sent to Delhivery

    // ── Delhivery & Logistics References ──────────────────────────────────────
    delhiveryWaybill: { type: String, default: '', index: true },
    shiprocketOrderId: { type: mongoose.Schema.Types.Mixed, default: null }, // Compatibility
    shiprocketShipmentId: { type: mongoose.Schema.Types.Mixed, default: null },

    // ── AWB & Tracking ────────────────────────────────────────────────────────
    awbNumber: { type: String, default: '', index: true },
    trackingUrl: { type: String, default: '' },
    labelUrl: { type: String, default: '' },
    manifestUrl: { type: String, default: '' },

    // ── Address Snapshots ─────────────────────────────────────────────────────
    originAddressSnapshot: { type: Object, required: true },
    destinationAddressSnapshot: { type: Object, required: true },
    pickupLocationName: { type: String, default: '' },

    // ── Package Dimensions ────────────────────────────────────────────────────
    packageWeight: { type: Number, required: true },   // kg
    length: { type: Number, required: true },           // cm
    width: { type: Number, required: true },            // cm (breadth)
    height: { type: Number, required: true },           // cm
    packageCount: { type: Number, default: 1 },

    // ── Financial ─────────────────────────────────────────────────────────────
    shippingCharge: { type: Number, default: 0 },
    codAmount: { type: Number, default: 0 },
    isCOD: { type: Boolean, default: false },

    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: [
        'DRAFT',
        'READY',
        'ORDER_CREATED',
        'CREATED',              // Shipment created in Delhivery
        'AWB_ASSIGNED',         // Waybill number assigned
        'PICKUP_REQUESTED',
        'PICKUP_SCHEDULED',
        'PICKUP_FAILED',
        'PICKED_UP',
        'SHIPPED',
        'IN_TRANSIT',
        'REACHED_DESTINATION_HUB',
        'OUT_FOR_DELIVERY',
        'DELIVERY_ATTEMPTED',
        'NDR',                  // Non-Delivery Report
        'DELIVERED',
        'DELIVERY_FAILED',
        'RETURN_INITIATED',
        'RTO_INITIATED',
        'RETURN_IN_TRANSIT',
        'RTO_IN_TRANSIT',
        'RETURNED',
        'RTO_DELIVERED',
        'CANCELLED',
      ],
      default: 'DRAFT',
      index: true,
    },

    // ── Idempotency ────────────────────────────────────────────────────────────
    creationAttempts: { type: Number, default: 0 },
    shiprocketCreationAttempts: { type: Number, default: 0 },
    lastCreationAttemptAt: { type: Date, default: null },

    // ── Timestamps ────────────────────────────────────────────────────────────
    pickupScheduledAt: { type: Date, default: null },
    pickedUpAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    estimatedDeliveryDate: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancellationReason: { type: String, default: '' },

    // ── Return Shipment Reference ─────────────────────────────────────────────
    returnShipmentId: { type: String, default: null },
    returnAwbNumber: { type: String, default: '' },
  },
  { timestamps: true }
);

export const Shipment = mongoose.model('Shipment', shipmentSchema);
export default Shipment;
