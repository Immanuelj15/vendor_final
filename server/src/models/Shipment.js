/**
 * Shipment model — Extended for Shiprocket Integration
 *
 * Adds full Shiprocket tracking fields to the existing Shipment schema.
 * All existing fields are preserved.
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
    courierProvider: { type: String, default: 'SHIPROCKET' },
    courierService: { type: String, default: '' },
    courierCompanyId: { type: Number, default: null },  // Shiprocket courier_company_id
    courierName: { type: String, default: '' },         // Actual courier name (e.g., Delhivery)
    courierOrderId: { type: String, default: '' },      // Our order_id sent to Shiprocket

    // ── Shiprocket References ─────────────────────────────────────────────────
    shiprocketOrderId: { type: Number, default: null },    // SR's internal order ID
    shiprocketShipmentId: { type: Number, default: null }, // SR's shipment ID

    // ── AWB & Tracking ────────────────────────────────────────────────────────
    awbNumber: { type: String, default: '' },
    trackingUrl: { type: String, default: '' },
    labelUrl: { type: String, default: '' },
    manifestUrl: { type: String, default: '' },

    // ── Address Snapshots ─────────────────────────────────────────────────────
    originAddressSnapshot: { type: Object, required: true },
    destinationAddressSnapshot: { type: Object, required: true },
    pickupLocationName: { type: String, default: '' },  // Shiprocket pickup location name

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
        'CREATED',              // Order created in Shiprocket
        'AWB_ASSIGNED',         // AWB number assigned
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
    returnShipmentId: { type: String, default: null },   // Shiprocket return order ID
    returnAwbNumber: { type: String, default: '' },
  },
  { timestamps: true }
);

// Compound index to prevent duplicate AWB assignments
shipmentSchema.index({ awbNumber: 1 }, { sparse: true });
shipmentSchema.index({ shiprocketOrderId: 1 }, { sparse: true });

export const Shipment = mongoose.model('Shipment', shipmentSchema);
export default Shipment;
